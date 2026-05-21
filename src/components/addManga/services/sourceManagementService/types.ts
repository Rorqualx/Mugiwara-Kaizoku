/**
 * Source Management Service - Type Definitions
 *
 * Shared type definitions for source management modules.
 * Defines interfaces for mutations, provider data, and service configuration.
 *
 * Extracted from: sourceManagementService.ts (lines 1-7, 39-90)
 */

import type { ProviderMetadata, MediaGallery } from '@/types/universalImportWizard.types';

// ============================================================================
// Mutation Interface
// ============================================================================

/**
 * Generic mutation interface for tRPC mutations
 * Accepts any parameters and returns any result to match actual tRPC mutation types
 * Using `any` for params to allow compatibility with all tRPC mutation types
 */
export interface Mutation {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mutateAsync: (params: any) => Promise<any>;
}

// ============================================================================
// Provider Data Interfaces
// ============================================================================

/**
 * ComicVine API response structure
 */
export interface ComicVineData {
  id?: number | string;
  name?: string;
  site_detail_url?: string;
  siteDetailUrl?: string;
  api_detail_url?: string;
  issueCount?: number;
  count_of_issues?: number;
  issues?: Array<Record<string, unknown>>;
  aliases?: string;
  deck?: string;
  description?: string;
  image?: {
    original_url?: string;
    medium_url?: string;
    small_url?: string;
  };
  start_year?: string | number;
  publisher?: {
    name?: string;
  };
}

/**
 * Fandom/Wikipedia raw data structure
 */
export interface WikiRawData {
  volumeList?: Array<{
    chapters?: Array<Record<string, unknown>>;
    [key: string]: unknown;
  }>;
  chapters?: Array<Record<string, unknown>>;
  [key: string]: unknown;
}

// ============================================================================
// Service Configuration
// ============================================================================

/**
 * Configuration for SourceManagementService
 * Contains all required mutations for metadata providers
 */
export interface SourceManagementServiceConfig {
  fetchAnilistMutation: Mutation;
  fetchFandomMutation: Mutation;
  parseFandomUrlMutation?: Mutation; // For comprehensive Fandom parsing
  fetchComicvineMutation: Mutation;
  fetchComicvineVolumeDetailsMutation: Mutation;
  scrapeComicVineVolumeMutation?: Mutation; // Optional for backward compatibility
  scrapeComicVineChaptersMutation?: Mutation; // For batch scraping chapters
  scrapeComicVineVolumeUrlsMutation?: Mutation; // For getting volume URLs from series page
  fetchWikipediaMutation?: Mutation; // For fetching enhanced Wikipedia metadata (author, publisher, etc.)
}

// ============================================================================
// Re-exports for convenience
// ============================================================================

export type { ProviderMetadata, MediaGallery };
