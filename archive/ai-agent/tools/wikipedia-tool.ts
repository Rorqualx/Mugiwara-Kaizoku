/**
 * Wikipedia Tool
 *
 * Wraps Wikipedia service for AI agent tool calling.
 * Provides Wikipedia manga metadata extraction with adaptive parser.
 * Combines findBestMatch (API-based) and adaptiveExtract (parser-based) for best results.
 */

import type { WikipediaParserOptions } from '@/server/services/wikipedia/adaptive/types';
import { wikipediaService } from '@/server/services/wikipedia/wikipedia/service';
import type { WikipediaMangaData } from '@/server/services/wikipedia/wikipedia/types';
import type { WikipediaChapter, WikipediaVolume } from '@/server/services/wikipedia/wikipedia/types';
import { createSuccessResult, createErrorResult, isError, isSuccess } from '@/utils/async-result';
import type { AsyncResult } from '@/utils/async-result';
import { logger } from '@/utils/logger';

import type { AgentTool } from '../agent-core/types';

const log = logger.child('WikipediaTool');

/**
 * Parameters for the Wikipedia enrichment tool
 */
interface WikipediaToolParams {
  /** Manga title to search for */
  title: string;
  /** Optional Wikipedia parser configuration */
  options?: Partial<WikipediaParserOptions>;
}

/**
 * Validate tool parameters
 */
function validateParams(params: unknown): AsyncResult<WikipediaToolParams, Error> {
  if (!params || typeof params !== 'object') {
    return createErrorResult(new Error('Parameters must be an object'));
  }

  const { title, options } = params as Partial<WikipediaToolParams>;

  if (!title || typeof title !== 'string') {
    return createErrorResult(new Error('Title parameter is required and must be a string'));
  }

  if (options && typeof options !== 'object') {
    return createErrorResult(new Error('Options parameter must be an object'));
  }

  const result: WikipediaToolParams = { title };
  if (options !== undefined) {
    result.options = options;
  }
  return createSuccessResult(result);
}

/**
 * Check if a chapter title is a generic placeholder like "Chapter 5"
 */
function isPlaceholderTitle(title: string | undefined): boolean {
  if (!title) return true;
  return /^Chapter\s+\d+$/i.test(title);
}

/**
 * Supplement chapter-level metadata from adaptive chapters into findBestMatch chapters
 * Returns number of chapters supplemented
 */
function supplementChapterMetadata(
  chapters: WikipediaChapter[],
  adaptiveChapters: WikipediaChapter[]
): number {
  if (adaptiveChapters.length === 0) return 0;

  // Build lookup by chapter number for O(1) matching
  const adaptiveByNum = new Map<number, WikipediaChapter>();
  for (const ch of adaptiveChapters) {
    const num = typeof ch.number === 'number' ? ch.number : parseFloat(String(ch.number));
    if (!isNaN(num)) adaptiveByNum.set(num, ch);
  }

  let supplemented = 0;
  for (const ch of chapters) {
    const num = typeof ch.number === 'number' ? ch.number : parseFloat(String(ch.number));
    if (isNaN(num)) continue;

    const adaptiveCh = adaptiveByNum.get(num);
    if (!adaptiveCh) continue;

    // Supplement title if current is missing or placeholder
    if (isPlaceholderTitle(ch.title) && adaptiveCh.title && !isPlaceholderTitle(adaptiveCh.title)) {
      ch.title = adaptiveCh.title;
      supplemented++;
    }
    // Supplement release date if missing
    if (!ch.releaseDate && adaptiveCh.releaseDate) ch.releaseDate = adaptiveCh.releaseDate;
    // Supplement pages if missing
    if (!ch.pages && adaptiveCh.pages) ch.pages = adaptiveCh.pages;
  }

  return supplemented;
}

/**
 * Enrich existing volumes with descriptions from adaptive data
 */
function supplementVolumeDescriptions(
  existingVolumes: WikipediaVolume[],
  adaptiveVolumes: WikipediaVolume[]
): void {
  if (!existingVolumes.length || !adaptiveVolumes.length) return;

  for (const vol of existingVolumes) {
    if (vol.description) continue;
    const adaptiveVol = adaptiveVolumes.find(v => v.number === vol.number);
    if (adaptiveVol?.description) {
      vol.description = adaptiveVol.description;
    }
  }
}

/**
 * Perform adaptive extraction and merge with findBestMatch data
 */
async function performAdaptiveExtraction(
  title: string,
  bestMatchData: WikipediaMangaData,
  options?: Partial<WikipediaParserOptions>
): Promise<WikipediaMangaData> {
  try {
    const adaptiveResult = await wikipediaService.getAdaptiveMangaInfo(title, options);
    if (!adaptiveResult.success || !adaptiveResult.data) {
      return bestMatchData;
    }

    const adaptiveData = adaptiveResult.data;
    const mergedData = { ...bestMatchData };

    // Supplement chapter titles if missing or placeholder
    if (mergedData.chapterList?.length && adaptiveData.chapterList?.length) {
      const supplemented = supplementChapterMetadata(mergedData.chapterList, adaptiveData.chapterList);
      if (supplemented > 0) {
        log.debug('Supplemented chapter titles from adaptive extraction', { title, supplemented });
      }
    }

    // Supplement volume descriptions
    if (mergedData.volumeList?.length && adaptiveData.volumeList?.length) {
      supplementVolumeDescriptions(mergedData.volumeList, adaptiveData.volumeList);
    }

    // Supplement other metadata gaps
    if (!mergedData.description && adaptiveData.description) {
      mergedData.description = adaptiveData.description;
    }
    if (!mergedData.synopsis && adaptiveData.synopsis) {
      mergedData.synopsis = adaptiveData.synopsis;
    }
    if (!mergedData.plot && adaptiveData.plot) {
      mergedData.plot = adaptiveData.plot;
    }

    return mergedData;
  } catch (adaptiveError) {
    // Adaptive extraction is non-critical; log and continue with findBestMatch data
    log.debug('Adaptive extraction failed (non-critical)', {
      title,
      error: adaptiveError instanceof Error ? adaptiveError.message : String(adaptiveError),
    });
    return bestMatchData;
  }
}

/**
 * Fetch Wikipedia data using findBestMatch and adaptive extraction
 * Similar to fetchWikipediaData in phase-wikipedia-fallback.ts but simplified
 */
async function fetchWikipediaData(
  title: string,
  options?: Partial<WikipediaParserOptions>
): Promise<AsyncResult<WikipediaMangaData | null, Error>> {
  log.info('Fetching Wikipedia data', { title, hasOptions: !!options });

  try {
    // Stage 1: findBestMatch (API-based — best chapter-to-volume assignments)
    const bestMatch = await wikipediaService.findBestMatch(title);
    if (!bestMatch) {
      log.info('No Wikipedia data found via findBestMatch', { title });
      return createSuccessResult(null);
    }

    log.info('Wikipedia findBestMatch completed', {
      title,
      chapterCount: bestMatch.chapterList?.length ?? 0,
      volumeCount: bestMatch.volumeList?.length ?? 0,
    });

    // Stage 2: Adaptive extraction supplements gaps (descriptions, metadata)
    const mergedData = await performAdaptiveExtraction(title, bestMatch, options);

    return createSuccessResult(mergedData);
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    log.error('Wikipedia data fetch failed', { error: err, title });
    return createErrorResult(err);
  }
}

/**
 * Simplify Wikipedia data for agent consumption
 */
function simplifyWikipediaData(
  data: WikipediaMangaData,
  _title: string
): Record<string, unknown> {
  return {
    success: true,
    data: {
      title: data.title,
      alternativeTitles: data.alternativeTitles,
      description: data.description,
      synopsis: data.synopsis,
      plot: data.plot,
      author: data.author,
      artist: data.artist,
      publisher: data.publisher,
      englishPublisher: data.englishPublisher,
      volumes: data.volumes,
      chapters: data.chapters,
      chapterList: data.chapterList,
      volumeList: data.volumeList,
      genres: data.genres,
      demographic: data.demographic,
      wikipediaUrl: data.wikipediaUrl,
      volumeListUrl: data.volumeListUrl,
      chapterListUrls: data.chapterListUrls,
    },
    stats: {
      chapterCount: data.chapterList?.length ?? 0,
      volumeCount: data.volumeList?.length ?? 0,
    },
  };
}

/**
 * Execute enrichment and format result
 */
async function executeEnrichment(params: WikipediaToolParams): Promise<AsyncResult<unknown, Error>> {
  const { title, options } = params;

  const result = await fetchWikipediaData(title, options);
  if (isError(result)) {
    return createErrorResult(result.error);
  }
  if (!isSuccess(result)) {
    return createErrorResult(new Error(`Wikipedia data fetch result in unexpected state: ${result.status}`));
  }

  const data = result.data;
  if (!data) {
    return createSuccessResult({
      success: false,
      data: null,
      message: `No Wikipedia data found for title: ${title}`,
    });
  }

  const simplifiedResult = simplifyWikipediaData(data, title);
  return createSuccessResult(simplifiedResult);
}

/**
 * Wikipedia enrichment tool
 */
export const wikipediaTool: AgentTool = {
  name: 'wikipedia_enrichment',
  description: 'Fetch manga metadata from Wikipedia using adaptive parser. Combines findBestMatch (API-based) and adaptive extraction for best results. Returns complete manga metadata with chapter/volume lists.',
  parameters: {
    type: 'object',
    properties: {
      title: {
        type: 'string',
        description: 'Manga title to search for',
      },
      options: {
        type: 'object',
        description: 'Optional Wikipedia parser configuration',
        additionalProperties: true,
      },
    },
    additionalProperties: false,
  } as const,
  async execute(params: unknown): Promise<AsyncResult<unknown, Error>> {
    // Validate parameters
    const validationResult = validateParams(params);
    if (isError(validationResult)) {
      log.error('Parameter validation failed', { error: validationResult.error });
      return validationResult;
    }
    if (!isSuccess(validationResult)) {
      return createErrorResult(new Error(`Validation result in unexpected state: ${validationResult.status}`));
    }

    // Execute enrichment
    return executeEnrichment(validationResult.data);
  },
};
