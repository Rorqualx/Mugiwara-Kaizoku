/**
 * Unified Cache Provider - Type Definitions
 *
 * Shared types, enums, validation schemas, and helper functions
 * for the unified cache system.
 *
 * @module server/cache/UnifiedCacheProvider/types
 */

import { z } from 'zod';

// Helper functions for safe type handling
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export interface CacheOptions {
  ttl?: number; // Time to live in seconds
  namespace?: string; // Cache namespace for isolation
  tags?: string[]; // Tags for bulk operations
  compress?: boolean; // Enable compression for large values
}

/** Options for cache GET operations */
export interface CacheGetOptions {
  /** Skip the UPDATE query that tracks access count/frequency. Use for bulk reads. */
  skipAccessTracking?: boolean;
}

export interface CacheEntry {
  key: string;
  value: unknown;
  namespace: string;
  expiresAt: Date | null;
  accessCount: number;
  accessFrequency: number;
  metadata: Record<string, unknown>;
}

export interface CacheStats {
  totalEntries: number;
  totalSize: number;
  hitRate: number;
  evictions: number;
  namespaces: Record<string, {
    entries: number;
    size: number;
    hits: number;
  }>;
}

export enum CacheDataType {
  STRING = 'string',
  HASH = 'hash',
  LIST = 'list',
  SET = 'set',
  ZSET = 'zset',
  JSON = 'json'
}

/** Internal statistics tracked per cache provider instance */
export interface CacheInternalStats {
  hits: number;
  misses: number;
  evictions: number;
  errors: number;
}

// Validation schemas
export const CacheKeySchema = z.string().min(1).max(255);
export const CacheNamespaceSchema = z.string().min(1).max(100);
