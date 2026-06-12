/**
 * Provider Matching - Core Matching Operations
 *
 * Handles cross-provider manga matching, confidence calculation, and result aggregation.
 * All type safety violations fixed:
 * - Line 188: no-param-reassign - Using map() instead of forEach() mutation
 * - Line 208: no-non-null-assertion - Type guard with filter instead of !
 * - Line 312: no-unnecessary-condition - Removed if present
 *
 * Extracted from: providerMatchingService.ts (lines 123-383)
 * Date: 2025-11-21
 *
 * @module provider-matching/core-matching
 */

// ============================================================================
// Imports
// ============================================================================

import { applySingleTokenGuard } from '@/server/trpc/routers/manga/metadataOperations/enrichment-pipeline/matching/sequel-penalty';
import { hasEditionMismatch } from '@/server/trpc/routers/manga/metadataOperations/enrichment-pipeline/utils';
import type { ProviderMatcher } from '@/server/utils/providerMatcher';
import { diceCoefficient, normalizeTitle } from '@/server/utils/string';
import type { MangaMetadata, SearchProvider } from '@/types/search.types';
import type { AsyncResult } from '@/utils/async-result';
import { createSuccessResult, createErrorResult, isSuccess } from '@/utils/async-result';
import { serverLogger as logger } from '@/utils/serverLogger';

import { mergeMatchMetadata } from './metadata-operations';
import {
  type ProviderMatchResult,
  type CrossProviderMatchResult,
  type ProviderMatchingServiceConfig,
  type MetadataWithProvider,
  normalizeForComparison,
} from './types-and-utils';


import type { MetadataService } from '../metadataService';


// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Calculate title similarity score between two strings.
 * Uses bigram Sørensen-Dice — the same scorer as the enrichment pipeline's
 * matchers (anilist-match.ts). Replaces the old Levenshtein ratio, which
 * over-scored short-vs-long title pairs and had drifted from the pipeline.
 *
 * @param query - The search query
 * @param title - The title to compare against
 * @returns Similarity score between 0 and 1 (1 = identical)
 */
function calculateTitleSimilarity(query: string, title: string): number {
  if (normalizeForComparison(query) === normalizeForComparison(title)) {
    return 1.0;
  }
  return diceCoefficient(normalizeTitle(query), normalizeTitle(title));
}

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Type for the search provider registry
 */
export interface SearchProviderRegistry {
  get(name: string): SearchProvider | undefined;
  getAll(): Record<string, SearchProvider>;
  register(provider: SearchProvider): void;
  initialize(): void;
}

// ============================================================================
// Context Type (dependency injection)
// ============================================================================

/**
 * Service context for core matching operations
 * Provides all necessary dependencies through dependency injection
 */
export interface CoreMatchingContext {
  matcher: ProviderMatcher;
  metadataService: MetadataService;
  config: ProviderMatchingServiceConfig;
  searchProviderRegistry: SearchProviderRegistry;
}

// ============================================================================
// Public API - Cross-Provider Matching
// ============================================================================

/**
 * Find matches for a manga title across all enabled providers
 *
 * This is the primary cross-provider search function that:
 * 1. Searches multiple providers in parallel
 * 2. Fetches metadata for each match (if enabled)
 * 3. Calculates confidence scores
 * 4. Merges metadata from all sources (if enabled)
 * 5. Returns sorted results with best match recommendation
 *
 * @param title - The manga title to search for
 * @param options - Optional search configuration
 * @param options.providers - Specific providers to search (defaults to all enabled)
 * @param options.limit - Maximum results per provider (default: 20)
 * @param context - Service context with dependencies
 * @returns AsyncResult with cross-provider match results
 *
 * @example
 * ```typescript
 * const result = await findCrossProviderMatches(
 *   "One Piece",
 *   { providers: ["anilist", "comicvine"], limit: 10 },
 *   context
 * );
 *
 * if (isSuccess(result)) {
 *   logger.info(`Found ${result.data.matches.length} matches`);
 *   logger.info(`Best match: ${result.data.bestMatch?.title}`);
 * }
 * ```
 */
export async function findCrossProviderMatches(
  title: string,
  options: {
    providers?: string[];
    limit?: number;
    alternativeTitles?: {
      english?: string | undefined;
      romaji?: string | undefined;
      native?: string | undefined;
      synonyms?: string[] | undefined;
    };
  } | undefined,
  context: CoreMatchingContext
): Promise<AsyncResult<CrossProviderMatchResult, Error>> {
  try {
    logger.info(`Starting cross-provider search for: "${title}"`);

    // Get providers to search
    const allProviders = Object.keys(context.searchProviderRegistry.getAll());

    // DEBUG: Log available providers
    logger.warn('[core-matching] Available providers in registry:', { allProviders });
    logger.warn('[core-matching] Requested providers:', { requested: options?.providers });

    const providersToUse = options?.providers
      ? allProviders.filter(p => options.providers?.includes(p))
      : allProviders.filter(p => !context.config.excludeProviders?.includes(p));

    // DEBUG: Log filtered providers
    logger.warn('[core-matching] Providers to use after filtering:', { providersToUse });

    if (providersToUse.length === 0) {
      logger.warn('[core-matching] NO PROVIDERS TO USE - returning empty matches');
      return createSuccessResult({
        query: title,
        matches: [],
      });
    }

    // Search each provider in parallel
    // eslint-disable-next-line complexity -- Provider matching handles search, metadata fetch, confidence calculation, and error handling per provider
    const matchPromises = providersToUse.map(async (providerName) => {
      try {
        logger.warn(`[core-matching] Searching provider: ${providerName} for "${title}"`);

        const matchId = await context.matcher.findMatch(title, providerName);
        logger.warn(`[core-matching] Matcher result for ${providerName}:`, { matchId: matchId ?? 'null' });

        if (!matchId) {
          logger.warn(`[core-matching] No match found on ${providerName}`);
          return null;
        }

        // Get the search results to find the matched item
        const provider = context.searchProviderRegistry.get(providerName);
        if (!provider) {
          logger.warn(`[core-matching] Provider ${providerName} not found in registry`);
          return null;
        }

        // Extract wiki from matchId for fandom provider (format: "wiki-name:mw-123")
        // This allows us to pass a wiki hint to FandomProvider for more accurate searching
        const wikiHint = providerName === 'fandom' && matchId.includes(':')
          ? matchId.split(':')[0]
          : undefined;

        const searchOptions: {
          limit?: number;
          wikiHint?: string;
          alternativeTitles?: {
            english?: string | undefined;
            romaji?: string | undefined;
            native?: string | undefined;
            synonyms?: string[] | undefined;
          };
        } = {
          limit: options?.limit ?? 20,
        };
        if (wikiHint) {
          searchOptions.wikiHint = wikiHint;
          logger.warn(`[core-matching] Using wiki hint for fandom search:`, { wikiHint });
        }

        // Pass alternative titles to providers that support multi-query search (e.g., ComicVine)
        if (options?.alternativeTitles) {
          searchOptions.alternativeTitles = options.alternativeTitles;
          logger.warn(`[core-matching] Passing alternative titles to ${providerName}:`, {
            english: options.alternativeTitles.english,
            romaji: options.alternativeTitles.romaji,
          });
        }

        const searchResults = await provider.search(title, searchOptions);
        logger.warn(`[core-matching] Search results from ${providerName}:`, { count: searchResults.length });

        let matchedResult = searchResults.find(r => r.id === matchId);

        // Fallback: If matchId not found but search results exist from the same wiki,
        // use the best matching result. This handles spin-off/subtitle pages like
        // "Ascendance of a Bookworm: Hannelore's Fifth Year at the Royal Academy"
        // where the matcher finds the main series but search finds the spin-off.
        if (!matchedResult && searchResults.length > 0) {
          const wikiPrefix = matchId.split(':')[0]; // e.g., "ascendance-of-a-bookworm"
          const sameWikiResults = searchResults.filter(r => r.id.startsWith(wikiPrefix + ':'));
          if (sameWikiResults.length > 0) {
            // Find the result with the highest title similarity to the query
            const bestMatch = sameWikiResults.reduce((best, current) => {
              const bestSimilarity = calculateTitleSimilarity(title, best.title);
              const currentSimilarity = calculateTitleSimilarity(title, current.title);
              return currentSimilarity > bestSimilarity ? current : best;
            });
            logger.warn(`[core-matching] Fallback: Using best matching result from same wiki`, {
              originalMatchId: matchId,
              fallbackId: bestMatch.id,
              fallbackTitle: bestMatch.title
            });
            matchedResult = bestMatch;
          }
        }

        if (!matchedResult) {
          logger.warn(`[core-matching] Match ID ${matchId} not found in ${providerName} search results`);
          return null;
        }

        const finalMatchId = matchedResult.id;
        logger.warn(`[core-matching] Found match on ${providerName}:`, { id: finalMatchId, title: matchedResult.title });

        // Create base match result (confidence will be calculated later)
        const matchResult: ProviderMatchResult = {
          provider: providerName,
          providerId: finalMatchId,
          title: matchedResult.title,
          confidence: 0.8, // Temporary value, will be calculated below
        };

        // Fetch metadata if enabled
        logger.warn(`[core-matching] fetchMetadata config: ${context.config.fetchMetadata}`);
        if (context.config.fetchMetadata) {
          logger.warn(`[core-matching] Fetching metadata for ${providerName}:${matchId}`);
          const metadataResult = await context.metadataService.fetchMetadata(matchId, providerName);
          logger.warn(`[core-matching] Metadata result for ${providerName}:`, {
            isSuccess: isSuccess(metadataResult),
            hasData: isSuccess(metadataResult) && !!metadataResult.data,
            dataKeys: isSuccess(metadataResult) && metadataResult.data ? Object.keys(metadataResult.data) : []
          });
          if (isSuccess(metadataResult) && metadataResult.data) {
            matchResult.metadata = metadataResult.data;
          }
        } else {
          logger.warn(`[core-matching] Metadata fetch DISABLED for ${providerName}`);
        }

        return matchResult;
      } catch (error: unknown) {
        logger.error(`[core-matching] Error searching provider ${providerName}:`, error);
        return null;
      }
    });

    const matches = (await Promise.all(matchPromises)).filter(
      (match): match is ProviderMatchResult => match !== null
    );

    // ✅ FIX for line 188: no-param-reassign
    // BEFORE (WRONG): matches.forEach(match => { match.confidence = ... })
    // AFTER (CORRECT): Create new objects instead of mutating
    const matchesWithConfidence = matches.map(match => ({
      ...match,
      confidence: calculateConfidence(title, match.title, match.metadata),
    }));

    // Sort by confidence (descending)
    matchesWithConfidence.sort((a, b) => b.confidence - a.confidence);

    // Create result object
    const result: CrossProviderMatchResult = {
      query: title,
      matches: matchesWithConfidence,
    };

    const bestMatch = matchesWithConfidence[0];
    if (bestMatch !== undefined) {
      result.bestMatch = bestMatch;
    }

    // Merge metadata if enabled and multiple matches found
    if (context.config.mergeMetadata && matchesWithConfidence.length > 1) {
      // ✅ FIX for line 208: no-non-null-assertion
      // BEFORE (WRONG): metadata: m.metadata!
      // AFTER (CORRECT): Type guard with filter
      const metadataToMerge = matchesWithConfidence
        .map(m => {
          if (!m.metadata) return null;
          return {
            provider: m.provider,
            metadata: m.metadata,
          };
        })
        .filter((item): item is MetadataWithProvider => item !== null);

      if (metadataToMerge.length > 0) {
        result.mergedMetadata = mergeMatchMetadata(metadataToMerge);
      }
    }

    logger.info(`Found ${matchesWithConfidence.length} matches across providers for: "${title}"`);
    return createSuccessResult(result);
  } catch (error: unknown) {
    logger.error('Error in cross-provider matching:', error);
    return createErrorResult(
      error instanceof Error
        ? error
        : new Error(`Failed to find cross-provider matches: ${String(error)}`)
    );
  }
}

// ============================================================================
// Public API - Provider-to-Provider Matching
// ============================================================================

/**
 * Find matches between two specific providers
 *
 * This is useful when you have an ID from one provider and want to find
 * the corresponding manga on another provider.
 *
 * @param title - The manga title
 * @param sourceProvider - Source provider name (for logging)
 * @param targetProvider - Target provider name to search
 * @param context - Service context with dependencies
 * @returns AsyncResult with match result or null if no match found
 *
 * @example
 * ```typescript
 * const result = await findProviderToProviderMatch(
 *   "One Piece",
 *   "anilist",
 *   "fandom",
 *   context
 * );
 *
 * if (isSuccess(result) && result.data) {
 *   logger.info(`Found on Fandom: ${result.data.providerId}`);
 * }
 * ```
 */
export async function findProviderToProviderMatch(
  title: string,
  sourceProvider: string,
  targetProvider: string,
  context: CoreMatchingContext
): Promise<AsyncResult<ProviderMatchResult | null, Error>> {
  try {
    logger.info(`Finding match for "${title}" from ${sourceProvider} to ${targetProvider}`);

    // Find match on target provider
    const matchId = await context.matcher.findMatch(title, targetProvider);
    if (!matchId) {
      logger.info(`No match found on ${targetProvider} for: "${title}"`);
      return createSuccessResult(null);
    }

    // Get provider and search for details
    const provider = context.searchProviderRegistry.get(targetProvider);
    if (!provider) {
      return createErrorResult(new Error(`Provider ${targetProvider} not found`));
    }

    const searchResults = await provider.search(title);
    const matchedResult = searchResults.find(r => r.id === matchId);
    if (!matchedResult) {
      return createSuccessResult(null);
    }

    // Create match result
    const matchResult: ProviderMatchResult = {
      provider: targetProvider,
      providerId: matchId,
      title: matchedResult.title,
      confidence: calculateConfidence(title, matchedResult.title),
    };

    // Fetch metadata if enabled
    if (context.config.fetchMetadata) {
      const metadataResult = await context.metadataService.fetchMetadata(matchId, targetProvider);
      if (isSuccess(metadataResult) && metadataResult.data) {
        matchResult.metadata = metadataResult.data;
      }
    }

    return createSuccessResult(matchResult);
  } catch (error: unknown) {
    logger.error(`Error finding ${sourceProvider} to ${targetProvider} match:`, error);
    return createErrorResult(
      error instanceof Error
        ? error
        : new Error(`Failed to find provider match: ${String(error)}`)
    );
  }
}

// ============================================================================
// Public API - Confidence Calculation
// ============================================================================

/**
 * Calculate confidence score for a match
 *
 * Uses multiple strategies to determine match quality:
 * 1. Title similarity (Levenshtein distance)
 * 2. Alternative title matches
 * 3. Metadata richness (more complete metadata = higher confidence)
 *
 * Score ranges:
 * - 1.0: Perfect match (exact title match)
 * - 0.8-0.9: Very high confidence (contains match or alt title match)
 * - 0.6-0.8: High confidence (similar with good metadata)
 * - 0.0-0.6: Lower confidence (different titles or sparse metadata)
 *
 * @param query - Original search query
 * @param matchTitle - Matched title from provider
 * @param metadata - Optional metadata for additional scoring
 * @returns Confidence score between 0 and 1
 *
 * @example
 * ```typescript
 * const score1 = calculateConfidence("One Piece", "One Piece"); // 1.0
 * const score2 = calculateConfidence("One Piece", "One Piece: Chapter 1"); // 0.8
 * const score3 = calculateConfidence("One Piece", "ワンピース", {
 *   alternativeTitles: ["One Piece", "OP"]
 * }); // 0.9
 * ```
 */
export function calculateConfidence(
  query: string,
  matchTitle: string,
  metadata?: MangaMetadata
): number {
  // Hard-reject edition/spinoff mismatches (e.g. plain "Overlord" query vs
  // "Overlord: Shin Sekai-hen" candidate) — the same gate the enrichment
  // pipeline applies before scoring. Without it this legacy path silently
  // proposed wrong-edition matches the pipeline would refuse.
  if (hasEditionMismatch(query, matchTitle)) {
    return 0;
  }

  let score = 0;

  // Base score from title similarity
  const normalizedQuery = normalizeForComparison(query);
  const normalizedMatch = normalizeForComparison(matchTitle);

  if (normalizedQuery === normalizedMatch) {
    // Perfect match
    score = 1.0;
  } else {
    // Bigram Sørensen-Dice, mirroring the pipeline's matchers
    // (anilist-match.ts). Drops the old containment→0.8 shortcut, which let
    // a single shared word ("Berserk" in "Berserk of Gluttony") rank as a
    // very-high match, and the Levenshtein fallback that had drifted from
    // the pipeline scorer.
    score = diceCoefficient(normalizeTitle(query), normalizeTitle(matchTitle));
    // Pipeline guard: penalise 1-token overlaps against long candidate
    // titles so one common word can't drive a confident false match.
    score = Math.max(0, applySingleTokenGuard(score, query, matchTitle));
  }

  // Boost score if alternative titles match
  if (metadata?.alternativeTitles) {
    for (const altTitle of metadata.alternativeTitles) {
      const normalizedAlt = normalizeForComparison(altTitle);
      if (normalizedAlt === normalizedQuery) {
        score = Math.max(score, 0.9);
        break;
      }
    }
  }

  // Boost score if metadata is rich
  if (metadata) {
    let metadataScore = 0;
    if (metadata.description) metadataScore += 0.02;
    if (metadata.coverUrl) metadataScore += 0.02;
    if (metadata.authors?.length) metadataScore += 0.02;
    if (metadata.genres?.length) metadataScore += 0.02;
    if (metadata.year) metadataScore += 0.02;
    score = Math.min(1.0, score + metadataScore);
  }

  return score;
}
