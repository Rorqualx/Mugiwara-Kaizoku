/**
 * Fandom Provider Fetcher
 *
 * Fetches and enhances metadata from Fandom wikis.
 * Handles full enhancement with gallery/volume covers and fallback to basic metadata.
 *
 * Extracted from: metadataEnrichmentService.ts (lines 576-733)
 */

import { logParseFailure } from '@/server/services/metadata/parse-failure-logger';
import { logger } from '@/utils/logger';
import { EnrichmentLevel } from '@/utils/metadata-cache';
import { isObject, hasProperty } from '@/utils/type-guards';

// ============================================================================
// Types
// ============================================================================

/**
 * Mutation interface with async methods
 */
interface Mutation<TInput = unknown, TOutput = unknown> {
  mutateAsync: (input: TInput) => Promise<TOutput>;
  mutate?: (input: TInput) => Promise<TOutput>;
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

/**
 * Cover art counts for logging
 */
interface CoverArtCounts {
  volumeCovers: number;
  gallery: number;
  characterArt: number;
}

/**
 * Processed result with enrichment level
 */
interface ProcessedResult {
  result: Record<string, unknown>;
  level: EnrichmentLevel;
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Type guard for mutation objects
 */
function isMutation(value: unknown): value is Mutation {
  return (
    isObject(value) &&
    hasProperty(value, 'mutateAsync') &&
    typeof value['mutateAsync'] === 'function'
  );
}

// ============================================================================
// Helper Functions (to reduce complexity)
// ============================================================================

/**
 * Extract cover art counts for logging
 */
function extractCoverArtCounts(data: unknown): CoverArtCounts {
  let volumeCoversCount = 0;
  let galleryCount = 0;
  let characterArtCount = 0;

  if (!isObject(data) || !hasProperty(data, 'coverArt')) {
    return { volumeCovers: volumeCoversCount, gallery: galleryCount, characterArt: characterArtCount };
  }

  const coverArt = data['coverArt'];
  if (!isObject(coverArt)) {
    return { volumeCovers: volumeCoversCount, gallery: galleryCount, characterArt: characterArtCount };
  }

  if (hasProperty(coverArt, 'volumeCovers')) {
    const volumeCovers = coverArt['volumeCovers'];
    volumeCoversCount = Array.isArray(volumeCovers) ? volumeCovers.length : 0;
  }

  if (hasProperty(coverArt, 'gallery')) {
    const gallery = coverArt['gallery'];
    galleryCount = Array.isArray(gallery) ? gallery.length : 0;
  }

  if (hasProperty(coverArt, 'characterArt')) {
    const characterArt = coverArt['characterArt'];
    characterArtCount = Array.isArray(characterArt) ? characterArt.length : 0;
  }

  return { volumeCovers: volumeCoversCount, gallery: galleryCount, characterArt: characterArtCount };
}

/**
 * Extract cover art data from response
 */
function extractCoverArtData(data: Record<string, unknown>): {
  coverArt: unknown;
  gallery: unknown[];
  volumeCovers: unknown[];
  characterArt: unknown[];
} {
  const coverArt = hasProperty(data, 'coverArt') ? data['coverArt'] : undefined;

  let gallery: unknown[] = [];
  let volumeCovers: unknown[] = [];
  let characterArt: unknown[] = [];

  if (isObject(coverArt)) {
    if (hasProperty(coverArt, 'gallery')) {
      gallery = (coverArt['gallery'] ?? []) as unknown[];
    }
    if (hasProperty(coverArt, 'volumeCovers')) {
      volumeCovers = (coverArt['volumeCovers'] ?? []) as unknown[];
    }
    if (hasProperty(coverArt, 'characterArt')) {
      characterArt = (coverArt['characterArt'] ?? []) as unknown[];
    }
  }

  return { coverArt, gallery, volumeCovers, characterArt };
}

/**
 * Extract additional metadata fields from data
 */
function extractAdditionalMetadata(data: Record<string, unknown>): Record<string, unknown> {
  const metadata: Record<string, unknown> = {};

  if (hasProperty(data, 'descriptions')) {
    metadata['descriptions'] = data['descriptions'];
  }
  if (hasProperty(data, 'publication')) {
    metadata['publication'] = data['publication'];
  }
  if (hasProperty(data, 'links')) {
    metadata['links'] = data['links'];
  }
  if (hasProperty(data, 'alternativeTitles')) {
    metadata['alternativeTitles'] = data['alternativeTitles'];
  }
  if (hasProperty(data, 'themes')) {
    metadata['themes'] = data['themes'];
  }

  return metadata;
}

/**
 * Process enhanced Fandom response
 */
function processEnhancedResponse(
  baseResult: Record<string, unknown>,
  enhancedResponse: unknown
): ProcessedResult | null {
  if (!isObject(enhancedResponse)) {
    logger.warn(`⚠️ [FANDOM ENHANCER] Unexpected response structure:`, enhancedResponse);
    return null;
  }

  // Check for error response
  if (enhancedResponse['status'] === 'error') {
    const error = hasProperty(enhancedResponse, 'error') ? enhancedResponse['error'] : 'Unknown error';
    logger.warn(`⚠️ [FANDOM ENHANCER] Enhancement failed with error:`, error);
    return null;
  }

  // Check for success response
  if (enhancedResponse['status'] !== 'success' || !hasProperty(enhancedResponse, 'data')) {
    logger.warn(`⚠️ [FANDOM ENHANCER] Unexpected response structure:`, enhancedResponse);
    return null;
  }

  const data = enhancedResponse['data'];
  if (!isObject(data)) {
    return null;
  }

  // Extract counts for logging
  const counts = extractCoverArtCounts(data);

  logger.info(`📦 [FANDOM ENHANCER] Extracting data from AsyncResult:`, {
    hasCoverArt: hasProperty(data, 'coverArt'),
    volumeCoversCount: counts.volumeCovers,
    galleryCount: counts.gallery,
    characterArtCount: counts.characterArt,
    dataKeys: Object.keys(data)
  });

  // Extract cover art data
  const coverArtData = extractCoverArtData(data as Record<string, unknown>);

  // Extract additional metadata
  const additionalMetadata = extractAdditionalMetadata(data as Record<string, unknown>);

  // Build enhanced result
  const enhancedResult: Record<string, unknown> = {
    ...baseResult,
    coverArt: coverArtData.coverArt,
    gallery: coverArtData.gallery,
    volumeCovers: coverArtData.volumeCovers,
    characterArt: coverArtData.characterArt,
    ...additionalMetadata
  };

  logger.info(`🎉 [FANDOM ENHANCER] Enhanced result created:`, {
    enrichmentLevel: EnrichmentLevel.FULL,
    volumeCoversCount: coverArtData.volumeCovers.length,
    galleryCount: coverArtData.gallery.length,
    characterArtCount: coverArtData.characterArt.length
  });

  return { result: enhancedResult, level: EnrichmentLevel.FULL };
}

/**
 * Process basic Fandom fallback response
 */
function processBasicFallback(
  baseResult: Record<string, unknown>,
  basicData: unknown
): ProcessedResult | null {
  if (!isObject(basicData)) {
    return null;
  }

  const result: Record<string, unknown> = {
    ...baseResult,
    cover: hasProperty(basicData, 'cover') ? basicData['cover'] : undefined,
    description: hasProperty(basicData, 'description') ? basicData['description'] : undefined,
    alternativeTitles: hasProperty(basicData, 'alternativeTitles') ? basicData['alternativeTitles'] : undefined,
    genres: hasProperty(basicData, 'genres') ? basicData['genres'] : undefined,
    authors: hasProperty(basicData, 'authors') ? basicData['authors'] : undefined,
    status: hasProperty(basicData, 'status') ? basicData['status'] : undefined
  };

  return { result, level: EnrichmentLevel.PARTIAL };
}

/**
 * Attempt full enhancement using enhanced mutation
 */
async function attemptFullEnhancement(
  baseResult: Record<string, unknown>,
  url: unknown,
  mutations: ProviderMutations | undefined
): Promise<ProcessedResult | null> {
  const enhancedMutation = mutations?.fetchEnhancedFandomMutation;

  if (!enhancedMutation || !isMutation(enhancedMutation)) {
    logger.info(`⚠️ [FANDOM ENHANCER] fetchEnhancedFandomMutation not available`);
    return null;
  }

  logger.info(`📡 [FANDOM ENHANCER] Calling fetchEnhancedFandomMutation with URL: ${url}`);

  const enhancedResponse: unknown = await enhancedMutation.mutateAsync({
    mangaPageUrl: url,
    includeGallery: true
  });

  logger.info(`✅ [FANDOM ENHANCER] Enhanced response received:`, {
    hasResponse: !!enhancedResponse,
    responseType: typeof enhancedResponse,
    hasStatus: isObject(enhancedResponse) && hasProperty(enhancedResponse, 'status'),
    status: isObject(enhancedResponse) ? enhancedResponse['status'] : undefined,
    hasData: isObject(enhancedResponse) && hasProperty(enhancedResponse, 'data'),
    responseKeys: isObject(enhancedResponse) ? Object.keys(enhancedResponse) : []
  });

  return processEnhancedResponse(baseResult, enhancedResponse);
}

/**
 * Attempt basic fallback using basic mutation
 */
async function attemptBasicFallback(
  baseResult: Record<string, unknown>,
  url: unknown,
  mutations: ProviderMutations | undefined
): Promise<ProcessedResult | null> {
  const basicMutation = mutations?.fetchFandomMutation;

  if (!basicMutation || !isMutation(basicMutation)) {
    return null;
  }

  try {
    const basicData: unknown = await basicMutation.mutateAsync({ url });
    return processBasicFallback(baseResult, basicData);
  } catch (fallbackError: unknown) {
    const errorMessage = fallbackError instanceof Error ? fallbackError.message : String(fallbackError);
    logger.warn('Fandom basic metadata fallback failed:', errorMessage);
    return null;
  }
}

// ============================================================================
// Main Fetcher Function
// ============================================================================

/**
 * Fetch enhanced Fandom data
 */
export async function fetchFandomData(
  result: unknown,
  mutations: ProviderMutations | undefined
): Promise<{ enrichmentLevel: EnrichmentLevel; data: unknown }> {
  const resultObj = result as Record<string, unknown>;
  const url = resultObj['wikiUrl'] ?? resultObj['url'];
  const volumeCovers = resultObj['volumeCovers'];
  const gallery = resultObj['gallery'];

  logger.info(`🎭 [FANDOM ENHANCER] Starting Fandom enhancement`, {
    url,
    hasUrl: !!url,
    resultId: resultObj['id'] ?? resultObj['sourceId'],
    existingVolumeCovers: Array.isArray(volumeCovers) ? volumeCovers.length : 0,
    existingGallery: Array.isArray(gallery) ? gallery.length : 0
  });

  if (!url) {
    logger.info(`⚠️ [FANDOM ENHANCER] No URL found, returning basic data`);
    return {
      enrichmentLevel: EnrichmentLevel.BASIC,
      data: result
    };
  }

  let enhancedResult = { ...resultObj };
  let enrichmentLevel = EnrichmentLevel.BASIC;

  try {
    // Try full enhancement
    const fullResult = await attemptFullEnhancement(resultObj, url, mutations);
    if (fullResult) {
      enhancedResult = fullResult.result;
      enrichmentLevel = fullResult.level;
    }

    // Fallback to basic metadata if full enhancement failed
    if (enrichmentLevel === EnrichmentLevel.BASIC) {
      const basicResult = await attemptBasicFallback(resultObj, url, mutations);
      if (basicResult) {
        enhancedResult = basicResult.result;
        enrichmentLevel = basicResult.level;
      }
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Fandom enhancement failed:', errorMessage);
    await logParseFailure({
      source: 'fandom',
      url: typeof url === 'string' ? url : String(url),
      stage: 'fetchFandomData',
      reason: 'exception',
      context: { error: errorMessage, resultId: resultObj['id'] ?? resultObj['sourceId'] },
    });
  }

  if (enrichmentLevel === EnrichmentLevel.BASIC) {
    await logParseFailure({
      source: 'fandom',
      url: typeof url === 'string' ? url : String(url),
      stage: 'fetchFandomData',
      reason: 'no_enrichment',
      context: { resultId: resultObj['id'] ?? resultObj['sourceId'] },
    });
  }

  return {
    enrichmentLevel,
    data: enhancedResult
  };
}
