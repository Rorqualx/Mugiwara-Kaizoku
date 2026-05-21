/**
 * MangaUpdates Provider Strategy
 *
 * Implements the provider strategy pattern for MangaUpdates.
 * No API key required — uses the public MangaUpdates v1 API.
 * Provides publisher info, granular categories, related series, and licensing details.
 */

import { MetadataProvider } from '@prisma/client';

import { adaptMUSearchResult, adaptMUToMangaMetadata } from '@/server/services/mangaupdates/adapter';
import { mangaUpdatesService } from '@/server/services/mangaupdates/service';
import type { SearchResult, MangaMetadata } from '@/types/search.types';
import type { AsyncResult } from '@/utils/async-result';
import { createSuccessResult, createErrorResult } from '@/utils/async-result';
import { logger } from '@/utils/logger';


import type { ProviderStrategy, ProviderConfig } from '../registry';

// ============================================================================
// MangaUpdates Provider Strategy Implementation
// ============================================================================
export class MangaUpdatesProviderStrategy implements ProviderStrategy {
  public readonly name = 'MangaUpdates';
  public readonly type = MetadataProvider.MANGAUPDATES;
  private config: ProviderConfig;

  constructor(config?: Partial<ProviderConfig>) {
    this.config = {
      enabled: true,
      priority: 6,
      timeout: 15000,
      rateLimit: {
        requests: 60,
        window: 60000,
      },
      fallbackProviders: [],
      ...config,
    };
  }

  /**
   * Search for manga on MangaUpdates
   */
  public async search(
    query: string,
    _options?: unknown
  ): Promise<AsyncResult<SearchResult[], Error>> {
    try {
      const hits = await mangaUpdatesService.searchSeries(query, 10);
      const results = hits.map(hit => adaptMUSearchResult(hit));
      return createSuccessResult(results);
    } catch (error: unknown) {
      logger.error(`MangaUpdates search failed for query "${query}":`, error);
      return createErrorResult(
        error instanceof Error ? error : new Error(`MangaUpdates search failed: ${String(error)}`)
      );
    }
  }

  /**
   * Get detailed metadata for a manga series
   */
  public async getMetadata(
    id: string,
    _options?: unknown
  ): Promise<AsyncResult<MangaMetadata, Error>> {
    try {
      const seriesId = parseInt(id, 10);
      if (isNaN(seriesId)) {
        return createErrorResult(new Error(`Invalid MangaUpdates series ID: ${id}`));
      }

      const details = await mangaUpdatesService.getSeriesDetails(seriesId);
      if (!details) {
        return createErrorResult(new Error(`MangaUpdates series not found: ${id}`));
      }

      const metadata = adaptMUToMangaMetadata(details);
      return createSuccessResult(metadata);
    } catch (error: unknown) {
      logger.error(`MangaUpdates metadata fetch failed for ID "${id}":`, error);
      return createErrorResult(
        error instanceof Error ? error : new Error(`MangaUpdates metadata fetch failed: ${String(error)}`)
      );
    }
  }

  /**
   * Check if provider is enabled (always true — no API key needed)
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
      logger.info(`MangaUpdates provider ${config.enabled ? 'enabled' : 'disabled'}`);
    }
  }
}

// ============================================================================
// Exports
// ============================================================================
export default MangaUpdatesProviderStrategy;
