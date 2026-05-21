/**
 * Global Configuration Service
 *
 * This module provides a centralized access point for all configuration services.
 * It acts as a factory for obtaining specific configuration services and ensures
 * that they are properly initialized with the global ConfigService instance.
 *
 * Features:
 * - Central access point for all configuration services
 * - Lazy initialization of configuration services
 * - Singleton pattern for configuration services
 */
import { ValidationError } from '@/utils/errors';
import { logger } from '@/utils/logger';

import { getIntegrationConfigService } from '../integration/configService';
import { getMetadataConfigService } from '../metadata/configService';

import { getGeneralConfigService } from './generalConfigService';

import type { ConfigService } from './configService';
import type { GeneralConfigService} from './generalConfigService';
import type { IntegrationConfigService} from '../integration/configService';
import type { MetadataConfigService} from '../metadata/configService';




// Global ConfigService instance
let globalConfigService: ConfigService | null = null;
/**
 * Set the global ConfigService instance
 *
 * @param configService - The ConfigService instance to use globally
 */
export function setGlobalConfigService(configService: ConfigService): void {
    globalConfigService = configService;
    logger.info('Global ConfigService set');
}
/**
 * Get the global ConfigService instance
 *
 * @returns The global ConfigService instance
 * @throws Error if the global ConfigService is not set
 */
export function getGlobalConfigService(): ConfigService {
    if (!globalConfigService) {
        throw new ValidationError('Global ConfigService not initialized. Call setGlobalConfigService first.');
    }
    return globalConfigService;
}
/**
 * Get all configuration services
 *
 * @returns An object containing all configuration services
 * @throws Error if the global ConfigService is not set
 */
export function getAllConfigServices(): {
    config: ConfigService;
    general: GeneralConfigService;
    integration: IntegrationConfigService;
    metadata: MetadataConfigService;
} {
    const configService = getGlobalConfigService();
    return {
        config: configService,
        general: getGeneralConfigService(configService),
        integration: getIntegrationConfigService(configService),
        metadata: getMetadataConfigService(configService)
    };
}
/**
 * Reset all configuration services
 *
 * This clears the caches of all configuration services,
 * forcing them to reload configuration from the database.
 *
 * @throws Error if the global ConfigService is not set
 */
export function resetAllConfigServices(): void {
    try {
        const services = getAllConfigServices();
        // Clear caches
        services.general.clearCache();
        services.integration.clearCache();
        services["metadata"].clearCache();
        logger.info('All configuration services reset');
    }
    catch (error: unknown) {const errorMessage = error instanceof Error ? error.message : String(error);
logger.error(`Error resetting configuration services: ${errorMessage}`);
        throw error;
    }
}
