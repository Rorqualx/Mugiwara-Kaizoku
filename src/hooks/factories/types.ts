/**
 * Factory Types
 *
 * Type definitions for hook factories and related patterns.
 * Provides type-safe interfaces for factory implementations.
 *
 * @module hooks/factories/types
 */

import { z } from 'zod';

import type { AsyncResult } from '@/utils/async-result';

/**
 * Base configuration type
 */
export interface BaseConfig {
  id?: string;
  createdAt?: Date;
  updatedAt?: Date;
  metadata?: Record<string, unknown>;
}

/**
 * Configuration scope
 */
export type ConfigScope = 'global' | 'user' | 'library' | 'manga';

/**
 * Configuration metadata
 */
export interface ConfigMetadata {
  version?: number;
  source?: string;
  lastModifiedBy?: string;
  tags?: string[];
}

/**
 * Configuration with metadata
 */
export interface ConfigWithMetadata<T = unknown> extends BaseConfig {
  value: T;
  scope: ConfigScope;
}

/**
 * Factory hook options base
 */
export interface FactoryHookOptions {
  /** Enable debug logging */
  debug?: boolean;
  /** Custom error handler */
  onError?: (error: Error) => void;
  /** Custom success handler */
  onSuccess?: (data: unknown) => void;
  /** Enable performance tracking */
  trackPerformance?: boolean;
}

/**
 * Query hook factory options
 */
export interface QueryHookOptions<TData> extends FactoryHookOptions {
  /** Garbage collection time in milliseconds (renamed from cacheTime in TanStack Query v5) */
  gcTime?: number;
  /** Stale time in milliseconds */
  staleTime?: number;
  /** Enable background refetch */
  refetchInBackground?: boolean;
  /** Transform raw data */
  transform?: (data: unknown) => TData;
}

/**
 * Mutation hook factory options
 */
export interface MutationHookOptions<TVariables, TError = Error> extends FactoryHookOptions {
  /** Enable optimistic updates */
  optimistic?: boolean;
  /** Rollback handler for failed optimistic updates */
  onRollback?: (error: TError, variables: TVariables) => void;
  /** Retry configuration */
  retry?: number | ((failureCount: number, error: TError) => boolean);
}

/**
 * Standard hook return type
 */
export interface StandardHookReturn<TData, TError = Error> {
  data: TData | null;
  isLoading: boolean;
  error: TError | null;
  refetch: () => Promise<void>;
}

/**
 * Mutation hook return type
 */
export interface MutationHookReturn<TData, TVariables, TError = Error> {
  mutate: (variables: TVariables) => Promise<AsyncResult<TData, TError>>;
  mutateAsync: (variables: TVariables) => Promise<TData>;
  isLoading: boolean;
  error: TError | null;
  data: TData | null;
  reset: () => void;
}

/**
 * Schema registry for type inference
 */
export interface SchemaRegistry {
  [key: string]: z.ZodType;
}

/**
 * Infer schema types from registry
 */
export type InferSchemaTypes<T extends SchemaRegistry> = {
  [K in keyof T]: z.infer<T[K]>;
};

/**
 * Factory function type
 */
export type FactoryFunction<TOptions, TReturn> = (options: TOptions) => TReturn;

/**
 * Hook factory type
 */
export type HookFactory<TOptions, THookReturn> = (
  options: TOptions
) => () => THookReturn;

/**
 * Config schema definitions
 */
export const configSchemas = {
  // Theme configuration
  theme: z.object({
    mode: z.enum(['light', 'dark', 'auto']),
    primaryColor: z.string(),
    accentColor: z.string().optional(),
    fontSize: z.enum(['small', 'medium', 'large']).default('medium'),
    fontFamily: z.string().optional(),
  }),

  // Download configuration
  download: z.object({
    autoDownload: z.boolean().default(false),
    downloadPath: z.string(),
    maxConcurrent: z.number().min(1).max(10).default(3),
    preferredQuality: z.enum(['low', 'medium', 'high']).default('high'),
    keepOriginalFormat: z.boolean().default(true),
  }),

  // Notification configuration
  notification: z.object({
    enabled: z.boolean().default(true),
    types: z.object({
      download: z.boolean().default(true),
      update: z.boolean().default(true),
      error: z.boolean().default(true),
      info: z.boolean().default(false),
    }),
    channels: z.array(z.enum(['email', 'discord', 'telegram', 'push'])).default([]),
  }),

  // Library configuration
  library: z.object({
    scanInterval: z.number().min(0).default(3600000), // 1 hour default
    autoOrganize: z.boolean().default(true),
    folderStructure: z.enum(['flat', 'nested', 'by-series']).default('nested'),
    metadataProvider: z.enum(['anilist', 'mangadex', 'comicvine', 'fandom', 'auto']).default('auto'),
  }),

  // Reader configuration
  reader: z.object({
    readingMode: z.enum(['single', 'double', 'webtoon']).default('single'),
    readingDirection: z.enum(['ltr', 'rtl']).default('ltr'),
    fitMode: z.enum(['height', 'width', 'original']).default('height'),
    backgroundColor: z.string().default('#000000'),
    preloadPages: z.number().min(0).max(10).default(3),
  }),
} as const;

/**
 * Inferred config types
 */
export type ConfigTypes = InferSchemaTypes<typeof configSchemas>;

/**
 * Config keys
 */
export type ConfigKey = keyof ConfigTypes;

/**
 * Get config type by key
 */
export type GetConfigType<K extends ConfigKey> = ConfigTypes[K];