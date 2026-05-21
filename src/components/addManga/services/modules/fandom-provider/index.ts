/**
 * Main export and orchestration for Fandom metadata fetching
 */

import type { ProviderMetadata } from '@/types/universalImportWizard.types';
import { logger } from '@/utils/logger';

import { tryBasicFetch } from './basic-fetcher';
import { tryComprehensiveParsing, type OnChapterCoversLoaded } from './comprehensive-parser';
import { buildMetadataFromSearchResult } from './metadata-from-search';
import { extractUrl, logFetchAttempt } from './url-extraction';

import type { FandomMutations } from './types';

// Re-export for callers
export type { OnChapterCoversLoaded } from './comprehensive-parser';

/**
 * Get non-empty array or fallback
 */
function getArrayWithFallback(
  primary: string[] | undefined,
  fallback: string[] | undefined
): string[] {
  if (Array.isArray(primary) && primary.length > 0) {
    return primary;
  }
  return fallback ?? [];
}

/**
 * Get non-empty string or fallback
 */
function getStringWithFallback(
  primary: string | undefined,
  fallback: string | undefined
): string {
  if (typeof primary === 'string' && primary.length > 0) {
    return primary;
  }
  return fallback ?? '';
}

/**
 * Get value or fallback for optional string fields
 */
function getOptionalStringWithFallback(
  primary: string | undefined,
  fallback: string | undefined
): string | undefined {
  if (typeof primary === 'string' && primary.length > 0) {
    return primary;
  }
  if (typeof fallback === 'string' && fallback.length > 0) {
    return fallback;
  }
  return undefined;
}

// Type definitions for complex union types
type PublisherType = string | { name?: string; english?: string; japan?: string };
type DateType = string | { year?: number; month?: number; day?: number };

/**
 * Get value or fallback for complex publisher field (can be string or object)
 */
function getPublisherWithFallback(
  primary: PublisherType | undefined,
  fallback: PublisherType | undefined
): PublisherType | undefined {
  // Check if primary has valid value
  if (primary !== undefined) {
    if (typeof primary === 'string' && primary.length > 0) return primary;
    if (typeof primary === 'object' && Object.keys(primary).length > 0) return primary;
  }
  // Check if fallback has valid value
  if (fallback !== undefined) {
    if (typeof fallback === 'string' && fallback.length > 0) return fallback;
    if (typeof fallback === 'object' && Object.keys(fallback).length > 0) return fallback;
  }
  return undefined;
}

/**
 * Get value or fallback for complex date field (can be string or object)
 */
function getDateWithFallback(
  primary: DateType | undefined,
  fallback: DateType | undefined
): DateType | undefined {
  // Check if primary has valid value
  if (primary !== undefined) {
    if (typeof primary === 'string' && primary.length > 0) return primary;
    if (typeof primary === 'object' && Object.keys(primary).length > 0) return primary;
  }
  // Check if fallback has valid value
  if (fallback !== undefined) {
    if (typeof fallback === 'string' && fallback.length > 0) return fallback;
    if (typeof fallback === 'object' && Object.keys(fallback).length > 0) return fallback;
  }
  return undefined;
}

/**
 * Merge comprehensive and basic metadata, preferring comprehensive for structure
 * and filling in missing metadata fields from basic fetch.
 *
 * This ensures ALL metadata fields are properly merged to avoid losing data
 * regardless of whether Fandom is used as primary or secondary source.
 */
// eslint-disable-next-line complexity -- Complex metadata merging with many fields
function mergeMetadata(
  comprehensive: ProviderMetadata,
  basic: ProviderMetadata | undefined
): ProviderMetadata {
  // Get optional field values
  const publisher = getPublisherWithFallback(comprehensive.publisher, basic?.publisher);
  const startDate = getDateWithFallback(comprehensive.startDate, basic?.startDate);
  const endDate = getDateWithFallback(comprehensive.endDate, basic?.endDate);
  const demographic = getOptionalStringWithFallback(comprehensive.demographic, basic?.demographic);
  const coverImage = getOptionalStringWithFallback(comprehensive.coverImage, basic?.coverImage);
  const bannerImage = getOptionalStringWithFallback(comprehensive.bannerImage, basic?.bannerImage);

  // Log cover image merge
  logger.debug('[Fandom Merge] Cover image sources:', {
    comprehensiveCover: comprehensive.coverImage,
    basicCover: basic?.coverImage,
    mergedCover: coverImage,
  });
  const url = getOptionalStringWithFallback(comprehensive.url, basic?.url);
  const wikiUrl = getOptionalStringWithFallback(comprehensive.wikiUrl, basic?.wikiUrl);
  const volumesListUrl = getOptionalStringWithFallback(comprehensive.volumesListUrl, basic?.volumesListUrl);

  // Build merged object - only include optional properties if they have values
  // (exactOptionalPropertyTypes requires this pattern)
  const merged: ProviderMetadata = {
    // Start with comprehensive as base
    ...comprehensive,

    // Array fields - prefer non-empty
    genres: getArrayWithFallback(comprehensive.genres, basic?.genres),
    authors: getArrayWithFallback(comprehensive.authors, basic?.authors),
    artists: getArrayWithFallback(comprehensive.artists, basic?.artists),
    tags: getArrayWithFallback(comprehensive.tags, basic?.tags),
    themes: getArrayWithFallback(comprehensive.themes, basic?.themes),
    alternativeTitles: getArrayWithFallback(comprehensive.alternativeTitles, basic?.alternativeTitles),

    // String fields - prefer non-empty
    description: getStringWithFallback(comprehensive.description, basic?.description),
    synopsis: getStringWithFallback(comprehensive.synopsis, basic?.synopsis),
    status: getStringWithFallback(comprehensive.status, basic?.status),
    format: getStringWithFallback(comprehensive.format, basic?.format),

    // Gallery - merge arrays if both exist
    gallery: getArrayWithFallback(comprehensive.gallery, basic?.gallery),

    // Conditionally spread optional fields only if they have values
    ...(publisher !== undefined && { publisher }),
    ...(startDate !== undefined && { startDate }),
    ...(endDate !== undefined && { endDate }),
    ...(demographic !== undefined && { demographic }),
    ...(coverImage !== undefined && { coverImage }),
    ...(bannerImage !== undefined && { bannerImage }),
    ...(url !== undefined && { url }),
    ...(wikiUrl !== undefined && { wikiUrl }),
    ...(volumesListUrl !== undefined && { volumesListUrl }),

    // External ID fields - basic fetch extracts these from Fandom page links
    ...((basic?.idMal ?? comprehensive.idMal) !== undefined && { idMal: basic?.idMal ?? comprehensive.idMal }),
    ...((basic?.anilistId ?? comprehensive.anilistId) !== undefined && { anilistId: basic?.anilistId ?? comprehensive.anilistId }),

    // External links array - merge from both sources, deduplicate
    externalLinks: [...(comprehensive.externalLinks ?? []), ...(basic?.externalLinks ?? [])].filter((v, i, a) => a.indexOf(v) === i),
  };

  logger.info('[Fandom] Merged metadata from comprehensive + basic fetch:', {
    hasGenres: (merged.genres?.length ?? 0) > 0,
    genreCount: merged.genres?.length ?? 0,
    hasAuthors: (merged.authors?.length ?? 0) > 0,
    authorsCount: merged.authors?.length ?? 0,
    authors: merged.authors,
    hasArtists: (merged.artists?.length ?? 0) > 0,
    hasTags: (merged.tags?.length ?? 0) > 0,
    hasThemes: (merged.themes?.length ?? 0) > 0,
    hasDescription: !!merged.description,
    hasCoverImage: !!merged.coverImage,
    hasGallery: (merged.gallery?.length ?? 0) > 0,
    idMal: merged.idMal,
    anilistId: merged.anilistId,
    externalLinksCount: merged.externalLinks?.length ?? 0,
    // Source tracking
    comprehensiveIdMal: comprehensive.idMal,
    basicIdMal: basic?.idMal,
    comprehensiveAuthors: comprehensive.authors,
    basicAuthors: basic?.authors,
  });

  return merged;
}

/**
 * Log diagnostic information about the result structure
 */
function logResultDiagnostics(result: Record<string, unknown>, mutations: FandomMutations): void {
  const metadata = result['metadata'] as Record<string, unknown> | undefined;
  const rawData = result['rawData'] as Record<string, unknown> | undefined;
  const externalLinks = result['externalLinks'] as Array<Record<string, unknown>> | undefined;
  const metadataExternalLinks = metadata?.['externalLinks'] as Array<Record<string, unknown>> | undefined;

  logger.debug('[Fandom Provider] ENTRY - fetchFandomMetadata called', {
    hasResult: !!result,
    resultKeys: Object.keys(result),
    url: result['url'],
    wikiUrl: result['wikiUrl'],
    siteDetailUrl: result['siteDetailUrl'],
    providerUrl: result['providerUrl'],
    hasMetadata: !!metadata,
    metadataKeys: metadata ? Object.keys(metadata) : [],
    metadataUrl: metadata?.['url'],
    metadataWikiUrl: metadata?.['wikiUrl'],
    hasRawData: !!rawData,
    rawDataKeys: rawData ? Object.keys(rawData) : [],
    rawDataUrl: rawData?.['url'],
    rawDataWikiUrl: rawData?.['wikiUrl'],
    hasExternalLinks: !!externalLinks,
    externalLinksLength: externalLinks?.length ?? 0,
    externalLinksFirst: externalLinks?.[0],
    hasMetadataExternalLinks: !!metadataExternalLinks,
    metadataExternalLinksLength: metadataExternalLinks?.length ?? 0,
    metadataExternalLinksFirst: metadataExternalLinks?.[0],
    hasFetchFandomMutation: !!mutations.fetchFandomMutation,
    hasParseFandomUrlMutation: !!mutations.parseFandomUrlMutation,
  });
}

/**
 * Process comprehensive parsing result
 */
function processComprehensiveResult(
  result: PromiseSettledResult<ProviderMetadata | undefined>
): ProviderMetadata | undefined {
  if (result.status === 'fulfilled') {
    const metadata = result.value;
    logger.debug('[Fandom] tryComprehensiveParsing completed', {
      hasMetadata: !!metadata,
      hasGenres: metadata?.genres?.length ?? 0
    });
    return metadata;
  }
  logger.error('[Fandom] Comprehensive parse error:', result.reason);
  return undefined;
}

/**
 * Process basic fetch result
 */
function processBasicResult(
  result: PromiseSettledResult<ProviderMetadata | undefined>
): ProviderMetadata | undefined {
  if (result.status === 'fulfilled') {
    const metadata = result.value;
    logger.debug('[Fandom] tryBasicFetch completed', {
      hasMetadata: !!metadata,
      hasCoverImage: !!metadata?.coverImage,
      coverImage: metadata?.coverImage,
      hasGenres: metadata?.genres?.length ?? 0,
      genres: metadata?.genres,
      hasAuthors: (metadata?.authors?.length ?? 0) > 0,
      authorsCount: metadata?.authors?.length ?? 0,
      authors: metadata?.authors,
      hasIdMal: metadata?.idMal !== undefined,
      idMal: metadata?.idMal,
    });
    return metadata;
  }
  logger.warn('[Fandom] Basic fetch failed:', result.reason);
  return undefined;
}

/**
 * Create a timeout wrapper for a promise
 */
function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  name: string
): Promise<T | undefined> {
  const timeoutPromise = new Promise<undefined>((resolve) => {
    setTimeout(() => {
      logger.warn(`[Fandom] ${name} timed out after ${timeoutMs}ms`);
      resolve(undefined);
    }, timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]);
}

/**
 * Run parallel fetches for comprehensive and basic metadata
 * Uses timeouts to prevent blocking if fetches take too long
 */
async function runParallelFetches(
  url: string | undefined,
  mutations: FandomMutations,
  result: Record<string, unknown>,
  onCoversLoaded?: OnChapterCoversLoaded
): Promise<{ comprehensive: ProviderMetadata | undefined; basic: ProviderMetadata | undefined }> {
  logger.debug('[Fandom] Starting parallel fetch', { url, hasParseMutation: !!mutations.parseFandomUrlMutation });

  // Timeout for comprehensive parsing (15s) - this is the slower operation
  const COMPREHENSIVE_TIMEOUT = 15000;
  // Timeout for basic fetch (10s) - this is usually faster
  const BASIC_TIMEOUT = 10000;

  const [comprehensiveResult, basicResult] = await Promise.allSettled([
    // Comprehensive parsing for volume/chapter structure (two-phase: fast then background covers)
    // Uses timeout to prevent blocking if server is slow
    url && mutations.parseFandomUrlMutation
      ? withTimeout(
          tryComprehensiveParsing(url, mutations, result, onCoversLoaded),
          COMPREHENSIVE_TIMEOUT,
          'comprehensive parsing'
        )
      : Promise.resolve(undefined),
    // Basic fetch to get genres, authors, description
    url
      ? withTimeout(
          tryBasicFetch(url, mutations, result),
          BASIC_TIMEOUT,
          'basic fetch'
        )
      : Promise.resolve(undefined),
  ]);

  return {
    comprehensive: processComprehensiveResult(comprehensiveResult),
    basic: processBasicResult(basicResult),
  };
}

/**
 * Handle fallback when both comprehensive and basic fetches fail
 */
function handleFetchFallback(
  result: Record<string, unknown>,
  url: string | undefined,
  extractBasicMetadata: (result: Record<string, unknown>) => ProviderMetadata
): ProviderMetadata {
  const resultMetadata = result['metadata'] as Record<string, unknown> | undefined;
  if (resultMetadata && Object.keys(resultMetadata).length > 0) {
    logger.info('[Fandom] Using existing metadata from search result');
    return buildMetadataFromSearchResult(result);
  }

  if (!url) {
    logger.error('[Fandom] No URL found in result:', result);
    logger.error('[Fandom] Available fields:', Object.keys(result));
    throw new Error('No Fandom URL found');
  }

  return extractBasicMetadata(result);
}

/**
 * Check if we should use fast path for secondary provider.
 *
 * NOTE: For Fandom as secondary, we ALWAYS use fast path to avoid blocking UI.
 * The slow API calls often timeout (10-15s), so we return what we have immediately
 * and enrich in background. Even if we have minimal data, blocking is worse.
 */
function shouldUseFastPath(result: Record<string, unknown>): boolean {
  // Always use fast path if we have a title - the slow API calls timeout too often
  // URL is extracted separately via extractUrl() which checks nested fields
  const hasTitle = !!(result['title']);
  return hasTitle;
}

/**
 * Merge background fetch results and invoke callback
 */
function handleBackgroundFetchResults(
  comprehensive: ProviderMetadata | undefined,
  basic: ProviderMetadata | undefined,
  onCoversLoaded?: OnChapterCoversLoaded
): void {
  if (!comprehensive && !basic) return;

  logger.info('[Fandom] Background enrichment completed', {
    hasComprehensive: !!comprehensive,
    hasBasic: !!basic,
    hasDescription: !!(basic?.description ?? comprehensive?.description),
  });

  if (!onCoversLoaded) return;

  // Merge results - prefer comprehensive but fall back to basic (which has description)
  const merged = comprehensive
    ? (basic ? mergeMetadata(comprehensive, basic) : comprehensive)
    : basic;

  if (merged) {
    onCoversLoaded(merged);
  }
}

/**
 * Start background fetch for full metadata (description, volumes, covers)
 */
function startBackgroundEnrichment(
  url: string,
  mutations: FandomMutations,
  result: Record<string, unknown>,
  onCoversLoaded?: OnChapterCoversLoaded
): void {
  // Fire off API calls in background - don't await
  void runParallelFetches(url, mutations, result, onCoversLoaded).then(({ comprehensive, basic }) => {
    handleBackgroundFetchResults(comprehensive, basic, onCoversLoaded);
  });
}

/**
 * Fetch Fandom metadata using a combined strategy
 *
 * Calls both comprehensive parsing (for volume/chapter structure) and basic fetch
 * (for genres, authors, description) then merges the results.
 *
 * Uses two-phase loading for fast initial response:
 * - Phase 1: Returns volume/chapter structure immediately (no covers)
 * - Phase 2: Fetches chapter covers in background, calls onCoversLoaded when done
 *
 * @param result - Search result data
 * @param mutations - tRPC mutations object
 * @param extractBasicMetadata - Fallback metadata extractor
 * @param onCoversLoaded - Optional callback when chapter covers finish loading in background
 */
export async function fetchFandomMetadata(
  result: Record<string, unknown>,
  mutations: FandomMutations,
  extractBasicMetadata: (result: Record<string, unknown>) => ProviderMetadata,
  onCoversLoaded?: OnChapterCoversLoaded
): Promise<ProviderMetadata> {
  logResultDiagnostics(result, mutations);

  const url = extractUrl(result);
  logFetchAttempt(result, mutations, url);

  logger.debug('[Fandom Provider] Extracted URL', {
    url,
    willCallBasicFetch: !!url
  });

  // FAST PATH: Use search result data immediately to avoid blocking UI
  // The slow API calls often timeout (10-15s), making secondary provider unusable
  const useFastPath = shouldUseFastPath(result);
  logger.warn('[Fandom] fetchFandomMetadata - fast path check', { useFastPath, url, resultKeys: Object.keys(result) });

  if (useFastPath) {
    logger.warn('[Fandom] Fast path: Using search result data immediately');
    const searchMetadata = buildMetadataFromSearchResult(result);

    // Start background enrichment for full metadata (description, volumes, covers)
    if (url) {
      startBackgroundEnrichment(url, mutations, result, onCoversLoaded);
    }

    return searchMetadata;
  }

  // SLOW PATH: No rich metadata in search result, need to fetch from API
  const { comprehensive, basic } = await runParallelFetches(url, mutations, result, onCoversLoaded);
  logger.debug('[Fandom Provider] Parallel fetches completed', { hasComprehensive: !!comprehensive, hasBasic: !!basic });

  if (!url) {
    logger.info('[Fandom] Cannot fetch metadata: no URL available');
  } else if (!mutations.parseFandomUrlMutation) {
    logger.info('[Fandom] Comprehensive parsing unavailable: no parseFandomUrlMutation');
  }

  if (comprehensive) {
    return mergeMetadata(comprehensive, basic);
  }

  if (basic) {
    logger.info('[Fandom] Using basic metadata only (comprehensive failed)');
    return basic;
  }

  return handleFetchFallback(result, url, extractBasicMetadata);
}
