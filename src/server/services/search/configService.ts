// @ts-nocheck
// TODO: Disabled until Settings Prisma model is implemented in schema.prisma

/**
 * Search Configuration Service
 *
 * This service handles loading and saving search provider configuration settings using
 * the centralized configuration system.
 */


import { MetadataProvider } from '@prisma/client';
import { ConfigScope } from '@prisma/client';

import { logger } from '@/utils/logger';


import { configService } from '../config/configService';

import type { ConfigService } from '../config/configService';


/**
 * Provider settings interface
 */
export interface ProviderSettings {
    enabled: boolean;
    settings?: Record<string, unknown>;
    [key: string]: unknown;
}
/**
 * Prowlarr configuration interface
 */
export interface ProwlarrConfig {
    enabled: boolean;
    baseURL: string;
    apiKey: string;
}
/**
 * Search provider configuration interface
 */
export interface SearchProviderConfig {
    // General settings
    defaultProvider: string;
    searchAllByDefault: boolean;
    // Provider-specific settings
    providers: Record<string, ProviderSettings>;
    // Prowlarr-specific settings
    prowlarrEnabled: boolean;
    prowlarrBaseURL: string;
    prowlarrApiKey: string;
}
/**
 * Service for managing search provider configuration
 */
class SearchConfigService {
    /**
     * Default configuration values
     * FANDOM DISABLED: See docs/deprecation/FANDOM_DEPRECATION_ANALYSIS.md
     */
    private defaultConfig: SearchProviderConfig = {
        defaultProvider: MetadataProvider.ANILIST,
        searchAllByDefault: true,
        providers: {
            [MetadataProvider.ANILIST]: { enabled: true },
            [MetadataProvider.COMICVINE]: { enabled: true },
            [MetadataProvider.FANDOM]: { enabled: false }, // DEPRECATED - DO NOT ENABLE
            [MetadataProvider.WIKIPEDIA]: { enabled: false }, // Default to disabled, user can enable
            [MetadataProvider.PROWLARR]: { enabled: false }
        },
        prowlarrEnabled: false,
        prowlarrBaseURL: '',
        prowlarrApiKey: ''
    };
    /**
     * Load search provider configuration
     *
     * @returns {Promise<SearchProviderConfig>} The loaded configuration
     */
    async loadConfig(): Promise<SearchProviderConfig> {
        try {
            // Initialize the configuration service if needed
            if (!configService.isInitialized()) {
                await configService.initialize();
            }
            // Load the default provider
            const defaultProvider = await configService.get<string>('search.defaultProvider', this.defaultConfig.defaultProvider);
            // Load searchAllByDefault setting
            const searchAllByDefault = await configService.get<boolean>('search.searchAllByDefault', this.defaultConfig.searchAllByDefault);
            // Load provider settings
            const providers: Record<string, unknown> = {};
            // Load provider-specific settings for each provider type
            const providerTypes = Object.values(MetadataProvider);
            const providerConfigs = await Promise.all(
                providerTypes.map(async (type) => {
                    const defaultEnabled = this.defaultConfig.providers[type]?.enabled ?? true;
                    const providerEnabled = await configService.get<boolean>(`search.providers.${type}.enabled`, defaultEnabled);
                    return {
                        type,
                        config: { enabled: providerEnabled }
                    };
                })
            );
            for (const { type, config } of providerConfigs) {
                providers[type] = config;
            }
            // Load Prowlarr-specific settings
            const prowlarrEnabled = await configService.get<boolean>('search.prowlarr.enabled', this.defaultConfig.prowlarrEnabled);
            const prowlarrBaseURL = await configService.get<string>('search.prowlarr.baseURL', this.defaultConfig.prowlarrBaseURL);
            const prowlarrApiKey = await configService.get<string>('search.prowlarr.apiKey', this.defaultConfig.prowlarrApiKey);
            return {
                defaultProvider,
                searchAllByDefault,
                providers: providers as Record<string, ProviderSettings>,
                prowlarrEnabled,
                prowlarrBaseURL,
                prowlarrApiKey
            };
        }
        catch (error: unknown) {const errorMessage = error instanceof Error ? error.message : String(error);
logger.error(`Error loading search config: ${errorMessage}`);
            return this.defaultConfig;
        }
    }
    /**
     * Save search provider configuration
     *
     * @param {Partial<SearchProviderConfig>} config - Configuration to save
     */
    async saveConfig(config: Partial<SearchProviderConfig>): Promise<void> {
        try {
            // Initialize the configuration service if needed
            if (!configService.isInitialized()) {
                await configService.initialize();
            }
            // Save default provider if provided
            if (config.defaultProvider) {
                await configService.set('search.defaultProvider', config.defaultProvider, {
                    scope: ConfigScope.SYSTEM
                });
            }
            // Save searchAllByDefault if provided
            if (config.searchAllByDefault !== undefined) {
                await configService.set('search.searchAllByDefault', config.searchAllByDefault, {
                    scope: ConfigScope.SYSTEM
                });
            }
            // Save provider settings if provided
            if (config.providers) {
                const providerUpdates = Object.entries(config.providers).flatMap(([type, settings]) => {
                    const updates = [
                        configService.set(`search.providers.${type}.enabled`, settings.enabled, {
                            scope: ConfigScope.SYSTEM
                        })
                    ];
                    // Save any additional provider-specific settings
                    Object.entries(settings).forEach(([key, value]) => {
                        if (key !== 'enabled') {
                            updates.push(
                                configService.set(`search.providers.${type}.${key}`, value, {
                                    scope: ConfigScope.SYSTEM
                                })
                            );
                        }
                    });
                    return updates;
                });
                await Promise.all(providerUpdates);
            }
            // Save Prowlarr-specific settings if provided
            if (config.prowlarrEnabled !== undefined) {
                await configService.set('search.prowlarr.enabled', config.prowlarrEnabled, {
                    scope: ConfigScope.INTEGRATION
                });
            }
            if (config.prowlarrBaseURL) {
                await configService.set('search.prowlarr.baseURL', config.prowlarrBaseURL, {
                    scope: ConfigScope.INTEGRATION
                });
            }
            if (config.prowlarrApiKey) {
                await configService.set('search.prowlarr.apiKey', config.prowlarrApiKey, {
                    scope: ConfigScope.INTEGRATION
                });
            }
        }
        catch (error: unknown) {const errorMessage = error instanceof Error ? error.message : String(error);
logger.error(`Error saving search config: ${errorMessage}`);
            throw error;
        }
    }
    /**
     * Get the default search provider
     *
     * @returns {Promise<string>} The default provider
     */
    async getDefaultProvider(): Promise<string> {
        try {
            const config = await this.loadConfig();
            return config.defaultProvider;
        }
        catch (error: unknown) {const errorMessage = error instanceof Error ? error.message : String(error);
logger.error(`Error getting default provider: ${errorMessage}`);
            return this.defaultConfig.defaultProvider;
        }
    }
    /**
     * Set the default search provider
     *
     * @param {string} provider - The provider to set as default
     */
    async setDefaultProvider(provider: string): Promise<void> {
        try {
            await this.saveConfig({ defaultProvider: provider });
        }
        catch (error: unknown) {const errorMessage = error instanceof Error ? error.message : String(error);
logger.error(`Error setting default provider: ${errorMessage}`);
            throw error;
        }
    }
    /**
     * Check if a provider is enabled
     *
     * @param {string} provider - The provider to check
     * @returns {Promise<boolean>} Whether the provider is enabled
     */
    async isProviderEnabled(provider: string): Promise<boolean> {
        try {
            const config = await this.loadConfig();
            return config.providers[provider]?.enabled ?? false;
        }
        catch (error: unknown) {
  logger.error(`Error checking if provider ${provider} is enabled: ${error}`);
            return false;
        }
    }
    /**
     * Get Prowlarr configuration
     *
     * @returns {Promise<ProwlarrConfig>} Prowlarr configuration
     */
    async getProwlarrConfig(): Promise<ProwlarrConfig> {
        try {
            const config = await this.loadConfig();
            return {
                enabled: config.prowlarrEnabled,
                baseURL: config.prowlarrBaseURL,
                apiKey: config.prowlarrApiKey
            };
        }
        catch (error: unknown) {const errorMessage = error instanceof Error ? error.message : String(error);
logger.error(`Error getting Prowlarr config: ${errorMessage}`);
            return {
                enabled: false,
                baseURL: '',
                apiKey: ''
            };
        }
    }
}
// Create singleton instance
export const searchConfigService = new SearchConfigService();
// Factory function to get a SearchConfigService instance from a ConfigService
export function getSearchConfigService(_configServiceInstance: ConfigService): SearchConfigService {
    // This approach allows for dependency injection and testing
    const service = new SearchConfigService();
    // We would set the configService here if it were class member
    return service;
}
