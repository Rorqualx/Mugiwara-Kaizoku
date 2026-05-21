/**
 * ComicVine Search Optimizations
 *
 * Contains optimized search methods for ComicVine provider:
 * - Multi-query search with title variations
 * - Optimized ranking with publisher and resource type scoring
 *
 * Extracted from ComicVineProvider.ts to keep file under 500 lines.
 */

import { applyPublisherScoringSync } from '@/server/services/comicvine/publisher-scoring';
import type { ComicVineSearchConfig } from '@/server/services/comicvine/search-config';
import { getComicVineSearchConfig } from '@/server/services/comicvine/search-config';
import { comicvineService } from '@/server/services/comicvine/service';
import {
  generateComicVineSearchVariants,
  normalizeForComicVineSearch,
} from '@/server/services/comicvine/title-variants';
import type { AlternativeTitles } from '@/server/services/comicvine/title-variants';
import type { SearchResult, SearchOptions, ComicVineSearchResult } from '@/types/search.types';
import { logger } from '@/utils/logger';

import { applyLanguageScoring, getPreferredLanguage, detectNonEnglishVariant } from '../comicvine-language-filter';
import { ComicVineValidator, COMICVINE_RESOURCE_VOLUME } from '../search-result-validator/comicvine-validator';
import { SearchResultValidator } from '../SearchResultValidator';

import type { MetadataProvider } from '@prisma/client';

// ============================================================================
// Types
// ============================================================================

/**
 * Extended search options with alternative titles for multi-query search
 */
export interface ComicVineSearchOptions extends SearchOptions {
  alternativeTitles?: AlternativeTitles;
}

/**
 * Search params for ComicVine API
 */
export interface ComicVineSearchParams {
  query: string;
  apiKey: string;
  limit?: number;
  offset?: number;
  sort?: string;
}

/**
 * Scored result for ranking
 */
interface ScoredResult {
  result: SearchResult;
  score: number;
  rawData: Record<string, unknown> | undefined;
}

// ============================================================================
// Title Normalization
// ============================================================================

/**
 * Normalize query based on config settings
 */
export function normalizeQueryIfEnabled(query: string, config: ComicVineSearchConfig): string {
  return config.enableTitleNormalization ? normalizeForComicVineSearch(query) : query;
}

// ============================================================================
// Relevance Scoring
// ============================================================================

/**
 * Calculate base relevance score for a result based on title match
 */
export function calculateRelevanceScore(title: string, query: string): number {
  const normalizedTitle = title.toLowerCase().trim();
  const normalizedQuery = query.toLowerCase().trim();

  if (normalizedTitle === normalizedQuery) return 1.0;
  if (normalizedTitle.startsWith(normalizedQuery)) return 0.9;

  const queryWords = normalizedQuery.split(/\s+/);
  const titleWords = normalizedTitle.split(/\s+/);

  const wordMatchScore = calculateWordMatchScore(queryWords, titleWords);
  if (wordMatchScore > 0) return wordMatchScore;

  if (normalizedTitle.includes(normalizedQuery)) return 0.6;

  const anyWordMatch = queryWords.some((qw) =>
    titleWords.some((tw) => tw.includes(qw) || qw.includes(tw))
  );

  return anyWordMatch ? 0.3 : 0.0;
}

/**
 * Calculate score based on word overlap
 */
function calculateWordMatchScore(queryWords: string[], titleWords: string[]): number {
  const allWordsMatch = queryWords.every((qw) =>
    titleWords.some((tw) => tw.includes(qw) || qw.includes(tw))
  );

  if (!allWordsMatch) return 0;

  const matchingWords = queryWords.filter((qw) => titleWords.some((tw) => tw === qw)).length;
  return 0.5 + (matchingWords / queryWords.length) * 0.4;
}

/**
 * Extract publisher name from result
 */
function extractPublisherName(result: SearchResult): string | undefined {
  const cvResult = result as ComicVineSearchResult;
  if (typeof cvResult.publisher === 'object') {
    return (cvResult.publisher as { name?: string }).name;
  }
  return typeof cvResult.publisher === 'string' ? cvResult.publisher : undefined;
}

/**
 * Apply all scoring optimizations to a base score
 */
export function applyAllScoringOptimizations(
  baseScore: number,
  result: SearchResult,
  config: ComicVineSearchConfig,
  rawData: Record<string, unknown> | undefined,
  preferredLanguage: string
): number {
  let score = baseScore;
  const publisherName = extractPublisherName(result);

  score = applyLanguageScoring(score, result.title, publisherName, preferredLanguage);

  if (config.enablePublisherBoost) {
    score = applyPublisherScoringSync(score, publisherName, config.publisherBoostMultiplier);
  }

  if (config.enableResourceTypePreference && rawData) {
    score = applyResourceTypeBonus(score, rawData, result.title, config.volumePageBonus);
  }

  return score;
}

/**
 * Apply volume page bonus if applicable
 */
function applyResourceTypeBonus(
  score: number,
  rawData: Record<string, unknown>,
  title: string,
  bonus: number
): number {
  const resourceType = ComicVineValidator.extractResourceType(rawData);
  if (resourceType === COMICVINE_RESOURCE_VOLUME) {
    logger.debug('[ComicVine] Applied volume page bonus', { title, resourceType, bonus });
    return Math.min(score + bonus, 1.0);
  }
  return score;
}

// ============================================================================
// Optimized Ranking
// ============================================================================

/**
 * Rank and filter results with all optimizations applied
 */
export function rankResultsByRelevanceOptimized(
  results: SearchResult[],
  query: string,
  preferredLanguage: string,
  config: ComicVineSearchConfig,
  rawResults?: unknown
): SearchResult[] {
  const MINIMUM_SCORE = 0.2;
  const MAX_RESULTS = 5;

  logger.info(`[ComicVine] Ranking ${results.length} results with optimizations`);

  const rawDataMap = buildRawDataMap(rawResults);
  const scoredResults = scoreAllResults(results, query, config, rawDataMap, preferredLanguage);

  scoredResults.sort((a, b) => b.score - a.score);

  const aboveMinimum = scoredResults.filter((sr) => sr.score >= MINIMUM_SCORE);

  // When preferredLanguage is 'en', strictly prefer English-publisher results.
  // Only fall back to non-English if no English results exist.
  const finalResults = preferredLanguage === 'en'
    ? filterEnglishFirst(aboveMinimum)
    : aboveMinimum;

  const filteredResults = finalResults
    .slice(0, MAX_RESULTS)
    .map((sr) => sr.result);

  logger.debug(`ComicVine optimized ranking: ${results.length} -> ${filteredResults.length} results`);

  return filteredResults;
}

/**
 * Partition results into English vs non-English, preferring English.
 * Returns English results if any exist above minimum score; otherwise falls back to all.
 * This enforces the "always use English providers" directive for ComicVine.
 */
function filterEnglishFirst(scoredResults: ScoredResult[]): ScoredResult[] {
  const english: ScoredResult[] = [];
  const nonEnglish: ScoredResult[] = [];

  for (const sr of scoredResults) {
    const publisherName = extractPublisherName(sr.result);
    const { isNonEnglish } = detectNonEnglishVariant(sr.result.title, publisherName);
    if (isNonEnglish) {
      nonEnglish.push(sr);
    } else {
      english.push(sr);
    }
  }

  if (english.length > 0) {
    logger.info(`[ComicVine] English-first filter: ${english.length} English, ${nonEnglish.length} non-English — using English`);
    return english;
  }

  logger.info(`[ComicVine] English-first filter: no English results, falling back to ${nonEnglish.length} non-English`);
  return nonEnglish;
}

/**
 * Score all results with optimizations
 */
function scoreAllResults(
  results: SearchResult[],
  query: string,
  config: ComicVineSearchConfig,
  rawDataMap: Map<string, Record<string, unknown>>,
  preferredLanguage: string
): ScoredResult[] {
  return results.map((result) => {
    const rawData = rawDataMap.get(result.id);
    const baseScore = calculateRelevanceScore(result.title, query);
    const score = applyAllScoringOptimizations(baseScore, result, config, rawData, preferredLanguage);
    return { result, score, rawData };
  });
}

/**
 * Build a map of raw data by result ID
 */
function buildRawDataMap(rawResults: unknown): Map<string, Record<string, unknown>> {
  const map = new Map<string, Record<string, unknown>>();
  if (!rawResults || typeof rawResults !== 'object') return map;

  const rawResultsObj = rawResults as { results?: unknown[] };
  if (!Array.isArray(rawResultsObj.results)) return map;

  for (const raw of rawResultsObj.results) {
    addRawDataToMap(raw, map);
  }

  return map;
}

/**
 * Add single raw data entry to map
 */
function addRawDataToMap(raw: unknown, map: Map<string, Record<string, unknown>>): void {
  if (!raw || typeof raw !== 'object') return;
  const rawData = raw as Record<string, unknown>;
  const id = rawData['id'];
  if (typeof id === 'number' || typeof id === 'string') {
    map.set(String(id), rawData);
  }
}

// ============================================================================
// Multi-Query Search
// ============================================================================

/**
 * Perform multi-query search with title variants
 */
// eslint-disable-next-line max-params -- Search pipeline function; all parameters required for variant generation and API calls
export async function searchWithVariants(
  primaryQuery: string,
  alternativeTitles: AlternativeTitles,
  apiKey: string,
  providerType: MetadataProvider,
  buildSearchParams: (query: string, apiKey: string, options?: SearchOptions) => ComicVineSearchParams,
  options?: SearchOptions
): Promise<SearchResult[]> {
  const config = await getComicVineSearchConfig();
  const preferredLanguage = await getPreferredLanguage();

  const variants = await generateComicVineSearchVariants(
    primaryQuery,
    alternativeTitles,
    config.maxQueriesPerSearch
  );

  logger.info(`[ComicVine] Multi-query search with ${variants.length} variants:`, { variants });

  const { allResults, foundHighConfidence } = await searchAllVariants(
    variants,
    primaryQuery,
    apiKey,
    providerType,
    buildSearchParams,
    options,
    config,
    preferredLanguage
  );

  if (foundHighConfidence) {
    return allResults;
  }

  // Re-rank combined results against primary query
  return rankResultsByRelevanceOptimized(allResults, primaryQuery, preferredLanguage, config);
}

/**
 * Search all variants and collect results
 */
// eslint-disable-next-line max-params -- Internal search pipeline function; parameters passed through from searchWithVariants
async function searchAllVariants(
  variants: string[],
  primaryQuery: string,
  apiKey: string,
  providerType: MetadataProvider,
  buildSearchParams: (query: string, apiKey: string, options?: SearchOptions) => ComicVineSearchParams,
  options: SearchOptions | undefined,
  config: ComicVineSearchConfig,
  preferredLanguage: string
): Promise<{ allResults: SearchResult[]; foundHighConfidence: boolean }> {
  const allResults: SearchResult[] = [];
  const seenIds = new Set<string>();

  for (const variant of variants) {
    // eslint-disable-next-line no-await-in-loop -- Sequential search with early exit on high-confidence match
    const variantResults = await searchSingleVariant(
      variant,
      apiKey,
      providerType,
      buildSearchParams,
      options,
      config,
      preferredLanguage
    );

    addUniqueResults(variantResults, allResults, seenIds);

    if (checkHighConfidenceMatch(variantResults, primaryQuery, config)) {
      return { allResults, foundHighConfidence: true };
    }
  }

  return { allResults, foundHighConfidence: false };
}

/**
 * Search a single variant query
 */
// eslint-disable-next-line max-params -- Internal search function; receives search context from searchAllVariants
async function searchSingleVariant(
  variant: string,
  apiKey: string,
  providerType: MetadataProvider,
  buildSearchParams: (query: string, apiKey: string, options?: SearchOptions) => ComicVineSearchParams,
  options: SearchOptions | undefined,
  config: ComicVineSearchConfig,
  preferredLanguage: string
): Promise<SearchResult[]> {
  try {
    const params = buildSearchParams(variant, apiKey, options);
    const rawResults = await comicvineService.searchVolumes(params);
    const results = processRawResults(rawResults, providerType);
    return rankResultsByRelevanceOptimized(results, variant, preferredLanguage, config, rawResults);
  } catch (error) {
    logger.warn(`[ComicVine] Variant search failed for "${variant}":`, { error });
    return [];
  }
}

/**
 * Add unique results to collection
 */
function addUniqueResults(
  newResults: SearchResult[],
  allResults: SearchResult[],
  seenIds: Set<string>
): void {
  for (const result of newResults) {
    if (!seenIds.has(result.id)) {
      seenIds.add(result.id);
      allResults.push(result);
    }
  }
}

/**
 * Check if top result exceeds high confidence threshold
 */
function checkHighConfidenceMatch(
  results: SearchResult[],
  primaryQuery: string,
  config: ComicVineSearchConfig
): boolean {
  const topResult = results[0];
  if (!topResult) return false;

  const topScore = calculateRelevanceScore(topResult.title, primaryQuery);
  if (topScore >= config.highConfidenceThreshold) {
    logger.info(`[ComicVine] High-confidence match found`, { title: topResult.title, score: topScore.toFixed(3) });
    return true;
  }
  return false;
}

/**
 * Process raw API results
 */
function processRawResults(rawResults: unknown, providerType: MetadataProvider): SearchResult[] {
  const rawResultsData =
    rawResults && typeof rawResults === 'object' && 'results' in rawResults
      ? (rawResults as { results: unknown }).results
      : [];
  return SearchResultValidator.processResults(Array.isArray(rawResultsData) ? rawResultsData : [], providerType);
}
