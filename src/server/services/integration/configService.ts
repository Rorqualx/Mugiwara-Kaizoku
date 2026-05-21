/**
 * Integration Configuration Service
 *
 * Provides centralized access to integration-specific configuration options.
 * This service acts as an adapter between the main configuration system
 * and the integration services, abstracting away configuration storage details.
 *
 * Features:
 * - Type-safe configuration access
 * - Default values
 * - Centralized configuration schema
 * - Integration-specific configuration
 */
import type { IntegrationType } from '@/types/integration';
import { logger } from '@/utils/logger';

import { getIntegrationStatusCache } from './statusCache';

import type { ConfigService } from '../config/configService';
/**
 * Interface for Komga integration configuration
 * Explicitly include all required fields to ensure type compatibility
 */
export interface KomgaConfig {
    enabled: boolean;
    host: string;
    user: string;
    password: string;
    libraries: string[];
    type: Extract<IntegrationType, 'komga'>;
}
/**
 * Interface for Kavita integration configuration
 * Explicitly include all required fields to ensure type compatibility
 */
export interface KavitaConfig {
    enabled: boolean;
    host: string;
    user: string;
    password: string;
    libraries: string[];
    type: Extract<IntegrationType, 'kavita'>;
}
/**
 * Interface for Telegram integration configuration
 * Supports Telegram bot notifications
 */
export interface TelegramConfig {
    enabled: boolean;
    botToken: string;
    chatId: string;
    type: Extract<IntegrationType, 'telegram'>;
}
/**
 * Interface for Apprise integration configuration
 * Supports multi-service notification gateway
 */
export interface AppriseConfig {
    enabled: boolean;
    serviceUrl: string;
    services: string[];
    type: Extract<IntegrationType, 'apprise'>;
}
/**
 * Interface for integration configuration
 */
export interface IntegrationConfig {
    komga: KomgaConfig;
    kavita: KavitaConfig;
    telegram: TelegramConfig;
    apprise: AppriseConfig;
}
/**
 * Service for managing integration configuration
 */
export class IntegrationConfigService {
    /**
     * Default configuration values
     */
    private defaultConfig: IntegrationConfig = {
        komga: {
            enabled: false,
            host: '',
            user: '',
            password: '',
            libraries: [],
            type: 'komga'
        },
        kavita: {
            enabled: false,
            host: '',
            user: '',
            password: '',
            libraries: [],
            type: 'kavita'
        },
        telegram: {
            enabled: false,
            botToken: '',
            chatId: '',
            type: 'telegram'
        },
        apprise: {
            enabled: false,
            serviceUrl: '',
            services: [],
            type: 'apprise'
        }
    };
    // Store loaded config
    private configCache: IntegrationConfig | null = null;
    constructor(private configService: ConfigService) { }
    /**
     * Load the current integration configuration
     *
     * @returns Promise resolving to the current configuration
     */
    async loadConfig(): Promise<IntegrationConfig> {
        try {
            // If we have cached config, return it
            if (this.configCache) {
                return this.configCache;
            }
            // Load Komga configuration
            const komgaEnabled = await this.configService.get<boolean>('integration.komga.enabled', this.defaultConfig.komga.enabled);
            const komgaHost = await this.configService.get<string | null>('integration.komga.host', this.defaultConfig.komga.host);
            const komgaUser = await this.configService.get<string | null>('integration.komga.user', this.defaultConfig.komga.user);
            const komgaPassword = await this.configService.get<string | null>('integration.komga.password', this.defaultConfig.komga.password);
            const komgaLibraries = await this.configService.get<string[]>('integration.komga.libraries', this.defaultConfig.komga.libraries);
            // Load Kavita configuration
            const kavitaEnabled = await this.configService.get<boolean>('integration.kavita.enabled', this.defaultConfig.kavita.enabled);
            const kavitaHost = await this.configService.get<string | null>('integration.kavita.host', this.defaultConfig.kavita.host);
            const kavitaUser = await this.configService.get<string | null>('integration.kavita.user', this.defaultConfig.kavita.user);
            const kavitaPassword = await this.configService.get<string | null>('integration.kavita.password', this.defaultConfig.kavita.password);
            const kavitaLibraries = await this.configService.get<string[]>('integration.kavita.libraries', this.defaultConfig.kavita.libraries);
            // Load Telegram configuration
            const telegramEnabled = await this.configService.get<boolean>('integration.telegram.enabled', this.defaultConfig.telegram.enabled);
            const telegramBotToken = await this.configService.get<string | null>('integration.telegram.botToken', this.defaultConfig.telegram.botToken);
            const telegramChatId = await this.configService.get<string | null>('integration.telegram.chatId', this.defaultConfig.telegram.chatId);
            // Load Apprise configuration
            const appriseEnabled = await this.configService.get<boolean>('integration.apprise.enabled', this.defaultConfig.apprise.enabled);
            const appriseServiceUrl = await this.configService.get<string | null>('integration.apprise.serviceUrl', this.defaultConfig.apprise.serviceUrl);
            const appriseServices = await this.configService.get<string[]>('integration.apprise.services', this.defaultConfig.apprise.services);
            // Build the full config
            const config: IntegrationConfig = {
                komga: {
                    enabled: komgaEnabled,
                    host: komgaHost ?? '',
                    user: komgaUser ?? '',
                    password: komgaPassword ?? '',
                    libraries: komgaLibraries,
                    type: 'komga'
                },
                kavita: {
                    enabled: kavitaEnabled,
                    host: kavitaHost ?? '',
                    user: kavitaUser ?? '',
                    password: kavitaPassword ?? '',
                    libraries: kavitaLibraries,
                    type: 'kavita'
                },
                telegram: {
                    enabled: telegramEnabled,
                    botToken: telegramBotToken ?? '',
                    chatId: telegramChatId ?? '',
                    type: 'telegram'
                },
                apprise: {
                    enabled: appriseEnabled,
                    serviceUrl: appriseServiceUrl ?? '',
                    services: appriseServices,
                    type: 'apprise'
                }
            };
            // Cache the config
            this.configCache = config;
            return config;
        }
        catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            logger.error(`Error loading integration configuration: ${errorMessage}`);
            return this.defaultConfig;
        }
    }
    /**
     * Update Komga integration settings
     * @private
     */
    private async updateKomgaSettings(komga: Partial<KomgaConfig>): Promise<void> {
        const updates: Record<string, unknown> = {};
        if ('enabled' in komga) updates['integration.komga.enabled'] = komga.enabled;
        if ('host' in komga) updates['integration.komga.host'] = komga.host;
        if ('user' in komga) updates['integration.komga.user'] = komga.user;
        if ('password' in komga) updates['integration.komga.password'] = komga.password;
        if ('libraries' in komga) updates['integration.komga.libraries'] = komga.libraries;

        await Promise.all(
            Object.entries(updates).map(([key, value]) => this.configService.set(key, value))
        );
    }

    /**
     * Update Kavita integration settings
     * @private
     */
    private async updateKavitaSettings(kavita: Partial<KavitaConfig>): Promise<void> {
        const updates: Record<string, unknown> = {};
        if ('enabled' in kavita) updates['integration.kavita.enabled'] = kavita.enabled;
        if ('host' in kavita) updates['integration.kavita.host'] = kavita.host;
        if ('user' in kavita) updates['integration.kavita.user'] = kavita.user;
        if ('password' in kavita) updates['integration.kavita.password'] = kavita.password;
        if ('libraries' in kavita) updates['integration.kavita.libraries'] = kavita.libraries;

        await Promise.all(
            Object.entries(updates).map(([key, value]) => this.configService.set(key, value))
        );
    }

    /**
     * Update Telegram integration settings
     * @private
     */
    private async updateTelegramSettings(telegram: Partial<TelegramConfig>): Promise<void> {
        const updates: Record<string, unknown> = {};
        if ('enabled' in telegram) updates['integration.telegram.enabled'] = telegram.enabled;
        if ('botToken' in telegram) updates['integration.telegram.botToken'] = telegram.botToken;
        if ('chatId' in telegram) updates['integration.telegram.chatId'] = telegram.chatId;

        await Promise.all(
            Object.entries(updates).map(([key, value]) => this.configService.set(key, value))
        );
    }

    /**
     * Update Apprise integration settings
     * @private
     */
    private async updateAppriseSettings(apprise: Partial<AppriseConfig>): Promise<void> {
        const updates: Record<string, unknown> = {};
        if ('enabled' in apprise) updates['integration.apprise.enabled'] = apprise.enabled;
        if ('serviceUrl' in apprise) updates['integration.apprise.serviceUrl'] = apprise.serviceUrl;
        if ('services' in apprise) updates['integration.apprise.services'] = apprise.services;

        await Promise.all(
            Object.entries(updates).map(([key, value]) => this.configService.set(key, value))
        );
    }

    /**
     * Update integration configuration
     *
     * @param config - Partial configuration to update
     * @returns Promise resolving when the update is complete
     */
    async updateConfig(config: Partial<IntegrationConfig>): Promise<void> {
        try {
            // Update each integration type if provided
            const updatePromises: Promise<void>[] = [];

            if (config.komga) {
                updatePromises.push(this.updateKomgaSettings(config.komga));
            }
            if (config.kavita) {
                updatePromises.push(this.updateKavitaSettings(config.kavita));
            }
            if (config.telegram) {
                updatePromises.push(this.updateTelegramSettings(config.telegram));
            }
            if (config.apprise) {
                updatePromises.push(this.updateAppriseSettings(config.apprise));
            }

            // Execute all updates in parallel
            await Promise.all(updatePromises);

            // Clear the cache
            this.configCache = null;
            logger.info('Integration configuration updated successfully');
        }
        catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            logger.error(`Error updating integration configuration: ${errorMessage}`);
            throw error instanceof Error ? error : new Error(`Failed to update integration configuration: ${errorMessage}`);
        }
    }
    /**
     * Check if Komga integration is enabled
     *
     * @returns Promise resolving to whether Komga is enabled
     */
    async isKomgaEnabled(): Promise<boolean> {
        const config = await this.loadConfig();
        return config.komga.enabled;
    }
    /**
     * Check if Kavita integration is enabled
     *
     * @returns Promise resolving to whether Kavita is enabled
     */
    async isKavitaEnabled(): Promise<boolean> {
        const config = await this.loadConfig();
        return config.kavita.enabled;
    }
    /**
     * Get Komga configuration
     *
     * @returns Promise resolving to Komga configuration
     */
    async getKomgaConfig(): Promise<KomgaConfig> {
        const config = await this.loadConfig();
        return config.komga;
    }
    /**
     * Get Kavita configuration
     *
     * @returns Promise resolving to Kavita configuration
     */
    async getKavitaConfig(): Promise<KavitaConfig> {
        const config = await this.loadConfig();
        return config.kavita;
    }
    /**
     * Update Komga configuration
     *
     * @param komgaConfig - Partial Komga configuration to update
     * @returns Promise resolving when the update is complete
     */
    async updateKomgaConfig(komgaConfig: Partial<KomgaConfig>): Promise<void> {
        // We need to load the current config to make sure all required fields are present
        const currentConfig = await this.getKomgaConfig();
        // Merge with current config to ensure all required fields are present
        const updatedConfig = {
            ...currentConfig,
            ...komgaConfig,
            type: 'komga' as const
        };
        await this.updateConfig({ komga: updatedConfig });
        getIntegrationStatusCache().clear('komga');
    }
    /**
     * Update Kavita configuration
     *
     * @param kavitaConfig - Partial Kavita configuration to update
     * @returns Promise resolving when the update is complete
     */
    async updateKavitaConfig(kavitaConfig: Partial<KavitaConfig>): Promise<void> {
        // We need to load the current config to make sure all required fields are present
        const currentConfig = await this.getKavitaConfig();
        // Merge with current config to ensure all required fields are present
        const updatedConfig = {
            ...currentConfig,
            ...kavitaConfig,
            type: 'kavita' as const
        };
        await this.updateConfig({ kavita: updatedConfig });
        getIntegrationStatusCache().clear('kavita');
    }
    /**
     * Check if Telegram integration is enabled
     *
     * @returns Promise resolving to whether Telegram is enabled
     */
    async isTelegramEnabled(): Promise<boolean> {
        const config = await this.loadConfig();
        return config.telegram.enabled;
    }
    /**
     * Check if Apprise integration is enabled
     *
     * @returns Promise resolving to whether Apprise is enabled
     */
    async isAppriseEnabled(): Promise<boolean> {
        const config = await this.loadConfig();
        return config.apprise.enabled;
    }
    /**
     * Get Telegram configuration
     *
     * @returns Promise resolving to Telegram configuration
     */
    async getTelegramConfig(): Promise<TelegramConfig> {
        const config = await this.loadConfig();
        return config.telegram;
    }
    /**
     * Get Apprise configuration
     *
     * @returns Promise resolving to Apprise configuration
     */
    async getAppriseConfig(): Promise<AppriseConfig> {
        const config = await this.loadConfig();
        return config.apprise;
    }
    /**
     * Update Telegram configuration
     *
     * @param telegramConfig - Partial Telegram configuration to update
     * @returns Promise resolving when the update is complete
     */
    async updateTelegramConfig(telegramConfig: Partial<TelegramConfig>): Promise<void> {
        // We need to load the current config to make sure all required fields are present
        const currentConfig = await this.getTelegramConfig();
        // Merge with current config to ensure all required fields are present
        const updatedConfig = {
            ...currentConfig,
            ...telegramConfig,
            type: 'telegram' as const
        };
        await this.updateConfig({ telegram: updatedConfig });
        getIntegrationStatusCache().clear('telegram');
    }
    /**
     * Update Apprise configuration
     *
     * @param appriseConfig - Partial Apprise configuration to update
     * @returns Promise resolving when the update is complete
     */
    async updateAppriseConfig(appriseConfig: Partial<AppriseConfig>): Promise<void> {
        // We need to load the current config to make sure all required fields are present
        const currentConfig = await this.getAppriseConfig();
        // Merge with current config to ensure all required fields are present
        const updatedConfig = {
            ...currentConfig,
            ...appriseConfig,
            type: 'apprise' as const
        };
        await this.updateConfig({ apprise: updatedConfig });
        getIntegrationStatusCache().clear('apprise');
    }
    /**
     * Clear the configuration cache
     */
    clearCache(): void {
        this.configCache = null;
    }
    /**
     * Check integration status for all configured services
     *
     * @returns Promise resolving to integration status
     */
    async checkIntegrationStatus(): Promise<Record<IntegrationType, boolean>> {
        const config = await this.loadConfig();
        return {
            komga: config.komga.enabled,
            kavita: config.kavita.enabled,
            telegram: config.telegram.enabled,
            apprise: config.apprise.enabled
        };
    }
}
// Create and export the config service factory
let integrationConfigServiceInstance: IntegrationConfigService | null = null;
/**
 * Get the integration config service singleton instance
 *
 * @param configService - The main config service to use
 * @returns The integration config service instance
 */
export function getIntegrationConfigService(configService: ConfigService): IntegrationConfigService {
    integrationConfigServiceInstance ??= new IntegrationConfigService(configService);
    return integrationConfigServiceInstance;
}
