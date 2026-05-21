/**
 * Search Core Router Debug Loggers
 *
 * Provider-specific debug logging functions to reduce complexity
 * in the main router file.
 *
 * Extracted from: core.ts (lines 168-271)
 */

import type { SearchResult } from '@/types/search.types';
import { logger } from '@/utils/logging';
import { isArray } from '@/utils/type-guards';

import { safeGet } from '../utils';

/**
 * Log ComicVine search results for debugging
 *
 * @param results - Search results array
 * @param provider - Provider name
 */
export function logComicVineResults(results: SearchResult[], provider: string): void {
  if (results.length === 0) return;

  const firstResult = results[0];
  if (!firstResult) return;

  logger.info('🔍 [TRPC ROUTER] ComicVine results before return:', {
    provider,
    count: results.length,
    firstResult: {
      title: firstResult.title,
      hasCover: !!firstResult.cover,
      cover: firstResult.cover,
      hasCoverImage: !!firstResult.coverImage,
      coverImage: firstResult.coverImage,
      hasDescription: !!firstResult.description,
      descriptionLength: firstResult.description?.length ?? 0,
      genres: firstResult.genres ?? [],
      authors: safeGet(firstResult, 'authors') ?? [],
      artists: safeGet(firstResult, 'artists') ?? [],
      volumes: firstResult.volumes,
      chapters: firstResult.chapters,
      hasMetadata: !!firstResult.metadata,
      metadataKeys: firstResult.metadata ? Object.keys(firstResult.metadata as Record<string, unknown>) : [],
      allKeys: Object.keys(firstResult as unknown as Record<string, unknown>)
    }
  });
}

/**
 * Log Fandom search results for debugging
 *
 * @param results - Search results array
 * @param provider - Provider name
 */
export function logFandomResults(results: SearchResult[], provider: string): void {
  if (results.length === 0) return;

  const firstResult = results[0];
  if (!firstResult) return;

  logger.info('🔍 [TRPC ROUTER] Fandom results before return:', {
    provider,
    count: results.length,
    firstResult: {
      id: firstResult.id,
      title: firstResult.title,
      hasDescription: !!firstResult.description,
      descriptionLength: firstResult.description?.length ?? 0,
      hasWikiUrl: 'wikiUrl' in firstResult && !!safeGet(firstResult, 'wikiUrl'),
      wikiUrl: 'wikiUrl' in firstResult ? safeGet(firstResult, 'wikiUrl') : 'field not present',
      hasUrl: 'url' in firstResult && !!safeGet(firstResult, 'url'),
      url: 'url' in firstResult ? safeGet(firstResult, 'url') : 'field not present',
      authors: safeGet(firstResult, 'authors') ?? 'not present',
      artists: safeGet(firstResult, 'artists') ?? 'not present',
      author: safeGet(firstResult, 'author') ?? 'not present',
      artist: safeGet(firstResult, 'artist') ?? 'not present',
      alternativeTitles: safeGet(firstResult, 'alternativeTitles') ?? 'not present',
      startDate: safeGet(firstResult, 'startDate') ?? 'not present',
      endDate: safeGet(firstResult, 'endDate') ?? 'not present',
      volumes: firstResult.volumes,
      chapters: firstResult.chapters,
      publisher: safeGet(firstResult, 'publisher') ?? 'not present',
      hasMetadata: !!firstResult.metadata,
      metadataKeys: firstResult.metadata ? Object.keys(firstResult.metadata as Record<string, unknown>) : [],
      allKeys: Object.keys(firstResult as unknown as Record<string, unknown>)
    }
  });
}

/**
 * Log Wikipedia search results for debugging
 *
 * @param results - Search results array
 * @param provider - Provider name
 */
export function logWikipediaResults(results: SearchResult[], provider: string): void {
  if (results.length === 0) return;

  const firstResult = results[0];
  if (!firstResult) return;

  const volumeData = safeGet(firstResult, 'volumeData');
  const volumeDataArray = isArray(volumeData) ? volumeData as unknown[] : undefined;
  const firstVolume = volumeDataArray && volumeDataArray.length > 0 ? volumeDataArray[0] : undefined;

  logger.info('🔍 [TRPC ROUTER] Wikipedia results before return:', {
    provider,
    count: results.length,
    firstResult: {
      id: firstResult.id,
      title: firstResult.title,
      hasDescription: !!firstResult.description,
      descriptionLength: firstResult.description?.length ?? 0,
      hasVolumeData: !!volumeDataArray,
      volumeDataLength: volumeDataArray?.length ?? 0,
      firstVolumeDescription: safeGet(firstVolume, 'description') ?? 'not present',
      firstVolumeSummary: safeGet(firstVolume, 'summary') ?? 'not present',
      volumes: firstResult.volumes,
      chapters: firstResult.chapters,
      hasMetadata: !!firstResult.metadata,
      metadataKeys: firstResult.metadata ? Object.keys(firstResult.metadata as Record<string, unknown>) : [],
      allKeys: Object.keys(firstResult as unknown as Record<string, unknown>)
    }
  });

  // Log first 3 volumes in detail
  logWikipediaVolumeDetails(volumeDataArray);
}

/**
 * Log detailed Wikipedia volume data
 *
 * @param volumeDataArray - Array of volume data
 */
function logWikipediaVolumeDetails(volumeDataArray: unknown[] | undefined): void {
  if (!volumeDataArray || volumeDataArray.length === 0) return;

  logger.info('📚 [TRPC ROUTER] Wikipedia volume data details:', {
    totalVolumes: volumeDataArray.length,
    firstThreeVolumes: volumeDataArray.slice(0, 3).map((vol: unknown, idx: number) => {
      const volObj = vol as Record<string, unknown>;
      return {
        index: idx,
        volumeNumber: volObj["volumeNumber"] ?? volObj["number"],
        hasDescription: !!volObj["description"],
        hasSummary: !!volObj["summary"],
        descriptionPreview: volObj["description"] && typeof volObj["description"] === 'string'
          ? volObj["description"].substring(0, 100)
          : 'none',
        summaryPreview: volObj["summary"] && typeof volObj["summary"] === 'string'
          ? volObj["summary"].substring(0, 100)
          : 'none'
      };
    })
  });
}

/**
 * Log search results based on provider type
 *
 * @param provider - Provider name
 * @param results - Search results array
 */
export function logProviderResults(provider: string, results: SearchResult[]): void {
  const normalizedProvider = provider.toLowerCase();

  switch (normalizedProvider) {
    case 'comicvine':
      logComicVineResults(results, provider);
      break;
    case 'fandom':
      logFandomResults(results, provider);
      break;
    case 'wikipedia':
      logWikipediaResults(results, provider);
      break;
    case 'anilist':
      logAniListResults(results, provider);
      break;
    default:
      // No debug logging for other providers
      break;
  }
}

/**
 * Log AniList search results for debugging
 *
 * @param results - Search results array
 * @param provider - Provider name
 */
export function logAniListResults(results: SearchResult[], provider: string): void {
  if (results.length === 0) return;

  const firstResult = results[0];
  if (!firstResult) return;

  logger.info('🔍 [TRPC ROUTER] AniList results before return:', {
    provider,
    count: results.length,
    firstResult: {
      id: firstResult.id,
      title: firstResult.title,
      hasAuthors: 'authors' in firstResult,
      authors: safeGet(firstResult, 'authors'),
      authorsLength: Array.isArray(safeGet(firstResult, 'authors')) ? (safeGet(firstResult, 'authors') as unknown[]).length : 0,
      hasArtists: 'artists' in firstResult,
      artists: safeGet(firstResult, 'artists'),
      artistsLength: Array.isArray(safeGet(firstResult, 'artists')) ? (safeGet(firstResult, 'artists') as unknown[]).length : 0,
      volumes: firstResult.volumes,
      chapters: firstResult.chapters,
      hasMetadata: !!firstResult.metadata,
      metadataKeys: firstResult.metadata ? Object.keys(firstResult.metadata as Record<string, unknown>) : [],
      allKeys: Object.keys(firstResult as unknown as Record<string, unknown>)
    }
  });
}
