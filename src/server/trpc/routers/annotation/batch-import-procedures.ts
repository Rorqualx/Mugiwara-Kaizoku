/**
 * Annotation Router - Batch Import Procedures
 *
 * Parallel batch URL import with session pooling and progress tracking.
 * Uses FlareSolverr session pool for concurrent fetching of JS-heavy pages.
 *
 * @module annotation/batch-import-procedures
 */

import { Prisma } from '@prisma/client';
import { z } from 'zod';

import { prisma } from '@/server/db';
import { settingsProcedure } from '@/server/trpc/procedures';
import { logger } from '@/utils/logger';


import { detectSourceType, fetchHtmlWithFlareSolverr } from './helpers';

// ============================================================================
// Schemas
// ============================================================================

const batchImportInputSchema = z.object({
  urls: z.array(z.object({
    url: z.string().url(),
    mangaTitle: z.string().optional(),
  })).min(1).max(50),
  notes: z.string().optional(),
});

// ============================================================================
// Types
// ============================================================================

interface ImportResult {
  url: string;
  pageId: string;
  status: 'created' | 'exists' | 'failed';
  error?: string;
}

interface BatchProgress {
  total: number;
  completed: number;
  created: number;
  skipped: number;
  failed: number;
}

// ============================================================================
// Constants
// ============================================================================

const BATCH_CONCURRENCY = 3;

// ============================================================================
// Helper Functions
// ============================================================================

function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

function isPrismaUniqueConstraintError(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return error.code === 'P2002';
  }
  return false;
}

async function importSingleUrl(
  url: string,
  mangaTitle: string | undefined,
  notes: string | undefined
): Promise<ImportResult> {
  const sourceType = detectSourceType(url);
  if (!sourceType) {
    return { url, pageId: '', status: 'failed', error: 'Unsupported URL source' };
  }

  try {
    const fetchResult = await fetchHtmlWithFlareSolverr(url, sourceType);
    const html = fetchResult.html;

    const page = await prisma.annotatedPage.create({
      data: {
        url,
        mangaTitle: mangaTitle ?? null,
        sourceType,
        htmlSnapshot: html,
        tokens: [],
        labels: [],
        entityCounts: {},
        confidence: null,
        notes: notes ?? null,
        annotatorId: null,
        status: 'BOOTSTRAP',
      },
    });

    logger.info('Imported page', { pageId: page.id, url });
    return { url, pageId: page.id, status: 'created' };
  } catch (error) {
    if (isPrismaUniqueConstraintError(error)) {
      logger.debug('URL already exists', { url });
      return { url, pageId: '', status: 'exists' };
    }

    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Import failed', { url, error: errorMessage });
    return { url, pageId: '', status: 'failed', error: errorMessage };
  }
}

async function processImportChunk(
  items: Array<{ url: string; mangaTitle?: string | undefined }>,
  notes: string | undefined
): Promise<ImportResult[]> {
  const promises = items.map((item) => importSingleUrl(item.url, item.mangaTitle, notes));
  return Promise.all(promises);
}

// ============================================================================
// Procedures
// ============================================================================

/** Import multiple URLs in parallel with progress tracking */
export const batchImport = settingsProcedure
  .input(batchImportInputSchema)
  .mutation(async ({ input }): Promise<{
    results: ImportResult[];
    progress: BatchProgress;
  }> => {
    const results: ImportResult[] = [];
    const chunks = chunkArray(input.urls, BATCH_CONCURRENCY);

    logger.info('Starting batch import', {
      total: input.urls.length,
      chunks: chunks.length,
      concurrency: BATCH_CONCURRENCY,
    });

    for (const chunk of chunks) {
      // eslint-disable-next-line no-await-in-loop -- Sequential chunk processing for controlled concurrency
      const chunkResults = await processImportChunk(chunk, input.notes);
      results.push(...chunkResults);
    }

    const progress: BatchProgress = {
      total: input.urls.length,
      completed: results.length,
      created: results.filter((r) => r.status === 'created').length,
      skipped: results.filter((r) => r.status === 'exists').length,
      failed: results.filter((r) => r.status === 'failed').length,
    };

    logger.info('Batch import complete', progress);

    return { results, progress };
  });

/** Check which URLs are already imported */
export const checkExistingUrls = settingsProcedure
  .input(z.object({ urls: z.array(z.string().url()).max(100) }))
  .query(async ({ input }): Promise<Array<{ url: string; exists: boolean; pageId?: string | undefined }>> => {
    const existing = await prisma.annotatedPage.findMany({
      where: { url: { in: input.urls } },
      select: { id: true, url: true },
    });

    const existingMap = new Map(existing.map((p) => [p.url, p.id]));

    return input.urls.map((url) => {
      const pageId = existingMap.get(url);
      return { url, exists: !!pageId, pageId };
    });
  });
