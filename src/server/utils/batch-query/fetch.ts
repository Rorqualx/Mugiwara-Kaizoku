/**
 * Batch Fetch Operations
 *
 * Generator function for memory-efficient paginated fetching.
 *
 * Extracted from: batchQuery.ts (lines 332-371)
 */

import type { PrismaClient, Prisma } from '@prisma/client';

/**
 * Fetch data in batches to avoid memory issues
 *
 * Generator pattern enables streaming large datasets without loading
 * everything into memory at once. Uses cursor-style pagination internally.
 *
 * @example
 * ```ts
 * for await (const batch of batchFetch(prisma, 'manga', { batchSize: 100 })) {
 *   // Process batch
 * }
 * ```
 *
 * @param prisma - Prisma client instance
 * @param model - Model name to query
 * @param options - Query options
 * @param options.where - Filter conditions
 * @param options.orderBy - Sort order
 * @param options.batchSize - Number of records per batch (default: 100)
 * @param options.select - Fields to select
 * @yields Batches of records from the database
 */
export async function* batchFetch<T extends keyof PrismaClient>(
  prisma: PrismaClient,
  model: T,
  options?: {
    where?: Prisma.Args<PrismaClient[T], 'findMany'>['where'];
    orderBy?: Prisma.Args<PrismaClient[T], 'findMany'>['orderBy'];
    batchSize?: number;
    select?: Prisma.Args<PrismaClient[T], 'findMany'>['select'];
  }
): AsyncGenerator<unknown[], void, unknown> {
  const batchSize = options?.batchSize ?? 100;
  const modelClient = prisma[model] as Record<string, unknown>;
  const findManyFn = modelClient['findMany'] as (args: {
    where?: unknown;
    orderBy?: unknown;
    select?: unknown;
    skip: number;
    take: number;
  }) => Promise<unknown[]>;
  let skip = 0;
  let hasMore = true;

  while (hasMore) {
    // eslint-disable-next-line no-await-in-loop -- Generator pattern requires sequential fetching
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
