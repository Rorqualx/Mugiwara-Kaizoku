/**
 * Annotation Router - CRUD Procedures
 */

import { Prisma } from '@prisma/client';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { prisma } from '@/server/db';
import { adminProcedure } from '@/server/trpc/procedures';
import { logger } from '@/utils/logger';


import {
  buildStatusMap,
  buildSourceMap,
  aggregateEntityCounts,
  calculateEntityCountsFromLabels,
  getBootstrapLabels,
  fetchHtmlWithFlareSolverr,
  detectSourceType,
  loadTrainingDataMap,
} from './helpers';
import { cleanHtmlForReprocess, createPreviousVersionBackup } from './reprocess-helpers';
import {
  getPagesInputSchema,
  createPageInputSchema,
  updateLabelsInputSchema,
  updateStatusInputSchema,
  updateMangaTitleInputSchema,
  reprocessInputSchema,
} from './schemas';

import type { AnnotationStats, PageListItem } from './types';
import type { AnnotatedPage, AnnotationStatus } from '@prisma/client';

export const getStats = adminProcedure.query(async (): Promise<AnnotationStats> => {
  // Use efficient database aggregations instead of loading all data into memory
  const [totalPages, statusCounts, sourceCounts, tokenCountResult, entityStats] = await Promise.all([
    prisma.annotatedPage.count(),
    prisma.annotatedPage.groupBy({
      by: ['status'],
      _count: { id: true },
    }),
    prisma.annotatedPage.groupBy({
      by: ['sourceType'],
      _count: { id: true },
    }),
    // Use raw SQL to aggregate token counts in database (avoids loading all tokens into memory)
    prisma.$queryRaw<Array<{ total: bigint | null }>>`
      SELECT COALESCE(SUM(json_array_length(tokens::json)), 0)::bigint as total
      FROM "AnnotatedPage"
    `,
    // Only fetch entityCounts (small JSON objects), not tokens
    prisma.annotatedPage.findMany({
      select: { entityCounts: true },
      where: { NOT: { entityCounts: { equals: Prisma.JsonNull } } },
    }),
  ]);

  const statusMap = buildStatusMap(statusCounts);
  const sourceMap = buildSourceMap(sourceCounts);
  // Extract total from query result (array may be empty, total may be null)
  const firstRow = tokenCountResult[0] as { total: bigint | null } | undefined;
  const totalTokens = Number(firstRow?.total ?? 0n);
  const entityCounts = aggregateEntityCounts(entityStats);

  return {
    totalPages,
    bootstrapPages: statusMap.BOOTSTRAP,
    agentReviewedPages: statusMap.AGENT_REVIEWED,
    reviewedPages: statusMap.REVIEWED,
    goldPages: statusMap.GOLD,
    inProgressPages: statusMap.IN_PROGRESS,
    rejectedPages: statusMap.REJECTED,
    bySource: sourceMap,
    totalTokens,
    entityCounts,
  };
});

export const getPages = adminProcedure
  .input(getPagesInputSchema)
  .query(async ({ input }): Promise<{ pages: PageListItem[]; nextCursor: string | null; total: number }> => {
    const { limit, offset, cursor, search, sourceType, status, sortBy, sortOrder } = input;

    const where = {
      ...(search && {
        OR: [
          { url: { contains: search, mode: 'insensitive' as const } },
          { mangaTitle: { contains: search, mode: 'insensitive' as const } },
        ],
      }),
      ...(sourceType && { sourceType }),
      ...(status && { status }),
    };

    // Get total count for pagination
    const total = await prisma.annotatedPage.count({ where });

    const findOptions = {
      where,
      take: limit + 1,
      skip: cursor ? 1 : offset, // Skip 1 when using cursor, otherwise use offset
      orderBy: { [sortBy]: sortOrder },
      select: {
        id: true,
        url: true,
        mangaTitle: true,
        sourceType: true,
        status: true,
        // Don't select tokens - it's too large and causes Prisma Rust-to-JS conversion errors
        // We'll calculate token counts separately using a raw SQL query
        createdAt: true,
        updatedAt: true,
      },
    };

    const pages = cursor
      ? await prisma.annotatedPage.findMany({ ...findOptions, cursor: { id: cursor } })
      : await prisma.annotatedPage.findMany(findOptions);

    let nextCursor: string | null = null;
    if (pages.length > limit) {
      const nextItem = pages.pop();
      nextCursor = nextItem?.id ?? null;
    }

    // Get token counts for these pages using raw SQL (avoids loading large token arrays)
    const pageIds = pages.map(p => p.id);
    let tokenCountMap: Map<string, number> = new Map();
    if (pageIds.length > 0) {
      const tokenCounts = await prisma.$queryRaw<Array<{ id: string; count: number }>>`
        SELECT id, COALESCE(json_array_length(tokens::json), 0)::integer as count
        FROM "AnnotatedPage"
        WHERE id = ANY(${pageIds}::text[])
      `;
      tokenCountMap = new Map(tokenCounts.map(tc => [tc.id, tc.count]));
    }

    // Load training data and create a lookup map by normalized title
    const trainingDataMap = loadTrainingDataMap();

    return {
      pages: pages.map((page) => {
        // Look up training data by mangaTitle
        const trainingMatch = page.mangaTitle
          ? trainingDataMap.get(page.mangaTitle.toLowerCase())
          : undefined;

        return {
          id: page.id,
          url: page.url,
          mangaTitle: page.mangaTitle,
          sourceType: page.sourceType,
          status: page.status,
          tokenCount: tokenCountMap.get(page.id) ?? 0,
          createdAt: page.createdAt,
          updatedAt: page.updatedAt,
          // Training data fields
          comicVineId: trainingMatch?.comicVineId ?? null,
          fandomBaseUrl: trainingMatch?.fandomUrl ?? null,
          wikipediaBaseUrl: trainingMatch?.wikipediaUrl ?? null,
          fandomDiscoveredUrls: trainingMatch?.fandomDiscoveredUrls ?? [],
          wikipediaDiscoveredUrls: trainingMatch?.wikipediaDiscoveredUrls ?? [],
          comicVineDiscoveredUrls: trainingMatch?.comicVineDiscoveredUrls ?? [],
        };
      }),
      nextCursor,
      total,
    };
  });

export const getById = adminProcedure
  .input(z.object({ id: z.string() }))
  .query(async ({ input }) => {
    const page = await prisma.annotatedPage.findUnique({
      where: { id: input.id },
      include: { annotator: { select: { id: true, name: true } } },
    });

    if (!page) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Annotated page not found',
      });
    }

    return page;
  });

/** Find an annotation page by URL - returns page ID if exists, null if not */
export const findByUrl = adminProcedure
  .input(z.object({ url: z.string().url() }))
  .query(async ({ input }): Promise<{ id: string; status: string } | null> => {
    const page = await prisma.annotatedPage.findUnique({
      where: { url: input.url },
      select: { id: true, status: true },
    });

    return page;
  });

export const create = adminProcedure
  .input(createPageInputSchema)
  .mutation(async ({ input, ctx }) => {
    const entityCounts = calculateEntityCountsFromLabels(input.labels);

    // Use atomic create with race condition handling
    // Instead of check-then-create, we create directly and catch unique constraint errors
    try {
      const page = await prisma.annotatedPage.create({
        data: {
          url: input.url,
          mangaTitle: input.mangaTitle ?? null,
          sourceType: input.sourceType,
          htmlSnapshot: input.htmlSnapshot,
          tokens: input.tokens,
          labels: input.labels,
          entityCounts,
          notes: input.notes ?? null,
          annotatorId: 'user' in ctx ? (ctx.user as { id?: string } | undefined)?.id ?? null : null,
          status: 'BOOTSTRAP',
        },
      });

      logger.info('Created annotated page', {
        pageId: page.id,
        url: input.url,
        sourceType: input.sourceType,
        tokenCount: input.tokens.length,
      });

      return page;
    } catch (error) {
      // Handle race condition: unique constraint violation means URL already exists
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'A page with this URL already exists',
        });
      }
      throw error;
    }
  });

export const updateLabels = adminProcedure
  .input(updateLabelsInputSchema)
  .mutation(async ({ input, ctx }) => {
    const entityCounts = input.entityCounts ?? calculateEntityCountsFromLabels(input.labels);
    const userId = 'user' in ctx ? (ctx.user as { id?: string } | undefined)?.id : null;

    // Use transaction for atomic check-and-update with optimistic locking
    const updated = await prisma.$transaction(async (tx) => {
      const page = await tx.annotatedPage.findUnique({
        where: { id: input.id },
        select: { id: true, version: true, status: true },
      });

      if (!page) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Annotated page not found',
        });
      }

      // Optimistic locking: check version if provided
      if (input.version !== undefined && page.version !== input.version) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'Page was modified by another user. Please refresh and try again.',
        });
      }

      return tx.annotatedPage.update({
        where: { id: input.id },
        data: {
          labels: input.labels,
          entityCounts,
          // Store selections as source of truth for annotations
          ...(input.selections !== undefined && { selections: input.selections }),
          ...(input.urlAnnotations !== undefined && { urlAnnotations: input.urlAnnotations }),
          ...(userId && { annotatorId: userId }),
          status: page.status === 'BOOTSTRAP' ? 'IN_PROGRESS' : page.status,
          version: { increment: 1 }, // Increment version on each update
        },
      });
    });

    logger.info('Updated annotated page labels', {
      pageId: input.id,
      labelCount: input.labels.length,
      selectionCount: input.selections?.length ?? 0,
      newVersion: updated.version,
    });

    return updated;
  });

export const updateStatus = adminProcedure
  .input(updateStatusInputSchema)
  .mutation(async ({ input }) => {
    // Use transaction for atomic check-and-update with optimistic locking
    const updated = await prisma.$transaction(async (tx) => {
      const page = await tx.annotatedPage.findUnique({
        where: { id: input.id },
        select: { id: true, version: true, status: true },
      });

      if (!page) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Annotated page not found',
        });
      }

      // Optimistic locking: check version if provided
      if (input.version !== undefined && page.version !== input.version) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'Page was modified by another user. Please refresh and try again.',
        });
      }

      const updateData: { status: AnnotationStatus; reviewedAt?: Date; version: { increment: number } } = {
        status: input.status,
        version: { increment: 1 },
      };

      if (input.status === 'REVIEWED' || input.status === 'GOLD') {
        updateData.reviewedAt = new Date();
      }

      return tx.annotatedPage.update({
        where: { id: input.id },
        data: updateData,
      });
    });

    logger.info('Updated annotated page status', {
      pageId: input.id,
      newStatus: input.status,
      newVersion: updated.version,
    });

    return updated;
  });

export const updateMangaTitle = adminProcedure
  .input(updateMangaTitleInputSchema)
  .mutation(async ({ input }) => {
    const page = await prisma.annotatedPage.findUnique({
      where: { id: input.id },
      select: { id: true },
    });

    if (!page) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Annotated page not found',
      });
    }

    const updated = await prisma.annotatedPage.update({
      where: { id: input.id },
      data: { mangaTitle: input.mangaTitle },
    });

    logger.info('Updated annotated page manga title', {
      pageId: input.id,
      mangaTitle: input.mangaTitle,
    });

    return updated;
  });

export const deletePage = adminProcedure
  .input(z.object({ id: z.string() }))
  .mutation(async ({ input }) => {
    // Use transaction for atomic check-and-delete to prevent TOCTOU race condition
    const deletedUrl = await prisma.$transaction(async (tx) => {
      const page = await tx.annotatedPage.findUnique({
        where: { id: input.id },
        select: { id: true, url: true },
      });

      if (!page) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Annotated page not found',
        });
      }

      await tx.annotatedPage.delete({
        where: { id: input.id },
      });

      return page.url;
    });

    logger.info('Deleted annotated page', { pageId: input.id, url: deletedUrl });

    return { success: true };
  });

export const reprocess = adminProcedure
  .input(reprocessInputSchema)
  // eslint-disable-next-line max-lines-per-function -- Procedural mutation with clear steps: fetch, validate, process, transact, log. Splitting would hurt readability.
  .mutation(async ({ input }) => {
    // Step 1: Read page and get version (outside transaction for long-running processing)
    const page = await prisma.annotatedPage.findUnique({
      where: { id: input.id },
    });

    if (!page) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Annotated page not found',
      });
    }

    const initialVersion = page.version;
    let htmlSnapshot = page.htmlSnapshot;

    // Optionally refetch HTML using FlareSolverr
    if (input.refetch) {
      logger.info('Refetching HTML with FlareSolverr', { pageId: input.id, url: page.url });
      const fetchResult = await fetchHtmlWithFlareSolverr(page.url, page.sourceType);
      htmlSnapshot = fetchResult.html;
      logger.info('Refetch complete', { usedFlareSolverr: fetchResult.usedFlareSolverr, htmlLength: htmlSnapshot.length });
    }

    if (!htmlSnapshot) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Page does not have HTML snapshot for reprocessing',
      });
    }

    console.error('[SERVER REPROCESS] Starting reprocess', { pageId: input.id, url: page.url, refetch: input.refetch });
    logger.info('Reprocessing page', { pageId: input.id, url: page.url, refetch: input.refetch });

    // Step 2: Clean HTML to match client-side structure (for XPath consistency)
    const { html: processedHtml } = cleanHtmlForReprocess(htmlSnapshot, input.id, page.url);

    // Step 3: Re-bootstrap the page (long-running, outside transaction)
    console.error('[SERVER REPROCESS] Calling bootstrapLabels with URL:', page.url);
    const bootstrapLabels = await getBootstrapLabels();
    const result = bootstrapLabels(processedHtml, page.url);
    console.error('[SERVER REPROCESS] Bootstrap complete, tokens:', result.tokens.length);

    // Store full token data including all ML features for training export
    const tokens = JSON.parse(JSON.stringify(result.tokens)) as Prisma.InputJsonValue;
    const entityCounts = calculateEntityCountsFromLabels(result.labels);

    // Step 3: Read backup fields OUTSIDE transaction (avoids loading huge JSON in tx)
    const backupPage = await prisma.annotatedPage.findUnique({
      where: { id: input.id },
      select: {
        version: true,
        tokens: true,
        labels: true,
        selections: true,
        urlAnnotations: true,
        entityCounts: true,
        confidence: true,
      },
    });

    if (!backupPage) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Page was deleted during reprocessing',
      });
    }

    // Pre-check version before entering transaction
    if (backupPage.version !== initialVersion) {
      throw new TRPCError({
        code: 'CONFLICT',
        message: 'Page was modified during reprocessing. Please try again.',
      });
    }

    const previousVersionBackup = createPreviousVersionBackup(backupPage as AnnotatedPage);

    // Step 4: Lightweight transaction — only version check + update
    const updated = await prisma.$transaction(async (tx) => {
      // Verify version hasn't changed since we read backup
      const versionCheck = await tx.annotatedPage.findUnique({
        where: { id: input.id },
        select: { version: true },
      });

      if (!versionCheck) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Page was deleted during reprocessing',
        });
      }

      if (versionCheck.version !== initialVersion) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'Page was modified during reprocessing. Please try again.',
        });
      }

      return tx.annotatedPage.update({
        where: { id: input.id },
        data: {
          tokens,
          labels: result.labels,
          entityCounts,
          confidence: result.confidence,
          previousVersion: previousVersionBackup,
          version: { increment: 1 },
          // Reset status to BOOTSTRAP since bootstrap autolabeler is replacing the labels
          status: 'BOOTSTRAP',
          // Clear agent review fields since they're no longer valid after reprocessing
          agentReviewedAt: null,
          agentReviewNotes: null,
          agentCorrections: Prisma.DbNull,
          agentConfidence: null,
          agentIssuesFound: Prisma.DbNull,
          agentModelVersion: null,
          ...(input.refetch && { htmlSnapshot }),
        },
      });
    }, {
      timeout: 30000, // 30s for large Wikipedia pages with volume tables
      maxWait: 5000,
    });

    // Debug: Find VOLUME_COVER labels and check if corresponding tokens are images
    const volumeCoverIndices = result.labels
      .map((label, idx) => label.includes('VOLUME_COVER') ? idx : -1)
      .filter(idx => idx >= 0);
    const volumeCoverTokenInfo = volumeCoverIndices.slice(0, 5).map(idx => ({
      idx,
      label: result.labels[idx],
      isImage: result.tokens[idx]?.isImage,
      text: result.tokens[idx]?.text.substring(0, 30),
    }));
    logger.info('Reprocessed page', {
      pageId: input.id,
      newTokenCount: result.tokens.length,
      imageTokens: result.tokens.filter((t) => t.isImage).length,
      volumeCoverLabels: volumeCoverIndices.length,
      volumeCoverTokenInfo,
      refetched: input.refetch,
      hasPreviousVersion: true,
      newVersion: updated.version,
      previousStatus: page.status,
      newStatus: 'BOOTSTRAP',
      clearedAgentReview: page.status === 'AGENT_REVIEWED',
    });

    return updated;
  });

/** Fetch HTML only - for previewing a page before adding to training data */
export const fetchHtmlOnly = adminProcedure
  .input(z.object({ url: z.string().url() }))
  .mutation(async ({ input }) => {
    const sourceType = detectSourceType(input.url);
    if (!sourceType) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Unsupported source. Only Fandom, Wikipedia, AniList, and ComicVine URLs are supported.',
      });
    }

    logger.info('Fetching HTML for preview', { url: input.url, sourceType });

    const result = await fetchHtmlWithFlareSolverr(input.url, sourceType);

    logger.info('HTML fetch complete', {
      url: input.url,
      htmlLength: result.html.length,
      usedFlareSolverr: result.usedFlareSolverr,
    });

    return {
      html: result.html,
      url: input.url,
      sourceType,
    };
  });

// Export functionality moved to export-procedures.ts for deferred tokenization
