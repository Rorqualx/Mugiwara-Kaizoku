/**
 * Metadata Enrichment Service - Core
 *
 * Main service class for enriching manga with metadata from external providers.
 * Includes caching, rate limiting, and enhanced data fetching.
 *
 * Matcher-unification Phase 5b (2026-04-24): the legacy two-phase enrichment
 * path (`enrichManga`, `scoreMatches`, `batchEnrichManga`) has been removed.
 * Scanner auto-match and post-import enrichment go through `oneClickEnrich()`
 * (ts-mangadex) and the full pipeline in `runEnrichmentPipeline` respectively.
 */

import { MetadataService } from '@/server/services/metadata/metadataService';
import { isError, unwrapOr } from '@/utils/async-result';
import { toNumberId } from '@/utils/id-converters';
import { logger } from '@/utils/logger';
import { EnhancedMetadataCache, EnrichmentLevel } from '@/utils/metadata-cache';
import { rateLimiter } from '@/utils/rate-limiter';
import { serverLogger } from '@/utils/serverLogger';
import { isObject, hasProperty } from '@/utils/type-guards';

import { fetchAniListData } from './provider-fetchers/anilist';
import { fetchComicVineData } from './provider-fetchers/comicvine';
import { fetchFandomData } from './provider-fetchers/fandom';
import { fetchWikipediaData } from './provider-fetchers/wikipedia';
import { tsMangadexEnrichmentService } from './ts-mangadex-enrichment';

import type { OneClickEnrichmentResult } from './ts-mangadex-enrichment';
import type {
  EnhancedEnrichmentResult,
  EnrichmentOptions,
  EnrichmentResult,
  ProviderMatch,
  ProviderMutations
} from './types';

// ============================================================================
// Service Class
// ============================================================================

/**
 * Service for automatically enriching manga with metadata from providers
 * Includes caching, rate limiting, and enhanced data fetching
 */
export class MetadataEnrichmentService {
  private metadataService: MetadataService;
  private cache: EnhancedMetadataCache;
  private mutations?: ProviderMutations;

  constructor(mutations?: ProviderMutations) {
    this.metadataService = new MetadataService({
      providerConfigs: {}
    });
    this.cache = new EnhancedMetadataCache();
    if (mutations !== undefined) {
      this.mutations = mutations;
    }
  }

  /**
   * Set provider mutations for client-side operations
   */
  setMutations(mutations: ProviderMutations): void {
    this.mutations = mutations;
  }

  /**
   * Enhance metadata for a selected result (from metadata-enhancer)
   */
  async enhanceMetadata(
    provider: string,
    result: unknown,
    options: EnrichmentOptions = {}
  ): Promise<EnhancedEnrichmentResult> {
    const startTime = Date.now();
    const resultObj = result as Record<string, unknown>;
    const resultId = String(resultObj['id'] ?? resultObj['sourceId'] ?? `${provider}-unknown`);

    logger.info(`[ENHANCER] Starting enhancement for ${provider}:${resultId}`, {
      provider,
      resultId,
      hasUrl: Boolean(resultObj['url'] ?? resultObj['wikiUrl']),
      useCache: options.useCache !== false
    });

    // Check cache first
    if (options.useCache !== false) {
      const cached = this.cache.get(provider, resultId);
      if (cached) {
        const cachedObj = cached as Record<string, unknown>;
        const volumeCovers = cachedObj['volumeCovers'];
        const gallery = cachedObj['gallery'];

        logger.info(`[ENHANCER] Using cached metadata for ${provider}:${resultId}`, {
          hasVolumeCovers: Boolean(volumeCovers),
          volumeCoversCount: Array.isArray(volumeCovers) ? volumeCovers.length : 0,
          hasGallery: Boolean(gallery),
          galleryCount: Array.isArray(gallery) ? gallery.length : 0
        });

        // Extract enrichment level safely
        const enrichmentLevel = this.extractEnrichmentLevel(cached);

        return {
          provider,
          resultId,
          enrichmentLevel,
          data: cached,
          fromCache: true,
          duration: Date.now() - startTime
        };
      }
    }

    logger.info(`[ENHANCER] No cache hit, fetching fresh data for ${provider}:${resultId}`);

    // Fetch enhanced data with rate limiting
    try {
      const enhancedData = await rateLimiter.execute(
        provider,
        () => this.fetchProviderData(provider, result),
        {
          priority: options.priority ?? 0,
          id: `${provider}-${resultId}`
        }
      );

      const enhancedDataObj = enhancedData.data as Record<string, unknown> | undefined;
      const volumeCovers = enhancedDataObj?.['volumeCovers'];
      const gallery = enhancedDataObj?.['gallery'];

      logger.info(`[ENHANCER] Enhanced data fetched for ${provider}:${resultId}`, {
        enrichmentLevel: enhancedData.enrichmentLevel,
        hasVolumeCovers: Boolean(volumeCovers),
        volumeCoversCount: Array.isArray(volumeCovers) ? volumeCovers.length : 0,
        hasGallery: Boolean(gallery),
        galleryCount: Array.isArray(gallery) ? gallery.length : 0,
        dataKeys: Object.keys(enhancedData.data ?? {})
      });

      // Cache the result
      if (enhancedData.enrichmentLevel !== EnrichmentLevel.BASIC) {
        this.cache.set(provider, resultId, enhancedData.data, enhancedData.enrichmentLevel);
        logger.info(`[ENHANCER] Cached enhanced data for ${provider}:${resultId}`);
      }

      return {
        provider,
        resultId,
        ...enhancedData,
        fromCache: false,
        duration: Date.now() - startTime
      };
    } catch (error: unknown) {
      logger.error(`[ENHANCER] Failed to enhance ${provider} metadata:`, error);

      // Return basic result with error
      return {
        provider,
        resultId,
        enrichmentLevel: EnrichmentLevel.BASIC,
        data: result,
        fromCache: false,
        duration: Date.now() - startTime,
        errors: [error instanceof Error ? error.message : String(error)]
      };
    }
  }

  /**
   * Extract enrichment level from cached data
   */
  private extractEnrichmentLevel(cached: unknown): EnrichmentLevel {
    if (isObject(cached) && hasProperty(cached, '_enrichmentLevel')) {
      const level = cached['_enrichmentLevel'];
      if (
        typeof level === 'string' &&
        Object.values(EnrichmentLevel).includes(level as EnrichmentLevel)
      ) {
        return level as EnrichmentLevel;
      }
    }
    return EnrichmentLevel.BASIC;
  }

  /**
   * Apply metadata from a specific match to a manga
   */
  async applyMetadata(
    manga: { id: number; title: string },
    match: ProviderMatch
  ): Promise<EnrichmentResult> {
    try {
      // Fetch full metadata if not already present
      let updatedMatch = match;
      if (!match.metadata || Object.keys(match.metadata).length === 0) {
        const metadataResult = await this.metadataService.fetchMetadata(
          match.provider,
          match.providerId
        );
        if (isError(metadataResult)) {
          throw metadataResult.error;
        }
        const metadata = unwrapOr(metadataResult, null);
        // Fix: Use spread operator instead of parameter reassignment
        updatedMatch = { ...match, metadata };
      }

      // Update manga with metadata
      serverLogger.info('Metadata ready to be applied', {
        mangaId: toNumberId(manga.id),
        provider: updatedMatch.provider,
        providerId: updatedMatch.providerId
      });

      serverLogger.info('Applied metadata to manga', {
        mangaId: toNumberId(manga.id),
        provider: updatedMatch.provider,
        providerId: updatedMatch.providerId
      });

      return {
        status: 'enriched',
        manga: {
          id: manga.id,
          title: manga.title
        },
        appliedMatch: updatedMatch
      };
    } catch (error: unknown) {
      serverLogger.error('Failed to apply metadata', {
        mangaId: toNumberId(manga.id),
        provider: match.provider,
        error: error instanceof Error ? error.message : String(error)
      });
      return {
        status: 'error',
        manga: {
          id: manga.id,
          title: manga.title
        },
        error: error instanceof Error ? error : new Error('Failed to apply metadata')
      };
    }
  }

  /**
   * One-click enrichment using ts-mangadex MetadataEnricher.
   *
   * Fetches metadata from MangaDex + AniList + ComicVine (if configured) in parallel,
   * merges with priority-based deduplication, and returns the unified result.
   *
   * Optionally supplements with Fandom/Wikipedia data.
   */
  async oneClickEnrich(
    manga: { id: number; title: string }
  ): Promise<EnrichmentResult> {
    try {
      serverLogger.info('Starting one-click enrichment', {
        mangaId: toNumberId(manga.id),
        title: manga.title
      });

      // Primary: ts-mangadex enrichment (MangaDex + AniList + ComicVine)
      let enrichmentResult: OneClickEnrichmentResult;
      try {
        enrichmentResult = await tsMangadexEnrichmentService.enrichByTitle(manga.title);
      } catch (error) {
        // No legacy fallback — Phase 5b removed two-phase enrichment.
        // Users trigger explicit re-enrichment via the wizard (which runs the
        // full pipeline) when ts-mangadex fails.
        serverLogger.warn('One-click enrichment failed', {
          mangaId: toNumberId(manga.id),
          error: error instanceof Error ? error.message : String(error)
        });
        return {
          status: 'error',
          manga: { id: manga.id, title: manga.title },
          error: error instanceof Error ? error : new Error('One-click enrichment failed'),
        };
      }

      const { metadata, enriched } = enrichmentResult;

      // Build a ProviderMatch from the enriched result
      const primarySource = enriched.manga.sources[0] ?? 'mangadex';
      const primaryId = enriched.manga.ids[primarySource] ?? '';

      const match: ProviderMatch = {
        id: `${primarySource}-${primaryId}`,
        provider: primarySource,
        providerId: primaryId,
        title: metadata.title,
        confidence: enriched.completeness.overall / 100,
        metadata
      };

      serverLogger.info('One-click enrichment complete', {
        mangaId: toNumberId(manga.id),
        tier: enriched.tier,
        completeness: enriched.completeness.overall,
        sources: enriched.manga.sources,
        errors: enriched.errors,
      });

      return {
        status: 'enriched',
        manga: { id: manga.id, title: manga.title },
        appliedMatch: match,
        enrichedData: enriched,
      };
    } catch (error: unknown) {
      serverLogger.error('One-click enrichment error', {
        mangaId: toNumberId(manga.id),
        error: error instanceof Error ? error.message : String(error)
      });
      return {
        status: 'error',
        manga: { id: manga.id, title: manga.title },
        error: error instanceof Error ? error : new Error('One-click enrichment failed')
      };
    }
  }

  /**
   * Fetch provider-specific enhanced data
   */
  private async fetchProviderData(
    provider: string,
    result: unknown
  ): Promise<{
    enrichmentLevel: EnrichmentLevel;
    data: unknown;
  }> {
    switch (provider) {
      case 'fandom':
        return fetchFandomData(result, this.mutations);
      case 'comicvine':
        return fetchComicVineData(result, this.mutations);
      case 'wikipedia':
        return fetchWikipediaData(result, this.mutations);
      case 'anilist':
        return fetchAniListData(result, this.mutations);
      default:
        // Unknown provider, return basic data
        return {
          enrichmentLevel: EnrichmentLevel.BASIC,
          data: result
        };
    }
  }

  /**
   * Batch enhance multiple results
   */
  async batchEnhance(
    requests: Array<{ provider: string; result: unknown }>,
    options: EnrichmentOptions = {}
  ): Promise<EnhancedEnrichmentResult[]> {
    // Process all requests in parallel
    const promises = requests.map((req) =>
      this.enhanceMetadata(req.provider, req.result, options)
    );
    return Promise.all(promises);
  }

  /**
   * Preload enhancement for anticipated selections
   */
  preloadEnhancement(
    provider: string,
    results: unknown[],
    options: EnrichmentOptions = {}
  ): Promise<void> {
    // Only preload top results
    const topResults = results.slice(0, 3);

    // Low priority background fetch
    for (const result of topResults) {
      // Check if already cached
      const resultObj = result as Record<string, unknown>;
      const resultId = String(resultObj['id'] ?? resultObj['sourceId']);
      if (this.cache.has(provider, resultId)) {
        continue;
      }

      // Queue low-priority enhancement
      this.enhanceMetadata(provider, result, {
        ...options,
        priority: -1 // Low priority
      }).catch((error) => {
        // Silently fail for preloading
        logger.debug('Preload enhancement failed:', error);
      });
    }

    return Promise.resolve();
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): unknown {
    return this.cache.getStats();
  }

  /**
   * Clear metadata cache
   */
  clearCache(): void {
    this.cache.clear();
  }
}

// ============================================================================
// Exports
// ============================================================================

// Export singleton instance for server-side use
export const metadataEnrichmentService = new MetadataEnrichmentService();

// Export function for creating client-side instance with mutations
export function createMetadataEnrichmentService(
  mutations?: ProviderMutations
): MetadataEnrichmentService {
  return new MetadataEnrichmentService(mutations);
}

// Re-export types and EnrichmentLevel for convenience
export { EnrichmentLevel } from '@/utils/metadata-cache';
export type {
  EnrichmentOptions,
  ProviderMatch,
  EnrichmentResult,
  EnhancedEnrichmentResult,
  ProviderMutations
} from './types';
