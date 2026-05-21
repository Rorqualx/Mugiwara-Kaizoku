/**
 * Config Service Adapter
 *
 * This module adapts the internal ConfigService implementation to the
 * standardized interface expected by providers and services. It ensures
 * compatibility between different configuration service implementations
 * across the codebase.
 *
 * @module server/services/config/configServiceAdapter
 */
import type { ConfigService as ExternalConfigService } from '@/types/config-service';
import { ValidationError } from '@/utils/errors';
import { logger } from '@/utils/logger';

import type { ConfigService as InternalConfigService } from './configService';

/**
 * Adapter that wraps the internal ConfigService to implement the external ConfigService interface
 */
export class ConfigServiceAdapter implements ExternalConfigService {
    private configService: InternalConfigService;
    /**
     * Creates a new adapter for the ConfigService
     *
     * @param configService Internal ConfigService instance to adapt
     */
    constructor(configService: InternalConfigService) {
        this.configService = configService;
    }
    /**
     * Check if the associated service is enabled
     *
     * @returns Promise resolving to boolean indicating enabled status
     */
    async isEnabled(): Promise<boolean> {
        try {
            const config = await this.configService.get<boolean>('service.enabled', false);
            return Boolean(config);
        }
        catch (error: unknown) {const errorMessage = error instanceof Error ? error.message : String(error);
logger.error('Error checking if service is enabled:', errorMessage);
            return false;
        }
    }
    /**
     * Load configuration data from storage
     *
     * @returns Promise resolving to the configuration data
     */
    async loadConfig(): Promise<unknown> {
        return this.configService.getAll();
    }
    /**
     * Save configuration data to storage
     *
     * @param config Configuration data to save
     * @returns Promise resolving when save is complete
     */
    async saveConfig(config: unknown): Promise<void> {
        if (typeof config !== 'object' || config === null) {
            throw new ValidationError('Invalid configuration: must be an object');
        }
        const configObj = config as Record<string, unknown>;
        // Save all keys in parallel since operations are independent
        const savePromises = Object.entries(configObj).map(([key, value]) =>
            this.configService.set(key, value)
        );
        await Promise.all(savePromises);
    }
    /**
     * Get a specific configuration value
     *
     * @param key Configuration key to retrieve
     * @param defaultValue Default value if key not found
     * @returns Promise resolving to configuration value
     */
    async getValue<T>(key: string, defaultValue?: T): Promise<T> {
        return this.configService.get<T>(key, defaultValue);
    }
    /**
     * Set a specific configuration value
     *
     * @param key Configuration key to set
     * @param value Value to store
     * @returns Promise resolving when update is complete
     */
    async setValue<T>(key: string, value: T): Promise<void> {
        await this.configService.set(key, value);
    }
    /**
     * Check if a configuration key exists
     *
     * @param key Configuration key to check
     * @returns Promise resolving to boolean indicating existence
     */
    async hasKey(key: string): Promise<boolean> {
        // Use get with a sentinel value to check if key exists
        const sentinel = {};
        const result = await this.configService.get(key, sentinel);
        return result !== sentinel;
    }
    /**
     * Remove a configuration key
     *
     * @param key Configuration key to remove
     * @returns Promise resolving when removal is complete
     */
    async removeKey(key: string): Promise<void> {
        await this.configService.delete(key);
    }
}
/**
 * Convert an internal ConfigService to an external-compatible ConfigService
 *
 * @param configService Internal ConfigService instance
 * @returns External-compatible ConfigService implementation
 */
export function adaptConfigService(configService: InternalConfigService): ExternalConfigService {
    return new ConfigServiceAdapter(configService);
}
