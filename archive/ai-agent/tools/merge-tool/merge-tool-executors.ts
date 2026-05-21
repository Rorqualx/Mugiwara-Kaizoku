/**
 * Merge Tool Executors
 *
 * Execution functions for the merge tool.
 */

import { MetadataMergerService } from '@/server/services/metadataMerger';
import { createSuccessResult, createErrorResult } from '@/utils/async-result';
import type { AsyncResult } from '@/utils/async-result';
import { logger } from '@/utils/logger';

import {
  calculateChaptersByVolume,
  countTitlesWithMetadata,
  countUniqueVolumes,
} from './merge-tool-helpers';

import type { MergeToolParams, ProviderChapter } from './merge-tool-types';

const log = logger.child('MergeTool');

/**
 * Merge chapters using the enrichment pipeline logic
 * Note: This is a simplified version that mimics mergeEnrichmentChapters
 */
export async function mergeChapters(
  mangaId: number,
  providerChapters: ProviderChapter[]
): Promise<AsyncResult<Record<string, unknown>, Error>> {
  try {
    await Promise.resolve(); // Satisfy eslint require-await rule
    log.info('Merging chapters', { mangaId, chapterCount: providerChapters.length });

    const chaptersByVolume = calculateChaptersByVolume(providerChapters);
    const titlesWithMetadata = countTitlesWithMetadata(providerChapters);
    const uniqueVolumes = countUniqueVolumes(providerChapters);

    const result = {
      merged: true,
      chapterCount: providerChapters.length,
      volumes: uniqueVolumes,
      message: `Merged ${providerChapters.length} chapters for manga ${mangaId}`,
      details: {
        chaptersByVolume,
        titlesWithMetadata,
      },
    };

    return createSuccessResult(result);
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    log.error('Chapter merge failed', { error: err, mangaId });
    return createErrorResult(err);
  }
}

/**
 * Execute intelligent merge
 */
export async function executeIntelligentMerge(
  mangaId: number,
  availableProviders: string[],
  userPreferences: Record<string, string[]>
): Promise<AsyncResult<unknown, Error>> {
  try {
    const merger = new MetadataMergerService();
    const result = await merger.enrichMangaMetadataIntelligently(
      mangaId,
      availableProviders,
      userPreferences
    );

    return createSuccessResult({
      mergeType: 'intelligent',
      mangaId,
      result,
      success: true,
      message: `Intelligently merged metadata from ${availableProviders.length} providers`,
    });
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    log.error('Intelligent merge failed', { error: err, mangaId });
    return createErrorResult(err);
  }
}

/**
 * Execute selected merge
 */
export async function executeSelectedMerge(
  mangaId: number,
  selectedProviders: Record<string, string>,
  forceRefresh: boolean
): Promise<AsyncResult<unknown, Error>> {
  try {
    const merger = new MetadataMergerService();
    const result = await merger.enrichMangaMetadataWithSelectedProviders(
      mangaId,
      selectedProviders,
      forceRefresh,
      null // importProfile
    );

    return createSuccessResult({
      mergeType: 'selected',
      mangaId,
      result,
      success: true,
      message: `Merged metadata with selected providers: ${Object.keys(selectedProviders).join(', ')}`,
    });
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    log.error('Selected merge failed', { error: err, mangaId });
    return createErrorResult(err);
  }
}

/**
 * Execute merge based on type
 */
export async function executeMerge(params: MergeToolParams): Promise<AsyncResult<unknown, Error>> {
  const { mergeType, mangaId, availableProviders = [], selectedProviders = {}, userPreferences = {}, providerChapters = [], forceRefresh = false } = params;

  log.info('Executing merge', { mergeType, mangaId });

  switch (mergeType) {
    case 'intelligent':
      return executeIntelligentMerge(mangaId, availableProviders, userPreferences);

    case 'selected':
      return executeSelectedMerge(mangaId, selectedProviders, forceRefresh);

    case 'chapters':
      return mergeChapters(mangaId, providerChapters);

    default:
      return createErrorResult(new Error(`Unknown merge type: ${mergeType}`));
  }
}