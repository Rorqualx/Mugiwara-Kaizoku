/**
 * Provider Registry Types
 *
 * Type definitions for the provider registry system.
 * Defines configuration, strategy interfaces, and registry options.
 *
 * Extracted from: registry.ts (lines 24-54)
 */

import type { SearchResult, MangaMetadata } from '@/types/search.types';
import type { AsyncResult } from '@/utils/async-result';

import type { MetadataProvider } from '@prisma/client';

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Provider Configuration
 *
 * Configuration options for a metadata provider.
 */
export interface ProviderConfig {
  enabled: boolean;
  priority: number;
  apiKey?: string;
  apiUrl?: string;
  timeout?: number;
  rateLimit?: {
    requests: number;
    window: number;
  };
  fallbackProviders?: MetadataProvider[];
}

/**
 * Provider Strategy Interface
 *
 * Core interface that all provider strategies must implement.
 * Defines the contract for metadata provider operations.
 */
export interface ProviderStrategy {
  name: string;
  type: MetadataProvider;
  search(query: string, options?: unknown): Promise<AsyncResult<SearchResult[], Error>>;
  getMetadata(id: string, options?: unknown): Promise<AsyncResult<MangaMetadata, Error>>;
  isEnabled(): Promise<boolean>;
  getConfig(): ProviderConfig;
  updateConfig(config: Partial<ProviderConfig>): void;
}

/**
 * Provider Registry Options
 *
 * Options for configuring the provider registry behavior.
 */
export interface ProviderRegistryOptions {
  enableFallback?: boolean;
  maxRetries?: number;
  cacheResults?: boolean;
  performanceTracking?: boolean;
}
