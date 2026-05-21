/**
 * Result Matching Utilities
 *
 * Provides smart matching logic for finding the best matching result
 * across different metadata providers. Used by QuickAddService to
 * correctly fetch data from preferred providers.
 *
 * Uses a locally-inlined Jaccard similarity — this is the only remaining
 * consumer of the legacy word-level composite matcher, so it stays client-local
 * and avoids pulling server-only modules into the bundle.
 *
 * @module components/addManga/utils/result-matching
 */

import type { ExtendedMangaSearchResult } from '@/types/search.types';
import { logger } from '@/utils/logger';

/**
 * Strip edition/quality suffixes and Part-N before normalising. Mirrors the
 * legacy title-similarity behaviour for consistency across search result
 * uniqueness checks.
 */
function stripTitlePatternsLocal(title: string): string {
  return title
    .replace(/\s+Part\s+\d+\b/gi, '')
    .replace(/\s+Part\s+(?:I{1,3}|IV|VI{0,3}|IX|X{0,3})\b/gi, '')
    .replace(/\s*\(\d{4}\)/g, '')
    .replace(/\s*-?\s*(?:Digital|HD|Complete|Omnibus|Colored|Full Color|Manga)\s*$/gi, '')
    .trim();
}

function baseNormalizeTitle(title: string): string {
  return stripTitlePatternsLocal(title)
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Jaccard similarity on word sets — used by Strategy 5 fuzzy matching below.
 * Appropriate for comparing search-result titles across providers.
 */
function jaccardSimilarity(str1: string, str2: string): number {
  const words1 = new Set(str1.split(' ').filter((w) => w.length > 0));
  const words2 = new Set(str2.split(' ').filter((w) => w.length > 0));
  if (words1.size === 0 && words2.size === 0) return 1.0;
  if (words1.size === 0 || words2.size === 0) return 0.0;
  const intersection = new Set([...words1].filter((w) => words2.has(w)));
  const union = new Set([...words1, ...words2]);
  return intersection.size / union.size;
}

/**
 * Options for finding the best matching result
 */
export interface MatchOptions {
  /** Use provider-specific IDs (anilistId, comicvineId, etc.) for matching */
  useProviderIds?: boolean;
  /** Use normalized title comparison */
  useNormalizedTitle?: boolean;
  /** Check alternative titles array */
  useAlternativeTitles?: boolean;
  /** Minimum similarity threshold (0-1) for fuzzy matching */
  similarityThreshold?: number;
  /** Fall back to first result if no match found */
  fallbackToFirst?: boolean;
}

/**
 * Match result with confidence information
 */
export interface MatchResult<T> {
  result: T;
  strategy: 'provider-id' | 'exact-title' | 'normalized-title' | 'alternative-title' | 'similarity' | 'first-result';
  confidence: number;
}

/**
 * Normalize a title for result matching
 *
 * Extends the base normalizeTitle with additional processing specific to
 * search result matching: removes media type annotations in parentheses/brackets
 * like "(TV)", "(Manga)", "[OVA]", etc.
 *
 * @param title - The title to normalize
 * @returns Normalized title string
 */
export function normalizeTitle(title: string): string {
  // First, remove media type annotations in parentheses/brackets
  const withoutAnnotations = title
    // Remove content in parentheses (TV), (Manga), etc.
    .replace(/\s*\([^)]*\)\s*/g, ' ')
    // Remove content in brackets [TV], [Manga], etc.
    .replace(/\s*\[[^\]]*\]\s*/g, ' ')
    .trim();

  // Then apply base normalization
  return baseNormalizeTitle(withoutAnnotations);
}

/**
 * Calculate similarity between two strings using Jaccard similarity
 * (intersection over union of word sets)
 *
 * Uses simple Jaccard similarity for search result matching, which is
 * more appropriate for comparing titles across different providers.
 *
 * @param a - First string
 * @param b - Second string
 * @returns Similarity score between 0 and 1
 */
export function calculateTitleSimilarity(a: string, b: string): number {
  const normalizedA = normalizeTitle(a);
  const normalizedB = normalizeTitle(b);
  return jaccardSimilarity(normalizedA, normalizedB);
}

/**
 * Get provider-specific ID field name
 */
function getProviderIdField(provider: string): string {
  const providerIdMap: Record<string, string> = {
    anilist: 'anilistId',
    comicvine: 'comicvineId',
    fandom: 'fandomId',
    wikipedia: 'wikipediaId',
    mal: 'malId',
    kitsu: 'kitsuId'
  };
  return providerIdMap[provider.toLowerCase()] ?? `${provider.toLowerCase()}Id`;
}

/**
 * Extract provider-specific ID from a result
 */
function getProviderId(result: ExtendedMangaSearchResult, provider: string): string | number | undefined {
  const idField = getProviderIdField(provider);
  const record = result as unknown as Record<string, unknown>;

  // Try the provider-specific ID field
  const providerId = record[idField];
  if (providerId !== undefined && providerId !== null && providerId !== '') {
    return providerId as string | number;
  }

  // If the result's provider matches, use its id directly
  if (result.provider.toLowerCase() === provider.toLowerCase()) {
    return result.id;
  }

  return undefined;
}

/**
 * Find the best matching result from a list of candidates
 *
 * Uses multiple matching strategies in order of preference:
 * 1. Provider-specific ID matching (most reliable)
 * 2. Exact title match
 * 3. Normalized title match
 * 4. Alternative titles match
 * 5. Similarity threshold match
 * 6. First result fallback (least reliable, but search results are ordered by relevance)
 *
 * @param target - The target result to match against
 * @param candidates - List of candidate results to search
 * @param targetProvider - The provider we're trying to find a match from
 * @param options - Matching options
 * @returns The best matching result with confidence info, or null if no match
 */
// eslint-disable-next-line complexity, max-statements -- 6-strategy matching algorithm with fallback chain; complexity inherent to multi-strategy matching
export function findBestMatchingResult(
  target: ExtendedMangaSearchResult,
  candidates: ExtendedMangaSearchResult[],
  targetProvider: string,
  options: MatchOptions = {}
): MatchResult<ExtendedMangaSearchResult> | null {
  const {
    useProviderIds = true,
    useNormalizedTitle = true,
    useAlternativeTitles = true,
    similarityThreshold = 0.7,
    fallbackToFirst = true
  } = options;

  if (candidates.length === 0) {
    return null;
  }

  const targetTitle = target.title;

  // Strategy 1: Provider-specific ID matching
  if (useProviderIds) {
    // Check if target has an ID for the target provider
    const targetProviderId = getProviderId(target, targetProvider);

    if (targetProviderId !== undefined) {
      const match = candidates.find(c => {
        // If the candidate is from the target provider, compare IDs directly
        if (c.provider.toLowerCase() === targetProvider.toLowerCase()) {
          return String(c.id) === String(targetProviderId);
        }
        // Also check if candidate has the same provider-specific ID
        const candidateProviderId = getProviderId(c, targetProvider);
        return candidateProviderId !== undefined && String(candidateProviderId) === String(targetProviderId);
      });

      if (match) {
        logger.debug('[result-matching] Found match via provider ID', {
          targetProvider,
          targetProviderId,
          matchTitle: match.title
        });
        return { result: match, strategy: 'provider-id', confidence: 1.0 };
      }
    }
  }

  // Strategy 2: Exact title match
  const exactMatch = candidates.find(c => c.title === targetTitle);
  if (exactMatch) {
    logger.debug('[result-matching] Found exact title match', {
      title: targetTitle,
      provider: exactMatch.provider
    });
    return { result: exactMatch, strategy: 'exact-title', confidence: 1.0 };
  }

  // Strategy 3: Normalized title match
  if (useNormalizedTitle) {
    const normalizedTarget = normalizeTitle(targetTitle);
    const normalizedMatch = candidates.find(c =>
      normalizeTitle(c.title) === normalizedTarget
    );

    if (normalizedMatch) {
      logger.debug('[result-matching] Found normalized title match', {
        originalTitle: targetTitle,
        normalizedTitle: normalizedTarget,
        matchTitle: normalizedMatch.title
      });
      return { result: normalizedMatch, strategy: 'normalized-title', confidence: 0.95 };
    }
  }

  // Strategy 4: Alternative titles match
  if (useAlternativeTitles) {
    // Check target's alternative titles against candidate titles
    const targetAlts = target.alternativeTitles ?? [];
    for (const alt of targetAlts) {
      const altNormalized = normalizeTitle(alt);
      const altMatch = candidates.find(c =>
        normalizeTitle(c.title) === altNormalized
      );

      if (altMatch) {
        logger.debug('[result-matching] Found match via target alternative title', {
          alternativeTitle: alt,
          matchTitle: altMatch.title
        });
        return { result: altMatch, strategy: 'alternative-title', confidence: 0.9 };
      }
    }

    // Check candidate alternative titles against target title
    const normalizedTarget = normalizeTitle(targetTitle);
    for (const candidate of candidates) {
      const candidateAlts = candidate.alternativeTitles ?? [];
      for (const alt of candidateAlts) {
        if (normalizeTitle(alt) === normalizedTarget) {
          logger.debug('[result-matching] Found match via candidate alternative title', {
            targetTitle,
            alternativeTitle: alt,
            matchTitle: candidate.title
          });
          return { result: candidate, strategy: 'alternative-title', confidence: 0.9 };
        }
      }
    }
  }

  // Strategy 5: Similarity threshold match
  if (similarityThreshold > 0) {
    let bestMatch: ExtendedMangaSearchResult | null = null;
    let bestSimilarity = 0;

    for (const candidate of candidates) {
      const similarity = calculateTitleSimilarity(targetTitle, candidate.title);
      if (similarity >= similarityThreshold && similarity > bestSimilarity) {
        bestMatch = candidate;
        bestSimilarity = similarity;
      }
    }

    if (bestMatch) {
      logger.debug('[result-matching] Found match via similarity', {
        targetTitle,
        matchTitle: bestMatch.title,
        similarity: bestSimilarity
      });
      return { result: bestMatch, strategy: 'similarity', confidence: bestSimilarity };
    }
  }

  // Strategy 6: First result fallback
  if (fallbackToFirst && candidates.length > 0) {
    const firstResult = candidates[0];
    if (firstResult) {
      logger.debug('[result-matching] Using first result as fallback', {
        targetTitle,
        firstResultTitle: firstResult.title,
        candidateCount: candidates.length
      });
      return { result: firstResult, strategy: 'first-result', confidence: 0.5 };
    }
  }

  logger.debug('[result-matching] No match found', {
    targetTitle,
    targetProvider,
    candidateCount: candidates.length
  });

  return null;
}
