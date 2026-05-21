/**
 * MangaDex Provider Strategy
 *
 * Implements the provider strategy pattern for MangaDex.
 * Uses mangadex-ts-client's MangaDexProvider under the hood.
 */
import { MetadataProvider } from '@prisma/client';



import { tsMangadexClient } from '@/server/services/mangadex/ts-client-factory';
import type { SearchResult, MangaMetadata } from '@/types/search.types';
import type { AsyncResult } from '@/utils/async-result';
import { createSuccessResult, createErrorResult } from '@/utils/async-result';
import { logger } from '@/utils/logger';

import { MangaDexProvider } from 'mangadex-ts-client';


import { adaptSearchResult, adaptUnifiedMangaToMetadata } from '../adapters';

import type { ProviderStrategy, ProviderConfig } from '../registry';


// ============================================================================
// MangaDex Provider Strategy Implementation
// ============================================================================
export class MangaDexProviderStrategy implements ProviderStrategy {
  public readonly name = 'MangaDex';
  public readonly type = MetadataProvider.MANGADEX;
  private provider: MangaDexProvider;
  private config: ProviderConfig;

  constructor(config?: Partial<ProviderConfig>) {
    this.provider = new MangaDexProvider(tsMangadexClient);
    this.config = {
      enabled: true,
      priority: 2,
      timeout: 20000,
      rateLimit: {
        requests: 5,
        window: 1000,
      },
      fallbackProviders: [MetadataProvider.ANILIST],
      ...config,
    };
  }

  /**
   * Search for manga on MangaDex
   */
  public async search(
    query: string,
    _options?: unknown
  ): Promise<AsyncResult<SearchResult[], Error>> {
    try {
      const tsResults = await this.provider.search(query, 10);
      const results = tsResults.map(r => adaptSearchResult(r, MetadataProvider.MANGADEX));
      return createSuccessResult(results);
    } catch (error: unknown) {
      logger.error(`MangaDex search failed for query "${query}":`, error);
      return createErrorResult(
        error instanceof Error ? error : new Error(`MangaDex search failed: ${String(error)}`)
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
      const resolvedId = this.extractIdFromUrl(id);
      const providerResult = await this.provider.getMetadata(resolvedId);
      const metadata = adaptUnifiedMangaToMetadata(providerResult.manga, MetadataProvider.MANGADEX);
      return createSuccessResult(metadata);
    } catch (error: unknown) {
      logger.error(`MangaDex metadata fetch failed for ID "${id}":`, error);
      return createErrorResult(
        error instanceof Error ? error : new Error(`MangaDex metadata fetch failed: ${String(error)}`)
      );
    }
  }

  /**
   * Check if provider is enabled.
   *
   * Note: this returns the in-memory ProviderConfig flag, not the DB-backed
   * `mangadex.enabled` key. The actual gate that controls whether MangaDex
   * is queried during enrichment lives in `phase-provider-fetch.ts` →
   * `loadEnabledProviders()`, which reads `mangadex.enabled` directly.
   * That upstream check is what users see when toggling MangaDex on the
   * metadata-providers page.
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
      logger.info(`MangaDex provider ${config.enabled ? 'enabled' : 'disabled'}`);
    }
  }

  /**
   * Extract UUID from a MangaDex URL
   */
  private extractIdFromUrl(id: string): string {
    if (id.includes('mangadex.org/title/')) {
      const match = id.match(/mangadex\.org\/title\/([a-f0-9-]+)/i);
      if (match?.[1]) {
        return match[1];
      }
    }
    return id;
  }
}

// ============================================================================
// Exports
// ============================================================================
export default MangaDexProviderStrategy;
