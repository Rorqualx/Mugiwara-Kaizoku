/**
 * Download Client Configuration Service
 *
 * This service provides access to download client configuration settings.
 * It includes functionality for managing settings for multiple download clients:
 * - Transmission
 * - Deluge
 * - SABnzbd
 * - NZBGet
 * - Client preferences
 *
 * Each client has a set of configuration options including:
 * - Connection settings (URL, credentials)
 * - Enabled/disabled state
 * - Client preferences
 */

import { ConfigValueType } from '@prisma/client';
import { ConfigScope } from '@prisma/client';

import { logger } from '@/utils/logger';


import type { ConfigService } from '../config/configService';
/**
 * Transmission client configuration
 *
 * No credential fields: the Transmission RPC path doesn't authenticate
 * requests in this codebase.
 */
export interface TransmissionConfig {
    enabled: boolean;
    baseURL: string;
}
/**
 * Deluge client configuration
 */
export interface DelugeConfig {
    enabled: boolean;
    baseURL: string;
    password: string;
    label?: string; // Optional label for organizing downloads
}
/**
 * SABnzbd client configuration
 */
export interface SabnzbdConfig {
    enabled: boolean;
    baseURL: string;
    apiKey: string;
    category?: string; // Optional category for organizing downloads
}
/**
 * NZBGet client configuration
 */
export interface NzbgetConfig {
    enabled: boolean;
    baseURL: string;
    username: string;
    password: string;
    category?: string; // Optional category for organizing downloads
}
/**
 * Supported torrent client types
 */
export type TorrentClientType = 'transmission' | 'deluge';
/**
 * Supported usenet client types
 */
export type UsenetClientType = 'sabnzbd' | 'nzbget';
/**
 * Download client preferences
 */
export interface DownloadClientPreferences {
    preferredTorrentClient: TorrentClientType | null;
    preferredUsenetClient: UsenetClientType | null;
    autoSelectClient: boolean;
}
/**
 * Complete download client configuration
 */
export interface DownloadClientConfig {
    transmission: TransmissionConfig;
    deluge: DelugeConfig;
    sabnzbd: SabnzbdConfig;
    nzbget: NzbgetConfig;
    preferences: DownloadClientPreferences;
}
/**
 * Download Client Configuration Service
 *
 * This service provides methods for accessing and updating download client
 * configuration through the centralized configuration system.
 */
export class DownloadClientConfigService {
    /**
     * Default download client configuration
     */
    private defaultConfig: DownloadClientConfig = {
        transmission: {
            enabled: false,
            baseURL: 'http://localhost:9091',
        },
        deluge: {
            enabled: false,
            baseURL: 'http://localhost:8112',
            password: '',
            label: 'manga',
        },
        sabnzbd: {
            enabled: false,
            baseURL: 'http://localhost:8080',
            apiKey: '',
            category: 'manga',
        },
        nzbget: {
            enabled: false,
            baseURL: 'http://localhost:6789',
            username: '',
            password: '',
            category: 'manga',
        },
        preferences: {
            preferredTorrentClient: null,
            preferredUsenetClient: null,
            autoSelectClient: true,
        },
    };
    /**
     * Creates a new DownloadClientConfigService
     *
     * @param configService - The central configuration service
     */
    constructor(private configService: ConfigService) { }
    /**
     * Load all download client configuration
     *
     * @returns Complete download client configuration
     */
    async loadConfig(): Promise<DownloadClientConfig> {
        try {
            // Transmission settings
            const transmissionEnabled = await this.configService.get<boolean>('download.transmission.enabled', this.defaultConfig.transmission.enabled);
            const transmissionBaseURL = await this.configService.get<string>('download.transmission.baseURL', this.defaultConfig.transmission.baseURL);
            // Deluge settings
            const delugeEnabled = await this.configService.get<boolean>('download.deluge.enabled', this.defaultConfig.deluge.enabled);
            const delugeBaseURL = await this.configService.get<string>('download.deluge.baseURL', this.defaultConfig.deluge.baseURL);
            const delugePassword = await this.configService.get<string>('download.deluge.password', this.defaultConfig.deluge.password);
            const delugeLabel = await this.configService.get<string>('download.deluge.label', this.defaultConfig.deluge.label);
            // SABnzbd settings
            const sabnzbdEnabled = await this.configService.get<boolean>('download.sabnzbd.enabled', this.defaultConfig.sabnzbd.enabled);
            const sabnzbdBaseURL = await this.configService.get<string>('download.sabnzbd.baseURL', this.defaultConfig.sabnzbd.baseURL);
            const sabnzbdApiKey = await this.configService.get<string>('download.sabnzbd.apiKey', this.defaultConfig.sabnzbd.apiKey);
            const sabnzbdCategory = await this.configService.get<string>('download.sabnzbd.category', this.defaultConfig.sabnzbd.category);
            // NZBGet settings
            const nzbgetEnabled = await this.configService.get<boolean>('download.nzbget.enabled', this.defaultConfig.nzbget.enabled);
            const nzbgetBaseURL = await this.configService.get<string>('download.nzbget.baseURL', this.defaultConfig.nzbget.baseURL);
            const nzbgetUsername = await this.configService.get<string>('download.nzbget.username', this.defaultConfig.nzbget.username);
            const nzbgetPassword = await this.configService.get<string>('download.nzbget.password', this.defaultConfig.nzbget.password);
            const nzbgetCategory = await this.configService.get<string>('download.nzbget.category', this.defaultConfig.nzbget.category);
            // Client preferences
            const preferredTorrentClientString = await this.configService.get<string>('download.preferences.preferredTorrentClient', '');
            const preferredUsenetClientString = await this.configService.get<string>('download.preferences.preferredUsenetClient', '');
            const preferredTorrentClient = this.parseClientPreference<TorrentClientType>(preferredTorrentClientString, ['transmission', 'deluge'] as const);
            const preferredUsenetClient = this.parseClientPreference<UsenetClientType>(preferredUsenetClientString, ['sabnzbd', 'nzbget'] as const);
            const autoSelectClient = await this.configService.get<boolean>('download.preferences.autoSelectClient', this.defaultConfig.preferences.autoSelectClient);
            const transmissionConfig: TransmissionConfig = {
                enabled: transmissionEnabled,
                baseURL: transmissionBaseURL,
            };

            const delugeConfig: DelugeConfig = {
                enabled: delugeEnabled,
                baseURL: delugeBaseURL,
                password: delugePassword,
                ...(delugeLabel && { label: delugeLabel })
            };

            const sabnzbdConfig: SabnzbdConfig = {
                enabled: sabnzbdEnabled,
                baseURL: sabnzbdBaseURL,
                apiKey: sabnzbdApiKey,
                ...(sabnzbdCategory && { category: sabnzbdCategory })
            };

            const nzbgetConfig: NzbgetConfig = {
                enabled: nzbgetEnabled,
                baseURL: nzbgetBaseURL,
                username: nzbgetUsername,
                password: nzbgetPassword,
                ...(nzbgetCategory && { category: nzbgetCategory })
            };

            return {
                transmission: transmissionConfig,
                deluge: delugeConfig,
                sabnzbd: sabnzbdConfig,
                nzbget: nzbgetConfig,
                preferences: {
                    preferredTorrentClient,
                    preferredUsenetClient,
                    autoSelectClient,
                },
            };
        }
        catch (error: unknown) {
            logger.error(`Failed to load download client configuration: ${error instanceof Error ? error.message : String(error)}`);
            return this.defaultConfig;
        }
    }
    /**
     * Parse client preference string to typed value
     *
     * @param value - The preference string value
     * @param validValues - Array of valid client types
     * @returns Typed client preference or null
     */
    private parseClientPreference<T extends string>(value: string, validValues: readonly T[]): T | null {
        if (!value)
            return null;
        // Check if the value is included in the valid values
        return validValues.includes(value as T) ? value as T : null;
    }
    /**
     * Update Transmission configuration
     *
     * @param config - Partial Transmission configuration to update
     */
    async updateTransmissionConfig(config: Partial<TransmissionConfig>): Promise<void> {
        try {
            if (config.enabled !== undefined) {
                await this.configService.set<boolean>('download.transmission.enabled', config.enabled, {
                    scope: ConfigScope.INTEGRATION,
                    valueType: ConfigValueType.BOOLEAN,
                    metadata: {
                        label: 'Enable Transmission',
                        description: 'Enable Transmission download client integration',
                        category: 'Transmission'
                    }
                });
            }
            if (config.baseURL !== undefined) {
                await this.configService.set<string>('download.transmission.baseURL', config.baseURL, {
                    scope: ConfigScope.INTEGRATION,
                    valueType: ConfigValueType.STRING,
                    metadata: {
                        label: 'Transmission Base URL',
                        description: 'Base URL for Transmission API',
                        category: 'Transmission'
                    }
                });
            }
        }
        catch (error: unknown) {
            logger.error(`Failed to update Transmission configuration: ${error instanceof Error ? error.message : String(error)}`);
            throw error;
        }
    }
    /**
     * Update Deluge configuration
     *
     * @param config - Partial Deluge configuration to update
     */
    async updateDelugeConfig(config: Partial<DelugeConfig>): Promise<void> {
        try {
            if (config.enabled !== undefined) {
                await this.configService.set<boolean>('download.deluge.enabled', config.enabled, {
                    scope: ConfigScope.INTEGRATION,
                    valueType: ConfigValueType.BOOLEAN,
                    metadata: {
                        label: 'Enable Deluge',
                        description: 'Enable Deluge download client integration',
                        category: 'Deluge'
                    }
                });
            }
            if (config.baseURL !== undefined) {
                await this.configService.set<string>('download.deluge.baseURL', config.baseURL, {
                    scope: ConfigScope.INTEGRATION,
                    valueType: ConfigValueType.STRING,
                    metadata: {
                        label: 'Deluge Base URL',
                        description: 'Base URL for Deluge API',
                        category: 'Deluge'
                    }
                });
            }
            if (config.password !== undefined) {
                await this.configService.set<string>('download.deluge.password', config.password, {
                    scope: ConfigScope.INTEGRATION,
                    valueType: ConfigValueType.STRING,
                    metadata: {
                        label: 'Deluge Password',
                        description: 'Password for Deluge',
                        category: 'Deluge',
                        ui: {
                            readonly: true
                        }
                    }
                });
            }
            if (config.label !== undefined) {
                await this.configService.set<string>('download.deluge.label', config.label, {
                    scope: ConfigScope.INTEGRATION,
                    valueType: ConfigValueType.STRING,
                    metadata: {
                        label: 'Deluge Label',
                        description: 'Label for organizing downloads in Deluge',
                        category: 'Deluge'
                    }
                });
            }
        }
        catch (error: unknown) {
            logger.error(`Failed to update Deluge configuration: ${error instanceof Error ? error.message : String(error)}`);
            throw error;
        }
    }
    /**
     * Update SABnzbd configuration
     *
     * @param config - Partial SABnzbd configuration to update
     */
    async updateSabnzbdConfig(config: Partial<SabnzbdConfig>): Promise<void> {
        try {
            if (config.enabled !== undefined) {
                await this.configService.set<boolean>('download.sabnzbd.enabled', config.enabled, {
                    scope: ConfigScope.INTEGRATION,
                    valueType: ConfigValueType.BOOLEAN,
                    metadata: {
                        label: 'Enable SABnzbd',
                        description: 'Enable SABnzbd download client integration',
                        category: 'SABnzbd'
                    }
                });
            }
            if (config.baseURL !== undefined) {
                await this.configService.set<string>('download.sabnzbd.baseURL', config.baseURL, {
                    scope: ConfigScope.INTEGRATION,
                    valueType: ConfigValueType.STRING,
                    metadata: {
                        label: 'SABnzbd Base URL',
                        description: 'Base URL for SABnzbd API',
                        category: 'SABnzbd'
                    }
                });
            }
            if (config.apiKey !== undefined) {
                await this.configService.set<string>('download.sabnzbd.apiKey', config.apiKey, {
                    scope: ConfigScope.INTEGRATION,
                    valueType: ConfigValueType.STRING,
                    metadata: {
                        label: 'SABnzbd API Key',
                        description: 'API key for SABnzbd',
                        category: 'SABnzbd',
                        ui: {
                            readonly: true
                        }
                    }
                });
            }
            if (config.category !== undefined) {
                await this.configService.set<string>('download.sabnzbd.category', config.category, {
                    scope: ConfigScope.INTEGRATION,
                    valueType: ConfigValueType.STRING,
                    metadata: {
                        label: 'SABnzbd Category',
                        description: 'Category for organizing downloads in SABnzbd',
                        category: 'SABnzbd'
                    }
                });
            }
        }
        catch (error: unknown) {
            logger.error(`Failed to update SABnzbd configuration: ${error instanceof Error ? error.message : String(error)}`);
            throw error;
        }
    }
    /**
     * Update NZBGet configuration
     *
     * @param config - Partial NZBGet configuration to update
     */
    async updateNzbgetConfig(config: Partial<NzbgetConfig>): Promise<void> {
        try {
            if (config.enabled !== undefined) {
                await this.configService.set<boolean>('download.nzbget.enabled', config.enabled, {
                    scope: ConfigScope.INTEGRATION,
                    valueType: ConfigValueType.BOOLEAN,
                    metadata: {
                        label: 'Enable NZBGet',
                        description: 'Enable NZBGet download client integration',
                        category: 'NZBGet'
                    }
                });
            }
            if (config.baseURL !== undefined) {
                await this.configService.set<string>('download.nzbget.baseURL', config.baseURL, {
                    scope: ConfigScope.INTEGRATION,
                    valueType: ConfigValueType.STRING,
                    metadata: {
                        label: 'NZBGet Base URL',
                        description: 'Base URL for NZBGet API',
                        category: 'NZBGet'
                    }
                });
            }
            if (config.username !== undefined) {
                await this.configService.set<string>('download.nzbget.username', config.username, {
                    scope: ConfigScope.INTEGRATION,
                    valueType: ConfigValueType.STRING,
                    metadata: {
                        label: 'NZBGet Username',
                        description: 'Username for NZBGet',
                        category: 'NZBGet'
                    }
                });
            }
            if (config.password !== undefined) {
                await this.configService.set<string>('download.nzbget.password', config.password, {
                    scope: ConfigScope.INTEGRATION,
                    valueType: ConfigValueType.STRING,
                    metadata: {
                        label: 'NZBGet Password',
                        description: 'Password for NZBGet',
                        category: 'NZBGet',
                        ui: {
                            readonly: true
                        }
                    }
                });
            }
            if (config.category !== undefined) {
                await this.configService.set<string>('download.nzbget.category', config.category, {
                    scope: ConfigScope.INTEGRATION,
                    valueType: ConfigValueType.STRING,
                    metadata: {
                        label: 'NZBGet Category',
                        description: 'Category for organizing downloads in NZBGet',
                        category: 'NZBGet'
                    }
                });
            }
        }
        catch (error: unknown) {
            logger.error(`Failed to update NZBGet configuration: ${error instanceof Error ? error.message : String(error)}`);
            throw error;
        }
    }
    /**
     * Update download client preferences
     *
     * @param preferences - Partial preferences to update
     */
    async updatePreferences(preferences: Partial<DownloadClientPreferences>): Promise<void> {
        try {
            if (preferences.preferredTorrentClient !== undefined) {
                await this.configService.set<string>('download.preferences.preferredTorrentClient', preferences.preferredTorrentClient ?? '', {
                    scope: ConfigScope.INTEGRATION,
                    valueType: ConfigValueType.STRING,
                    metadata: {
                        label: 'Preferred Torrent Client',
                        description: 'The preferred torrent client to use when multiple are available',
                        category: 'Download Preferences'
                    }
                });
            }
            if (preferences.preferredUsenetClient !== undefined) {
                await this.configService.set<string>('download.preferences.preferredUsenetClient', preferences.preferredUsenetClient ?? '', {
                    scope: ConfigScope.INTEGRATION,
                    valueType: ConfigValueType.STRING,
                    metadata: {
                        label: 'Preferred Usenet Client',
                        description: 'The preferred usenet client to use when multiple are available',
                        category: 'Download Preferences'
                    }
                });
            }
            if (preferences.autoSelectClient !== undefined) {
                await this.configService.set<boolean>('download.preferences.autoSelectClient', preferences.autoSelectClient, {
                    scope: ConfigScope.INTEGRATION,
                    valueType: ConfigValueType.BOOLEAN,
                    metadata: {
                        label: 'Auto-select Client',
                        description: 'Automatically select an available download client if preferred is not available',
                        category: 'Download Preferences'
                    }
                });
            }
        }
        catch (error: unknown) {
            logger.error(`Failed to update download client preferences: ${error instanceof Error ? error.message : String(error)}`);
            throw error;
        }
    }
    /**
     * Update all download client configuration
     *
     * @param config - Partial download client configuration to update
     */
    async updateConfig(config: Partial<DownloadClientConfig>): Promise<void> {
        try {
            if (config.transmission) {
                await this.updateTransmissionConfig(config.transmission);
            }
            if (config.deluge) {
                await this.updateDelugeConfig(config.deluge);
            }
            if (config.sabnzbd) {
                await this.updateSabnzbdConfig(config.sabnzbd);
            }
            if (config.nzbget) {
                await this.updateNzbgetConfig(config.nzbget);
            }
            if (config.preferences) {
                await this.updatePreferences(config.preferences);
            }
        }
        catch (error: unknown) {
            logger.error(`Failed to update download client configuration: ${error instanceof Error ? error.message : String(error)}`);
            throw error;
        }
    }
    /**
     * Get the active torrent client configuration
     *
     * Resolves the active torrent client based on preferences
     *
     * @returns Client configuration and type or null if none available
     */
    async getActiveTorrentClient(): Promise<{
        type: 'transmission';
        config: TransmissionConfig;
    } | {
        type: 'deluge';
        config: DelugeConfig;
    } | null> {
        const config = await this.loadConfig();
        // Check preferences first
        if (config.preferences.preferredTorrentClient === 'transmission' && config.transmission.enabled) {
            return { type: 'transmission', config: config.transmission };
        }
        if (config.preferences.preferredTorrentClient === 'deluge' && config.deluge.enabled) {
            return { type: 'deluge', config: config.deluge };
        }
        // Fall back to first enabled client
        if (config.transmission.enabled) {
            return { type: 'transmission', config: config.transmission };
        }
        if (config.deluge.enabled) {
            return { type: 'deluge', config: config.deluge };
        }
        // No enabled clients
        return null;
    }
    /**
     * Get the active usenet client configuration
     *
     * Resolves the active usenet client based on preferences
     *
     * @returns Client configuration and type or null if none available
     */
    async getActiveUsenetClient(): Promise<{
        type: 'sabnzbd';
        config: SabnzbdConfig;
    } | {
        type: 'nzbget';
        config: NzbgetConfig;
    } | null> {
        const config = await this.loadConfig();
        // Check preferences first
        if (config.preferences.preferredUsenetClient === 'sabnzbd' && config.sabnzbd.enabled) {
            return { type: 'sabnzbd', config: config.sabnzbd };
        }
        if (config.preferences.preferredUsenetClient === 'nzbget' && config.nzbget.enabled) {
            return { type: 'nzbget', config: config.nzbget };
        }
        // Fall back to first enabled client
        if (config.sabnzbd.enabled) {
            return { type: 'sabnzbd', config: config.sabnzbd };
        }
        if (config.nzbget.enabled) {
            return { type: 'nzbget', config: config.nzbget };
        }
        // No enabled clients
        return null;
    }
    /**
     * Check if auto-selection of download clients is enabled
     *
     * @returns Whether auto-selection is enabled
     */
    async isAutoSelectEnabled(): Promise<boolean> {
        const config = await this.loadConfig();
        return config.preferences.autoSelectClient;
    }
}
/**
 * Factory function to create a download client configuration service
 *
 * @param configService - The central configuration service
 * @returns Download client configuration service instance
 */
export function getDownloadClientConfigService(configService: ConfigService): DownloadClientConfigService {
    return new DownloadClientConfigService(configService);
}
