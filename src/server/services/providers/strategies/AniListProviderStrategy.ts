/**
 * AniList Provider Strategy
 *
 * Implements the provider strategy pattern for AniList.
 * Uses mangadex-ts-client's AniListProvider under the hood.
 */
import { MetadataProvider } from '@prisma/client';


import type { SearchResult, MangaMetadata } from '@/types/search.types';
import type { AsyncResult } from '@/utils/async-result';
import { createSuccessResult, createErrorResult } from '@/utils/async-result';
import { logger } from '@/utils/logger';

import { AniListProvider } from 'mangadex-ts-client';


import { adaptSearchResult, adaptUnifiedMangaToMetadata } from '../adapters';

import type { ProviderStrategy, ProviderConfig } from '../registry';

// ============================================================================
// AniList Provider Strategy Implementation
// ============================================================================
export class AniListProviderStrategy implements ProviderStrategy {
  public readonly name = 'AniList';
  public readonly type = MetadataProvider.ANILIST;
  private provider: AniListProvider;
  private config: ProviderConfig;

  constructor(config?: Partial<ProviderConfig>) {
    this.provider = new AniListProvider();
    this.config = {
      enabled: true,
      priority: 1,
      timeout: 10000,
      rateLimit: {
        requests: 90,
        window: 60000,
      },
      fallbackProviders: [],
      ...config,
    };
  }

  /**
   * Search for manga on AniList
   */
  public async search(
    query: string,
    _options?: unknown
  ): Promise<AsyncResult<SearchResult[], Error>> {
    try {
      const tsResults = await this.provider.search(query, 10);
      const results = tsResults.map(r => adaptSearchResult(r, MetadataProvider.ANILIST));
      return createSuccessResult(results);
    } catch (error: unknown) {
      logger.error(`AniList search failed for query "${query}":`, error);
      return createErrorResult(
        error instanceof Error ? error : new Error(`AniList search failed: ${String(error)}`)
      );
    }
  }

  /**
   * Get detailed metadata for a manga
   */
  public async getMetadata(
    id: string,
    _options?: unknown
  ): Promise<AsyncResult<MangaMetadata, Error>> {
    try {
      const providerResult = await this.provider.getMetadata(id);
      const metadata = adaptUnifiedMangaToMetadata(providerResult.manga, MetadataProvider.ANILIST);
      return createSuccessResult(metadata);
    } catch (error: unknown) {
      logger.error(`AniList metadata fetch failed for ID "${id}":`, error);
      return createErrorResult(
        error instanceof Error ? error : new Error(`AniList metadata fetch failed: ${String(error)}`)
      );
    }
  }

  /**
   * Check if provider is enabled
   */
  public isEnabled(): Promise<boolean> {
    return Promise.resolve(this.config.enabled);
  }

  /**
   * Get provider configuration
   */
  public getConfig(): ProviderConfig {
    return { ...this.config };
  }

  /**
   * Update provider configuration
   */
  public updateConfig(config: Partial<ProviderConfig>): void {
    this.config = { ...this.config, ...config };
    if (config.enabled !== undefined) {
      logger.info(`AniList provider ${config.enabled ? 'enabled' : 'disabled'}`);
    }
  }
}

// ============================================================================
// Exports
// ============================================================================
export default AniListProviderStrategy;
