/**
 * Batch Update Operations
 *
 * Handles batch update operations with transaction support.
 *
 * Extracted from: batchQuery.ts (lines 177-253)
 */

import type { AsyncResult } from '@/utils/async-result';
import { createSuccessResult, createErrorResult } from '@/utils/async-result';
import { logger } from '@/utils/logger';

import { DEFAULT_BATCH_OPTIONS } from './types';
import { chunkArray, processInParallel, delay } from './utils';

import type { BatchQueryOptions, BatchResult } from './types';
import type { PrismaClient, Prisma } from '@prisma/client';

/**
 * Execute batch update operation with transaction support
 *
 * Updates multiple records in batches within transactions for data consistency.
 * Supports parallel processing, error handling, and progress tracking.
 *
 * @param prisma - Prisma client instance
 * @param model - Name of the Prisma model to update
 * @param updates - Array of update operations with where and data clauses
 * @param options - Configuration options for batch processing
 * @returns AsyncResult containing batch operation results and metadata
 *
 * @example
 * ```typescript
 * const result = await batchUpdate(
 *   prisma,
 *   'manga',
 *   [
 *     { where: { id: 1 }, data: { title: 'Updated Title' } },
 *     { where: { id: 2 }, data: { status: 'COMPLETED' } }
 *   ],
 *   { batchSize: 100, concurrency: 3 }
 * );
 * ```
 */
export async function batchUpdate<T extends keyof PrismaClient>(
  prisma: PrismaClient,
  model: T,
  updates: Array<{
    where: Prisma.Args<PrismaClient[T], 'update'>['where'];
    data: Prisma.Args<PrismaClient[T], 'update'>['data'];
  }>,
  options?: BatchQueryOptions
): Promise<AsyncResult<BatchResult<unknown>, Error>> {
  const config = { ...DEFAULT_BATCH_OPTIONS, ...options };
  const startTime = Date.now();
  const results: unknown[] = [];
  const errors: Array<{ error: Error; batch: unknown[] }> = [];
  let successCount = 0;
  let failedCount = 0;

  try {
    const chunks = chunkArray(updates, config.batchSize);
    const totalItems = updates.length;

    logger.info(`Starting batch update for ${model as string}: ${totalItems} items in ${chunks.length} batches`);

    await processInParallel(
      chunks,
      async (chunk, index) => {
        try {
          // Execute updates in transaction for consistency
          const batchResults = await prisma.$transaction(
            async (tx) => {
              const modelClient = tx[model] as Record<string, unknown>;
              const updateFn = modelClient["update"] as (args: { where: unknown; data: unknown }) => Promise<unknown>;

              return Promise.all(
                chunk.map(update => updateFn(update))
              );
            }
          );

          successCount += batchResults.length;
          results.push(...batchResults);

          const processed = Math.min((index + 1) * config.batchSize, totalItems);
          config.onProgress(processed, totalItems);

          if (config.delayBetweenBatches > 0 && index < chunks.length - 1) {
            await delay(config.delayBetweenBatches);
          }
        } catch (error: unknown) {
          const err = error instanceof Error ? error : new Error(String(error));
          failedCount += chunk.length;
          errors.push({ error: err, batch: chunk });
          config.onError(err, chunk);

          if (!config.continueOnError) {
            throw err;
          }
        }
      },
      config.concurrency
    );

    const duration = Date.now() - startTime;
    logger.info(`Batch update completed: ${successCount} success, ${failedCount} failed in ${duration}ms`);

    return createSuccessResult({
      success: successCount,
      failed: failedCount,
      results,
      errors,
      duration,
    });
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error('Batch update failed:', err);
    return createErrorResult(err);
  }
}
