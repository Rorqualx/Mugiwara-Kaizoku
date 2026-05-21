/**
 * Main Fandom Service - Aggregator
 *
 * Combines MediaWiki and v1 APIs with dynamic parsing capabilities.
 *
 * This is the main entry point that delegates to focused sub-modules:
 * - fandom/utils.ts - Helper functions
 * - fandom/search.ts - Search operations
 * - fandom/manga-info.ts - Manga extraction
 * - fandom/character-info.ts - Character extraction
 * - fandom/bulk-operations.ts - Bulk fetching
 * - fandom/metadata/index.ts - Page metadata
 *
 * Original: 2,117 lines
 * Refactored: ~200 lines (90% reduction)
 */

import { logger } from '@/utils/logger';

import { DynamicWikiParser } from './dynamic/DynamicWikiParser';
import { WikiContentScraper } from './dynamic/WikiContentScraper';
import {
  getAllCharacters,
  getAllChapters,
  bulkFetchVolumeChapterData,
  checkChapterZeroPageExists
} from './fandom/bulk-operations';
import { getCharacterInfo } from './fandom/character-info';
import { getMangaInfo } from './fandom/manga-info';
import { getPageMetadata } from './fandom/metadata';
import {
  search,
  determineResultType,
  calculateRelevanceScore
} from './fandom/search';
import {
  cleanWikitext,
  parseDateRange,
  formatDateString,
  processImageUrl,
  hasChapterZeroInContent
} from './fandom/utils';
import { FandomV1API } from './FandomV1API';
import { MediaWikiAPI } from './MediaWikiAPI';
import { POPULAR_WIKIS } from './types';

import type { BulkFetchOptions, BulkFetchResult } from './fandom/bulk-operations';
import type {
  FandomAPIConfig,
  FandomSearchResult,
  FandomMangaData,
  FandomCharacterData,
  WikiConfig,
  FandomPageMetadata
} from './types';

export class FandomService {
  private mediaWikiAPI: MediaWikiAPI;
  private v1API: FandomV1API;
  private wikiConfig: WikiConfig;
  private log = logger.child('FandomService');

  // Dynamic parsing system
  private dynamicParser: DynamicWikiParser;
  private contentScraper: WikiContentScraper;

  constructor(
    wikiSubdomain = 'manga',
    wikiConfig?: WikiConfig,
    apiConfig?: Partial<FandomAPIConfig>
  ) {
    const baseUrl = `https://${wikiSubdomain}.fandom.com`;
    const config: FandomAPIConfig = {
      baseUrl,
      wiki: wikiSubdomain,
      rateLimit: {
        requestsPerSecond: apiConfig?.rateLimit?.requestsPerSecond ?? 2,
        burstLimit: apiConfig?.rateLimit?.burstLimit ?? 5
      },
      cache: {
        enabled: apiConfig?.cache?.enabled !== false,
        ttl: apiConfig?.cache?.ttl ?? 3600
      },
      timeout: apiConfig?.timeout ?? 30000,
      retries: apiConfig?.retries ?? 3
    };

    this.mediaWikiAPI = new MediaWikiAPI(config);
    this.v1API = new FandomV1API(config);
    this.dynamicParser = new DynamicWikiParser();
    this.contentScraper = new WikiContentScraper();

    this.wikiConfig = wikiConfig ?? this.findWikiConfig(wikiSubdomain) ?? {
      name: wikiSubdomain,
      subdomain: wikiSubdomain,
      categories: {
        characters: 'Characters',
        chapters: 'Chapters',
        volumes: 'Volumes',
        arcs: 'Story Arcs'
      }
    };
  }

  /**
   * Find wiki configuration from popular wikis
   */
  private findWikiConfig(subdomain: string): WikiConfig | null {
    for (const [_key, config] of Object.entries(POPULAR_WIKIS)) {
      if ((config as WikiConfig).subdomain === subdomain) {
        return config as WikiConfig;
      }
    }
    return null;
  }

  // ============================================================================
  // PUBLIC API - Delegates to modules
  // ============================================================================

  /**
   * Search for manga or characters across both APIs
   */
  async search(
    query: string,
    options: {
      type?: 'all' | 'manga' | 'character';
      limit?: number;
      includeDetails?: boolean;
    } = {}
  ): Promise<FandomSearchResult[]> {
    return search(query, options, {
      mediaWikiAPI: this.mediaWikiAPI,
      v1API: this.v1API,
      wikiConfig: this.wikiConfig,
      getPageMetadata: (title) => this.getPageMetadata(title)
    });
  }

  /**
   * Get manga information using dynamic or static parsing
   */
  async getMangaInfo(title: string): Promise<FandomMangaData | null> {
    return getMangaInfo(title, {
      mediaWikiAPI: this.mediaWikiAPI,
      wikiConfig: this.wikiConfig,
      contentScraper: this.contentScraper,
      getPageMetadata: (t) => this.getPageMetadata(t),
      bulkFetchVolumeChapterData: (url, opts) => this.bulkFetchVolumeChapterData(url, opts),
      getAllChapters: (limit) => this.getAllChapters(limit)
    });
  }

  /**
   * Get character information from the wiki
   */
  async getCharacterInfo(characterName: string): Promise<FandomCharacterData | null> {
    const baseUrl = `https://${this.wikiConfig.subdomain}.fandom.com`;
    return getCharacterInfo(characterName, this.mediaWikiAPI, baseUrl);
  }

  /**
   * Get complete page metadata including volumes, chapters, and description
   */
  async getPageMetadata(title: string): Promise<FandomPageMetadata | null> {
    return getPageMetadata(title, this.mediaWikiAPI, this.wikiConfig);
  }

  /**
   * Get all characters from the wiki
   */
  async getAllCharacters(limit: number = 500): Promise<string[]> {
    return getAllCharacters(this.wikiConfig, this.mediaWikiAPI, limit);
  }

  /**
   * Get all manga chapters
   */
  async getAllChapters(limit: number = 500): Promise<string[]> {
    return getAllChapters(this.wikiConfig, this.mediaWikiAPI, limit);
  }

  /**
   * Bulk fetch volumes and chapters with their details
   */
  async bulkFetchVolumeChapterData(
    volumesListUrl?: string,
    options: BulkFetchOptions = {}
  ): Promise<BulkFetchResult> {
    return bulkFetchVolumeChapterData(volumesListUrl, this.mediaWikiAPI, options);
  }

  /**
   * Check if a Chapter 0 page exists for the manga
   */
  async checkChapterZeroPageExists(title?: string): Promise<boolean> {
    return checkChapterZeroPageExists(
      this.mediaWikiAPI,
      this.wikiConfig.subdomain,
      title
    );
  }

  /**
   * Destroy the service and clean up resources
   */
  destroy(): void {
    this.mediaWikiAPI.destroy();
    this.v1API.destroy();
  }
}

// Re-export utilities for direct access
export {
  cleanWikitext,
  parseDateRange,
  formatDateString,
  processImageUrl,
  hasChapterZeroInContent,
  determineResultType,
  calculateRelevanceScore
};
