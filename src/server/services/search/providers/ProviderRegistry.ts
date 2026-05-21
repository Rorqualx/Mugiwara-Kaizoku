/**
 * Search Provider Registry
 *
 * This module provides a centralized registry for managing search providers.
 * It handles provider registration, selection, and multi-provider operations.
 */

import { MetadataProvider } from '@prisma/client';

import { ValidationError } from '@/utils/errors';
import { logger } from '@/utils/logger';
import { hasProperty } from '@/utils/type-guards';


import { searchConfigService } from '../configService';

import { anilistProvider } from './AniListProvider';
import { comicvineProvider } from './ComicVineProvider';
import { fandomProvider } from './FandomProviderInstance';
import { SearchResultValidator } from './SearchResultValidator';
import { wikipediaProvider } from './WikipediaProvider';


import type { SearchProvider, SearchResult, SearchOptions } from '../types';

// Type guard to check if provider has isEnabled method
function hasIsEnabledMethod(provider: SearchProvider): provider is SearchProvider & { isEnabled: () => Promise<boolean> | boolean } {
    return hasProperty(provider, 'isEnabled') && typeof provider['isEnabled'] === 'function';
}

// Type guard to check if result has optional metadata fields
interface ExtendedSearchResult extends SearchResult {
    authors?: string[];
    artists?: string[];
    startDate?: string;
    endDate?: string;
    alternativeTitles?: string[];
}
/**
 * Registry for search providers
 *
 * This class manages the registration and use of search providers, including
 * provider selection, fallback, and multi-provider operations.
 *
 * Note: Prowlarr is NOT a metadata search provider - it's an indexer aggregator
 * used for the download workflow (torrents/NZBs)
 */
export class ProviderRegistry {
    private providers: Map<string, SearchProvider>;
    private defaultProvider: string;
    private initialized: boolean;
    /**
     * Create a new provider registry
     */
    constructor() {
        this.providers = new Map();
        this.defaultProvider = '';
        this.initialized = false;
        // Register the built-in METADATA providers only
        // Prowlarr is NOT a metadata provider - it's for downloading
        this.registerProvider(anilistProvider as SearchProvider);
        this.registerProvider(comicvineProvider as SearchProvider);
        this.registerProvider(fandomProvider as SearchProvider);
        this.registerProvider(wikipediaProvider as SearchProvider);
        // Initialize the default provider
        void this.initializeDefaultProvider();
    }
    /**
     * Initialize the default provider from configuration service
     *
     * @returns Promise that resolves when initialization is complete
     */
    private async initializeDefaultProvider(): Promise<void> {
        try {
            // Get the default provider from the configuration service
            const defaultProvider = await searchConfigService.getDefaultProvider();
            if (defaultProvider && this.providers.has(defaultProvider)) {
                this.defaultProvider = defaultProvider;
                logger.info(`Default search provider loaded from configuration: ${this.defaultProvider}`);
            }
            // If no default provider was set, use AniList as the default
            if (!this.defaultProvider && this.providers.has(MetadataProvider.ANILIST)) {
                this.defaultProvider = MetadataProvider.ANILIST;
                logger.info(`No default provider found in configuration, using AniList as default`);
            }
            this.initialized = true;
        }
        catch (error: unknown) {
            logger.error(`Failed to initialize default provider:`, error instanceof Error ? error.message : String(error));
            // Default to AniList on error
            if (this.providers.has(MetadataProvider.ANILIST)) {
                this.defaultProvider = MetadataProvider.ANILIST;
            }
            this.initialized = true;
        }
    }
    /**
     * Find a provider type using case-insensitive matching
     *
     * @param type - Provider type to search for
     * @returns Matching provider type or null if not found
     */
    private findProviderTypeCaseInsensitive(type: string): string | null {
        const lowerType = type.toLowerCase();
        const upperType = type.toUpperCase();

        if (this.providers.has(lowerType)) {
            return lowerType;
        }

        if (this.providers.has(upperType)) {
            return upperType;
        }

        // Try to find a case-insensitive match
        for (const [key] of this.providers) {
            if (key.toLowerCase() === lowerType) {
                return key;
            }
        }

        return null;
    }
    /**
     * Register a search provider with the registry
     *
     * @param provider - The provider to register
     * @throws Error if the provider is invalid
     */
    registerProvider(provider: SearchProvider): void {
        if (!provider.name || !provider.type || typeof provider.search !== 'function') {
            throw new ValidationError('Invalid provider: must have name, type, and search function');
        }
        this.providers.set(provider.type, provider);
        logger.debug(`Registered search provider: ${provider.name} (${provider.type})`);
    }
    /**
     * Get a provider by type or use the default provider
     *
     * @param type - Optional provider type to retrieve
     * @returns Promise with the requested provider
     * @throws Error if no valid provider can be found
     */
    async getProvider(type?: string): Promise<SearchProvider> {
        // Ensure initialization is complete
        if (!this.initialized) {
            await this.initializeDefaultProvider();
        }
        // Determine which provider to use
        let providerType = '';
        if (type) {
            // Try case-sensitive match first
            if (this.providers.has(type)) {
                providerType = type;
            } else {
                // Try case-insensitive match
                const found = this.findProviderTypeCaseInsensitive(type);
                if (found !== null) {
                    providerType = found;
                } else {
                    // Log warning and fall through to default
                    logger.warn(`Provider '${type}' not found, falling back to default`);
                }
            }
        }

        // If no provider found yet, use defaults
        if (!providerType) {
            if (this.defaultProvider) {
                // Fall back to default provider
                providerType = this.defaultProvider;
            }
            else if (this.providers.size > 0) {
                // Last resort: use the first available provider
                const keys = Array.from(this.providers.keys());
                const firstKey = keys[0];
                if (firstKey !== undefined) {
                    providerType = firstKey;
                    logger.warn(`No default provider set, using first available: ${providerType}`);
                }
            }
            else {
                throw new ValidationError('No search providers available');
            }
        }
        const provider = this.providers.get(providerType);
        if (!provider) {
            throw new ValidationError(`Provider '${providerType}' not found`);
        }
        // Check if the provider is enabled (if method exists)
        const isEnabled = hasIsEnabledMethod(provider) ?
            await provider.isEnabled() :
            true;
        if (!isEnabled) {
            logger.warn(`Provider ${providerType} is disabled, searching for an enabled provider`);

            // Check all providers in parallel
            const entries = Array.from(this.providers.entries());
            const enabledChecks = await Promise.all(
                entries.map(async ([_key, p]) => ({
                    provider: p,
                    isEnabled: hasIsEnabledMethod(p) ? await p.isEnabled() : true
                }))
            );

            // Find the first enabled provider
            const enabledProvider = enabledChecks.find(({ isEnabled: enabled }) => enabled);

            if (enabledProvider) {
                logger.info(`Using ${enabledProvider.provider.name} as fallback for disabled provider ${providerType}`);
                return enabledProvider.provider;
            }

            // If no enabled providers are found, use the requested one anyway
            logger.warn(`No enabled providers found, using ${providerType} anyway`);
        }
        return provider;
    }
    /**
     * Search using a specific provider
     *
     * @param type - Provider type to use
     * @param query - Search query
     * @param options - Search options
     * @returns Promise with search results
     */
    async searchWithProvider(type: string, query: string, options?: SearchOptions): Promise<SearchResult[]> {
        try {
            // Debug log the exact provider type received
            logger.info(`🔍 [PROVIDER REGISTRY] searchWithProvider called with type: "${type}" (typeof: ${typeof type})`);

            const provider = await this.getProvider(type);

            // Check if provider is enabled before searching
            if (typeof provider.isEnabled === 'function') {
                const isEnabled = await provider.isEnabled();
                if (!isEnabled) {
                    logger.info(`Provider ${type} is disabled, skipping search`);
                    return [];
                }
            }

            logger.info(`🔍 [PROVIDER REGISTRY] Calling provider.search for ${provider.name || type}`);
            let results = await provider.search(query, options);
            logger.info(`🔍 [PROVIDER REGISTRY] Provider returned ${results.length} results`);

            // Check for Fandom provider - be very permissive with matching
            const isFandomProvider = type.toLowerCase() === 'fandom' ||
                                   type.toUpperCase() === 'FANDOM' ||
                                   type === 'Fandom' ||
                                   provider.name === 'Fandom' ||
                                   provider.type === 'fandom';

            logger.info(`🔍 [PROVIDER REGISTRY] Is Fandom provider? ${isFandomProvider} (type: "${type}", provider.name: "${provider.name}")`);

            // Validate Fandom results through SearchResultValidator
            if (isFandomProvider) {
                logger.info(`🔍 [PROVIDER REGISTRY] Processing ${results.length} Fandom results through validator`);

                // Process Fandom results through the validator to ensure all fields are properly formatted
                results = SearchResultValidator.processResults(results, MetadataProvider.FANDOM) as SearchResult[];

                // Debug logging for Fandom results after validation
                const firstResult = results[0] as ExtendedSearchResult | undefined;
                if (results.length > 0 && firstResult !== undefined) {
                    logger.info('🔍 [PROVIDER REGISTRY] Fandom results after validation:', {
                        type,
                        count: results.length,
                        firstResult: {
                            id: firstResult.id,
                            title: firstResult.title,
                            hasAuthors: !!firstResult.authors,
                            authors: firstResult.authors ?? 'not present',
                            hasArtists: !!firstResult.artists,
                            artists: firstResult.artists ?? 'not present',
                            hasStartDate: !!firstResult.startDate,
                            startDate: firstResult.startDate ?? 'not present',
                            hasEndDate: !!firstResult.endDate,
                            endDate: firstResult.endDate ?? 'not present',
                            hasAlternativeTitles: !!firstResult.alternativeTitles,
                            alternativeTitles: firstResult.alternativeTitles ?? 'not present',
                            volumes: firstResult.volumes,
                            chapters: firstResult.chapters,
                            hasMetadata: !!firstResult.metadata,
                            metadataKeys: firstResult.metadata ? Object.keys(firstResult.metadata) : [],
                            allKeys: Object.keys(firstResult)
                        }
                    });
                }
            } else {
                logger.info(`🔍 [PROVIDER REGISTRY] Not a Fandom provider, skipping validation`);
            }

            return results;
        }
        catch (error: unknown) {
  logger.error(`Error searching with provider ${type}:`, error instanceof Error ? error.message : String(error));
            return [];
        }
    }
    /**
     * Search across all enabled providers
     *
     * @param query - Search query
     * @param options - Search options
     * @returns Promise with combined search results
     */
    async searchAll(query: string, options?: SearchOptions): Promise<SearchResult[]> {
        // Get search configuration to check which providers are enabled
        const config = await searchConfigService.loadConfig();
        // Get enabled providers
        const enabledProviders: SearchProvider[] = [];
        const entries = Array.from(this.providers.entries());
        for (const [type, provider] of entries) {
            // Check if provider is enabled in configuration
            const providerConfig = config.providers[type];
            const isEnabled = providerConfig?.enabled !== false;
            if (isEnabled) {
                enabledProviders.push(provider);
            }
        }
        if (enabledProviders.length === 0) {
            logger.warn('No enabled providers found, using default provider');
            const provider = await this.getProvider();
            return provider.search(query, options);
        }
        // Search with all enabled providers in parallel
        const searchPromises = enabledProviders.map(async (provider) => {
            try {
                logger.info(`Searching with ${provider.name}`);
                const results = await provider.search(query, options);
                return results;
            }
            catch (error: unknown) {
  logger.error(`Error searching with ${provider.name}:`, error instanceof Error ? error.message : String(error));
                return [];
            }
        });
        // Wait for all searches to complete
        const resultsArrays = await Promise.all(searchPromises);
        // Combine results
        return resultsArrays.flat();
    }
    /**
     * Get metadata for a manga using a specific provider
     *
     * @param type - Provider type
     * @param id - Manga ID
     * @param title - Optional fallback title
     * @returns Promise with manga metadata
     */
    async getMetadata(type: string, id: string, title?: string): Promise<SearchResult> {
        try {
            const provider = await this.getProvider(type);
            return await provider.getMetadata(id, title);
        }
        catch (error: unknown) {
  logger.error(`Error getting metadata with provider ${type}:`, error instanceof Error ? error.message : String(error));
            // Return minimal result
            return {
                id,
                title: title ?? id,
                provider: type as MetadataProvider
            };
        }
    }
    /**
     * Set the default search provider
     *
     * @param type - Provider type to set as default
     * @returns Promise that resolves when default is set
     * @throws Error if provider not found
     */
    async setDefaultProvider(type: string): Promise<void> {
        if (!this.providers.has(type)) {
            throw new ValidationError(`Provider '${type}' not found`);
        }
        // Update in memory
        this.defaultProvider = type;
        try {
            // Update in configuration service
            await searchConfigService.setDefaultProvider(type);
            logger.info(`Default search provider saved to configuration: ${type}`);
        }
        catch (error: unknown) {
            logger.error(`Failed to save default provider to configuration:`, error instanceof Error ? error.message : String(error));
        }
    }
    /**
     * Get a list of all available provider types
     *
     * @returns Array of provider types
     */
    getAvailableProviders(): string[] {
        return Array.from(this.providers.keys());
    }
    /**
     * Get the current default provider type
     *
     * @returns Default provider type
     */
    getDefaultProvider(): string {
        return this.defaultProvider;
    }
}
// Export singleton instance
export const providerRegistry = new ProviderRegistry();
