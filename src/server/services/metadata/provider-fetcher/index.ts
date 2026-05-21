/**
 * Provider Fetching Service
 *
 * Handles fetching metadata from various providers (AniList, ComicVine, Fandom, Wikipedia)
 * and converting it to a unified format for the metadata merger.
 *
 * This service:
 * - Fetches metadata from single or multiple providers
 * - Converts SearchResult to PartialUnifiedMetadata format
 * - Handles provider matching and ID resolution
 * - Returns AsyncResult for type-safe error handling
 * - Supports future rate limiting and caching
 *
 * @module ProviderFetchingService
 *
 * Refactored from: provider-fetcher.ts
 * Architecture:
 * - provider-fetcher/types.ts - Type definitions
 * - provider-fetcher/conversion-utils.ts - Conversion utilities
 * - provider-fetcher/index.ts - Main service class (this file)
 */

import { searchProviderRegistry } from '@/server/services/search/registerProviders';
import type { SearchResult } from '@/server/services/search/types';
import { ProviderMatcher } from '@/server/utils/providerMatcher';
import type { PartialUnifiedMetadata } from '@/types/search.types';
import { AsyncResult, createSuccessResult, createErrorResult } from '@/utils/async-result';
import { toStringId } from '@/utils/id-converters';
import { logger } from '@/utils/logger';

import { convertToUnifiedMetadata } from './conversion-utils';

import type { FetchInput, ProviderFetchConfig } from './types';

// Re-export types for convenience
export type { FetchInput, ProviderFetchConfig, ProviderFetchResult } from './types';

/**
 * Provider Fetching Service
 *
 * Responsible for fetching metadata from providers and converting to unified format
 */
export class ProviderFetchingService {
  private providerMatcher: ProviderMatcher;
  private logger = logger.child('ProviderFetchingService', {
    module: 'ProviderFetchingService'
  });

  constructor() {
    this.providerMatcher = new ProviderMatcher();
  }

  /**
   * Fetch metadata from a single provider
   *
   * @param provider - Provider name (anilist, comicvine, fandom, wikipedia)
   * @param manga - Manga information for fetching
   * @param config - Fetch configuration
   * @returns AsyncResult with unified metadata
   */
  async fetchFromProvider(
    provider: string,
    manga: FetchInput,
    config: ProviderFetchConfig = {}
  ): Promise<AsyncResult<PartialUnifiedMetadata>> {
    try {
      const { isPrimary = false } = config;

      this.logger.info(`Fetching metadata from ${provider} for manga: ${manga.title}`);

      // Get metadata from provider
      const searchResult = await this.getProviderMetadata(provider, manga, isPrimary);

      if (!searchResult) {
        return createErrorResult(new Error(`No metadata found from ${provider} for: ${manga.title}`));
      }

      // Convert SearchResult to PartialUnifiedMetadata
      const unifiedMetadata = convertToUnifiedMetadata(searchResult, provider);

      this.logger.info(`Successfully fetched metadata from ${provider} for: ${manga.title}`);

      return createSuccessResult(unifiedMetadata);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Error fetching from provider ${provider}:`, error);
      return createErrorResult(new Error(`Failed to fetch from ${provider}: ${errorMessage}`));
    }
  }

  /**
   * Fetch metadata from multiple providers in parallel
   *
   * @param providers - Array of provider names
   * @param manga - Manga information for fetching
   * @param config - Fetch configuration
   * @returns AsyncResult with map of provider name to unified metadata
   */
  async fetchFromMultipleProviders(
    providers: string[],
    manga: FetchInput,
    config: ProviderFetchConfig = {}
  ): Promise<AsyncResult<Map<string, PartialUnifiedMetadata>>> {
    try {
      this.logger.info(`Fetching metadata from ${providers.length} providers for: ${manga.title}`);

      // Fetch from all providers in parallel
      const fetchPromises = providers.map(async (provider) => {
        const result = await this.fetchFromProvider(provider, manga, config);
        return { provider, result };
      });

      const results = await Promise.all(fetchPromises);

      // Build map of successful fetches
      const metadataMap = new Map<string, PartialUnifiedMetadata>();

      for (const { provider, result } of results) {
        if (result.status === 'success') {
          metadataMap.set(provider, result.data);
        } else if (result.status === 'error') {
          this.logger.warn(`Failed to fetch from ${provider}:`, result.error);
        }
      }

      if (metadataMap.size === 0) {
        return createErrorResult(new Error(`Failed to fetch metadata from any of the ${providers.length} providers`));
      }

      this.logger.info(`Successfully fetched metadata from ${metadataMap.size}/${providers.length} providers`);

      return createSuccessResult(metadataMap);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error('Error fetching from multiple providers:', error);
      return createErrorResult(new Error(`Failed to fetch from multiple providers: ${errorMessage}`));
    }
  }

  /**
   * Get metadata from a specific provider
   *
   * Uses provider registry to get metadata by ID or searches by title if no ID is available
   *
   * @param provider - Provider name
   * @param manga - Manga information
   * @param isPrimary - Whether this is the primary provider (use stored ID if available)
   * @returns Search result or null if not found
   */
  private async getProviderMetadata(
    provider: string,
    manga: FetchInput,
    isPrimary: boolean
  ): Promise<SearchResult | null> {
    try {
      // Try to use stored provider ID for primary provider
      if (isPrimary && manga.providerMetadata) {
        const providerId = this.extractProviderId(manga.providerMetadata);
        if (providerId) {
          this.logger.info(`Using existing provider ID for ${provider}: ${providerId}`);
          const metadata = await this.fetchByProviderId(provider, providerId, manga.title);
          if (metadata) {
            return metadata;
          }
        }
      }

      // Fall back to title search
      this.logger.info(`Searching for match on ${provider} by title: ${manga.title}`);
      const matchId = await this.providerMatcher.findMatch(manga.title, provider);

      if (!matchId) {
        this.logger.info(`No match found on ${provider} for title: ${manga.title}`);
        return null;
      }

      this.logger.info(`Found match on ${provider} with ID: ${matchId}`);
      return await this.fetchByProviderId(provider, matchId, manga.title);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Error getting metadata from ${provider}:`, errorMessage);
      throw error;
    }
  }

  /**
   * Fetch metadata by provider ID
   *
   * @param provider - Provider name
   * @param providerId - Provider-specific ID
   * @param title - Manga title (optional, for fallback)
   * @returns Search result or null
   */
  private async fetchByProviderId(
    provider: string,
    providerId: string,
    title?: string
  ): Promise<SearchResult | null> {
    const providerInstance = searchProviderRegistry.get(provider);

    if (!providerInstance) {
      this.logger.warn(`Provider ${provider} not found in registry`);
      return null;
    }

    if (!('getMetadata' in providerInstance) || typeof providerInstance.getMetadata !== 'function') {
      this.logger.warn(`Provider ${provider} does not support getMetadata`);
      return null;
    }

    const result = await providerInstance.getMetadata(providerId, title);

    // Ensure provider field is set (avoid spreading with exactOptionalPropertyTypes)
    if (!result.provider) {
      result.provider = provider;
    }

    // Cast through unknown to handle exactOptionalPropertyTypes differences between SearchResult types
    return result as unknown as SearchResult;
  }

  /**
   * Extract provider ID from provider metadata
   *
   * @param providerMetadata - Raw provider metadata from database
   * @returns Provider ID as string, or null if not found
   */
  private extractProviderId(providerMetadata: unknown): string | null {
    try {
      if (!providerMetadata || typeof providerMetadata !== 'object') {
        return null;
      }

      // Check if metadata has an id field
      if ('id' in providerMetadata) {
        const id = (providerMetadata as Record<string, unknown>)['id'];
        if (id !== null) {
          return toStringId(id);
        }
      }

      return null;
    } catch (error: unknown) {
      this.logger.error('Error extracting provider ID:', error);
      return null;
    }
  }
}

/**
 * Get singleton instance of ProviderFetchingService
 */
let providerFetchingServiceInstance: ProviderFetchingService | null = null;

export function getProviderFetchingService(): ProviderFetchingService {
  providerFetchingServiceInstance ??= new ProviderFetchingService();
  return providerFetchingServiceInstance;
}

/**
 * Export singleton instance
 */
export const providerFetchingService = getProviderFetchingService();
