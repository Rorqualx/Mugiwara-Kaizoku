/**
 * Annotation Router - Bulk Operations Procedures
 *
 * Handles bulk operations like reprocessing multiple pages at once.
 */

import { Prisma } from '@prisma/client';
import { z } from 'zod';

import { prisma } from '@/server/db';
import { settingsProcedure } from '@/server/trpc/procedures';
import { logger } from '@/utils/logger';


import {
  calculateEntityCountsFromLabels,
  getBootstrapLabels,
  fetchHtmlWithFlareSolverr,
} from './helpers';
import { cleanHtmlForReprocess, createPreviousVersionBackup } from './reprocess-helpers';

import type { AnnotatedPage } from '@prisma/client';

// ============================================================================
// Types
// ============================================================================

interface BulkReprocessResult {
  processed: number;
  failed: string[];
  errors: string[];
}

interface BulkDeleteResult {
  deleted: number;
  failed: string[];
  errors: string[];
}

// ============================================================================
// Bulk Reprocess Procedure
// ============================================================================

interface SaveReprocessedInput {
  pageId: string;
  initialVersion: number;
  tokens: Prisma.InputJsonValue;
  labels: string[];
  entityCounts: Record<string, number>;
  confidence: number;
  htmlSnapshot?: string;
}

/** Save reprocessed labels with backup and optimistic locking */
async function saveReprocessedLabels(input: SaveReprocessedInput): Promise<void> {
  const { pageId, initialVersion } = input;

  // Read backup fields outside transaction (avoids loading huge JSON in tx)
  const backupPage = await prisma.annotatedPage.findUnique({
    where: { id: pageId },
    select: { version: true, tokens: true, labels: true, selections: true, urlAnnotations: true, entityCounts: true, confidence: true },
  });

  if (!backupPage) throw new Error('Page was deleted during reprocessing');
  if (backupPage.version !== initialVersion) throw new Error('Page was modified during reprocessing');

  const previousVersionBackup = createPreviousVersionBackup(backupPage as AnnotatedPage);

  // Lightweight transaction — only version check + update
  await prisma.$transaction(async (tx) => {
    const versionCheck = await tx.annotatedPage.findUnique({ where: { id: pageId }, select: { version: true } });
    if (!versionCheck) throw new Error('Page was deleted during reprocessing');
    if (versionCheck.version !== initialVersion) throw new Error('Page was modified during reprocessing');

    await tx.annotatedPage.update({
      where: { id: pageId },
      data: {
        tokens: input.tokens, labels: input.labels, entityCounts: input.entityCounts,
        confidence: input.confidence, previousVersion: previousVersionBackup,
        version: { increment: 1 }, status: 'BOOTSTRAP',
        agentReviewedAt: null, agentReviewNotes: null, agentCorrections: Prisma.DbNull,
        agentConfidence: null, agentIssuesFound: Prisma.DbNull, agentModelVersion: null,
        ...(input.htmlSnapshot ? { htmlSnapshot: input.htmlSnapshot } : {}),
      },
    });
  }, { timeout: 30000, maxWait: 5000 });
}

/**
 * Reprocess a single page - extracted to reduce nesting depth
 */
async function reprocessSinglePage(
  pageId: string,
  refetch: boolean
): Promise<{ success: true } | { success: false; error: string }> {
  const page = await prisma.annotatedPage.findUnique({ where: { id: pageId } });
  if (!page) return { success: false, error: `Page ${pageId} not found` };

  const initialVersion = page.version;
  let htmlSnapshot = page.htmlSnapshot;

  if (refetch) {
    logger.info('Refetching HTML with FlareSolverr', { pageId, url: page.url });
    const fetchResult = await fetchHtmlWithFlareSolverr(page.url, page.sourceType);
    htmlSnapshot = fetchResult.html;
  }

  if (!htmlSnapshot) return { success: false, error: `Page ${pageId} has no HTML snapshot` };

  const { html: processedHtml } = cleanHtmlForReprocess(htmlSnapshot, pageId, page.url);
  const bootstrapLabels = await getBootstrapLabels();
  const result = bootstrapLabels(processedHtml, page.url);
  const tokens = JSON.parse(JSON.stringify(result.tokens)) as Prisma.InputJsonValue;
  const entityCounts = calculateEntityCountsFromLabels(result.labels);

  await saveReprocessedLabels({
    pageId, initialVersion, tokens, labels: result.labels, entityCounts,
    confidence: result.confidence,
    ...(refetch && htmlSnapshot ? { htmlSnapshot } : {}),
  });

  logger.info('Reprocessed page', {
    pageId, newTokenCount: result.tokens.length, refetched: refetch,
    previousStatus: page.status, newStatus: 'BOOTSTRAP',
  });

  return { success: true };
}

/** Bulk reprocess multiple pages (with optional HTML refetch) */
export const bulkReprocess = settingsProcedure
  .input(z.object({
    pageIds: z.array(z.string()).min(1).max(100),
    refetch: z.boolean().default(false),
  }))
  .mutation(async ({ input }): Promise<BulkReprocessResult> => {
    const results: BulkReprocessResult = { processed: 0, failed: [], errors: [] };

    logger.info('Starting bulk reprocess', { pageCount: input.pageIds.length, refetch: input.refetch });

    const pageResults = await Promise.all(
      input.pageIds.map(async (pageId) => {
        try {
          const result = await reprocessSinglePage(pageId, input.refetch);
          return { pageId, result };
        } catch (error) {
          logger.error('Failed to reprocess page', { pageId, error });
          return { pageId, result: { success: false as const, error: error instanceof Error ? error.message : 'Unknown error' } };
        }
      })
    );

    for (const { pageId, result } of pageResults) {
      if (result.success) {
        results.processed++;
      } else {
        results.failed.push(pageId);
        results.errors.push(result.error);
      }
    }

    logger.info('Bulk reprocess complete', {
      processed: results.processed,
      failed: results.failed.length,
    });

    return results;
  });

// ============================================================================
// Bulk Delete Procedure
// ============================================================================

/** Bulk delete multiple annotated pages */
export const bulkDelete = settingsProcedure
  .input(z.object({
    pageIds: z.array(z.string()).min(1).max(100),
  }))
  .mutation(async ({ input }): Promise<BulkDeleteResult> => {
    const results: BulkDeleteResult = { deleted: 0, failed: [], errors: [] };

    logger.info('Starting bulk delete', { pageCount: input.pageIds.length });

    // Use a transaction to delete all pages atomically
    // This is more efficient than deleting one by one
    try {
      const deleteResult = await prisma.annotatedPage.deleteMany({
        where: {
          id: { in: input.pageIds },
        },
      });

      results.deleted = deleteResult.count;

      // If not all pages were deleted, some might not have existed
      if (deleteResult.count < input.pageIds.length) {
        const notDeleted = input.pageIds.length - deleteResult.count;
        logger.warn('Some pages were not found during bulk delete', {
          requested: input.pageIds.length,
          deleted: deleteResult.count,
          notFound: notDeleted,
        });
      }
    } catch (error) {
      logger.error('Bulk delete failed', { error, pageIds: input.pageIds });
      results.errors.push(error instanceof Error ? error.message : 'Unknown error');
      results.failed = input.pageIds;
    }

    logger.info('Bulk delete complete', {
      deleted: results.deleted,
      failed: results.failed.length,
    });

    return results;
  });
