/**
 * ComicVine Provider Strategy
 *
 * Implements the provider strategy pattern for ComicVine.
 * Uses mangadex-ts-client's ComicVineProvider under the hood.
 */
import { MetadataProvider } from '@prisma/client';


import { comicvineConfigService } from '@/server/services/comicvine/configService';
import type { SearchResult, MangaMetadata } from '@/types/search.types';
import type { AsyncResult } from '@/utils/async-result';
import { createSuccessResult, createErrorResult } from '@/utils/async-result';
import { logger } from '@/utils/logger';

import { ComicVineProvider } from 'mangadex-ts-client';


import { adaptSearchResult, adaptUnifiedMangaToMetadata } from '../adapters';

import type { ProviderStrategy, ProviderConfig } from '../registry';

// ============================================================================
// ComicVine Provider Strategy Implementation
// ============================================================================
export class ComicVineProviderStrategy implements ProviderStrategy {
  public readonly name = 'ComicVine';
  public readonly type = MetadataProvider.COMICVINE;
  private provider: ComicVineProvider | null = null;
  private config: ProviderConfig;

  constructor(config?: Partial<ProviderConfig>) {
    this.config = {
      enabled: false,
      priority: 4,
      timeout: 15000,
      rateLimit: {
        requests: 200,
        window: 3600000,
      },
      fallbackProviders: [MetadataProvider.WIKIPEDIA],
      ...config,
    };

    // Initialize provider if API key is available
    void this.initProvider();
  }

  /**
   * Initialize the ComicVine provider with API key from config service
   */
  private async initProvider(): Promise<void> {
    try {
      const apiKey = await comicvineConfigService.getApiKey();
      if (apiKey) {
        this.provider = new ComicVineProvider({ enabled: true, apiKey });
        this.config.enabled = true;
        this.config.apiKey = apiKey;
      }
    } catch {
      // Provider stays disabled without API key
    }
  }

  /**
   * Ensure provider is initialized before use
   */
  private async ensureProvider(): Promise<ComicVineProvider> {
    if (!this.provider) {
      await this.initProvider();
    }
    if (!this.provider) {
      throw new Error('ComicVine API key not configured');
    }
    return this.provider;
  }

  /**
   * Search for manga/comics on ComicVine
   */
  public async search(
    query: string,
    _options?: unknown
  ): Promise<AsyncResult<SearchResult[], Error>> {
    try {
      const provider = await this.ensureProvider();
      const tsResults = await provider.search(query, 10);
      const results = tsResults.map(r => adaptSearchResult(r, MetadataProvider.COMICVINE));
      return createSuccessResult(results);
    } catch (error: unknown) {
      logger.error(`ComicVine search failed for query "${query}":`, error);
      return createErrorResult(
        error instanceof Error ? error : new Error(`ComicVine search failed: ${String(error)}`)
      );
    }
  }

  /**
   * Get detailed metadata for a manga/comic
   */
  public async getMetadata(
    id: string,
    _options?: unknown
  ): Promise<AsyncResult<MangaMetadata, Error>> {
    try {
      const provider = await this.ensureProvider();
      const volumeId = this.extractVolumeId(id);
      const providerResult = await provider.getMetadata(volumeId);
      const metadata = adaptUnifiedMangaToMetadata(providerResult.manga, MetadataProvider.COMICVINE);
      return createSuccessResult(metadata);
    } catch (error: unknown) {
      logger.error(`ComicVine metadata fetch failed for ID "${id}":`, error);
      return createErrorResult(
        error instanceof Error ? error : new Error(`ComicVine metadata fetch failed: ${String(error)}`)
      );
    }
  }

  /**
   * Check if provider is enabled
   */
  public async isEnabled(): Promise<boolean> {
    if (!this.provider) {
      await this.initProvider();
    }
    return this.config.enabled && !!this.config.apiKey;
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
      logger.info(`ComicVine provider ${config.enabled ? 'enabled' : 'disabled'}`);
    }
    if (config.apiKey) {
      this.provider = new ComicVineProvider({ enabled: true, apiKey: config.apiKey });
      logger.info('ComicVine API key updated');
    }
  }

  /**
   * Extract volume ID from various input formats
   */
  private extractVolumeId(id: string): string {
    if (id.includes('comicvine.gamespot.com')) {
      const match = id.match(/4050-(\d+)/);
      if (match?.[1]) return match[1];
      return id;
    }
    if (id.startsWith('4050-')) {
      return id.substring(5);
    }
    return id;
  }
}

// ============================================================================
// Exports
// ============================================================================
export default ComicVineProviderStrategy;
