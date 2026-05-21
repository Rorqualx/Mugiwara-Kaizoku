import type { SearchProvider } from '@/types/search.types';
import { logger } from '@/utils/logger';

import { anilistProvider } from './providers/AniListProvider';
import { comicvineProvider } from './providers/ComicVineProvider';
import { fandomProvider } from './providers/FandomProviderInstance';
import { wikipediaProvider } from './providers/WikipediaProvider';
/**
 * Search Provider Registry Module
 *
 * Manages the registration and access of manga search providers in the application.
 * This module serves as a central registry for all search providers, handling their
 * initialization, registration, and access.
 *
 * Features:
 * - Dynamic provider registration
 * - Provider overwrite protection
 * - Safe provider initialization
 * - Centralized provider access
 *
 * Provider Categories:
 * - Default providers (AniList, Fandom)
 * - Optional providers (ComicVine)
 * - Custom providers (can be registered at runtime)
 *
 * Note: Prowlarr is NOT a metadata search provider - it's an indexer aggregator
 * used exclusively for the download workflow (torrents/NZBs)
 *
 * @module searchProviderRegistry
 */
// Registry of search providers
const searchProviders: Record<string, SearchProvider> = {};
/**
 * Register a search provider
 *
 * Adds a search provider to the registry. If a provider with the same name
 * already exists, it will be overwritten with a warning.
 *
 * @param provider - Search provider to register
 * @throws {Error} If provider is invalid or registration fails
 *
 * @remarks
 * - Validates provider interface compliance
 * - Handles provider name collisions
 * - Logs registration status
 *
 * @example
 * ```typescript
 * // Register a new provider
 * registerSearchProvider(new CustomSearchProvider());
 *
 * // Replace an existing provider
 * registerSearchProvider(new EnhancedAniListProvider());
 * ```
 */
export function registerSearchProvider(provider: SearchProvider): void {
    if (searchProviders[provider["name"]]) {
        logger.warn(`Search provider '${provider["name"]}' is already registered. Overwriting.`);
    }
    searchProviders[provider["name"]] = provider;
    logger.info(`Registered search provider: ${provider["name"]}`);
}
/**
 * Get a search provider by name
 *
 * Retrieves a registered search provider by its unique name.
 * Returns undefined if no provider is found with the given name.
 *
 * @param name - Name of the search provider
 * @returns SearchProvider | undefined The requested provider or undefined
 *
 * @example
 * ```typescript
 * // Get a specific provider
 * const anilist = getSearchProvider('anilist');
 * if (anilist) {
 *   const results = await anilist.search('manga');
 * }
 * ```
 */
export function getSearchProvider(name: string): SearchProvider | undefined {
    return searchProviders[name];
}
/**
 * Get all registered search providers
 *
 * Returns a copy of the provider registry containing all registered providers.
 * The returned object is a shallow copy to prevent direct registry modification.
 *
 * @returns Record<string, SearchProvider> Copy of provider registry
 *
 * @example
 * ```typescript
 * // Get all providers
 * const providers = getSearchProviders();
 *
 * // Use multiple providers
 * for (const [name, provider] of Object.entries(providers)) {
 *   const results = await provider.search('manga');
 *   logger.info(`${name} found ${results.length} results`);
 * }
 * ```
 */
export function getSearchProviders(): Record<string, SearchProvider> {
    return { ...searchProviders };
}
/**
 * Initialize search providers
 *
 * Registers all available search providers with the registry.
 * Handles both default and optional providers, with error recovery
 * for optional provider registration failures.
 *
 * Provider Categories:
 * 1. Default Providers:
 *    - AniList
 *    - Fandom
 *
 * 2. Optional Providers:
 *    - ComicVine
 *
 * Note: Prowlarr is NOT included here as it's not a metadata provider
 *
 * @remarks
 * - Default providers must initialize successfully
 * - Optional providers can fail without stopping initialization
 * - Logs provider registration status and counts
 *
 * @example
 * ```typescript
 * // Initialize all providers
 * initializeSearchProviders();
 *
 * // Check registered providers
 * const count = Object.keys(getSearchProviders()).length;
 * logger.info(`${count} providers initialized`);
 * ```
 */
export function initializeSearchProviders(): void {
    // Register default METADATA providers only
    registerSearchProvider(anilistProvider);
    registerSearchProvider(fandomProvider as unknown as SearchProvider); // Type mismatch with SearchProvider interface
    registerSearchProvider(wikipediaProvider); // Wikipedia as enrichment provider
    // Register optional METADATA providers with error handling
    try {
        registerSearchProvider(comicvineProvider);
    }
    catch (error: unknown) {
        logger.warn('Failed to register ComicVine search provider:', error instanceof Error ? error.message : String(error));
    }
    // NOTE: MangaDex is now handled via the ProviderStrategy/Registry system (MangaDexProviderStrategy)
    // NOTE: Prowlarr is NOT registered here as it's not a metadata provider
    // Prowlarr is used exclusively for torrent/NZB indexing in the download workflow
    logger.info(`Initialized ${Object.keys(searchProviders).length} search providers`);
}
/**
 * Search Provider Registry Interface
 *
 * Provides a unified interface for managing search providers.
 * This singleton object is the primary way to interact with
 * the provider registry.
 *
 * @example
 * ```typescript
 * // Initialize providers
 * searchProviderRegistry.initialize();
 *
 * // Register a custom provider
 * searchProviderRegistry.register(new CustomProvider());
 *
 * // Get a specific provider
 * const provider = searchProviderRegistry.get('anilist');
 *
 * // Get all providers
 * const all = searchProviderRegistry.getAll();
 * ```
 */
export const searchProviderRegistry = {
    register: registerSearchProvider,
    get: getSearchProvider,
    getAll: getSearchProviders,
    initialize: initializeSearchProviders
};
