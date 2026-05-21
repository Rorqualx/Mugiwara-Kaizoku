/**
 * Batch Query Utilities
 *
 * Utilities for efficient batch database operations to reduce query overhead
 * and improve performance. Implements batching, chunking, and parallel processing.
 *
 * Features:
 * - Automatic query batching
 * - Chunk processing for large datasets
 * - Parallel execution with concurrency control
 * - Result aggregation and error handling
 * - Progress tracking for long operations
 *
 * @module server/utils/batchQuery
 */

import type { AsyncResult} from '@/utils/async-result';
import { createSuccessResult, createErrorResult } from '@/utils/async-result';
import { logger } from '@/utils/logger';

import { db } from '../db';

import type { Prisma, PrismaClient } from '@prisma/client';

/**
 * Batch query options
 */
export interface BatchQueryOptions {
  /** Maximum items per batch */
  batchSize?: number;
  /** Maximum concurrent batches */
  concurrency?: number;
  /** Delay between batches in ms */
  delayBetweenBatches?: number;
  /** Continue on error */
  continueOnError?: boolean;
  /** Progress callback */
  onProgress?: (processed: number, total: number) => void;
  /** Error callback */
  onError?: (error: Error, batch: unknown[]) => void;
}

/**
 * Batch operation result
 */
export interface BatchResult<T> {
  success: number;
  failed: number;
  results: T[];
  errors: Array<{ error: Error; batch: unknown[] }>;
  duration: number;
}

/**
 * Default batch configuration
 */
const DEFAULT_BATCH_OPTIONS: Required<BatchQueryOptions> = {
  batchSize: 100,
  concurrency: 3,
  delayBetweenBatches: 0,
  continueOnError: true,
  onProgress: () => {},
  onError: () => {},
};

/**
 * Batch Query Utility Class
 */
export class BatchQueryUtil {
  private prisma: PrismaClient;

  constructor(prismaClient?: PrismaClient) {
    this.prisma = prismaClient ?? db.client;
  }

  /**
   * Execute batch create operation
   */
  async batchCreate<T extends keyof PrismaClient>(
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
      const chunks = this.chunkArray(data, config.batchSize);
      const totalItems = data.length;

      logger.info(`Starting batch create for ${model as string}: ${totalItems} items in ${chunks.length} batches`);

      // Process chunks with concurrency control
      await this.processInParallel(
        chunks,
        async (chunk, index) => {
          try {
            // Use createMany for better performance
            const modelClient = this.prisma[model] as Record<string, unknown>;

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
              await this.delay(config.delayBetweenBatches);
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

  /**
   * Execute batch update operation
   */
  async batchUpdate<T extends keyof PrismaClient>(
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
      const chunks = this.chunkArray(updates, config.batchSize);
      const totalItems = updates.length;

      logger.info(`Starting batch update for ${model as string}: ${totalItems} items in ${chunks.length} batches`);

      await this.processInParallel(
        chunks,
        async (chunk, index) => {
          try {
            // Execute updates in transaction for consistency
            const batchResults = await this.prisma.$transaction(
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
              await this.delay(config.delayBetweenBatches);
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

  /**
   * Execute batch delete operation
   */
  async batchDelete<T extends keyof PrismaClient>(
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
      const chunks = this.chunkArray(ids, config.batchSize);
      const totalItems = ids.length;

      logger.info(`Starting batch delete for ${model as string}: ${totalItems} items in ${chunks.length} batches`);

      await this.processInParallel(
        chunks,
        async (chunk, index) => {
          try {
            const modelClient = this.prisma[model] as Record<string, unknown>;
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
              await this.delay(config.delayBetweenBatches);
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

  /**
   * Fetch data in batches to avoid memory issues
   */
  async *batchFetch<T extends keyof PrismaClient>(
    model: T,
    options?: {
      where?: Prisma.Args<PrismaClient[T], 'findMany'>['where'];
      orderBy?: Prisma.Args<PrismaClient[T], 'findMany'>['orderBy'];
      batchSize?: number;
      select?: Prisma.Args<PrismaClient[T], 'findMany'>['select'];
    }
  ): AsyncGenerator<unknown[], void, unknown> {
    const batchSize = options?.batchSize ?? 100;
    const modelClient = this.prisma[model] as Record<string, unknown>;
    const findManyFn = modelClient["findMany"] as (args: {
      where?: unknown;
      orderBy?: unknown;
      select?: unknown;
      skip: number;
      take: number;
    }) => Promise<unknown[]>;
    let skip = 0;
    let hasMore = true;

    while (hasMore) {
      // eslint-disable-next-line no-await-in-loop -- Sequential batch fetching is intentional for memory efficiency
      const batch = await findManyFn({
        where: options?.where,
        orderBy: options?.orderBy,
        select: options?.select,
        skip,
        take: batchSize,
      });

      if (batch.length > 0) {
        yield batch;
        skip += batch.length;
        hasMore = batch.length === batchSize;
      } else {
        hasMore = false;
      }
    }
  }

  /**
   * Split array into chunks
   */
  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  /**
   * Process chunks in parallel with concurrency control
   */
  private async processInParallel<T, R>(
    items: T[],
    processor: (item: T, index: number) => Promise<R>,
    concurrency: number
  ): Promise<R[]> {
    const results: R[] = [];
    const executing: Promise<void>[] = [];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (!item) continue;
      const promise = processor(item, i).then(result => {
        results[i] = result;
      });

      executing.push(promise as Promise<void>);

      if (executing.length >= concurrency) {
        // eslint-disable-next-line no-await-in-loop -- Concurrency control requires await in loop
        await Promise.race(executing);
        void executing.splice(
          executing.findIndex(p => p === promise),
          1
        );
      }
    }

    await Promise.all(executing);
    return results;
  }

  /**
   * Delay utility
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => {
      setTimeout(resolve, ms);
    });
  }
}

/**
 * Singleton batch query utility instance
 */
export const batchQuery = new BatchQueryUtil();

/**
 * Convenience functions
 */
export const batch = {
  /**
   * Create multiple records
   */
  create: batchQuery.batchCreate.bind(batchQuery),

  /**
   * Update multiple records
   */
  update: batchQuery.batchUpdate.bind(batchQuery),

  /**
   * Delete multiple records
   */
  delete: batchQuery.batchDelete.bind(batchQuery),

  /**
   * Fetch records in batches
   */
  fetch: batchQuery.batchFetch.bind(batchQuery),
};

export default batchQuery;