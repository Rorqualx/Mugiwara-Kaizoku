/**
 * Metadata Configuration Service
 *
 * Provides centralized access to metadata-specific configuration options.
 * This service acts as an adapter between the main configuration system
 * and the metadata service, abstracting away configuration storage details.
 *
 * Features:
 * - Type-safe configuration access
 * - Default values
 * - Centralized configuration schema
 * - Field preference management
 */
import { logger } from '@/utils/logger';

import type { ConfigService } from '../config/configService';
/**
 * Interface for field provider preferences
 */
export interface FieldProviderPreferences {
    [field: string]: string;
}
/**
 * Interface for metadata configuration
 */
export interface MetadataConfig {
    enrichOnImport: boolean;
    enrichChapters: boolean;
    conflictResolution: 'preferred' | 'manual' | 'merge';
    fieldProviders: FieldProviderPreferences;
}
/**
 * Service for managing metadata configuration
 */
export class MetadataConfigService {
    /**
     * Default configuration values
     */
    private defaultConfig: MetadataConfig = {
        enrichOnImport: true,
        enrichChapters: true,
        conflictResolution: 'preferred',
        fieldProviders: {
            summary: 'anilist',
            status: 'anilist',
            genres: 'anilist',
            authors: 'anilist',
            startDate: 'anilist',
            endDate: 'anilist',
            cover: 'anilist',
            chapters: 'fandom',
            volumes: 'fandom',
            synonyms: 'anilist'
        }
    };
    // Store loaded config
    private configCache: MetadataConfig | null = null;
    constructor(private configService: ConfigService) { }
    /**
     * Load the current metadata configuration
     *
     * @returns Promise resolving to the current configuration
     */
    async loadConfig(): Promise<MetadataConfig> {
        try {
            // If we have cached config, return it
            if (this.configCache) {
                return this.configCache;
            }
            // Get general metadata settings
            const enrichOnImport = await this.configService.get<boolean>('metadata.enrichOnImport', this.defaultConfig.enrichOnImport);
            const enrichChapters = await this.configService.get<boolean>('metadata.enrichChapters', this.defaultConfig.enrichChapters);
            const conflictResolution = await this.configService.get<'preferred' | 'manual' | 'merge'>('metadata.conflictResolution', this.defaultConfig.conflictResolution);
            // Load field provider preferences in parallel
            const fieldProviderEntries = await Promise.all(
                Object.entries(this.defaultConfig.fieldProviders).map(async ([field, provider]) => {
                    const value = await this.configService.get<string>(`metadata.fieldProviders.${field}`, provider);
                    return [field, value] as const;
                })
            );

            // Convert array of entries back to object
            const fieldProviders: FieldProviderPreferences = Object.fromEntries(fieldProviderEntries);
            // Construct full config
            const config: MetadataConfig = {
                enrichOnImport,
                enrichChapters,
                conflictResolution,
                fieldProviders
            };
            // Cache the config
            this.configCache = config;
            return config;
        }
        catch (error: unknown) {const errorMessage = error instanceof Error ? error.message : String(error);
logger.error(`Error loading metadata configuration: ${errorMessage}`);
            return this.defaultConfig;
        }
    }
    /**
     * Update metadata configuration
     *
     * @param config - Partial configuration to update
     * @returns Promise resolving when the update is complete
     */
    async updateConfig(config: Partial<MetadataConfig>): Promise<void> {
        try {
            // Update general settings if provided
            if (config.enrichOnImport !== undefined) {
                await this.configService.set('metadata.enrichOnImport', config.enrichOnImport);
            }
            if (config.enrichChapters !== undefined) {
                await this.configService.set('metadata.enrichChapters', config.enrichChapters);
            }
            if (config.conflictResolution !== undefined) {
                await this.configService.set('metadata.conflictResolution', config.conflictResolution);
            }
            // Update field provider preferences if provided (in parallel)
            if (config.fieldProviders) {
                await Promise.all(
                    Object.entries(config.fieldProviders).map(async ([field, provider]) => {
                        await this.configService.set(`metadata.fieldProviders.${field}`, provider);
                    })
                );
            }
            // Clear the cache
            this.configCache = null;
            logger.info('Metadata configuration updated successfully');
        }
        catch (error: unknown) {const errorMessage = error instanceof Error ? error.message : String(error);
logger.error(`Error updating metadata configuration: ${errorMessage}`);
            throw error;
        }
    }
    /**
     * Get the preferred provider for a specific field
     *
     * @param field - The metadata field name
     * @returns Promise resolving to the preferred provider for the field
     */
    async getFieldProvider(field: string): Promise<string> {
        const config = await this.loadConfig();
        return config.fieldProviders[field] ?? this.defaultConfig.fieldProviders[field] ?? 'anilist';
    }
    /**
     * Set the preferred provider for a specific field
     *
     * @param field - The metadata field name
     * @param provider - The provider to use for this field
     * @returns Promise resolving when the provider is set
     */
    async setFieldProvider(field: string, provider: string): Promise<void> {
        await this.configService.set(`metadata.fieldProviders.${field}`, provider);
        // Clear the cache
        this.configCache = null;
        logger.info(`Field provider for ${field} set to ${provider}`);
    }
    /**
     * Get all field provider preferences
     *
     * @returns Promise resolving to all field provider preferences
     */
    async getFieldProviders(): Promise<FieldProviderPreferences> {
        const config = await this.loadConfig();
        return config.fieldProviders;
    }
    /**
     * Check if metadata should be enriched on import
     *
     * @returns Promise resolving to whether metadata should be enriched on import
     */
    async shouldEnrichOnImport(): Promise<boolean> {
        const config = await this.loadConfig();
        return config.enrichOnImport;
    }
    /**
     * Check if chapter metadata should be enriched
     *
     * @returns Promise resolving to whether chapter metadata should be enriched
     */
    async shouldEnrichChapters(): Promise<boolean> {
        const config = await this.loadConfig();
        return config.enrichChapters;
    }
    /**
     * Get the conflict resolution strategy
     *
     * @returns Promise resolving to the conflict resolution strategy
     */
    async getConflictResolution(): Promise<'preferred' | 'manual' | 'merge'> {
        const config = await this.loadConfig();
        return config.conflictResolution;
    }
    /**
     * Clear the configuration cache
     */
    clearCache(): void {
        this.configCache = null;
    }
    /**
     * Get provider-specific settings
     *
     * @param providerName - Name of the provider (e.g., 'anilist', 'comicvine', 'fandom', 'wikipedia')
     * @returns Promise resolving to the provider settings or null if not found
     */
    async getProviderSettings(providerName: string): Promise<{
        enabled: boolean;
        [key: string]: unknown;
    } | null> {
        try {
            // Use a method that exists on ConfigService
            const configPath = `metadata.providers.${providerName}`;
            // Get full settings using the get method with a default empty object
            const settings = await this.configService.get<Record<string, unknown>>(configPath, {});
            // Check if settings is an empty object (no config found)
            if (Object.keys(settings).length === 0) {
                return null;
            }
            // Ensure the enabled property exists with a default value
            if (settings["enabled"] === undefined) {
                // Get enabled status separately if it exists
                const enabled = await this.configService.get<boolean>(`${configPath}.enabled`, false);
                // Add enabled property to settings
                return {
                    ...settings,
                    enabled
                };
            }
            return settings as {
                enabled: boolean;
                [key: string]: unknown;
            };
        }
        catch (error: unknown) {
            logger.error(`Error getting provider settings for ${providerName}: ${error}`);
            return null;
        }
    }
}
// Create and export the config service factory
let metadataConfigServiceInstance: MetadataConfigService | null = null;
/**
 * Get the metadata config service singleton instance
 *
 * @param configService - The main config service to use
 * @returns The metadata config service instance
 */
export function getMetadataConfigService(configService: ConfigService): MetadataConfigService {
    metadataConfigServiceInstance ??= new MetadataConfigService(configService);
    return metadataConfigServiceInstance;
}
