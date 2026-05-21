/**
 * Provider Fetcher Types
 *
 * Type definitions and interfaces for the provider fetching service.
 *
 * Extracted from: provider-fetcher.ts (lines 31-69)
 */

import type { PartialUnifiedMetadata } from '@/types/search.types';

/**
 * Input manga information for provider fetching
 */
export interface FetchInput {
  /** Database manga ID */
  id: number;
  /** Manga title for search/matching */
  title: string;
  /** Source/provider name */
  source?: string;
  /** Provider metadata containing IDs */
  providerMetadata?: unknown;
}

/**
 * Configuration for provider fetching
 */
export interface ProviderFetchConfig {
  /** Whether this is the primary provider (uses stored ID if available) */
  isPrimary?: boolean;
  /** Force refresh even if cached */
  forceRefresh?: boolean;
  /** Timeout in milliseconds */
  timeout?: number;
}

/**
 * Result of fetching from a provider
 */
export interface ProviderFetchResult {
  /** Provider name */
  provider: string;
  /** Fetched metadata in unified format */
  metadata: PartialUnifiedMetadata;
  /** Whether the fetch was successful */
  success: boolean;
  /** Error message if failed */
  error?: string;
}
