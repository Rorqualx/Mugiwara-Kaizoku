/**
 * Fandom Search Result Enrichment
 *
 * Handles enrichment of Fandom search results with gallery, volume data, and full metadata.
 */

import { isRecord } from '@/lib/type-guards';
import type { ProviderMetadata, Volume } from '@/types/universalImportWizard.types';
import { isSuccess } from '@/utils/async-result';
import { logger } from '@/utils/logger';
import { vanillaTrpcClient } from '@/utils/trpc-client/vanilla';

import {
  countChapterCoversInVolumes,
  updateFandomMetadata,
  updateFandomFullMetadata,
  updateFandomVolumes,
} from './fandom-update-helpers';

import type { EnrichmentContext, MetadataUpdateCallback } from './types';

/**
 * Fetch Fandom metadata asynchronously (for secondary provider use).
 * Same logic as enrichFandomResult but returns a Promise with the metadata.
 * This is the canonical path - both primary and secondary should use this.
 */
// eslint-disable-next-line complexity, max-statements -- Complex due to handling two parallel API responses with multiple optional fields
export async function fetchFandomMetadataAsync(
  fandomUrl: string,
  baseMetadata: ProviderMetadata = {} as ProviderMetadata,
  searchResult?: Record<string, unknown>
): Promise<ProviderMetadata> {
  logger.warn('[SearchEnrichment] fetchFandomMetadataAsync ENTERED', { fandomUrl, hasBaseMetadata: !!baseMetadata });

  if (!fandomUrl.includes('fandom.com')) {
    logger.warn('[SearchEnrichment] fetchFandomMetadataAsync - URL invalid, returning base');
    return baseMetadata;
  }

  // Decode URL-encoded characters (e.g., %20 -> space) to ensure consistent URL format
  const decodedUrl = decodeURIComponent(fandomUrl);
  logger.warn('[SearchEnrichment] fetchFandomMetadataAsync - starting API calls', { url: fandomUrl, decodedUrl });

  // Extract all fields from search result's rawData
  const additionalFields: Partial<ProviderMetadata> = {};
  if (searchResult) {
    const rawData = isRecord(searchResult['rawData']) ? searchResult['rawData'] : undefined;
    if (rawData) {
      if (typeof rawData['format'] === 'string') additionalFields.format = rawData['format'];
      if (typeof rawData['status'] === 'string') additionalFields.status = rawData['status'];
      if (typeof rawData['url'] === 'string') additionalFields.url = rawData['url'];
      if (typeof rawData['wikiUrl'] === 'string') additionalFields.wikiUrl = rawData['wikiUrl'];
      if (typeof rawData['siteDetailUrl'] === 'string') additionalFields.fandomUrl = rawData['siteDetailUrl'];
      if (typeof rawData['cover'] === 'string') additionalFields.coverImage = rawData['cover'];
      if (typeof rawData['coverImage'] === 'string') additionalFields.coverImage = rawData['coverImage'];
      if (typeof rawData['score'] === 'number') additionalFields.averageScore = rawData['score'];
      if (typeof rawData['meanScore'] === 'number') additionalFields.averageScore = rawData['meanScore'];
      if (Array.isArray(rawData['genres'])) additionalFields.genres = rawData['genres'] as string[];
      if (Array.isArray(rawData['authors'])) additionalFields.authors = rawData['authors'] as string[];
      if (Array.isArray(rawData['artists'])) additionalFields.artists = rawData['artists'] as string[];
      if (Array.isArray(rawData['alternativeTitles'])) additionalFields.alternativeTitles = rawData['alternativeTitles'] as string[];
      if (Array.isArray(rawData['externalLinks'])) {
        const links = rawData['externalLinks'] as Array<{url?: string; site?: string}>;
        additionalFields.externalLinks = links.map(l => l.url ?? '').filter(Boolean);
      }
      if (typeof rawData['resourceType'] === 'string') additionalFields.format = additionalFields.format ?? rawData['resourceType'];
      if (typeof rawData['providerName'] === 'string') additionalFields.metadataProvider = rawData['providerName'];
    }
  }

  // Fetch both in parallel for speed
  logger.warn('[SearchEnrichment] fetchFandomMetadataAsync - calling Promise.allSettled');

  type ParseResultType = Awaited<ReturnType<typeof vanillaTrpcClient.metadata.parseFandomUrl.mutate>>;
  type MetadataResultType = Awaited<ReturnType<typeof vanillaTrpcClient.metadata.fetchFandomMetadata.mutate>>;

  let parseResult: PromiseSettledResult<ParseResultType>;
  let metadataResult: PromiseSettledResult<MetadataResultType>;

  try {
    [parseResult, metadataResult] = await Promise.allSettled([
      vanillaTrpcClient.metadata.parseFandomUrl.mutate({
        url: decodedUrl,
        forceRefresh: false,
        fetchChapterCovers: false,
        maxChaptersToFetch: 0,
      }),
      vanillaTrpcClient.metadata.fetchFandomMetadata.mutate({ url: decodedUrl })
    ]);
  } catch (error) {
    logger.error('[SearchEnrichment] fetchFandomMetadataAsync - Promise.allSettled threw exception', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return { ...baseMetadata, ...additionalFields };
  }

  logger.warn('[SearchEnrichment] fetchFandomMetadataAsync - Promise.allSettled completed', {
    parseStatus: parseResult.status,
    metadataStatus: metadataResult.status,
    parseReason: parseResult.status === 'rejected' ? String(parseResult.reason) : undefined,
    metadataReason: metadataResult.status === 'rejected' ? String(metadataResult.reason) : undefined,
  });

  const enrichedMetadata: ProviderMetadata = { ...baseMetadata, ...additionalFields };

  // Process parseFandomUrl result (volumes, chapters, gallery)
  if (parseResult.status === 'fulfilled') {
    logger.warn('[SearchEnrichment] parseFandomUrl fulfilled', {
      isSuccess: isSuccess(parseResult.value),
      valueKeys: Object.keys(parseResult.value as Record<string, unknown>),
    });

    if (isSuccess(parseResult.value)) {
      const parsed = parseResult.value.data as unknown as Record<string, unknown>;
      logger.warn('[SearchEnrichment] Fandom parse complete', {
        hasGallery: !!parsed['gallery'],
        galleryLength: Array.isArray(parsed['gallery']) ? parsed['gallery'].length : 0,
        volumeCount: parsed['volumes'],
        chapterCount: parsed['chapters'],
        hasVolumeDetails: !!parsed['volumeDetails'],
        volumeDetailsLength: Array.isArray(parsed['volumeDetails']) ? parsed['volumeDetails'].length : 0,
      });

      if (Array.isArray(parsed['gallery']) && parsed['gallery'].length > 0) {
        enrichedMetadata.gallery = parsed['gallery'] as string[];
      }
      if (Array.isArray(parsed['volumeDetails']) && parsed['volumeDetails'].length > 0) {
        enrichedMetadata.volumeData = parsed['volumeDetails'] as Volume[];
        // Log first volume details for debugging
        const firstVol = parsed['volumeDetails'][0] as Record<string, unknown> | undefined;
        if (firstVol) {
          const chapters = firstVol['chapters'];
          logger.warn('[SearchEnrichment] First volume sample', {
            volumeNumber: firstVol['volumeNumber'],
            title: firstVol['title'],
            hasChapters: !!chapters,
            chapterCount: Array.isArray(chapters) ? chapters.length : 0,
            hasDescription: !!firstVol['description'],
            keys: Object.keys(firstVol),
          });
        }
      }
      if (typeof parsed['volumes'] === 'number' && parsed['volumes'] > 0) {
        enrichedMetadata.volumes = parsed['volumes'];
      }
      if (typeof parsed['chapters'] === 'number' && parsed['chapters'] > 0) {
        enrichedMetadata.chapters = parsed['chapters'];
      }
    }
  } else {
    const rejectedResult = parseResult as PromiseRejectedResult;
    logger.warn('[SearchEnrichment] parseFandomUrl rejected', {
      reason: String(rejectedResult.reason),
    });
  }

  // Process fetchFandomMetadata result (description, authors, genres, etc.)
  if (metadataResult.status === 'fulfilled') {
    logger.warn('[SearchEnrichment] fetchFandomMetadata fulfilled', {
      isSuccess: isSuccess(metadataResult.value),
      valueKeys: Object.keys(metadataResult.value as Record<string, unknown>),
    });

    if (isSuccess(metadataResult.value)) {
      const data = metadataResult.value.data as unknown as Record<string, unknown>;
      logger.warn('[SearchEnrichment] Fandom metadata fetch complete', {
        hasDescription: !!data['description'],
        descriptionLength: typeof data['description'] === 'string' ? data['description'].length : 0,
        descriptionPreview: typeof data['description'] === 'string' ? data['description'].substring(0, 100) : '',
        hasGenres: !!data['genres'],
        hasAuthors: !!data['authors'],
        hasCover: !!data['cover'],
        allKeys: Object.keys(data),
      });

      if (data['description'] && typeof data['description'] === 'string') {
        enrichedMetadata.description = data['description'];
        enrichedMetadata.synopsis = data['description'];
      }
      if (data['cover'] && typeof data['cover'] === 'string') {
        enrichedMetadata.coverImage = data['cover'];
      }
      if (data['status'] && typeof data['status'] === 'string') {
        enrichedMetadata.status = data['status'];
      }
      if (Array.isArray(data['genres']) && data['genres'].length > 0) {
        enrichedMetadata.genres = data['genres'] as string[];
      }
      if (Array.isArray(data['authors']) && data['authors'].length > 0) {
        enrichedMetadata.authors = data['authors'] as string[];
      }
      if (Array.isArray(data['alternativeTitles']) && data['alternativeTitles'].length > 0) {
        enrichedMetadata.alternativeTitles = data['alternativeTitles'] as string[];
      }
      if (data['originalRun'] && typeof data['originalRun'] === 'string') {
        enrichedMetadata.startDate = data['originalRun'];
      }
      if (typeof data['myAnimeListId'] === 'number') {
        enrichedMetadata.idMal = data['myAnimeListId'];
      } else if (typeof data['myAnimeListId'] === 'string' && data['myAnimeListId'].length > 0) {
        enrichedMetadata.idMal = parseInt(data['myAnimeListId'], 10);
      }
      if (data['startDate'] && typeof data['startDate'] === 'string') {
        enrichedMetadata.startDate = data['startDate'];
      }
      if (data['endDate'] && typeof data['endDate'] === 'string') {
        enrichedMetadata.endDate = data['endDate'];
      }
    }
  } else {
    const rejectedResult = metadataResult as PromiseRejectedResult;
    logger.warn('[SearchEnrichment] fetchFandomMetadata rejected', {
      reason: String(rejectedResult.reason),
    });
  }

  logger.info('[SearchEnrichment] fetchFandomMetadataAsync complete', {
    hasDescription: !!enrichedMetadata.description,
    descriptionLength: enrichedMetadata.description?.length ?? 0,
    hasAuthors: !!enrichedMetadata.authors?.length,
    format: enrichedMetadata.format,
    status: enrichedMetadata.status,
    idMal: enrichedMetadata.idMal,
    startDate: enrichedMetadata.startDate,
    endDate: enrichedMetadata.endDate,
  });

  return enrichedMetadata;
}

/**
 * Fetch Fandom chapter covers in the background (fire-and-forget).
 * Called after initial metadata fetch to avoid 30s timeout on secondary provider selection.
 */
export function fetchFandomChapterCoversBackground(
  fandomUrl: string,
  setSelectedSourcesMetadata: MetadataUpdateCallback
): void {
  if (!fandomUrl.includes('fandom.com')) {
    logger.warn('[SearchEnrichment] fetchFandomChapterCoversBackground - invalid URL:', { fandomUrl });
    return;
  }

  logger.info('[SearchEnrichment] Starting background chapter cover fetch', { url: fandomUrl });

  const decodedUrl = decodeURIComponent(fandomUrl);

  void vanillaTrpcClient.metadata.parseFandomUrl
    .mutate({
      url: decodedUrl,
      forceRefresh: false,
      fetchChapterCovers: true,
      maxChaptersToFetch: 0,
    })
    .then((result) => {
      if (!isSuccess(result)) {
        logger.warn('[SearchEnrichment] Background chapter cover fetch failed', {
          error: 'Result not successful',
        });
        return;
      }

      const parsed = result.data as unknown as Record<string, unknown>;
      const volumeDetails = parsed['volumeDetails'];

      if (!Array.isArray(volumeDetails) || volumeDetails.length === 0) {
        logger.info('[SearchEnrichment] Background fetch - no volume details');
        return;
      }

      const chapterCoverCount = countChapterCoversInVolumes(volumeDetails);
      logger.info('[SearchEnrichment] Background chapter cover fetch complete', {
        volumeCount: volumeDetails.length,
        chapterCoverCount,
      });

      if (chapterCoverCount === 0) {
        logger.info('[SearchEnrichment] No chapter covers found in background fetch');
        return;
      }

      setSelectedSourcesMetadata((prev) => {
        const fandomMetadata = prev['fandom'];
        if (!fandomMetadata) {
          logger.warn('[SearchEnrichment] Fandom metadata not found for background update');
          return prev;
        }

        const updatedMetadata: ProviderMetadata = {
          ...fandomMetadata,
          volumeData: volumeDetails as Volume[],
        };

        logger.info('[SearchEnrichment] Updated Fandom metadata with chapter covers', {
          volumeCount: volumeDetails.length,
          chapterCoverCount,
        });

        return { ...prev, fandom: updatedMetadata };
      });
    })
    .catch((error) => {
      logger.error('[SearchEnrichment] Background chapter cover fetch error', {
        error: error instanceof Error ? error.message : String(error),
      });
    });
}

/**
 * Enrich Fandom search results with gallery, volume data, and full metadata.
 */
export function enrichFandomResult(
  fandomUrl: string,
  ctx: EnrichmentContext
): void {
  if (!fandomUrl.includes('fandom.com')) {
    logger.warn('[SearchEnrichment] enrichFandomResult - URL does not contain fandom.com:', { fandomUrl });
    return;
  }

  logger.info('[SearchEnrichment] Starting Fandom enrichment with fetchChapterCovers=true', { url: fandomUrl });

  void vanillaTrpcClient.metadata.parseFandomUrl
    .mutate({
      url: fandomUrl,
      forceRefresh: false,
      fetchChapterCovers: true,
      maxChaptersToFetch: 0,
    })
    .then((parseResult) => {
      if (!isSuccess(parseResult)) {
        logger.warn('[SearchEnrichment] Fandom parse failed', { parseResult });
        return;
      }

      const parsed = parseResult.data as unknown as Record<string, unknown>;
      const volumeDetails = parsed['volumeDetails'];
      const chapterCoverCount = countChapterCoversInVolumes(volumeDetails);

      logger.info('[SearchEnrichment] Fandom parse complete', {
        hasGallery: !!parsed['gallery'],
        galleryLength: Array.isArray(parsed['gallery']) ? parsed['gallery'].length : 0,
        volumeCount: parsed['volumes'],
        chapterCount: parsed['chapters'],
        volumeDetailsCount: Array.isArray(volumeDetails) ? volumeDetails.length : 0,
        chapterCoverCount,
      });

      updateFandomMetadata(parsed, ctx);
      updateFandomVolumes(parsed, ctx);
    })
    .catch((error: unknown) => {
      logger.warn('[SearchEnrichment] Fandom volume/gallery enrichment failed:', {
        error: error instanceof Error ? error.message : String(error),
      });
    });

  void vanillaTrpcClient.metadata.fetchFandomMetadata
    .mutate({ url: fandomUrl })
    .then((metadataResult) => {
      if (!isSuccess(metadataResult)) {
        logger.warn('[SearchEnrichment] Fandom metadata fetch failed', { metadataResult });
        return;
      }

      const data = metadataResult.data as unknown as Record<string, unknown>;
      logger.debug('[SearchEnrichment] Fandom metadata fetch complete', {
        hasDescription: !!data['description'],
        hasGenres: !!data['genres'],
        hasAuthors: !!data['authors'],
        hasCover: !!data['cover'],
      });

      updateFandomFullMetadata(data, ctx);
    })
    .catch((error: unknown) => {
      logger.warn('[SearchEnrichment] Fandom metadata enrichment failed:', {
        error: error instanceof Error ? error.message : String(error),
      });
    });
}
