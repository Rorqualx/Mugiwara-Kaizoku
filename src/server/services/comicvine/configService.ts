/**
 * ComicVine Configuration Service
 *
 * This service provides a unified API for accessing ComicVine integration configuration.
 * It uses the central configuration system while maintaining backward compatibility.
 */

import { ConfigScope } from '@prisma/client';
import { ConfigValueType } from '@prisma/client';

import { logger } from '@/utils/logger';


import { configService } from '../config/configService';

import type { ConfigService } from '../config/configService';
/**
 * Interface for ComicVine configuration
 */
export interface ComicvineConfig {
    enabled: boolean;
    apiKey: string;
    priority: number;
    rateLimit: number;
    /** Preferred language for filtering variants (default: 'en' for English) */
    preferredLanguage: string;
}
/**
 * ComicVine configuration service that integrates with the centralized config system
 */
export class ComicvineConfigService {
    /**
     * Default configuration values
     */
    private defaultConfig: ComicvineConfig = {
        enabled: false,
        apiKey: '',
        priority: 3,
        rateLimit: 400,
        preferredLanguage: 'en'
    };
    /**
     * Loads the current ComicVine configuration
     *
     * @returns Promise resolving to the current ComicVine configuration
     */
    async loadConfig(): Promise<ComicvineConfig> {
        try {
            // Initialize the configuration service if needed
            if (!configService.isInitialized()) {
                await configService.initialize();
            }
            // Get each configuration value, falling back to defaults if not found
            // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
            const enabled = (await configService.get<boolean>('comicvine.enabled')) ?? this.defaultConfig.enabled;
            // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
            const apiKey = (await configService.get<string>('comicvine.apiKey')) ?? this.defaultConfig.apiKey;
            // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
            const priority = (await configService.get<number>('comicvine.priority')) ?? this.defaultConfig.priority;
            // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
            const rateLimit = (await configService.get<number>('comicvine.rateLimit')) ?? this.defaultConfig.rateLimit;
            // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
            const preferredLanguage = (await configService.get<string>('comicvine.preferredLanguage')) ?? this.defaultConfig.preferredLanguage;
            return {
                enabled,
                apiKey,
                priority,
                rateLimit,
                preferredLanguage
            };
        }
        catch (error: unknown) {const errorMessage = error instanceof Error ? error.message : String(error);
logger.error(`Error loading ComicVine config: ${errorMessage}`);
            return this.defaultConfig;
        }
    }
    /**
     * Updates the ComicVine configuration
     *
     * @param config - Partial configuration to update
     * @returns Promise resolving when the update is complete
     */
    async updateConfig(config: Partial<ComicvineConfig>): Promise<void> {
        try {
            // Initialize the configuration service if needed
            if (!configService.isInitialized()) {
                await configService.initialize();
            }
            // Update each provided field
            if (config.enabled !== undefined) {
                await configService.set('comicvine.enabled', config.enabled, {
                    scope: ConfigScope.INTEGRATION,
                    valueType: ConfigValueType.BOOLEAN
                });
            }
            if (config.apiKey !== undefined) {
                await configService.set('comicvine.apiKey', config.apiKey, {
                    scope: ConfigScope.INTEGRATION,
                    valueType: ConfigValueType.STRING
                });
            }
            if (config.priority !== undefined) {
                await configService.set('comicvine.priority', config.priority, {
                    scope: ConfigScope.INTEGRATION,
                    valueType: ConfigValueType.NUMBER
                });
            }
            if (config.rateLimit !== undefined) {
                await configService.set('comicvine.rateLimit', config.rateLimit, {
                    scope: ConfigScope.INTEGRATION,
                    valueType: ConfigValueType.NUMBER
                });
            }
            if (config.preferredLanguage !== undefined) {
                await configService.set('comicvine.preferredLanguage', config.preferredLanguage, {
                    scope: ConfigScope.INTEGRATION,
                    valueType: ConfigValueType.STRING
                });
            }
            logger.info('ComicVine configuration updated successfully');
        }
        catch (error: unknown) {const errorMessage = error instanceof Error ? error.message : String(error);
logger.error(`Error updating ComicVine config: ${errorMessage}`);
            throw error;
        }
    }
    /**
     * Checks if the ComicVine integration is enabled
     *
     * @returns Promise resolving to true if enabled, false otherwise
     */
    async isEnabled(): Promise<boolean> {
        const config = await this.loadConfig();
        return config.enabled;
    }
    /**
     * Gets the ComicVine API key
     *
     * @returns Promise resolving to the API key or empty string if not set
     */
    async getApiKey(): Promise<string> {
        const config = await this.loadConfig();
        return config.apiKey;
    }
    /**
     * Gets the ComicVine rate limit
     *
     * @returns Promise resolving to the rate limit
     */
    async getRateLimit(): Promise<number> {
        const config = await this.loadConfig();
        return config.rateLimit;
    }
}
// Singleton instance for server-side usage
export const comicvineConfigService = new ComicvineConfigService();
// Factory function for creating/retrieving an instance
let comicvineConfigServiceInstance: ComicvineConfigService | null = null;
/**
 * Get the ComicVine config service singleton instance
 *
 * @param _configService - The main config service to use
 * @returns The ComicVine config service instance
 */
export function getComicvineConfigService(_configService: ConfigService): ComicvineConfigService {
    comicvineConfigServiceInstance ??= new ComicvineConfigService();
    return comicvineConfigServiceInstance;
}
