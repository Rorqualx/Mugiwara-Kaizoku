/**
 * Query Optimizer Utilities
 * 
 * Provides optimized database query patterns to avoid common performance issues
 * like COUNT(*) with OFFSET but no LIMIT, and inefficient subqueries.
 */

import { prisma } from '@/server/db';
import { logger } from '@/utils/logger';

import type { PrismaClient } from '@prisma/client';
// Helper functions for safe type handling
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
/**
 * Options for paginated queries
 */
export interface PaginationOptions {
  page: number;
  pageSize: number;
  maxPageSize?: number;
}
/**
 * Result of a paginated query
 */
export interface PaginatedResult<T> {
  data: T[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrevious: boolean;
  };
}
/**
 * Performs an optimized paginated query that avoids the COUNT(*) with OFFSET issue
 * 
 * Instead of running separate count and data queries, this uses a transaction
 * to ensure consistency and better performance.
 */
export async function optimizedPaginatedQuery<T>(
  model: keyof PrismaClient,
  options: {
    where?: unknown;
    orderBy?: unknown;
    include?: unknown;
    select?: unknown;
    pagination: PaginationOptions;
  }
): Promise<PaginatedResult<T>> {
  const { pagination, where = {}, orderBy, include, select } = options;
  // Validate and sanitize pagination
  const page = Math.max(1, pagination.page);
  const pageSize = Math.min(
    pagination.maxPageSize || 100,
    Math.max(1, pagination.pageSize)
  );
  const skip = (page - 1) * pageSize;
  // Use a transaction for consistency and performance
  type PrismaModel = {
    findMany: (args: unknown) => Promise<T[]>;
    count: (args: unknown) => Promise<number>;
  };
  const _modelDelegate = prisma[model] as unknown as PrismaModel;
  const [data, total] = await prisma.$transaction(async (tx) => {
    // Cast the transaction client to a Record to allow dynamic property access
    const txAsRecord = tx as unknown as Record<string, PrismaModel>;
    const txModel = txAsRecord[model as string];

    if (!txModel) {
      throw new Error(`Model ${String(model)} not found in transaction client`);
    }

    return Promise.all([
      txModel.findMany({
        where,
        skip,
        take: pageSize,
        orderBy,
        include,
        select
      }),
      txModel.count({ where })
    ]);
  });
  return {
    data,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
      hasNext: skip + pageSize < total,
      hasPrevious: page > 1
    }
  };
}
/**
 * Performs efficient grouped counting to avoid multiple COUNT queries
 * 
 * This is particularly useful for dashboard statistics and status counts.
 */
export async function optimizedGroupCount(
  model: keyof PrismaClient,
  options: {
    groupBy: string | string[];
    where?: unknown;
    having?: unknown;
  }
): Promise<Map<string, number>> {
  const groupByFields = Array.isArray(options.groupBy)
    ? options.groupBy
    : [options.groupBy];

  type GroupByResult = Record<string, unknown> & {
    _count: { _all: number };
  };
  type PrismaModelWithGroupBy = {
    groupBy: (args: unknown) => Promise<GroupByResult[]>;
  };
  const modelDelegate = prisma[model] as unknown as PrismaModelWithGroupBy;
  const results = await modelDelegate.groupBy({
    by: groupByFields,
    where: options.where,
    having: options.having,
    _count: {
      _all: true
    }
  });
  // Convert to a Map for easy access
  const countMap = new Map<string, number>();
  for (const result of results) {
    // Create a key from the grouped fields
    const key = groupByFields
      .map(field => result[field])
      .join(':');
    countMap.set(key, result._count._all);
  }
  return countMap;
}
/**
 * Batch count multiple conditions efficiently
 * 
 * Instead of running multiple count queries, this aggregates them into
 * fewer database round trips.
 */
export async function batchCount(
  model: keyof PrismaClient,
  conditions: Array<{ key: string; where: unknown }>
): Promise<Record<string, number>> {
  // If we have many conditions, use Promise.all with batching
  const batchSize = 5; // Adjust based on your database capacity
  const results: Record<string, number> = {};

  type PrismaModelWithCount = {
    count: (args: unknown) => Promise<number>;
  };
  const modelDelegate = prisma[model] as unknown as PrismaModelWithCount;

  // Process batches sequentially to avoid overloading the database
  for (let i = 0; i < conditions.length; i += batchSize) {
    const batch = conditions.slice(i, i + batchSize);
    // eslint-disable-next-line no-await-in-loop
    const counts = await Promise.all(
      batch.map(({ where }) =>
        modelDelegate.count({ where })
      )
    );
    batch.forEach((condition, index) => {
      const count = counts[index];
      if (count !== undefined) {
        results[condition.key] = count;
      }
    });
  }
  return results;
}
/**
 * Caching wrapper for expensive count queries
 * 
 * Implements a simple in-memory cache with TTL (Time To Live)
 */
class QueryCache {
  private cache = new Map<string, { value: unknown; expires: number }>();
  set(key: string, value: unknown, ttlMs: number = 5000): void {
    this.cache.set(key, {
      value,
      expires: Date.now() + ttlMs
    });
  }
  get(key: string): unknown {
    const cached = this.cache.get(key);
    if (!cached) return null;
    if (Date.now() > cached.expires) {
      this.cache.delete(key);
      return null;
    }
    return cached.value;
  }
  clear(): void {
    this.cache.clear();
  }
  // Clean up expired entries periodically
  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expires) {
        this.cache.delete(key);
      }
    }
  }
}
// Global cache instance
export const queryCache = new QueryCache();
// Clean up cache every minute
setInterval(() => queryCache.cleanup(), 60000);
/**
 * Cached count query
 * 
 * Wraps a count query with caching to reduce database load
 */
export async function cachedCount(
  model: keyof PrismaClient,
  where: unknown = {},
  ttlMs: number = 5000
): Promise<number> {
  const cacheKey = `count:${String(model)}:${JSON.stringify(where)}`;
  // Check cache
  const cached = queryCache.get(cacheKey);
  if (cached !== null && typeof cached === 'number') {
    return cached;
  }
  // Fetch from database
  type PrismaModelWithCount = {
    count: (args: unknown) => Promise<number>;
  };
  const modelDelegate = prisma[model] as unknown as PrismaModelWithCount;
  const count = await modelDelegate.count({ where });
  // Store in cache
  queryCache.set(cacheKey, count, ttlMs);
  return count;
}
/**
 * Optimized task count query
 *
 * Specifically optimized for the Task model which has the most issues
 */
export async function getOptimizedTaskCounts(): Promise<{
  active: number;
  pending: number;
  scheduled: number;
  failed: number;
  completed: number;
  outOfSync: number;
  total: number;
}> {
  // Check cache first
  const cacheKey = 'task-counts-optimized';
  const cached = queryCache.get(cacheKey);
  if (cached !== null && typeof cached === 'object') {
    // Type guard to ensure cached value matches expected structure
    const cachedObj = cached as Record<string, unknown>;
    if (
      typeof cachedObj['active'] === 'number' &&
      typeof cachedObj['pending'] === 'number' &&
      typeof cachedObj['scheduled'] === 'number' &&
      typeof cachedObj['failed'] === 'number' &&
      typeof cachedObj['completed'] === 'number' &&
      typeof cachedObj['outOfSync'] === 'number' &&
      typeof cachedObj['total'] === 'number'
    ) {
      return cached as {
        active: number;
        pending: number;
        scheduled: number;
        failed: number;
        completed: number;
        outOfSync: number;
        total: number;
      };
    }
  }
  // Use a single aggregation query
  const [statusGroups, total] = await Promise.all([
    prisma.jobs.groupBy({
      by: ['status'],
      _count: { _all: true }
    }),
    prisma.jobs.count()
  ]);
  // Process results
  const counts = {
    active: 0,
    pending: 0,
    scheduled: 0,
    failed: 0,
    completed: 0,
    outOfSync: 0,
    total
  };
  for (const group of statusGroups) {
    const count = group._count._all;
    const status = group.status;
    switch (status) {
      case 'active':
        counts.active += count;
        break;
      case 'pending':
        counts.pending += count;
        break;
      case 'retrying':
        counts.scheduled += count;
        break;
      case 'failed':
        counts.failed += count;
        break;
      case 'completed':
        counts.completed += count;
        break;
      case 'cancelled':
      default:
        counts.outOfSync += count;
    }
  }
  // Cache for 5 seconds
  queryCache.set(cacheKey, counts, 5000);
  return counts;
}
/**
 * Monitoring utility to detect inefficient queries
 * 
 * This can be used in development to identify problematic query patterns
 */
export function monitorQuery<T>(
  queryName: string,
  queryFn: () => Promise<T>
): Promise<T> {
  const startTime = Date.now();
  return queryFn()
    .then(result => {
      const duration = Date.now() - startTime;
      // Log slow queries (adjust threshold as needed)
      if (duration > 1000) {
        logger.warn(`[SLOW QUERY] ${queryName} took ${duration}ms`);
      }
      return result;
    })
    .catch((error: unknown) => {
      logger.error(`[QUERY ERROR] ${queryName}`, { error, queryName });
      throw error;
    });
}
/**
 * Helper to build efficient WHERE clauses for complex filters
 */
export function buildOptimizedWhere(filters: Record<string, unknown>): Record<string, unknown> {
  const where: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(filters)) {
    if (value === null || value === '') {
      continue;
    }
    // Handle arrays (IN clause)
    if (Array.isArray(value) && value.length > 0) {
      where[key] = { in: value };
    }
    // Handle date ranges
    else if (key.endsWith('_from')) {
      const field = key.replace('_from', '');
      const existing = where[field];
      where[field] = { ...(isRecord(existing) ? existing : {}), gte: value };
    }
    else if (key.endsWith('_to')) {
      const field = key.replace('_to', '');
      const existing = where[field];
      where[field] = { ...(isRecord(existing) ? existing : {}), lte: value };
    }
    // Handle text search
    else if (typeof value === 'string' && key.endsWith('_search')) {
      const field = key.replace('_search', '');
      where[field] = { contains: value, mode: 'insensitive' };
    }
    // Default equality
    else {
      where[key] = value;
    }
  }
  return where;
}