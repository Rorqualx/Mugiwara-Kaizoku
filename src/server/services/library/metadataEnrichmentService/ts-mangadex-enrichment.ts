/**
 * ts-mangadex Enrichment Service
 *
 * Wraps the ts-mangadex MetadataEnricher for one-click multi-provider
 * enrichment (MangaDex + AniList + ComicVine in parallel).
 *
 * Fandom and Wikipedia remain handled by their existing fetchers.
 *
 * @module metadataEnrichmentService/ts-mangadex-enrichment
 */



import { comicvineConfigService } from '@/server/services/comicvine/configService';
import { getTsMangadexClient } from '@/server/services/mangadex/ts-client-factory';
import { adaptEnrichedToMangaMetadata } from '@/server/services/providers/adapters/ts-mangadex-adapter';
import type { MangaMetadata } from '@/types/search.types';
import { logger } from '@/utils/logger';

import {
  MetadataEnricher,
  MangaDexProvider,
  AniListProvider,
  ComicVineProvider,
} from 'mangadex-ts-client';


import type {
  EnrichedMetadata,
  DataSource,
  EnricherConfig,
} from 'mangadex-ts-client';

const log = logger.child('TsMangadexEnrichmentService');

/**
 * One-click enrichment result
 */
export interface OneClickEnrichmentResult {
  metadata: MangaMetadata;
  enriched: EnrichedMetadata;
}

/**
 * Service wrapping ts-mangadex's MetadataEnricher for multi-provider enrichment.
 * Lazily initializes providers on first use.
 */
export class TsMangadexEnrichmentService {
  private enricher: MetadataEnricher | null = null;

  /**
   * Lazily build the enricher with available providers
   */
  private async getEnricher(): Promise<MetadataEnricher> {
    if (this.enricher) return this.enricher;

    const client = await getTsMangadexClient();
    const providers = [];

    // MangaDex — always available
    providers.push(new MangaDexProvider(client));

    // AniList — always available (no API key needed)
    providers.push(new AniListProvider());

    // ComicVine — only if API key is configured
    try {
      const cvConfig = await comicvineConfigService.loadConfig();
      if (cvConfig.enabled && cvConfig.apiKey) {
        providers.push(
          new ComicVineProvider({ enabled: true, apiKey: cvConfig.apiKey })
        );
        log.info('ComicVine provider enabled for enrichment');
      }
    } catch (error) {
      log.warn('Failed to load ComicVine config, skipping provider', { error });
    }

    this.enricher = new MetadataEnricher(providers);

    log.info('MetadataEnricher initialized', {
      providers: this.enricher.getAvailableProviders(),
    });

    return this.enricher;
  }

  /**
   * Enrich by title — searches all providers, auto-picks best match per provider,
   * merges results with priority-based deduplication.
   */
  async enrichByTitle(
    title: string,
    config?: EnricherConfig
  ): Promise<OneClickEnrichmentResult> {
    const enricher = await this.getEnricher();

    log.info('Starting one-click enrichment by title', { title });
    const enriched = await enricher.enrichByTitle(title, config);

    const metadata = adaptEnrichedToMangaMetadata(enriched);

    log.info('One-click enrichment complete', {
      title,
      tier: enriched.tier,
      completeness: enriched.completeness.overall,
      sources: enriched.manga.sources,
      errors: enriched.errors.length,
    });

    return { metadata, enriched };
  }

  /**
   * Enrich with a known primary ID — fetches primary directly,
   * cross-searches other providers by title.
   */
  async enrichWithIds(
    source: DataSource,
    id: string,
    title?: string,
    knownIds?: Partial<Record<DataSource, string>>
  ): Promise<OneClickEnrichmentResult> {
    const enricher = await this.getEnricher();

    log.info('Starting one-click enrichment with ID', { source, id, title });
    const config: EnricherConfig = {};
    if (knownIds !== undefined) {
      config.knownIds = knownIds;
    }
    const enriched = await enricher.enrich(source, id, title, config);

    const metadata = adaptEnrichedToMangaMetadata(enriched);

    log.info('One-click enrichment with ID complete', {
      source,
      id,
      tier: enriched.tier,
      completeness: enriched.completeness.overall,
    });

    return { metadata, enriched };
  }

  /**
   * Reset the enricher (e.g., after config changes)
   */
  reset(): void {
    this.enricher = null;
  }
}

// Singleton instance
export const tsMangadexEnrichmentService = new TsMangadexEnrichmentService();
