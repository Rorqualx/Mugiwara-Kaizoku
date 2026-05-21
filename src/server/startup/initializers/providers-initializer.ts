/**
 * Providers Initializer Module
 *
 * Initializes provider release service and search provider registry including
 * AniList, ComicVine, Fandom, and other metadata providers.
 *
 * Extracted from: src/server/index.ts (lines 390-406, 518-574)
 */

import { providerReleaseService } from '@/server/services/calendar/ProviderReleaseService';
import { configService } from '@/server/services/config/configService';
import { getAllConfigServices } from '@/server/services/config/globalConfigService';
import { unifiedProviderRegistry } from '@/server/services/search/UnifiedProviderRegistry';
import { isError } from '@/utils/async-result';
import { logger } from '@/utils/logger';

import { formatError } from '../error-utils';

/**
 * Initializes the provider release service
 *
 * This function:
 * - Initializes metadata provider clients for calendar functionality
 * - Sets up AniList, ComicVine, Fandom, and other provider integrations
 * - Enables checking for new chapter releases from providers
 *
 * @throws {Error} If provider initialization fails
 */
export async function initializeProviderReleaseService(): Promise<void> {
  try {
    logger.info('Initializing provider release service...');

    // Initialize the provider release service
    const result = await providerReleaseService.initialize();

    if (result["status"] === 'success') {
      logger.info('Provider release service initialized successfully');
    } else if (isError(result)) {
      logger.warn(`Provider release service initialization completed with errors: ${formatError(result.error)}`);
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Failed to initialize provider release service: ${formatError(errorMessage)}`);
    // Don't throw - provider integration is not critical for server startup
  }
}

/**
 * Initializes search providers for metadata retrieval
 *
 * This function:
 * - Initializes the search provider registry using the enhanced initialization
 * - Checks provider settings
 * - Initializes AniList service if enabled
 *
 * @throws {Error} If provider initialization fails
 */
export async function initializeSearchProvidersAndServices(): Promise<void> {
  try {
    logger.info('Initializing search providers...');

    // Get the global configuration services
    const { config } = getAllConfigServices();

    // Initialize unified provider registry
    try {
      // Initialize the unified provider registry with the config service
      await unifiedProviderRegistry.initialize(config);

      // Log available providers to verify initialization
      const providers = unifiedProviderRegistry.getAvailableProviders();
      if (providers.length > 0) {
        logger.info(`Successfully initialized ${providers.length} search providers: ${providers.join(', ')}`);
      } else {
        logger.warn('Search provider registry initialized but no providers were registered');
      }
    } catch (registryError: unknown) {
      const errorMessage = registryError instanceof Error ? registryError.message : String(registryError);
      logger.error(`Failed to initialize search provider registry: ${formatError(errorMessage)}`);
    }

    // Initialize AniList service if enabled
    try {
      const { anilistService } = await import('@/server/services/anilist/service');

      // Check if AniList is enabled through metadata configuration
      // Use a type-safe approach to check provider settings
      // Check if AniList is enabled in metadata providers configuration
      const anilistEnabled = await configService.get('metadata.providers.anilist.enabled', false);
      // Using the value we got from configService directly

      if (anilistEnabled) {
        // Create an adapter for the config service
        const { adaptConfigService } = await import('@/server/services/config/configServiceAdapter');
        const configAdapter = adaptConfigService(configService);

        const initialized = await anilistService.initialize(configAdapter);

        if (initialized) {
          logger.info('AniList service initialized successfully');
        } else {
          logger.warn('AniList service initialization failed');
        }
      } else {
        logger.info('AniList service is disabled in settings');
      }
    } catch (error: unknown) {
      logger.error(`Error initializing AniList service: ${formatError((error instanceof Error ? error.message : String(error)))}`);
    }
  } catch (error: unknown) {
    logger.error(`Error initializing search providers: ${formatError((error instanceof Error ? error.message : String(error)))}`);
    // Log additional details for debugging
    logger.error(`Search provider initialization error details: ${error instanceof Error ? (error instanceof Error ? error.stack : String(error)) : 'No stack trace available'}`);
  }
}
