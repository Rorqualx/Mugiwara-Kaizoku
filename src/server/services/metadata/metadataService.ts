/**
 * Standardized Metadata Service
 *
 * This module provides a unified interface for working with various metadata providers.
 * It handles loading, caching, and merging metadata from multiple sources.
 *
 * Enhanced to use the Provider Registry pattern for better provider management.
 */

import { MetadataProvider } from '@prisma/client';

import type { BaseProviderConfig } from '@/server/adapters/base-metadata-adapter';
import type { AlternativeTitlesOption } from '@/types/search-types/configuration.types';
import type { MangaMetadata, SearchResult } from '@/types/search.types';
import type { AsyncResult} from '@/utils/async-result';
import { createSuccessResult, createErrorResult, isSuccess, isError } from '@/utils/async-result';
import type { IntegrationAdapter } from '@/utils/integration-adapter';


import { ProviderRegistry } from '../providers/registry';

// Extracted modules
import { convertSearchResultToMetadata, convertToMetadata } from './metadata-converters';
import { mergeProviderMetadata } from './metadata-merger';
import { ProviderInitializer } from './provider-initializer';

import type { MetadataServiceOptions, MetadataServiceLogger } from './metadata-types';

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Map string provider name to MetadataProvider enum
 */
const PROVIDER_NAME_MAP: Record<string, MetadataProvider> = {
    'anilist': MetadataProvider.ANILIST,
    'fandom': MetadataProvider.FANDOM,
    'wikipedia': MetadataProvider.WIKIPEDIA,
    'comicvine': MetadataProvider.COMICVINE
};

/**
 * Convert provider name strings to MetadataProvider enum values
 */
function mapProviderNamesToEnum(providers: string[] | undefined): MetadataProvider[] | undefined {
    if (!providers) return undefined;
    return providers.map(p => PROVIDER_NAME_MAP[p.toLowerCase()] ?? MetadataProvider.FANDOM);
}

// ============================================================================
// MetadataService Class
// ============================================================================

/**
 * Standardized metadata service
 */
export class MetadataService {
    private providers: Record<string, IntegrationAdapter<BaseProviderConfig>>;
    private providerRegistry: ProviderRegistry;
    private logger: MetadataServiceLogger;
    /**
     * Create a new metadata service with the given configurations
     *
     * @param options Service configuration options
     */
    constructor(options: MetadataServiceOptions) {
        this.providers = {};
        this.providerRegistry = ProviderRegistry.getInstance();
        this.logger = options.logger ?? (() => { }); // Default no-op logger

        // Use ProviderInitializer for setup
        this.providers = ProviderInitializer.initializeProviders(
            options.providerConfigs,
            this.logger
        );

        // Initialize provider registry
        ProviderInitializer.initializeProviderRegistry(
            options.providerConfigs,
            this.providerRegistry,
            this.logger
        );
    }

    /**
     * Get a specific provider by ID
     *
     * @param providerId Provider ID
     * @returns The provider or undefined if not found
     */
    getProvider(providerId: string): IntegrationAdapter<BaseProviderConfig> | undefined {
        return this.providers[providerId];
    }
    /**
     * Get all enabled providers
     *
     * @returns Record of provider ID to provider instance
     */
    getAllProviders(): Record<string, IntegrationAdapter<BaseProviderConfig>> {
        return { ...this.providers };
    }
    /**
     * Search for manga across all enabled providers
     * Enhanced to use provider registry for additional providers
     *
     * @param query Search query
     * @param options Search options
     * @returns AsyncResult with search results
     */
    async search(query: string, options?: {
        providers?: string[];
        limit?: number;
        useRegistry?: boolean;
        alternativeTitles?: AlternativeTitlesOption;
    }): Promise<AsyncResult<Array<{
        provider: string;
        results: MangaMetadata[];
    }>, Error>> {
        // If useRegistry is true, use the new provider registry
        if (options?.useRegistry !== false) {
            return this.searchWithRegistry(query, options);
        }

        // Otherwise fall back to legacy search
        try {
            const providersToUse = options.providers ?
                Object.keys(this.providers).filter((id) => options.providers?.includes(id)) :
                Object.keys(this.providers);
            if (providersToUse.length === 0) {
                return createSuccessResult([]);
            }
            const searchPromises = providersToUse.map(async (providerId) => {
                const provider = this.providers[providerId];
                if (!provider) {
                    return {
                        provider: providerId,
                        results: []
                    };
                }
                try {
                    // Check if the provider has a searchManga method
                    if (typeof provider.searchManga !== 'function') {
                        this.logger(`Provider ${providerId} does not support search`);
                        return {
                            provider: providerId,
                            results: []
                        };
                    }
                    const searchOptions: { limit?: number } = {};
                    if (options.limit !== undefined) searchOptions.limit = options.limit;
                    const searchResults = await provider.searchManga(query, searchOptions);
                    // Map search results to metadata format
                    const metadataResults: MangaMetadata[] = Array.isArray(searchResults) ?
                        searchResults.map((manga) => convertToMetadata(manga, providerId)) : [];
                    return {
                        provider: providerId,
                        results: metadataResults
                    };
                }
                catch (error: unknown) {
                    this.logger(`Error searching with ${providerId}`, error);
                    return {
                        provider: providerId,
                        results: []
                    };
                }
            });
            const results = await Promise.all(searchPromises);
            return createSuccessResult(results);
        }
        catch (error: unknown) {
            this.logger('Error performing metadata search', error);
            return createErrorResult(error instanceof Error ?
                error :
                new Error(`Failed to search: ${String(error)}`));
        }
    }

    /**
     * Search using the new provider registry
     *
     * @param query Search query
     * @param options Search options
     * @returns AsyncResult with search results
     */
    private async searchWithRegistry(
        query: string,
        options?: {
            providers?: string[];
            limit?: number;
            alternativeTitles?: AlternativeTitlesOption;
        }
    ): Promise<AsyncResult<Array<{
        provider: string;
        results: MangaMetadata[];
    }>, Error>> {
        try {
            // Use provider registry for search with alternative titles for better matching
            const registryResult = await this.providerRegistry.searchAll(query, {
                limit: options?.limit,
                providers: mapProviderNamesToEnum(options?.providers),
                alternativeTitles: options?.alternativeTitles,
            });

            if (isError(registryResult)) {
                return registryResult;
            }

            // After early return, registryResult is narrowed to success type
            if (!isSuccess(registryResult)) {
                return createErrorResult(new Error('Unexpected result state'));
            }

            // Convert SearchResult[] to the expected format
            const groupedResults: Record<string, SearchResult[]> = {};

            // Now TypeScript knows registryResult.data exists
            registryResult.data.forEach((result: unknown) => {
                const r = result as SearchResult;
                const providerName = r.provider.toLowerCase();
                // Initialize array if not present, then push (??= guarantees array exists)
                (groupedResults[providerName] ??= []).push(r);
            });

            // Convert to MangaMetadata format
            const formattedResults = Object.entries(groupedResults).map(([provider, results]) => ({
                provider,
                results: results.map(r => convertSearchResultToMetadata(r))
            }));

            return createSuccessResult(formattedResults);
        } catch (error: unknown) {
            this.logger('Error performing registry search', error);
            return createErrorResult(
                error instanceof Error ? error : new Error(`Registry search failed: ${String(error)}`)
            );
        }
    }

    /**
     * Fetch metadata for a specific manga
     *
     * @param mangaId ID of the manga to fetch metadata for
     * @param providerId Specific provider to use
     * @returns AsyncResult with the metadata
     */
    async fetchMetadata(mangaId: string, providerId: string): Promise<AsyncResult<MangaMetadata | null, Error>> {
        try {
            const provider = this.providers[providerId];
            if (!provider) {
                return createErrorResult(new Error(`Provider ${providerId} not found or not enabled`));
            }
            // Check if the provider has a getMangaById method
            if (typeof provider.getMangaById !== 'function') {
                return createErrorResult(new Error(`Provider ${providerId} does not support metadata fetching`));
            }
            const metadataResult = await provider.getMangaById(mangaId);
            // Handle AsyncResult - check if success and has data
            if (isError(metadataResult)) {
                return metadataResult;
            }
            // isSuccess case - data exists
            if (isSuccess(metadataResult)) {
                return createSuccessResult(convertToMetadata(metadataResult.data, providerId));
            }
            return createSuccessResult(null);
        }
        catch (error: unknown) {
            this.logger(`Error fetching metadata for ${mangaId} from ${providerId}`, error);
            return createErrorResult(error instanceof Error ?
                error :
                new Error(`Failed to fetch metadata: ${String(error)}`));
        }
    }
    /**
     * Merge metadata from multiple providers
     *
     * @param mangaId ID of the manga
     * @param options Merge options
     * @returns AsyncResult with the merged metadata
     */
    async mergeMetadata(mangaId: string, options?: {
        providers?: string[];
        preferredProvider?: string;
    }): Promise<AsyncResult<MangaMetadata | null, Error>> {
        try {
            const providersToUse = options?.providers ?
                Object.keys(this.providers).filter((id) => options.providers?.includes(id)) :
                Object.keys(this.providers);

            if (providersToUse.length === 0) {
                return createSuccessResult(null);
            }

            // Fetch metadata from all specified providers
            const metadataPromises = providersToUse.map(async (providerId) => {
                try {
                    const result = await this.fetchMetadata(mangaId, providerId);
                    if (isSuccess(result) && result.data) {
                        return {
                            provider: providerId,
                            metadata: result.data
                        };
                    }
                    return null;
                }
                catch (error: unknown) {
                    this.logger(`Error fetching metadata from ${providerId}`, error);
                    return null;
                }
            });

            const results = (await Promise.all(metadataPromises)).filter(Boolean) as Array<{
                provider: string;
                metadata: MangaMetadata;
            }>;

            if (results.length === 0) {
                return createSuccessResult(null);
            }

            // If a preferred provider is specified and has results, use that
            if (options?.preferredProvider) {
                const preferredResult = results.find((result) => result.provider === options.preferredProvider);
                if (preferredResult) {
                    return createSuccessResult(preferredResult.metadata);
                }
            }

            // Use extracted merger module
            const mergedMetadata = mergeProviderMetadata(results);
            return createSuccessResult(mergedMetadata);
        }
        catch (error: unknown) {
            this.logger(`Error merging metadata for ${mangaId}`, error);
            return createErrorResult(
                error instanceof Error ? error : new Error(`Failed to merge metadata: ${String(error)}`)
            );
        }
    }
}
