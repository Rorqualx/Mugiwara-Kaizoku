/**
 * Reprocess Helper Functions
 *
 * Extracted from crud-procedures.ts to reduce file size.
 */


import { cleanHtmlForTokenization, shouldCleanForTokenization } from '@/server/ml/training/bootstrap-labeler/html-cleaner';
import { logger } from '@/utils/logger';

import type { AnnotatedPage, Prisma } from '@prisma/client';

// ============================================================================
// Types
// ============================================================================

export interface CleanedHtmlResult {
  html: string;
  wasCleaned: boolean;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Clean HTML for reprocessing if needed based on source URL.
 */
export function cleanHtmlForReprocess(
  htmlSnapshot: string,
  pageId: string,
  pageUrl: string
): CleanedHtmlResult {
  if (!shouldCleanForTokenization(pageUrl)) {
    return { html: htmlSnapshot, wasCleaned: false };
  }

  const cleanResult = cleanHtmlForTokenization(htmlSnapshot, pageUrl);
  logger.debug('Cleaned HTML for reprocessing', {
    pageId,
    sourceType: cleanResult.sourceType,
    removedCount: cleanResult.removedCount,
    normalizedCount: cleanResult.normalizedCount,
    originalSize: htmlSnapshot.length,
    cleanedSize: cleanResult.html.length,
  });

  return { html: cleanResult.html, wasCleaned: true };
}

/**
 * Create a backup of the current page state before reprocessing.
 * Returns a plain object compatible with Prisma's InputJsonValue.
 */
export function createPreviousVersionBackup(page: AnnotatedPage): Prisma.InputJsonValue {
  return {
    tokens: page.tokens as Prisma.InputJsonValue,
    labels: page.labels as string[],
    selections: page.selections as Prisma.InputJsonValue,
    urlAnnotations: page.urlAnnotations as Prisma.InputJsonValue,
    entityCounts: page.entityCounts as Prisma.InputJsonValue,
    confidence: page.confidence,
    savedAt: new Date().toISOString(),
  };
}
