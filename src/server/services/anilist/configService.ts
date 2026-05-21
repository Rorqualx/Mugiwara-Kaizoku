/**
 * AniList Configuration Service
 *
 * This service provides a unified API for accessing AniList integration configuration.
 * It uses the central configuration system while maintaining backward compatibility.
 */

import { ConfigScope } from '@prisma/client';
import { ConfigValueType } from '@prisma/client';

import { logger } from '@/utils/logger';


import { configService } from '../config/configService';

import type { ConfigService } from '../config/configService';
/**
 * Interface for AniList configuration
 */
export interface AnilistConfig {
    enabled: boolean;
    useForMetadata: boolean;
    clientId: string;
    clientSecret: string;
    accessToken: string;
    useEnhancedProvider: boolean;
    filterAdultContent: boolean;
    /** Experimental: Filter out webtoon format from results */
    filterWebtoons: boolean;
    /** Experimental: Filter out Korean manhwa from results */
    filterKoreanManhwa: boolean;
}
/**
 * AniList configuration service that integrates with the centralized config system
 */
export class AnilistConfigService {
    /**
     * Default configuration values
     */
    private defaultConfig: AnilistConfig = {
        enabled: true,
        useForMetadata: true,
        clientId: '',
        clientSecret: '',
        accessToken: '',
        useEnhancedProvider: false,
        filterAdultContent: true,
        filterWebtoons: false,
        filterKoreanManhwa: false
    };
    /**
     * Loads the current AniList configuration
     *
     * @returns Promise resolving to the current AniList configuration
     */
    async loadConfig(): Promise<AnilistConfig> {
        try {
            // Initialize the configuration service if needed
            if (!configService.isInitialized()) {
                await configService.initialize();
            }
            // Get each configuration value (configService.get returns Promise<T>, never undefined)
            const enabled = await configService.get<boolean>('anilist.enabled');
            const useForMetadata = await configService.get<boolean>('anilist.useForMetadata');
            const clientId = await configService.get<string>('anilist.clientId');
            const clientSecret = await configService.get<string>('anilist.clientSecret');
            const accessToken = await configService.get<string>('anilist.accessToken');
            const useEnhancedProvider = await configService.get<boolean>('anilist.useEnhancedProvider');
            const filterAdultContent = await configService.get<boolean>('anilist.filterAdultContent');
            const filterWebtoons = await configService.get<boolean>('anilist.filterWebtoons');
            const filterKoreanManhwa = await configService.get<boolean>('anilist.filterKoreanManhwa');
            return {
                enabled,
                useForMetadata,
                clientId,
                clientSecret,
                accessToken,
                useEnhancedProvider,
                filterAdultContent,
                filterWebtoons,
                filterKoreanManhwa
            };
        }
        catch (error: unknown) {const errorMessage = error instanceof Error ? error.message : String(error);
logger.error(`Error loading AniList config: ${errorMessage}`);
            return this.defaultConfig;
        }
    }
    /**
     * Updates the AniList configuration
     *
     * @param config - Partial configuration to update
     * @returns Promise resolving when the update is complete
     */
    async updateConfig(config: Partial<AnilistConfig>): Promise<void> {
        try {
            // Initialize the configuration service if needed
            if (!configService.isInitialized()) {
                await configService.initialize();
            }
            // Update each provided field
            if (config.enabled !== undefined) {
                await configService.set('anilist.enabled', config.enabled, {
                    scope: ConfigScope.INTEGRATION,
                    valueType: ConfigValueType.BOOLEAN
                });
            }
            if (config.useForMetadata !== undefined) {
                await configService.set('anilist.useForMetadata', config.useForMetadata, {
                    scope: ConfigScope.INTEGRATION,
                    valueType: ConfigValueType.BOOLEAN
                });
            }
            if (config.clientId !== undefined) {
                await configService.set('anilist.clientId', config.clientId, {
                    scope: ConfigScope.INTEGRATION,
                    valueType: ConfigValueType.STRING
                });
            }
            if (config.clientSecret !== undefined) {
                await configService.set('anilist.clientSecret', config.clientSecret, {
                    scope: ConfigScope.INTEGRATION,
                    valueType: ConfigValueType.STRING
                });
            }
            if (config.accessToken !== undefined) {
                await configService.set('anilist.accessToken', config.accessToken, {
                    scope: ConfigScope.INTEGRATION,
                    valueType: ConfigValueType.STRING
                });
            }
            if (config.useEnhancedProvider !== undefined) {
                await configService.set('anilist.useEnhancedProvider', config.useEnhancedProvider, {
                    scope: ConfigScope.INTEGRATION,
                    valueType: ConfigValueType.BOOLEAN
                });
            }
            if (config.filterAdultContent !== undefined) {
                await configService.set('anilist.filterAdultContent', config.filterAdultContent, {
                    scope: ConfigScope.INTEGRATION,
                    valueType: ConfigValueType.BOOLEAN
                });
            }
            if (config.filterWebtoons !== undefined) {
                await configService.set('anilist.filterWebtoons', config.filterWebtoons, {
                    scope: ConfigScope.INTEGRATION,
                    valueType: ConfigValueType.BOOLEAN
                });
            }
            if (config.filterKoreanManhwa !== undefined) {
                await configService.set('anilist.filterKoreanManhwa', config.filterKoreanManhwa, {
                    scope: ConfigScope.INTEGRATION,
                    valueType: ConfigValueType.BOOLEAN
                });
            }
            logger.info('AniList configuration updated successfully');
        }
        catch (error: unknown) {const errorMessage = error instanceof Error ? error.message : String(error);
logger.error(`Error updating AniList config: ${errorMessage}`);
            throw error;
        }
    }
    /**
     * Checks if the AniList integration is enabled
     *
     * @returns Promise resolving to true if enabled, false otherwise
     */
    async isEnabled(): Promise<boolean> {
        const config = await this.loadConfig();
        return config.enabled;
    }
    /**
     * Checks if AniList should be used for metadata
     *
     * @returns Promise resolving to true if used for metadata, false otherwise
     */
    async isUsedForMetadata(): Promise<boolean> {
        const config = await this.loadConfig();
        return config.enabled && config.useForMetadata;
    }
    /**
     * Checks if enhanced AniList provider is enabled
     *
     * @returns Promise resolving to true if enhanced provider is enabled, false otherwise
     */
    async isEnhancedProviderEnabled(): Promise<boolean> {
        const config = await this.loadConfig();
        return config.enabled && config.useForMetadata && config.useEnhancedProvider;
    }
    /**
     * Gets the AniList API credentials
     *
     * @returns Promise resolving to the AniList API credentials
     */
    async getApiCredentials(): Promise<{
        clientId: string;
        clientSecret: string;
        accessToken: string;
    }> {
        const config = await this.loadConfig();
        return {
            clientId: config.clientId,
            clientSecret: config.clientSecret,
            accessToken: config.accessToken
        };
    }
}
// Singleton instance for server-side usage
export const anilistConfigService = new AnilistConfigService();
// Factory function for creating/retrieving an instance
let anilistConfigServiceInstance: AnilistConfigService | null = null;
/**
 * Get the AniList config service singleton instance
 *
 * @param _configService - The main config service to use
 * @returns The AniList config service instance
 */
export function getAnilistConfigService(_configService: ConfigService): AnilistConfigService {
    anilistConfigServiceInstance ??= new AnilistConfigService();
    return anilistConfigServiceInstance;
}
