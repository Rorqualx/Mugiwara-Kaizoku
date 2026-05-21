/**
 * Batch Delete Operations
 *
 * Handles batch delete operations using deleteMany for efficient bulk deletions.
 *
 * Extracted from: batchQuery.ts (lines 257-328)
 *
 * @module batch-query/delete
 */

import type { AsyncResult } from '@/utils/async-result';
import { createSuccessResult, createErrorResult } from '@/utils/async-result';
import { logger } from '@/utils/logger';

import { DEFAULT_BATCH_OPTIONS } from './types';
import { chunkArray, processInParallel, delay } from './utils';

import type { BatchQueryOptions, BatchResult } from './types';
import type { PrismaClient } from '@prisma/client';

/**
 * Execute batch delete operation using deleteMany
 *
 * Deletes multiple records in batches for better performance and resource management.
 * Uses Prisma's deleteMany for efficient bulk deletions.
 *
 * @template T - Prisma model name type
 * @param prisma - Prisma client instance
 * @param model - Name of the Prisma model
 * @param ids - Array of record IDs to delete
 * @param options - Optional batch operation configuration
 * @returns AsyncResult containing batch operation results
 *
 * @example
 * ```typescript
 * const result = await batchDelete(
 *   prisma,
 *   'manga',
 *   [1, 2, 3, 4, 5],
 *   {
 *     batchSize: 100,
 *     concurrency: 2,
 *     continueOnError: true
 *   }
 * );
 *
 * if (result.isOk()) {
 *   console.log(`Deleted ${result.value.success} records`);
 * }
 * ```
 */
export async function batchDelete<T extends keyof PrismaClient>(
  prisma: PrismaClient,
  model: T,
  ids: Array<string | number>,
  options?: BatchQueryOptions
): Promise<AsyncResult<BatchResult<unknown>, Error>> {
  const config = { ...DEFAULT_BATCH_OPTIONS, ...options };
  const startTime = Date.now();
  const results: unknown[] = [];
  const errors: Array<{ error: Error; batch: unknown[] }> = [];
  let successCount = 0;
  let failedCount = 0;

  try {
    const chunks = chunkArray(ids, config.batchSize);
    const totalItems = ids.length;

    logger.info(`Starting batch delete for ${model as string}: ${totalItems} items in ${chunks.length} batches`);

    await processInParallel(
      chunks,
      async (chunk, index) => {
        try {
          const modelClient = prisma[model] as Record<string, unknown>;
          const deleteManyFn = modelClient["deleteMany"] as (args: { where: unknown }) => Promise<{ count: number }>;

          // Use deleteMany for better performance
          const result = await deleteManyFn({
            where: {
              id: { in: chunk }
            }
          });

          successCount += result.count;
          results.push(result);

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
    logger.info(`Batch delete completed: ${successCount} success, ${failedCount} failed in ${duration}ms`);

    return createSuccessResult({
      success: successCount,
      failed: failedCount,
      results,
      errors,
      duration,
    });
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error('Batch delete failed:', err);
    return createErrorResult(err);
  }
}
