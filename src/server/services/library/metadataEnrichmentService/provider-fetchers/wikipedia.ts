/**
 * Wikipedia Provider Fetcher
 *
 * Fetches and enhances metadata from Wikipedia.
 * Retrieves volume lists, chapter lists, and infobox data.
 *
 * Extracted from: metadataEnrichmentService.ts (lines 830-883)
 */

import { logParseFailure } from '@/server/services/metadata/parse-failure-logger';
import { logger } from '@/utils/logger';
import { EnrichmentLevel } from '@/utils/metadata-cache';
import { isObject, hasProperty } from '@/utils/type-guards';

import { isMutation } from '../types';

import type { ProviderMutations } from '../types';

/**
 * Fetch enhanced Wikipedia data
 */
export async function fetchWikipediaData(
  result: unknown,
  mutations: ProviderMutations | undefined
): Promise<{ enrichmentLevel: EnrichmentLevel; data: unknown }> {
  const resultObj = result as Record<string, unknown>;
  const title = resultObj["title"];

  if (!title) {
    return {
      enrichmentLevel: EnrichmentLevel.BASIC,
      data: result
    };
  }

  let enhancedResult = {
    ...(result as Record<string, unknown>)
  };
  let enrichmentLevel = EnrichmentLevel.BASIC;

  try {
    const wikipediaMutation = mutations?.fetchWikipediaMutation;
    if (wikipediaMutation && isMutation(wikipediaMutation)) {
      const wikiResult: unknown = await wikipediaMutation.mutateAsync({
        title,
        enrichExisting: true
      });

      // mutateAsync returns data directly, not wrapped in AsyncResult
      if (isObject(wikiResult)) {
        enhancedResult = {
          ...enhancedResult,
          ...wikiResult,
          volumeList: hasProperty(wikiResult, 'volumeList') ? wikiResult['volumeList'] : undefined,
          volumeTables: hasProperty(wikiResult, 'volumeTables') ? wikiResult['volumeTables'] : undefined,
          chapterList: hasProperty(wikiResult, 'chapterList') ? wikiResult['chapterList'] : undefined,
          infobox: hasProperty(wikiResult, 'infobox') ? wikiResult['infobox'] : undefined
        };

        // Wikipedia typically provides comprehensive data
        const hasVolumeList = hasProperty(wikiResult, 'volumeList') && wikiResult['volumeList'];
        const hasChapterList = hasProperty(wikiResult, 'chapterList') && wikiResult['chapterList'];
        enrichmentLevel = hasVolumeList || hasChapterList ? EnrichmentLevel.FULL : EnrichmentLevel.PARTIAL;
      }
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Wikipedia enhancement failed:', errorMessage);
    await logParseFailure({
      source: 'wikipedia',
      url: typeof title === 'string' ? `wiki:${title}` : '',
      stage: 'fetchWikipediaData',
      reason: 'exception',
      context: { error: errorMessage, title },
    });
  }

  if (enrichmentLevel === EnrichmentLevel.BASIC) {
    await logParseFailure({
      source: 'wikipedia',
      url: typeof title === 'string' ? `wiki:${title}` : '',
      stage: 'fetchWikipediaData',
      reason: 'no_enrichment',
      context: { title },
    });
  }

  return {
    enrichmentLevel,
    data: enhancedResult
  };
}
