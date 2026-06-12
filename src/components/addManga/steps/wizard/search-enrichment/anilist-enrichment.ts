/**
 * AniList Search Result Enrichment
 *
 * Handles enrichment of AniList search results with complete metadata.
 */

import type { ProviderMetadata } from '@/types/universalImportWizard.types';
import { logger } from '@/utils/logger';
import { vanillaTrpcClient } from '@/utils/trpc-client/vanilla';

import type { EnrichmentContext } from './types';

/**
 * Enrich AniList search results with complete metadata (authors, artists, dates).
 * AniList search results don't include staff data - need to fetch from details endpoint.
 */
export function enrichAniListResult(
  anilistId: string | number,
  ctx: EnrichmentContext
): void {
  if (!anilistId) {
    return;
  }

  logger.debug('[SearchEnrichment] Starting AniList metadata enrichment', { id: anilistId });

  void vanillaTrpcClient.metadata.fetchAnilistMetadata
    .mutate({ id: String(anilistId) })
    .then((fetchResult) => {
      const data = fetchResult as unknown as Record<string, unknown>;
      logger.debug('[SearchEnrichment] AniList fetch complete', {
        hasAuthors: !!data['authors'],
        authorsLength: Array.isArray(data['authors']) ? data['authors'].length : 0,
        hasArtists: !!data['artists'],
        artistsLength: Array.isArray(data['artists']) ? data['artists'].length : 0,
      });

      updateAniListMetadata(data, ctx);
    })
    .catch((error: unknown) => {
      logger.warn('[SearchEnrichment] AniList enrichment failed:', {
        error: error instanceof Error ? error.message : String(error),
      });
    });
}

function updateAniListMetadata(
  data: Record<string, unknown>,
  ctx: EnrichmentContext
): void {
  const { primaryProvider, primaryMetadata, setSelectedSourcesMetadata, updateFormData } = ctx;

  // eslint-disable-next-line complexity -- AniList metadata field mapping with validation
  setSelectedSourcesMetadata((prev) => {
    const currentMetadata = prev[primaryProvider] ?? primaryMetadata;
    const enrichedMetadata: ProviderMetadata = { ...currentMetadata };

    // Staff/creator fields
    if (Array.isArray(data['authors']) && data['authors'].length > 0) {
      enrichedMetadata.authors = data['authors'] as string[];
    }
    if (Array.isArray(data['artists']) && data['artists'].length > 0) {
      enrichedMetadata.artists = data['artists'] as string[];
    }

    // Date fields
    if (data['startDate'] && typeof data['startDate'] === 'string') {
      enrichedMetadata.startDate = data['startDate'];
    }
    if (data['endDate'] && typeof data['endDate'] === 'string') {
      enrichedMetadata.endDate = data['endDate'];
    }

    // Format and status
    if (data['format'] && typeof data['format'] === 'string') {
      enrichedMetadata.format = data['format'];
    }
    if (data['status'] && typeof data['status'] === 'string') {
      enrichedMetadata.status = data['status'];
    }

    // Genre and tag fields
    if (Array.isArray(data['genres']) && data['genres'].length > 0) {
      enrichedMetadata.genres = data['genres'] as string[];
    }
    if (Array.isArray(data['tags']) && data['tags'].length > 0) {
      enrichedMetadata.tags = data['tags'] as string[];
    }
    if (Array.isArray(data['themes']) && data['themes'].length > 0) {
      enrichedMetadata.themes = data['themes'] as string[];
    }

    // Volume and chapter counts
    if (typeof data['volumes'] === 'number' && data['volumes'] > 0) {
      enrichedMetadata.volumes = data['volumes'];
    }
    if (typeof data['chapters'] === 'number' && data['chapters'] > 0) {
      enrichedMetadata.chapters = data['chapters'];
    }

    // Image fields
    if (data['cover'] && typeof data['cover'] === 'string') {
      enrichedMetadata.coverImage = data['cover'];
    }
    if (data['bannerImage'] && typeof data['bannerImage'] === 'string') {
      enrichedMetadata.bannerImage = data['bannerImage'];
    }

    // Score and popularity
    if (typeof data['popularity'] === 'number') {
      enrichedMetadata.popularity = data['popularity'];
    }
    if (typeof data['averageScore'] === 'number') {
      enrichedMetadata.averageScore = data['averageScore'];
    }

    // Content rating
    if (typeof data['isAdult'] === 'boolean') {
      enrichedMetadata.isAdult = data['isAdult'];
    }

    return { ...prev, [primaryProvider]: enrichedMetadata };
  });

  // Update form data with authors
  if (Array.isArray(data['authors']) && data['authors'].length > 0) {
    updateFormData({ authors: data['authors'] as string[] });
    logger.info('[SearchEnrichment] Updated form with AniList authors:', data['authors']);
  }

  // Update form data with format if available
  if (data['format'] && typeof data['format'] === 'string') {
    updateFormData({ format: data['format'] });
    logger.info('[SearchEnrichment] Updated form with AniList format:', data['format']);
  }
}
