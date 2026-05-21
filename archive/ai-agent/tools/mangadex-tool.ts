/**
 * MangaDex/AniList/ComicVine Tool
 *
 * Wraps tsMangadexEnrichmentService.enrichByTitle() for AI agent tool calling.
 * Provides one-click enrichment from MangaDex, AniList, and ComicVine (if configured).
 */

import { tsMangadexEnrichmentService } from '@/server/services/library/metadataEnrichmentService/ts-mangadex-enrichment';
import { createSuccessResult, createErrorResult, isError, isSuccess } from '@/utils/async-result';
import type { AsyncResult } from '@/utils/async-result';
import { logger } from '@/utils/logger';

import type { AgentTool } from '../agent-core/types';
import type { EnricherConfig } from 'mangadex-ts-client';

const log = logger.child('MangaDexTool');

/**
 * Parameters for the MangaDex enrichment tool
 */
interface MangaDexToolParams {
  /** Title to search for */
  title: string;
  /** Optional enrichment configuration */
  config?: EnricherConfig;
}

/**
 * Validate tool parameters
 */
function validateParams(params: unknown): AsyncResult<MangaDexToolParams, Error> {
  if (!params || typeof params !== 'object') {
    return createErrorResult(new Error('Parameters must be an object'));
  }

  const { title, config } = params as Partial<MangaDexToolParams>;

  if (!title || typeof title !== 'string') {
    return createErrorResult(new Error('Title parameter is required and must be a string'));
  }

  const result: MangaDexToolParams = { title };
  if (config !== undefined) result.config = config;
  return createSuccessResult(result);
}

/**
 * Convert enriched chapters to the unified chapterList format
 * used by all tool results (same shape as Fandom/Wikipedia tools).
 */
function buildChapterList(
  chapters: Array<{
    chapterNumber?: string; title?: string; volume?: string;
    pages?: number; source?: string; language?: string;
  }>,
): Array<{ number: number; title?: string; volume?: number; pages?: number }> {
  const items: Array<{ number: number; title?: string; volume?: number; pages?: number }> = [];
  for (const ch of chapters) {
    if (!ch.chapterNumber) continue;
    const num = parseFloat(ch.chapterNumber);
    if (isNaN(num) || num <= 0) continue;

    const item: { number: number; title?: string; volume?: number; pages?: number } = { number: num };
    if (ch.title) item.title = ch.title;
    if (ch.volume) {
      const vol = parseInt(ch.volume, 10);
      if (!isNaN(vol)) item.volume = vol;
    }
    if (ch.pages) item.pages = ch.pages;
    items.push(item);
  }
  return items;
}

/**
 * Convert enriched volumes to the unified volumeList format.
 */
function buildVolumeList(
  volumes: Array<{
    volumeNumber: string; title?: string; description?: string;
    coverImage?: string;
  }>,
): Array<{ number: number; title?: string; description?: string; coverImage?: string }> {
  const items: Array<{ number: number; title?: string; description?: string; coverImage?: string }> = [];
  for (const vol of volumes) {
    const num = parseInt(vol.volumeNumber, 10);
    if (isNaN(num) || num <= 0) continue;

    const item: { number: number; title?: string; description?: string; coverImage?: string } = { number: num };
    if (vol.title) item.title = vol.title;
    if (vol.description) item.description = vol.description;
    if (vol.coverImage) item.coverImage = vol.coverImage;
    items.push(item);
  }
  return items;
}

/**
 * Execute enrichment and format result
 */
async function executeEnrichment(params: MangaDexToolParams): Promise<AsyncResult<unknown, Error>> {
  const { title, config } = params;

  log.info('Executing MangaDex enrichment tool', { title, hasConfig: !!config });

  try {
    const result = await tsMangadexEnrichmentService.enrichByTitle(title, config);

    const chapterList = buildChapterList(result.enriched.manga.chapters);
    const volumeList = buildVolumeList(result.enriched.manga.volumes);

    log.info('MangaDex enrichment completed', {
      title,
      tier: result.enriched.tier,
      completeness: result.enriched.completeness.overall,
      sources: result.enriched.manga.sources,
      errors: result.enriched.errors.length,
      chapterCount: chapterList.length,
      volumeCount: volumeList.length,
    });

    // Return in the same { data: { chapterList, volumeList } } format
    // as Fandom/Wikipedia tools for unified processing
    const simplifiedResult = {
      metadata: result.metadata,
      enriched: {
        tier: result.enriched.tier,
        completeness: result.enriched.completeness,
        sources: result.enriched.manga.sources,
        errors: result.enriched.errors,
      },
      data: {
        chapterList,
        volumeList,
      },
    };

    return createSuccessResult(simplifiedResult);
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    log.error('MangaDex enrichment tool failed', { error: err, title });
    return createErrorResult(err);
  }
}

/**
 * MangaDex enrichment tool
 */
export const mangadexTool: AgentTool = {
  name: 'mangadex_enrichment',
  description: 'Fetch manga metadata from MangaDex, AniList, and ComicVine (if configured) using one-click enrichment. Returns enriched manga metadata with provider confidence scores.',
  parameters: {
    type: 'object',
    properties: {
      title: {
        type: 'string',
        description: 'Manga title to search for',
      },
      config: {
        type: 'object',
        description: 'Optional enrichment configuration',
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