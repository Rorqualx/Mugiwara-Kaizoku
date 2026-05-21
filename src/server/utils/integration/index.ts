/**
 * Integration System Module
 * 
 * This module provides a unified interface for managing external manga service integrations,
 * specifically Komga and Kavita. It handles library scanning, metadata synchronization,
 * and integration status management across multiple services.
 * 
 * Integration Architecture:
 * - Centralized configuration through ConfigService
 * - Parallel execution of integration tasks
 * - Unified error handling and logging
 * - Type-safe integration interfaces
 * 
 * Configuration Requirements:
 * - Each integration requires specific settings in the configuration system
 * - Credentials and endpoints are managed through the configuration system
 * - Integration-specific settings can be enabled/disabled independently
 * 
 * @module integrations
 */

import { prisma } from '@/server/db';
import type { ConfigService } from '@/server/services/config/configService';
import { getIntegrationConfigService } from '@/server/services/integration/configService';
import { logger } from '@/utils/logger';

import { getConfigBoolean } from '../configReader';

import * as kavita from './kavita';
import * as komga from './komga';

/**
 * Scans library for all configured integrations
 * 
 * Executes a parallel scan operation across all enabled integrations (Komga and Kavita).
 * Each integration's scan operation is independent and failures in one integration
 * will not affect others.
 * 
 * @throws {Error} If any integration scan fails
 * @example
 * ```typescript
 * try {
 *   await scanLibrary();
 *   logger.info('Library scan completed');
 * } catch (error) {
 *   console.error('Library scan failed:', error);
 * }
 * ```
 */
export const scanLibrary = async (): Promise<void> => {
  try {
    logger.info('Starting library scan for all integrations');
    await Promise.all([
    komga.scanLibrary(),
    kavita.scanLibrary()]
    );
    logger.info('Library scan completed successfully');
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? (error instanceof Error ? error.message : String(error)) : 'Unknown error';
    logger.error('Error during library scan:', errorMessage);
    throw error;
  }
};

/**
 * Refreshes metadata for a specific manga title across all integrations
 * 
 * Updates metadata for a manga title in all enabled integrations. Verifies manga
 * existence before attempting metadata refresh. Each integration's refresh operation
 * runs independently and in parallel.
 * 
 * @param {string} mangaTitle - Title of the manga to refresh metadata for
 * @throws {Error} If manga not found or metadata refresh fails
 * @example
 * ```typescript
 * try {
 *   await refreshMetadata('One Piece');
 *   logger.info('Metadata refresh completed');
 * } catch (error) {
 *   console.error('Metadata refresh failed:', error);
 * }
 * ```
 */
export const refreshMetadata = async (mangaTitle: string): Promise<void> => {
  try {
    logger.info(`Starting metadata refresh for: ${mangaTitle}`);

    // Get manga data to verify it exists
    const manga = await prisma.manga.findFirst({
      where: { title: mangaTitle },
      include: { Metadata: true }
    });

    if (!manga) {
      throw new Error(`Manga not found: ${mangaTitle}`);
    }

    // Run metadata refresh for all integrations
    await Promise.all([
    komga.refreshMetadata(mangaTitle),
    kavita.refreshMetadata(mangaTitle)]
    );

    logger.info(`Metadata refresh completed for: ${mangaTitle}`);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? (error instanceof Error ? error.message : String(error)) : 'Unknown error';
    logger.error(`Error refreshing metadata for ${mangaTitle}:`, errorMessage);
    throw error;
  }
};

/**
 * Check integration status for all configured services
 * 
 * Retrieves the current enabled/disabled status of all integrations from the configuration system.
 * Used to determine which integrations should be included in operations.
 * 
 * @param configService - Optional configuration service
 * @returns {Promise<{komga: boolean, kavita: boolean}>} Status of each integration
 * @throws {Error} If configuration query fails
 * @example
 * ```typescript
 * const status = await checkIntegrationStatus();
 * if (status.komga) {
 *   logger.info('Komga integration is enabled');
 * }
 * ```
 */
export async function checkIntegrationStatus(configService?: ConfigService): Promise<{
  komga: boolean;
  kavita: boolean;
}> {
  try {
    if (configService) {
      // Use the provided config service
      const integrationConfig = getIntegrationConfigService(configService);
      return await integrationConfig.checkIntegrationStatus();
    } else {
      // Use Config table for integration status
      return {
        komga: await getConfigBoolean('integration.komga.enabled', false),
        kavita: await getConfigBoolean('integration.kavita.enabled', false)
      };
    }
  } catch (error: unknown) {const errorMessage = error instanceof Error ? error.message : String(error);
logger.error(`Error checking integration status: ${errorMessage}`);
    return {
      komga: false,
      kavita: false
    };
  }
}

/**
 * Run integrations with comprehensive error handling
 * 
 * Executes library scans for all enabled integrations with proper error handling
 * and logging. Only runs integrations that are explicitly enabled in settings.
 * 
 * Error Handling:
 * - Individual integration failures are logged but don't stop other integrations
 * - All errors are properly typed and logged
 * - Failed operations are reported through the error logging system
 * 
 * @param configService - Optional configuration service
 * @throws {Error} If all integration runs fail
 * @example
 * ```typescript
 * try {
 *   await runIntegrations();
 *   logger.info('All integrations completed successfully');
 * } catch (error) {
 *   console.error('Integration run failed:', error);
 * }
 * ```
 */
export const runIntegrations = async (configService?: ConfigService): Promise<void> => {
  try {
    const status = await checkIntegrationStatus(configService);
    logger.info('Running enabled integrations', JSON.stringify(status));

    const tasks = [];
    if (status.komga) tasks.push(komga.scanLibrary());
    if (status.kavita) tasks.push(kavita.scanLibrary());

    if (tasks.length > 0) {
      await Promise.all(tasks);
      logger.info('All integration tasks completed successfully');
    } else {
      logger.info('No integrations enabled, skipping integration run');
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? (error instanceof Error ? error.message : String(error)) : 'Unknown error';
    logger.error('Error while running integrations:', errorMessage);
    throw error;
  }
};

/**
 * Re-exported and renamed types from Kavita integration
 * 
 * These types are renamed to avoid naming conflicts when using multiple integrations.
 * Each type represents a specific Kavita API response structure.
 * 
 * @typedef {Object} KavitaLibrary - Kavita library information
 * @typedef {Object} KavitaSeries - Kavita series metadata
 */
export type {
  KavitaLibrary,
  KavitaSeries } from
'./kavita';

/**
 * Re-exported integration modules
 * 
 * Provides direct access to individual integration implementations
 * while maintaining proper encapsulation of integration-specific logic.
 */
export { komga, kavita };