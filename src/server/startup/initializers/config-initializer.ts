/**
 * Configuration Initializer Module
 *
 * Initializes the centralized configuration system, including service setup
 * and configuration migrations.
 *
 * Extracted from: src/server/index.ts (lines 182-206)
 */

import { prisma } from '@/server/db';
import { runAllConfigMigrations } from '@/server/services/config/allMigrations';
import { configService } from '@/server/services/config/configService';
import { setGlobalConfigService, getAllConfigServices } from '@/server/services/config/globalConfigService';
import { logger } from '@/utils/logger';

import { formatError } from '../error-utils';

/**
 * Initializes the centralized configuration system
 *
 * This function:
 * - Initializes the configuration service
 * - Migrates legacy configurations to the new system
 *
 * @throws {Error} If configuration initialization fails
 */
export async function initializeConfigSystem(): Promise<void> {
  try {
    logger.info('Initializing configuration system...');

    // Initialize the configuration service
    await configService.initialize();
    logger.info('Configuration service initialized successfully');

    // Set the global config service
    setGlobalConfigService(configService);
    logger.info('Global configuration service set successfully');

    // Run all configuration migrations
    await runAllConfigMigrations(configService, prisma);
    logger.info('All configuration migrations completed');

    // Initialize all configuration services
    const _services = getAllConfigServices();
    logger.info('All configuration services initialized successfully');

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Failed to initialize configuration system: ${formatError(errorMessage)}`);
    throw error; // Re-throw to prevent server startup if configuration system fails
  }
}
