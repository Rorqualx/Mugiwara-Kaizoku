/**
 * Process Existing Pages Procedure
 *
 * Processes existing database pages that have empty tokens/labels by:
 * 1. Fetching HTML if needed (using FlareSolverr for JS-heavy pages)
 * 2. Running bootstrap labeling to extract tokens and BIO labels
 * 3. Saving the results back to the database
 *
 * @module annotation/auto-labeling-procedures/persistence/process-existing-pages
 */

import { z } from 'zod';

import { prisma } from '@/server/db';
import { adminProcedure } from '@/server/trpc/procedures';
import {
  fetchHtmlWithFlareSolverr,
  getBootstrapLabels,
} from '@/server/trpc/routers/annotation/helpers';
import { logger } from '@/utils/logger';

import type { AnnotationSourceType, Prisma } from '@prisma/client';

// ============================================================================
// Schema
// ============================================================================

const processExistingPagesInputSchema = z.object({
  /** Number of pages to process */
  limit: z.number().min(1).max(100).default(10),
  /** Filter by manga title (partial match) */
  mangaTitle: z.string().optional(),
  /** Filter by source type */
  sourceType: z.enum(['FANDOM', 'WIKIPEDIA', 'COMICVINE']).optional(),
  /** Only process pages with empty HTML snapshot (need fetching) */
  onlyEmptyHtml: z.boolean().default(false),
  /** Dry run - preview without saving */
  dryRun: z.boolean().default(false),
});

// ============================================================================
// Types
// ============================================================================

interface ProcessedPageResult {
  pageId: string;
  url: string;
  mangaTitle: string | null;
  sourceType: AnnotationSourceType;
  tokenCount: number;
  labelCount: number;
  entityCounts: Record<string, number>;
  confidence: number;
  status: 'processed' | 'skipped' | 'failed';
  error?: string | undefined;
  hadToFetchHtml: boolean;
}

interface ExistingPageData {
  id: string;
  url: string;
  mangaTitle: string | null;
  sourceType: AnnotationSourceType;
  htmlSnapshot: string;
}

type BootstrapLabeler = Awaited<ReturnType<typeof getBootstrapLabels>>;

// ============================================================================
// Helper Functions
// ============================================================================

function createSkippedResult(
  page: ExistingPageData,
  error: string,
  hadToFetchHtml: boolean
): ProcessedPageResult {
  return {
    pageId: page.id,
    url: page.url,
    mangaTitle: page.mangaTitle,
    sourceType: page.sourceType,
    tokenCount: 0,
    labelCount: 0,
    entityCounts: {},
    confidence: 0,
    status: 'skipped',
    error,
    hadToFetchHtml,
  };
}

function createFailedResult(
  page: ExistingPageData,
  error: string,
  hadToFetchHtml: boolean
): ProcessedPageResult {
  return {
    pageId: page.id,
    url: page.url,
    mangaTitle: page.mangaTitle,
    sourceType: page.sourceType,
    tokenCount: 0,
    labelCount: 0,
    entityCounts: {},
    confidence: 0,
    status: 'failed',
    error,
    hadToFetchHtml,
  };
}

async function processExistingPage(
  page: ExistingPageData,
  bootstrapLabels: BootstrapLabeler,
  dryRun: boolean
): Promise<ProcessedPageResult> {
  // Check if we need to fetch HTML
  let html = page.htmlSnapshot;
  let hadToFetchHtml = false;

  if (!html || html.trim() === '') {
    if (dryRun) {
      return createSkippedResult(page, 'Would fetch HTML (dry run)', true);
    }

    // Fetch HTML using FlareSolverr
    logger.info('Fetching HTML for page', { url: page.url, sourceType: page.sourceType });
    const fetchResult = await fetchHtmlWithFlareSolverr(page.url, page.sourceType);
    html = fetchResult.html;
    hadToFetchHtml = true;

    if (!html || html.trim() === '') {
      return createFailedResult(page, 'Failed to fetch HTML', true);
    }
  }

  // Run bootstrap labeling
  logger.info('Running bootstrap labeling', { url: page.url });
  const bootstrapResult = bootstrapLabels(html, page.url);

  const tokenCount = bootstrapResult.tokens.length;
  const labelCount = bootstrapResult.labels.filter(l => l !== 'O').length;
  const entityCounts = bootstrapResult.stats.entityCounts as Record<string, number>;

  if (dryRun) {
    return {
      pageId: page.id,
      url: page.url,
      mangaTitle: page.mangaTitle,
      sourceType: page.sourceType,
      tokenCount,
      labelCount,
      entityCounts,
      confidence: bootstrapResult.confidence,
      status: 'processed',
      hadToFetchHtml,
    };
  }

  // Prepare tokens for storage
  const tokensForStorage = bootstrapResult.tokens.map((t, i) => ({
    id: i,
    text: t.text,
    tagName: t.tagName,
    xpath: t.xpath,
  }));

  // Build notes string
  const entitiesStr = Object.entries(entityCounts)
    .map(([k, v]) => `${k}:${v}`)
    .join(', ');
  const notes = `Processed ${tokenCount} tokens, ${labelCount} labeled | Entities: ${entitiesStr}`;

  // Update the page in database
  await prisma.annotatedPage.update({
    where: { id: page.id },
    data: {
      htmlSnapshot: html,
      tokens: tokensForStorage,
      labels: bootstrapResult.labels,
      entityCounts,
      confidence: bootstrapResult.confidence,
      status: 'BOOTSTRAP',
      notes,
      updatedAt: new Date(),
    },
  });

  logger.info('Page processed successfully', {
    url: page.url,
    tokenCount,
    labelCount,
    confidence: bootstrapResult.confidence,
  });

  return {
    pageId: page.id,
    url: page.url,
    mangaTitle: page.mangaTitle,
    sourceType: page.sourceType,
    tokenCount,
    labelCount,
    entityCounts,
    confidence: bootstrapResult.confidence,
    status: 'processed',
    hadToFetchHtml,
  };
}

// ============================================================================
// Procedure
// ============================================================================

/**
 * Process existing database pages that have empty tokens/labels.
 *
 * This procedure:
 * 1. Queries pages with empty tokens array
 * 2. Fetches HTML if snapshot is empty (using FlareSolverr for JS-heavy pages)
 * 3. Runs bootstrap labeling to extract tokens and BIO labels
 * 4. Updates the database with tokens, labels, entityCounts, confidence
 */
export const processExistingPages = adminProcedure
  .input(processExistingPagesInputSchema)
  .mutation(async ({ input }) => {
    const { limit, mangaTitle, sourceType, onlyEmptyHtml, dryRun } = input;

    logger.info('Starting processing of existing pages', {
      limit,
      mangaTitle,
      sourceType,
      onlyEmptyHtml,
      dryRun,
    });

    // Build where clause for pages with empty tokens
    const whereClause: Prisma.AnnotatedPageWhereInput = {
      tokens: { equals: [] as Prisma.InputJsonValue },
    };

    if (mangaTitle) {
      whereClause.mangaTitle = { contains: mangaTitle, mode: 'insensitive' };
    }

    if (sourceType) {
      whereClause.sourceType = sourceType;
    }

    if (onlyEmptyHtml) {
      whereClause.htmlSnapshot = '';
    }

    // Query pages with empty tokens/labels
    const pages = await prisma.annotatedPage.findMany({
      where: whereClause,
      take: limit,
      select: {
        id: true,
        url: true,
        mangaTitle: true,
        sourceType: true,
        htmlSnapshot: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    logger.info('Found pages to process', { count: pages.length });

    if (pages.length === 0) {
      return {
        success: true,
        dryRun,
        message: 'No pages found with empty tokens',
        processed: [],
        summary: {
          total: 0,
          processed: 0,
          skipped: 0,
          failed: 0,
          htmlFetched: 0,
        },
      };
    }

    // Get bootstrap labeler (dynamically imported)
    const bootstrapLabels = await getBootstrapLabels();
    const results: ProcessedPageResult[] = [];

    for (const page of pages) {
      try {
        // eslint-disable-next-line no-await-in-loop -- Sequential processing to avoid overwhelming FlareSolverr
        const result = await processExistingPage(page, bootstrapLabels, dryRun);
        results.push(result);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        logger.error('Failed to process page', { url: page.url, error: errorMsg });
        results.push(createFailedResult(page, errorMsg, false));
      }
    }

    // Calculate summary
    const summary = {
      total: results.length,
      processed: results.filter(r => r.status === 'processed').length,
      skipped: results.filter(r => r.status === 'skipped').length,
      failed: results.filter(r => r.status === 'failed').length,
      htmlFetched: results.filter(r => r.hadToFetchHtml).length,
    };

    logger.info('Processing complete', { ...summary, dryRun });

    return {
      success: true,
      dryRun,
      message: dryRun
        ? `Would process ${summary.processed} pages (dry run)`
        : `Processed ${summary.processed} pages successfully`,
      processed: results,
      summary,
    };
  });
