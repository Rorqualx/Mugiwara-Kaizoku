/**
 * Transformation functions for FandomProvider
 *
 * Handles transformation of Fandom API responses into standardized SearchResult format.
 */

import { FandomService } from '@/server/services/fandom/FandomService';
import { POPULAR_WIKIS } from '@/server/services/fandom/types';
import type { FandomSearchResult, FandomMangaData } from '@/server/services/fandom/types';
import type { SearchResult } from '@/types/search.types';
import { logger } from '@/utils/logger';


import {
  buildResultProperties,
  buildSearchResultMetadata,
  processDescriptions,
  parseNumericField,
  buildAuthorArtistArrays,
  fetchPageMetadataWithCover,
  buildMangaBaseResult,
  addConditionalProperties,
  parseStatus,
  extractYear
} from './helpers';

import type { ExtendedSearchResult, ExtendedMetadata } from './types';

/**
 * Transform Fandom search results to standard format
 */
export function transformResults(
  fandomResults: FandomSearchResult[],
  wikiKey: string
): SearchResult[] {
  const wikiConfig = POPULAR_WIKIS[wikiKey];
  const wikiName = wikiConfig?.name ?? wikiKey;

  return fandomResults.map(result => {
    const resultAny = result as unknown as ExtendedSearchResult;
    const meta = result.metadata as unknown as ExtendedMetadata | undefined;

    // Log what we're receiving from FandomService
    logger.info('Transforming Fandom result:', {
      title: result.title,
      hasUrl: !!result.url,
      url: result.url,
      hasWikiUrl: !!result.wikiUrl,
      wikiUrl: result.wikiUrl,
      hasMetadata: !!meta,
      metadataKeys: meta ? Object.keys(meta) : [],
      author: meta?.author,
      artist: meta?.artist,
      startDate: meta?.startDate,
      endDate: meta?.endDate,
      alternativeTitles: meta?.alternativeTitles,
      volumes: meta?.volumes,
      chapters: meta?.chapters
    });

    // Build result properties using helper
    const resultProperties = buildResultProperties({
      result,
      meta,
      resultAny,
      wikiKey,
      parseStatus,
      extractYear
    });

    // Extract values needed for metadata
    const { description, synopsis } = processDescriptions(meta, result);
    const volumes = parseNumericField(meta?.volumes);
    const chapters = parseNumericField(meta?.chapters);
    const authorArtistArrays = buildAuthorArtistArrays(meta, resultAny);

    // Combine with metadata
    return {
      ...resultProperties,
      metadata: buildSearchResultMetadata(result, {
        wikiKey,
        wikiName,
        synopsis,
        description,
        volumes,
        chapters,
        authorArtistArrays,
        meta,
        resultAny
      })
    } as unknown as SearchResult;
  });
}

/**
 * Transform manga data to search result
 */
export async function transformMangaData(
  mangaData: FandomMangaData,
  wikiKey: string,
  services: Map<string, FandomService>
): Promise<SearchResult> {
  const wikiConfig = POPULAR_WIKIS[wikiKey];
  const wikiName = wikiConfig?.name ?? wikiKey;
  const wikiUrl = `https://${wikiConfig?.subdomain ?? wikiKey}.fandom.com/wiki/${encodeURIComponent(mangaData["title"])}`;

  const service = services.get(wikiKey);
  const { pageMetadata, coverImage } = await fetchPageMetadataWithCover(service, mangaData["title"]);

  const baseResult = buildMangaBaseResult({
    mangaData,
    wikiKey,
    wikiName,
    wikiUrl,
    coverImage,
    pageMetadata,
    parseStatus
  });

  return addConditionalProperties(baseResult, mangaData, extractYear);
}
