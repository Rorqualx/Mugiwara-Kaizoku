/**
 * Search Provider Registry Module
 *
 * This module provides a centralized registry for managing metadata search providers.
 * It handles:
 * - Provider registration and management
 * - Default provider selection and persistence
 * - Multi-provider search operations
 * - Provider fallback logic
 * - Centralized configuration through ConfigService
 *
 * @module searchProviderRegistry
 */
import { ValidationError } from '@/utils/errors';
import { logger } from '@/utils/logger';

import { anilistProvider } from './anilistProvider';
import { comicvineProvider } from './comicvineProvider';
// Fandom provider removed - using new FandomProvider in ProviderRegistry instead
import { getProviderConfigService } from './providerConfigService';

import type { ProviderConfigService} from './providerConfigService';
import type { SearchProvider, SearchResult } from './types';
import type { ConfigService } from '../config/configService';
/**
 * Registry for search providers that manages provider registration, selection, and search operations
 *
 * This class maintains a collection of search providers and handles provider selection
 * based on user preferences stored in the database. It provides fallback mechanisms
 * and error handling for provider operations.
 *
 * Features:
 * - Dynamic provider registration
 * - Persistent default provider selection
 * - Multi-provider search capabilities
 * - Automatic fallback to available providers
 * - Database integration for settings
 *
 * @example
 * ```typescript
 * // Using the registry singleton
 * const registry = searchProviderRegistry;
 *
 * // Getting the default provider
 * const provider = await registry.getProvider();
 *
 * // Searching with a specific provider
 * const results = await registry.getProvider('anilist')
 *   .then(provider => provider.search('One Piece'));
 *
 * // Searching across all enabled providers
 * const allResults = await registry.searchAllProviders('Naruto');
 * ```
 */
class SearchProviderRegistry {
    private providers: Map<string, SearchProvider> = new Map();
    private defaultProvider = '';
    private initialized = false;
    private configService: ProviderConfigService | null = null;
    /**
     * Initializes the registry with available search providers
     *
     * Registers all available search providers and initializes the default provider
     * from database settings. Handles provider registration order and dependencies.
     *
     * Note: Prowlarr is intentionally excluded as it's a download file indexer,
     * not a metadata provider.
     */
    constructor() {
        // Register metadata providers in priority order
        this.registerProvider(anilistProvider); // AniList provider
        this.registerProvider(comicvineProvider);
        // Fandom provider is registered separately in ProviderRegistry
        // Default provider will be set during initialization with ConfigService
        this.defaultProvider = 'anilist';
    }
    /**
     * Initializes the provider registry with configuration service
     *
     * @param configService - The main configuration service to use (required)
     * @returns Promise that resolves when initialization is complete
     * @throws Error if no configuration service is provided
     */
    async initialize(configService: ConfigService): Promise<void> {
        try {
            // Create provider config service
            this.configService = getProviderConfigService(configService);
            // Load the default provider from configuration
            const defaultProvider = await this.configService.getDefaultProvider();
            // Make sure the provider exists
            if (this.providers.has(defaultProvider)) {
                this.defaultProvider = defaultProvider;
                logger.info(`Loaded default metadata provider from configuration: ${this.defaultProvider}`);
            }
            else {
                logger.warn(`Default provider ${defaultProvider} not found in registry, using anilist as fallback`);
                this.defaultProvider = 'anilist';
            }
            this.initialized = true;
            logger.info('Provider registry initialized successfully');
        }
        catch (error: unknown) {
            logger.error(`Failed to initialize provider registry: ${error instanceof Error ? error.message : String(error)}`);
            // Set default to anilist as fallback
            this.defaultProvider = 'anilist';
            this.initialized = true;
        }
    }
    /**
     * Registers a search provider with the registry
     *
     * @param {SearchProvider} provider - The search provider to register
     * @throws {Error} If provider is missing required properties
     *
     * @example
     * ```typescript
     * // Registering a custom provider
     * registry.registerProvider({
     *   name: 'custom-provider',
     *   search: async (query) => {
     *     // Custom search implementation
     *     return [];
     *   }
     * });
     * ```
     */
    registerProvider(provider: SearchProvider): void {
        if (!provider["name"] || typeof provider.search !== 'function') {
            throw new ValidationError('Invalid provider: must have name and search function');
        }
        this.providers.set(provider["name"], provider);
    }
    /**
     * Gets a search provider by name or returns the default provider
     *
     * Provider Selection Logic:
     * 1. Use explicitly requested provider if specified
     * 2. Fall back to default provider if set
     * 3. Use anilist as preferred fallback
     * 4. Use first available provider as last resort
     *
     * Error Handling:
     * - Validates provider existence
     * - Handles provider name aliases
     * - Ensures initialization is complete
     * - Verifies provider is enabled
     *
     * @param {string | undefined} name - Optional provider name to retrieve
     * @returns {Promise<SearchProvider>} The requested provider or default provider
     * @throws {Error} If no valid provider can be found
     *
     * @example
     * ```typescript
     * // Get specific provider
     * const comicvine = await registry.getProvider('comicvine');
     *
     * // Get default provider
     * const defaultProvider = await registry.getProvider();
     *
     * // Handle provider alias
     * const anilist = await registry.getProvider('anilist');
     * ```
     */
    async getProvider(name: string | undefined = undefined): Promise<SearchProvider> {
        // Make sure initialization is complete
        if (!this.initialized) {
            throw new ValidationError('Provider registry is not initialized. Call initialize() first');
        }
        if (!this.configService) {
            throw new ValidationError('Configuration service is required for provider registry');
        }
        // Determine which provider to use
        let providerName = '';
        // Case 1: Explicit provider name is provided
        if (typeof name === 'string' && name.length > 0) {
            providerName = name;
            // Check if provider is enabled
            const isEnabled = await this.configService.isProviderEnabled(providerName);
            if (!isEnabled) {
                logger.warn(`Provider ${providerName} is disabled, using default provider instead`);
                providerName = '';
            }
        }
        // Case 2: Use default provider if available
        if (!providerName && this.defaultProvider.length > 0) {
            providerName = this.defaultProvider;
            // Check if default provider is enabled
            const isEnabled = await this.configService.isProviderEnabled(providerName);
            if (!isEnabled) {
                logger.warn(`Default provider ${providerName} is disabled, trying anilist`);
                providerName = '';
            }
        }
        // Case 3: Fall back to anilist as the preferred default
        if (!providerName && this.providers.has('anilist')) {
            providerName = 'anilist';
            logger.info(`No default provider set, using anilist as the preferred default`);
            // Check if anilist is enabled
            const isEnabled = await this.configService.isProviderEnabled('anilist');
            if (!isEnabled) {
                logger.warn(`Anilist provider is disabled, trying first available provider`);
                providerName = '';
            }
        }
        // Case 4: Fall back to first available provider
        if (!providerName && this.providers.size > 0) {
            // Get all enabled providers
            const enabledProviders = await this.configService.getEnabledProviders();
            // Find the first provider that is both enabled and registered
            for (const providerName of enabledProviders) {
                if (this.providers.has(providerName)) {
                    const foundProvider = this.providers.get(providerName);
                    if (foundProvider !== undefined) {
                        return foundProvider;
                    }
                }
            }
            // If no enabled providers found, use first available provider
            providerName = Array.from(this.providers.keys())[0] as string;
            logger.warn(`No enabled providers found, using first available provider: ${providerName}`);
        }
        const provider = this.providers.get(providerName);
        if (!provider) {
            throw new ValidationError(`Search provider '${providerName}' not found or all providers are disabled`);
        }
        return provider;
    }
    /**
     * Search across all enabled providers
     *
     * Performs parallel searches across all enabled providers and combines the results.
     * Handles provider failures gracefully to ensure some results are returned even
     * if individual providers fail.
     *
     * Error Handling:
     * - Continues with available providers if settings are missing
     * - Handles individual provider failures without failing entire search
     * - Falls back to default provider if no enabled providers
     * - Logs provider-specific errors for debugging
     *
     * @param {string} query - Search query
     * @returns {Promise<SearchResult[]>} Combined results from all enabled providers
     *
     * @example
     * ```typescript
     * // Search across all providers
     * const results = await registry.searchAllProviders('One Piece');
     *
     * // Results include provider information
     * results.forEach(result => {
     *   logger.info(`Found "${result["title"]}" from ${result.provider}`);
     * });
     * ```
     */
    async searchAllProviders(query: string): Promise<SearchResult[]> {
        // Make sure initialization is complete
        if (!this.initialized) {
            throw new ValidationError('Provider registry is not initialized. Call initialize() first');
        }
        if (!this.configService) {
            throw new ValidationError('Configuration service is required for provider registry');
        }
        // Get enabled providers from configuration
        let enabledProviders = await this.configService.getEnabledProviders();
        // Filter to only providers that exist in the registry
        enabledProviders = enabledProviders.filter(name => this.providers.has(name));
        if (enabledProviders.length === 0) {
            logger.warn('No enabled providers found, using default provider for search');
            const provider = await this.getProvider();
            return provider.search(query);
        }
        // Search with all enabled providers in parallel
        const searchPromises = enabledProviders.map(async (providerName) => {
            try {
                const provider = this.providers.get(providerName);
                if (!provider) {
                    logger.warn(`Provider ${providerName} not found`);
                    return [];
                }
                logger.info(`Searching with provider: ${providerName}`);
                const results = await provider.search(query);
                // Add provider name to each result
                return results.map(result => ({
                    ...result,
                    provider: providerName
                }));
            }
            catch (error: unknown) {
  logger.error(`Error searching with provider ${providerName}: ${error instanceof Error ? error.message : String(error)}`);
                return [];
            }
        });
        // Wait for all searches to complete
        const resultsArrays = await Promise.all(searchPromises);
        // Flatten the results
        const allResults = resultsArrays.flat();
        return allResults;
    }
    /**
     * Sets the default search provider
     *
     * Updates both the in-memory default provider and persists the setting to configuration.
     * Handles validation and error cases to ensure settings consistency.
     *
     * Error Handling:
     * - Validates provider existence before setting
     * - Maintains in-memory state even if configuration update fails
     * - Logs update failures for debugging
     * - Falls back to legacy method if configuration service is not available
     *
     * @param {string} name - Name of the provider to set as default
     * @returns {Promise<void>} A promise that resolves when the default provider is set
     * @throws {Error} If the specified provider is not found
     *
     * @example
     * ```typescript
     * // Set comicvine as default provider
     * await registry.setDefaultProvider('comicvine');
     *
     * // Attempt to set invalid provider
     * try {
     *   await registry.setDefaultProvider('invalid-provider');
     * } catch (error) {
     *   console.error('Provider not found:', error);
     * }
     * ```
     */
    async setDefaultProvider(name: string): Promise<void> {
        if (!this.initialized) {
            throw new ValidationError('Provider registry is not initialized. Call initialize() first');
        }
        if (!this.configService) {
            throw new ValidationError('Configuration service is required for provider registry');
        }
        if (!this.providers.has(name)) {
            throw new ValidationError(`Cannot set default provider: '${name}' not found`);
        }
        // Update in memory
        this.defaultProvider = name;
        try {
            // Update in configuration
            await this.configService.setDefaultProvider(name);
            logger.info(`Default metadata provider saved to configuration: ${name}`);
        }
        catch (error: unknown) {
            logger.error(`Failed to save default provider: ${error instanceof Error ? error.message : String(error)}`);
            // The in-memory value is still updated, but it won't persist across restarts
            throw error;
        }
    }
    /**
     * Gets a list of all available provider names
     *
     * @returns {string[]} Array of provider names
     *
     * @example
     * ```typescript
     * // Get all available providers
     * const providers = registry.getAvailableProviders();
     * logger.info('Available providers:', providers);
     * ```
     */
    getAvailableProviders(): string[] {
        return Array.from(this.providers.keys());
    }
    /**
     * Gets the name of the current default provider
     *
     * @returns {string} Name of the default provider
     *
     * @example
     * ```typescript
     * // Get current default provider
     * const defaultProvider = registry.getDefaultProvider();
     * logger.info('Default provider:', defaultProvider);
     * ```
     */
    getDefaultProvider(): string {
        return this.defaultProvider;
    }
}
// Create and export singleton instance
export const searchProviderRegistry = new SearchProviderRegistry();
