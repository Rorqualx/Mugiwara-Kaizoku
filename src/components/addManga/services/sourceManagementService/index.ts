/**
 * Source Management Service - Main Aggregator
 *
 * Manages metadata from multiple sources (AniList, ComicVine, Fandom, Wikipedia).
 *
 * Architecture:
 * - types.ts - Type definitions (4 interfaces, 2 re-exports)
 * - metadata-operations.ts - Metadata utilities (2 functions)
 * - data-retrieval.ts - Data access (3 functions)
 * - comicvine-operations.ts - ComicVine scraping (6 functions)
 * - source-selection.ts - Source selection orchestration (1 function)
 *
 * Original: 624 lines → Refactored: ~100 lines aggregator + 5 focused modules (931 lines total)
 */

import {
  extractComicVineAlternativeTitles,
  scrapeComicVineSeriesData,
} from './comicvine-operations';
import {
  getVolumesForSource as getVolumes,
  getChaptersForSource as getChapters,
} from './data-retrieval';
import {
  extractBasicMetadata as extractBasic,
  mergeMetadata as merge,
} from './metadata-operations';
import {
  handleAdditionalSourceSelection as handleSourceSelection,
  type SourceSelectionCallbacks,
  type SourceSelectionDependencies,
} from './source-selection';

import type {
  SourceManagementServiceConfig,
  ComicVineData,
  ProviderMetadata,
} from './types';

export class SourceManagementService {
  private mutations: SourceManagementServiceConfig;

  constructor(mutations: SourceManagementServiceConfig) {
    this.mutations = mutations;
  }

  /**
   * Handle selection of an additional metadata source
   */
  async handleAdditionalSourceSelection(
    provider: string,
    result: Record<string, unknown>,
    callbacks: SourceSelectionCallbacks,
    forceUpdate: boolean = false
  ): Promise<void> {
    const dependencies: SourceSelectionDependencies = {
      mutations: this.mutations,
      extractBasicMetadata: this.extractBasicMetadata.bind(this),
    };

    return handleSourceSelection(
      provider,
      result,
      callbacks,
      dependencies,
      forceUpdate
    );
  }

  /**
   * Merge metadata from multiple sources
   */
  mergeMetadata(
    sources: Record<string, ProviderMetadata>,
    primaryProvider: string
  ): Partial<ProviderMetadata> {
    return merge(sources, primaryProvider);
  }

  /**
   * Get volumes for a specific source
   */
  getVolumesForSource(
    source: string,
    volumesData: Record<string, unknown>,
    selectedSourcesMetadata: Record<string, ProviderMetadata>,
    provider: string
  ): Array<Record<string, unknown>> {
    return getVolumes(source, volumesData, selectedSourcesMetadata, provider);
  }

  /**
   * Get chapters for a specific source
   */
  getChaptersForSource(
    source: string,
    provider: string,
    volumesData: Record<string, unknown>,
    selectedSourcesMetadata: Record<string, ProviderMetadata>
  ): Array<Record<string, unknown>> {
    return getChapters(source, provider, volumesData, selectedSourcesMetadata);
  }

  /**
   * Extract basic metadata from search result
   * @private
   */
  private extractBasicMetadata(result: Record<string, unknown>): ProviderMetadata {
    return extractBasic(result);
  }

  /**
   * Extract alternative titles from ComicVine data
   * @private
   */
  private extractComicVineAlternativeTitles(data: ComicVineData): string[] {
    return extractComicVineAlternativeTitles(data);
  }

  /**
   * Scrape ComicVine series data using two-step process
   * @private
   */
  private async scrapeComicVineSeriesData(
    comicVineUrl: string,
    volumeData: unknown[],
    scrapedChapterData: unknown[]
  ): Promise<{ scrapedChapterCount: number; volumeData: unknown[] }> {
    return scrapeComicVineSeriesData(
      comicVineUrl,
      volumeData,
      scrapedChapterData,
      this.mutations
    );
  }
}

export default SourceManagementService;

// Re-export types for convenience
export type {
  SourceManagementServiceConfig,
  ComicVineData,
  ProviderMetadata,
  MediaGallery,
} from './types';
