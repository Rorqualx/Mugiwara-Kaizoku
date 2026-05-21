/**
 * Batch Create Operations
 *
 * Handles batch insert operations with automatic fallback
 * from createMany to individual creates.
 *
 * Extracted from: batchQuery.ts (lines 78-173)
 *
 * @module server/utils/batch-query/create
 */

import type { AsyncResult } from '@/utils/async-result';
import { createSuccessResult, createErrorResult } from '@/utils/async-result';
import { logger } from '@/utils/logger';

import { DEFAULT_BATCH_OPTIONS } from './types';
import { chunkArray, processInParallel, delay } from './utils';

import type { BatchQueryOptions, BatchResult } from './types';
import type { PrismaClient, Prisma } from '@prisma/client';

/**
 * Execute batch create operation
 *
 * Attempts to use createMany for optimal performance. If the model doesn't
 * support createMany, falls back to individual create operations.
 *
 * @template T - Prisma model name
 * @param prisma - PrismaClient instance
 * @param model - Model name to create records for
 * @param data - Array of data objects to create
 * @param options - Batch operation options
 * @returns AsyncResult with batch operation summary
 *
 * @example
 * ```typescript
 * const result = await batchCreate(
 *   prisma,
 *   'manga',
 *   [{ title: 'One Piece' }, { title: 'Naruto' }],
 *   { batchSize: 50 }
 * );
 *
 * if (result.isOk()) {
 *   console.log(`Created ${result.value.success} records`);
 * }
 * ```
 */
export async function batchCreate<T extends keyof PrismaClient>(
  prisma: PrismaClient,
  model: T,
  data: Array<Prisma.Args<PrismaClient[T], 'create'>['data']>,
  options?: BatchQueryOptions
): Promise<AsyncResult<BatchResult<unknown>, Error>> {
  const config = { ...DEFAULT_BATCH_OPTIONS, ...options };
  const startTime = Date.now();
  const results: unknown[] = [];
  const errors: Array<{ error: Error; batch: unknown[] }> = [];
  let successCount = 0;
  let failedCount = 0;

  try {
    // Split data into chunks
    const chunks = chunkArray(data, config.batchSize);
    const totalItems = data.length;

    logger.info(`Starting batch create for ${model as string}: ${totalItems} items in ${chunks.length} batches`);

    // Process chunks with concurrency control
    await processInParallel(
      chunks,
      async (chunk, index) => {
        try {
          // Use createMany for better performance
          const modelClient = prisma[model] as Record<string, unknown>;

          if (typeof modelClient["createMany"] === 'function') {
            // Use createMany when available
            const createManyFn = modelClient["createMany"] as (args: { data: unknown[]; skipDuplicates: boolean }) => Promise<{ count: number }>;
            const result = await createManyFn({
              data: chunk,
              skipDuplicates: true,
            });
            successCount += result.count;
            results.push(result);
          } else if (typeof modelClient["create"] === 'function') {
            // Fallback to individual creates
            const createFn = modelClient["create"] as (args: { data: unknown }) => Promise<unknown>;
            const batchResults = await Promise.all(
              chunk.map(item =>
                createFn({ data: item })
                  .then((res: unknown) => {
                    successCount++;
                    return res;
                  })
                  .catch((err: Error) => {
                    if (!config.continueOnError) throw err;
                    failedCount++;
                    errors.push({ error: err, batch: [item] });
                    return null;
                  })
              )
            );
            results.push(...batchResults.filter(Boolean));
          }

          // Progress callback
          const processed = Math.min((index + 1) * config.batchSize, totalItems);
          config.onProgress(processed, totalItems);

          // Delay between batches if specified
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
    logger.info(`Batch create completed: ${successCount} success, ${failedCount} failed in ${duration}ms`);

    return createSuccessResult({
      success: successCount,
      failed: failedCount,
      results,
      errors,
      duration,
    });
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error('Batch create failed:', err);
    return createErrorResult(err);
  }
}
