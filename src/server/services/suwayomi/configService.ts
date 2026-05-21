// @ts-nocheck
// TODO: Disabled until Settings Prisma model is implemented in schema.prisma

/**
 * Suwayomi Configuration Service
 *
 * This service handles loading and saving Suwayomi configuration settings using
 * the centralized configuration system.
 */
import path from 'path';

import { ConfigScope } from '@prisma/client';

import { logger } from '@/utils/logger';



import { configService } from '../config/configService';


/**
 * Configuration interface for Suwayomi server settings
 *
 * @interface SuwayomiConfig
 * @property {boolean} enabled - Whether Suwayomi integration is enabled
 * @property {string} serverPath - Path to the Suwayomi server installation
 * @property {string} configPath - Path to store Suwayomi configuration files
 * @property {number} port - Port number for Suwayomi server to listen on
 * @property {string[]} sources - List of enabled manga sources/extensions
 * @property {boolean} autoStart - Whether to auto-start the server on application startup
 * @property {string} downloadDir - Directory to save downloaded manga chapters
 */
export interface SuwayomiConfig {
    enabled: boolean;
    serverPath: string;
    configPath: string;
    port: number;
    sources: string[];
    autoStart: boolean;
    downloadDir: string;
}
/**
 * Service for managing Suwayomi server configuration
 *
 * This service handles loading and saving Suwayomi configuration settings using
 * the centralized configuration system. It provides default values and handles
 * error cases when the configuration is not available.
 */
class SuwayomiConfigService {
    /**
     * Default configuration values for Suwayomi
     *
     * These values are used when settings haven't been initialized in the configuration system.
     *
     * @private
     */
    private defaultConfig: SuwayomiConfig = {
        enabled: false,
        serverPath: path.join(process.cwd(), 'data', 'suwayomi-server'),
        configPath: path.join(process.cwd(), 'data', 'suwayomi-config'),
        port: 4567,
        sources: [],
        autoStart: true, // Changed to true for automatic startup
        downloadDir: path.join(process.cwd(), 'downloads')
    };
    /**
     * Load Suwayomi configuration from the configuration system
     *
     * @returns {Promise<SuwayomiConfig>} The loaded configuration
     */
    async loadConfig(): Promise<SuwayomiConfig> {
        try {
            // Initialize the configuration service if needed
            if (!configService.isInitialized()) {
                await configService.initialize();
            }
            // Get each configuration value, falling back to defaults if not found
            const enabled = (await configService.get<boolean>('suwayomi.enabled') as boolean | null) ?? this.defaultConfig.enabled;
            const serverPath = (await configService.get<string>('suwayomi.serverPath') as string | null) ?? this.defaultConfig.serverPath;
            const configPath = (await configService.get<string>('suwayomi.configPath') as string | null) ?? this.defaultConfig.configPath;
            const port = (await configService.get<number>('suwayomi.port') as number | null) ?? this.defaultConfig.port;
            const sources = (await configService.get<string[]>('suwayomi.sources') as string[] | null) ?? this.defaultConfig.sources;
            const autoStart = (await configService.get<boolean>('suwayomi.autoStart') as boolean | null) ?? this.defaultConfig.autoStart;
            const downloadDir = (await configService.get<string>('suwayomi.downloadDir') as string | null) ?? this.defaultConfig.downloadDir;
            return {
                enabled,
                serverPath,
                configPath,
                port,
                sources,
                autoStart,
                downloadDir
            };
        }
        catch (error: unknown) {const errorMessage = error instanceof Error ? error.message : String(error);
logger.error(`Error loading Suwayomi config: ${errorMessage}`);
            return this.defaultConfig;
        }
    }
    /**
     * Save Suwayomi configuration to the configuration system
     *
     * Updates Suwayomi settings in the configuration system. Only updates the provided
     * configuration fields, preserving existing values for fields not included in the update.
     *
     * @param {Partial<SuwayomiConfig>} config - Configuration values to update
     * @returns {Promise<void>}
     */
    async saveConfig(config: Partial<SuwayomiConfig>): Promise<void> {
        try {
            // Initialize the configuration service if needed
            if (!configService.isInitialized()) {
                await configService.initialize();
            }
            // Update each provided configuration value
            if (config.enabled !== undefined) {
                await configService.set('suwayomi.enabled', config.enabled, {
                    scope: ConfigScope.INTEGRATION
                });
            }
            if (config.serverPath) {
                await configService.set('suwayomi.serverPath', config.serverPath, {
                    scope: ConfigScope.INTEGRATION
                });
            }
            if (config.configPath) {
                await configService.set('suwayomi.configPath', config.configPath, {
                    scope: ConfigScope.INTEGRATION
                });
            }
            if (config.port !== undefined) {
                await configService.set('suwayomi.port', config.port, {
                    scope: ConfigScope.INTEGRATION
                });
            }
            if (config.sources) {
                await configService.set('suwayomi.sources', config.sources, {
                    scope: ConfigScope.INTEGRATION
                });
            }
            if (config.autoStart !== undefined) {
                await configService.set('suwayomi.autoStart', config.autoStart, {
                    scope: ConfigScope.INTEGRATION
                });
            }
            if (config.downloadDir) {
                await configService.set('suwayomi.downloadDir', config.downloadDir, {
                    scope: ConfigScope.INTEGRATION
                });
            }
        }
        catch (error: unknown) {const errorMessage = error instanceof Error ? error.message : String(error);
logger.error(`Error saving Suwayomi config: ${errorMessage}`);
            throw error;
        }
    }

    private advancedConfig: Record<string, unknown> = {};

    updateAdvancedConfig(config: Record<string, unknown>): void {
        this.advancedConfig = { ...this.advancedConfig, ...config };
        logger.info('Updated Suwayomi advanced configuration');
    }

    getAdvancedConfig(): Record<string, unknown> {
        return { ...this.advancedConfig };
    }
}
/**
 * Singleton instance of the Suwayomi configuration service
 */
export const suwayomiConfigService = new SuwayomiConfigService();
