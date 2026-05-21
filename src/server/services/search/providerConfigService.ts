/**
 * Provider Configuration Service
 *
 * Provides centralized access to provider-specific configuration options.
 * This service acts as an adapter between the main configuration system
 * and the search providers, abstracting away configuration storage details.
 *
 * Features:
 * - Type-safe configuration access
 * - Default values
 * - Centralized configuration schema
 * - Provider registration and lookup
 */
import { logger } from '@/utils/logger';

import type { ConfigService } from '../config/configService';
/**
 * Interface defining provider configuration options
 */
export interface ProviderConfig {
    enabled: boolean;
    strength: number;
    priority: number;
    description: string;
}
/**
 * Interface for all provider settings
 */
export interface ProvidersConfig {
    defaultProvider: string;
    providers: Record<string, ProviderConfig>;
}

/**
 * Interface for partial provider updates
 */
export interface PartialProvidersConfig {
    defaultProvider?: string;
    providers?: Record<string, Partial<ProviderConfig>>;
}
/**
 * Service for managing provider configuration
 */
export class ProviderConfigService {
    /**
     * Default configuration values
     */
    private defaultConfig: ProvidersConfig = {
        defaultProvider: 'anilist',
        providers: {
            anilist: {
                enabled: true,
                strength: 90,
                priority: 1,
                description: 'Official AniList API for manga metadata'
            },
            fandom: {
                enabled: true,
                strength: 70,
                priority: 2,
                description: 'Fandom wikis for supplemental manga information'
            },
            comicvine: {
                enabled: true,
                strength: 60,
                priority: 3,
                description: 'ComicVine API for Western comics metadata'
            },
            wikipedia: {
                enabled: true,
                strength: 50,
                priority: 4,
                description: 'Wikipedia for additional manga information'
            },
            prowlarr: {
                enabled: false,
                strength: 50,
                priority: 5,
                description: 'Prowlarr for torrent and usenet indexers'
            }
        }
    };
    // Store loaded config
    private configCache: ProvidersConfig | null = null;
    constructor(private configService: ConfigService) { }
    /**
     * Load the current provider configuration
     *
     * @returns Promise resolving to the current configuration
     */
    async loadConfig(): Promise<ProvidersConfig> {
        try {
            // If we have cached config, return it
            if (this.configCache) {
                return this.configCache;
            }
            // Get default provider
            const defaultProvider = await this.configService.get<string>('providers.defaultProvider', this.defaultConfig.defaultProvider);
            // Get known providers
            const knownProviders = Object.keys(this.defaultConfig.providers);
            // Load configuration for each provider in parallel
            const providers: Record<string, ProviderConfig> = {};
            await Promise.all(
                knownProviders.map(async (providerName) => {
                    const defaultProviderConfig = this.defaultConfig.providers[providerName];
                    if (!defaultProviderConfig) return;

                    // Get provider configuration in parallel
                    const [enabled, strength, priority] = await Promise.all([
                        this.configService.get<boolean>(`providers.${providerName}.enabled`, defaultProviderConfig.enabled),
                        this.configService.get<number>(`providers.${providerName}.strength`, defaultProviderConfig.strength),
                        this.configService.get<number>(`providers.${providerName}.priority`, defaultProviderConfig.priority)
                    ]);

                    // Add provider to config
                    providers[providerName] = {
                        enabled,
                        strength,
                        priority,
                        description: defaultProviderConfig.description
                    };
                })
            );
            // Return consolidated configuration
            const config: ProvidersConfig = {
                defaultProvider,
                providers
            };
            // Cache the config
            this.configCache = config;
            return config;
        }
        catch (error: unknown) {const errorMessage = error instanceof Error ? error.message : String(error);
logger.error(`Error loading provider configuration: ${errorMessage}`);
            return this.defaultConfig;
        }
    }
    /**
     * Update provider configuration
     *
     * @param config - Partial configuration to update
     * @returns Promise resolving when the update is complete
     */
    async updateConfig(config: PartialProvidersConfig): Promise<void> {
        try {
            // Update default provider if provided
            if (config.defaultProvider) {
                await this.configService.set('providers.defaultProvider', config.defaultProvider);
            }
            // Update provider-specific settings if provided
            if (config.providers) {
                const updatePromises: Promise<void>[] = [];

                for (const [providerName, providerConfig] of Object.entries(config.providers)) {
                    // Update enabled state if provided
                    if (providerConfig.enabled !== undefined) {
                        updatePromises.push(
                            this.configService.set(`providers.${providerName}.enabled`, providerConfig.enabled)
                        );
                    }
                    // Update strength if provided
                    if (providerConfig.strength !== undefined) {
                        updatePromises.push(
                            this.configService.set(`providers.${providerName}.strength`, providerConfig.strength)
                        );
                    }
                    // Update priority if provided
                    if (providerConfig.priority !== undefined) {
                        updatePromises.push(
                            this.configService.set(`providers.${providerName}.priority`, providerConfig.priority)
                        );
                    }
                }

                await Promise.all(updatePromises);
            }
            // Clear the cache
            this.configCache = null;
            logger.info('Provider configuration updated successfully');
        }
        catch (error: unknown) {const errorMessage = error instanceof Error ? error.message : String(error);
logger.error(`Error updating provider configuration: ${errorMessage}`);
            throw error;
        }
    }
    /**
     * Get the default provider
     *
     * @returns Promise resolving to the default provider name
     */
    async getDefaultProvider(): Promise<string> {
        const config = await this.loadConfig();
        return config.defaultProvider;
    }
    /**
     * Set the default provider
     *
     * @param providerName - Name of the provider to set as default
     * @returns Promise resolving when the default provider is set
     */
    async setDefaultProvider(providerName: string): Promise<void> {
        await this.configService.set('providers.defaultProvider', providerName);
        // Clear the cache
        this.configCache = null;
        logger.info(`Default provider set to ${providerName}`);
    }
    /**
     * Get configuration for a specific provider
     *
     * @param providerName - Name of the provider
     * @returns Promise resolving to the provider configuration or undefined if not found
     */
    async getProviderConfig(providerName: string): Promise<ProviderConfig | undefined> {
        const config = await this.loadConfig();
        return config.providers[providerName];
    }
    /**
     * Check if a provider is enabled
     *
     * @param providerName - Name of the provider
     * @returns Promise resolving to whether the provider is enabled
     */
    async isProviderEnabled(providerName: string): Promise<boolean> {
        const providerConfig = await this.getProviderConfig(providerName);
        return providerConfig?.enabled ?? false;
    }
    /**
     * Get all enabled providers
     *
     * @returns Promise resolving to an array of enabled provider names
     */
    async getEnabledProviders(): Promise<string[]> {
        const config = await this.loadConfig();
        return Object.entries(config.providers).
            filter(([_, config]) => config.enabled).
            map(([name, _]) => name);
    }
    /**
     * Get all providers sorted by priority
     *
     * @returns Promise resolving to an array of provider names sorted by priority
     */
    async getProvidersByPriority(): Promise<string[]> {
        const config = await this.loadConfig();
        return Object.entries(config.providers).
            sort(([_, a], [__, b]) => a.priority - b.priority).
            map(([name, _]) => name);
    }
    /**
     * Clear the configuration cache
     */
    clearCache(): void {
        this.configCache = null;
    }
}
// Create and export the config service for server-side usage
let providerConfigServiceInstance: ProviderConfigService | null = null;
/**
 * Get the provider config service singleton instance
 *
 * @param configService - The main config service to use
 * @returns The provider config service instance
 */
export function getProviderConfigService(configService: ConfigService): ProviderConfigService {
    providerConfigServiceInstance ??= new ProviderConfigService(configService);
    return providerConfigServiceInstance;
}
