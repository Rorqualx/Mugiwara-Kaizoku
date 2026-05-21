/**
 * Batch Query Module - Main Aggregator
 *
 * Provides utilities for efficient batch database operations.
 *
 * Architecture:
 * - types.ts - Type definitions and constants (0 functions)
 * - utils.ts - Helper utilities (3 functions)
 * - create.ts - Batch create operations (1 function)
 * - update.ts - Batch update operations (1 function)
 * - delete.ts - Batch delete operations (1 function)
 * - fetch.ts - Batch fetch generator (1 function)
 *
 * Total: 7 functions across 6 modules
 * Original: 455 lines → Refactored: ~600 lines across 7 files (modular)
 *
 * Backward Compatibility:
 * - All original exports maintained
 * - BatchQueryUtil class provided for class-based usage
 * - Convenience object exports for functional usage
 *
 * Extracted from: batchQuery.ts (455 lines)
 */

import { db } from '@/server/db';
import type { AsyncResult } from '@/utils/async-result';

import type { PrismaClient, Prisma } from '@prisma/client';

// Re-export types
export type { BatchQueryOptions, BatchResult } from './types';
export { DEFAULT_BATCH_OPTIONS } from './types';

// Re-export utilities (for advanced users)
export { chunkArray, processInParallel, delay } from './utils';

// Re-export operation functions
export { batchCreate } from './create';
export { batchUpdate } from './update';
export { batchDelete } from './delete';
export { batchFetch } from './fetch';

/**
 * Batch Query Utility Class (backward compatible)
 *
 * Provides class-based interface to batch operations.
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
    options?: Partial<import('./types').BatchQueryOptions>
  ): Promise<AsyncResult<import('./types').BatchResult<unknown>, Error>> {
    const { batchCreate } = await import('./create');
    return batchCreate<T>(this.prisma, model, data, options);
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
    options?: Partial<import('./types').BatchQueryOptions>
  ): Promise<AsyncResult<import('./types').BatchResult<unknown>, Error>> {
    const { batchUpdate } = await import('./update');
    return batchUpdate<T>(this.prisma, model, updates, options);
  }

  /**
   * Execute batch delete operation
   */
  async batchDelete<T extends keyof PrismaClient>(
    model: T,
    ids: Array<Prisma.Args<PrismaClient[T], 'delete'>['where']>,
    options?: Partial<import('./types').BatchQueryOptions>
  ): Promise<AsyncResult<import('./types').BatchResult<unknown>, Error>> {
    const { batchDelete } = await import('./delete');
    return batchDelete<T>(this.prisma, model, ids, options);
  }

  /**
   * Fetch data in batches
   */
  async *batchFetch<T extends keyof PrismaClient>(
    model: T,
    options?: Partial<import('./types').BatchQueryOptions>
  ): AsyncGenerator<unknown[], void, unknown> {
    const { batchFetch } = await import('./fetch');
    yield* batchFetch<T>(this.prisma, model, options);
  }
}

/**
 * Singleton batch query utility instance (backward compatible)
 */
export const batchQuery = new BatchQueryUtil();

/**
 * Convenience functions (backward compatible)
 */
export const batch = {
  /**
   * Create multiple records
   */
  create: <T extends keyof PrismaClient>(
    model: T,
    data: Array<Prisma.Args<PrismaClient[T], 'create'>['data']>,
    options?: Partial<import('./types').BatchQueryOptions>
  ): Promise<AsyncResult<import('./types').BatchResult<unknown>, Error>> => {
    return batchQuery.batchCreate<T>(model, data, options);
  },

  /**
   * Update multiple records
   */
  update: <T extends keyof PrismaClient>(
    model: T,
    updates: Array<{
      where: Prisma.Args<PrismaClient[T], 'update'>['where'];
      data: Prisma.Args<PrismaClient[T], 'update'>['data'];
    }>,
    options?: Partial<import('./types').BatchQueryOptions>
  ): Promise<AsyncResult<import('./types').BatchResult<unknown>, Error>> => {
    return batchQuery.batchUpdate<T>(model, updates, options);
  },

  /**
   * Delete multiple records
   */
  delete: <T extends keyof PrismaClient>(
    model: T,
    ids: Array<Prisma.Args<PrismaClient[T], 'delete'>['where']>,
    options?: Partial<import('./types').BatchQueryOptions>
  ): Promise<AsyncResult<import('./types').BatchResult<unknown>, Error>> => {
    return batchQuery.batchDelete<T>(model, ids, options);
  },

  /**
   * Fetch records in batches
   */
  fetch: <T extends keyof PrismaClient>(
    model: T,
    options?: Partial<import('./types').BatchQueryOptions>
  ): AsyncGenerator<unknown[], void, unknown> => {
    return batchQuery.batchFetch<T>(model, options);
  },
};

/**
 * Default export (backward compatible)
 */
export default batchQuery;
