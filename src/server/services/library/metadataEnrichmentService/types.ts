/**
 * Types for MetadataEnrichmentService
 *
 * Shared type definitions for provider fetchers and enrichment operations.
 *
 * Extracted from: metadataEnrichmentService.ts
 */

import type { AlternativeTitlesOption } from '@/types/search-types/configuration.types';
import type { EnrichmentLevel } from '@/utils/metadata-cache';
import { isObject, hasProperty } from '@/utils/type-guards';

// ============================================================================
// Alternative Titles Types
// ============================================================================

/**
 * Alternative titles extracted from primary provider matches.
 * Used to improve secondary provider search accuracy.
 * Re-exported from configuration.types for convenience.
 */
export type AlternativeTitles = AlternativeTitlesOption;

// ============================================================================
// Provider Phase Types
// ============================================================================

/**
 * Categorization of providers into phases for two-phase enrichment.
 * Primary providers have rich alternative title data.
 * Secondary providers benefit from alternative titles for better matching.
 */
export type ProviderPhase = 'primary' | 'secondary';

/**
 * Provider phase configuration
 */
export const PROVIDER_PHASES: Record<string, ProviderPhase> = {
  anilist: 'primary',
  mangadex: 'primary',
  comicvine: 'secondary',
  fandom: 'secondary',
  wikipedia: 'secondary',
};

/**
 * Get the phase for a provider
 */
export function getProviderPhase(provider: string): ProviderPhase {
  return PROVIDER_PHASES[provider.toLowerCase()] ?? 'secondary';
}

/**
 * Categorize providers into primary and secondary phases
 */
export function categorizeProviders(providers: string[]): {
  primary: string[];
  secondary: string[];
} {
  const primary: string[] = [];
  const secondary: string[] = [];

  for (const provider of providers) {
    if (getProviderPhase(provider) === 'primary') {
      primary.push(provider);
    } else {
      secondary.push(provider);
    }
  }

  return { primary, secondary };
}

// ============================================================================
// Enrichment Options
// ============================================================================

/**
 * Options for metadata enrichment
 */
export interface EnrichmentOptions {
  providers?: string[];
  minConfidence?: number;
  autoSelect?: boolean;
  fetchFullMetadata?: boolean;
  useCache?: boolean;
  maxRetries?: number;
  priority?: number;
  /**
   * Enable two-phase enrichment for better ComicVine/Fandom matching.
   * When true, primary providers (AniList, MangaDex) are searched first
   * to extract alternative titles, then passed to secondary providers.
   * @default true
   */
  enableTwoPhaseEnrichment?: boolean;
}

/**
 * Result of a provider match
 */
export interface ProviderMatch {
  id: string;
  provider: string;
  providerId: string;
  title: string;
  confidence: number;
  metadata?: unknown;
}

/**
 * Result of enrichment operation
 */
export interface EnrichmentResult {
  status: 'no_matches' | 'matches_found' | 'enriched' | 'error';
  manga: {
    id: number;
    title: string;
  };
  matches?: ProviderMatch[];
  appliedMatch?: ProviderMatch;
  requiresUserSelection?: boolean;
  error?: Error;
  enrichedData?: unknown;
}

/**
 * Enhanced enrichment result with caching info
 */
export interface EnhancedEnrichmentResult {
  provider: string;
  resultId: string;
  enrichmentLevel: EnrichmentLevel;
  data: unknown;
  fromCache: boolean;
  duration: number;
  errors?: string[];
}

/**
 * Mutation interface with async methods
 */
export interface Mutation<TInput = unknown, TOutput = unknown> {
  mutateAsync: (input: TInput) => Promise<TOutput>;
  mutate?: (input: TInput) => Promise<TOutput>;
}

/**
 * Type guard for mutation objects
 */
export function isMutation(value: unknown): value is Mutation {
  return (
    isObject(value) &&
    hasProperty(value, 'mutateAsync') &&
    typeof value['mutateAsync'] === 'function'
  );
}

/**
 * Provider mutations interface for client-side operations
 */
export interface ProviderMutations {
  fetchEnhancedFandomMutation?: Mutation;
  fetchFandomMutation?: Mutation;
  fetchComicvineMutation?: Mutation;
  fetchComicvineVolumeDetailsMutation?: Mutation;
  fetchComicVineIssues?: Mutation;
  fetchWikipediaMutation?: Mutation;
  fetchAnilistMutation?: Mutation;
}
