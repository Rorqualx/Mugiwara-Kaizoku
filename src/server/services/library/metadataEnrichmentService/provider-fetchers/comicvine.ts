/**
 * ComicVine Provider Fetcher
 *
 * Fetches and enhances metadata from ComicVine API using ts-mangadex's ComicVineProvider.
 * Falls back to mutation-based fetching if ts-mangadex fails.
 *
 * @module provider-fetchers/comicvine
 */

import { MetadataProvider } from '@prisma/client';


import { comicvineConfigService } from '@/server/services/comicvine/configService';
import { logParseFailure } from '@/server/services/metadata/parse-failure-logger';
import { adaptUnifiedMangaToMetadata } from '@/server/services/providers/adapters/ts-mangadex-adapter';
import { toStringId } from '@/utils/id-converters';
import { logger } from '@/utils/logger';
import { EnrichmentLevel } from '@/utils/metadata-cache';
import { isObject, hasProperty } from '@/utils/type-guards';

import { ComicVineProvider } from 'mangadex-ts-client';


import { isMutation } from '../types';

import type { ProviderMutations, Mutation } from '../types';

// ============================================================================
// Types
// ============================================================================

interface FetchResult {
  enrichmentLevel: EnrichmentLevel;
  data: unknown;
}

interface VolumeDetailsFields {
  issues?: unknown;
  characters?: unknown;
  creators?: unknown;
  coverImages?: unknown;
  publisher?: unknown;
  firstIssue?: unknown;
  lastIssue?: unknown;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get error message from unknown error
 */
function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Extract volume ID from result object
 */
function extractVolumeId(result: unknown): string | null {
  const resultObj = result as Record<string, unknown>;
  const volumeId = toStringId(resultObj['id'] ?? resultObj['sourceId']);

  if (!volumeId || volumeId === 'undefined') {
    return null;
  }

  return volumeId;
}

/**
 * Fetch basic ComicVine metadata
 */
async function fetchBasicMetadata(
  volumeId: string,
  mutation: Mutation | undefined
): Promise<Record<string, unknown> | null> {
  if (!mutation || !isMutation(mutation)) {
    return null;
  }

  const metadataResult: unknown = await mutation.mutateAsync({
    id: volumeId
  });

  // mutateAsync returns data directly, not wrapped in AsyncResult
  if (isObject(metadataResult)) {
    return metadataResult as Record<string, unknown>;
  }

  return null;
}

/**
 * Extract relevant fields from volume details
 */
function extractVolumeDetailsFields(
  volumeDetails: Record<string, unknown>
): VolumeDetailsFields {
  return {
    issues: hasProperty(volumeDetails, 'issues') ? volumeDetails['issues'] : undefined,
    characters: hasProperty(volumeDetails, 'characters') ? volumeDetails['characters'] : undefined,
    creators: hasProperty(volumeDetails, 'creators') ? volumeDetails['creators'] : undefined,
    coverImages: hasProperty(volumeDetails, 'coverImages') ? volumeDetails['coverImages'] : undefined,
    publisher: hasProperty(volumeDetails, 'publisher') ? volumeDetails['publisher'] : undefined,
    firstIssue: hasProperty(volumeDetails, 'firstIssue') ? volumeDetails['firstIssue'] : undefined,
    lastIssue: hasProperty(volumeDetails, 'lastIssue') ? volumeDetails['lastIssue'] : undefined
  };
}

/**
 * Fetch volume details from ComicVine
 */
async function fetchVolumeDetails(
  volumeId: string,
  mutation: Mutation | undefined
): Promise<VolumeDetailsFields | null> {
  if (!mutation || !isMutation(mutation)) {
    return null;
  }

  try {
    const volumeDetails: unknown = await mutation.mutateAsync({
      id: volumeId,
      type: 'volume'
    });

    // mutateAsync returns data directly, not wrapped in AsyncResult
    if (isObject(volumeDetails)) {
      return extractVolumeDetailsFields(volumeDetails as Record<string, unknown>);
    }
  } catch (detailsError: unknown) {
    const errorMessage = getErrorMessage(detailsError);
    logger.warn('ComicVine volume details fetch failed:', errorMessage);
  }

  return null;
}

/**
 * Fetch issues separately from ComicVine
 */
async function fetchIssues(
  volumeId: string,
  mutation: Mutation | undefined
): Promise<unknown[] | null> {
  if (!mutation || !isMutation(mutation)) {
    return null;
  }

  try {
    const issuesResult: unknown = await mutation.mutate?.({
      volumeId
    });

    if (isObject(issuesResult) && hasProperty(issuesResult, 'issues')) {
      return issuesResult['issues'] as unknown[];
    }
  } catch (issuesError: unknown) {
    const errorMessage = getErrorMessage(issuesError);
    logger.warn('ComicVine issues fetch failed:', errorMessage);
  }

  return null;
}

/**
 * Determine enrichment level based on data completeness
 */
function determineEnrichmentLevel(
  hasBasicMetadata: boolean,
  hasVolumeDetails: boolean,
  hasIssues: boolean,
  currentLevel: EnrichmentLevel
): EnrichmentLevel {
  if (hasVolumeDetails) {
    return EnrichmentLevel.FULL;
  }

  if (hasIssues && currentLevel === EnrichmentLevel.PARTIAL) {
    return EnrichmentLevel.FULL;
  }

  if (hasBasicMetadata) {
    return EnrichmentLevel.PARTIAL;
  }

  return currentLevel;
}

// ============================================================================
// Main Fetcher Function
// ============================================================================

/**
 * Fetch enhanced ComicVine data
 *
 * Fetches metadata from multiple ComicVine endpoints:
 * 1. Basic metadata
 * 2. Volume details (issues, characters, creators)
 * 3. Issues separately (if not included in volume details)
 */
export async function fetchComicVineData(
  result: unknown,
  mutations: ProviderMutations | undefined
): Promise<FetchResult> {
  const volumeId = extractVolumeId(result);

  if (!volumeId) {
    return {
      enrichmentLevel: EnrichmentLevel.BASIC,
      data: result
    };
  }

  // Try ts-mangadex ComicVineProvider first
  try {
    const cvConfig = await comicvineConfigService.loadConfig();
    if (cvConfig.enabled && cvConfig.apiKey) {
      const provider = new ComicVineProvider({ enabled: true, apiKey: cvConfig.apiKey });
      const providerResult = await provider.getMetadata(volumeId);

      const metadata = adaptUnifiedMangaToMetadata(providerResult.manga, MetadataProvider.COMICVINE);
        return {
          enrichmentLevel: EnrichmentLevel.FULL,
          data: {
            ...(result as Record<string, unknown>),
            ...metadata
          }
        };
    }
  } catch (error: unknown) {
    logger.warn('ts-mangadex ComicVine fetch failed, trying mutation fallback', {
      volumeId,
      error: error instanceof Error ? error.message : String(error)
    });
  }

  // Fallback: use client-side mutations
  let enhancedResult: Record<string, unknown> = {
    ...(result as Record<string, unknown>)
  };
  let enrichmentLevel = EnrichmentLevel.BASIC;

  try {
    // Fetch basic metadata
    const basicMetadata = await fetchBasicMetadata(
      volumeId,
      mutations?.fetchComicvineMutation
    );

    const hasBasicMetadata = basicMetadata !== null;
    if (hasBasicMetadata) {
      enhancedResult = {
        ...enhancedResult,
        ...basicMetadata
      };
      enrichmentLevel = EnrichmentLevel.PARTIAL;
    }

    // Fetch volume details
    const volumeDetailsFields = await fetchVolumeDetails(
      volumeId,
      mutations?.fetchComicvineVolumeDetailsMutation
    );

    const hasVolumeDetails = volumeDetailsFields !== null;
    if (hasVolumeDetails) {
      enhancedResult = {
        ...enhancedResult,
        ...volumeDetailsFields
      };
      enrichmentLevel = EnrichmentLevel.FULL;
    }

    // Fetch issues separately if not included
    let hasIssues = false;
    if (!hasProperty(enhancedResult, 'issues')) {
      const issues = await fetchIssues(
        volumeId,
        mutations?.fetchComicVineIssues
      );

      if (issues !== null) {
        Object.assign(enhancedResult, { issues });
        hasIssues = true;
      }
    }

    // Determine final enrichment level
    enrichmentLevel = determineEnrichmentLevel(
      hasBasicMetadata,
      hasVolumeDetails,
      hasIssues,
      enrichmentLevel
    );
  } catch (error: unknown) {
    const errorMessage = getErrorMessage(error);
    logger.error('ComicVine enhancement failed:', errorMessage);
    await logParseFailure({
      source: 'comicvine',
      url: `comicvine:volume:${volumeId}`,
      stage: 'fetchComicVineData',
      reason: 'exception',
      context: { error: errorMessage, volumeId },
    });
  }

  if (enrichmentLevel === EnrichmentLevel.BASIC) {
    await logParseFailure({
      source: 'comicvine',
      url: `comicvine:volume:${volumeId}`,
      stage: 'fetchComicVineData',
      reason: 'no_enrichment',
      context: { volumeId },
    });
  }

  return {
    enrichmentLevel,
    data: enhancedResult
  };
}
