/**
 * Metadata Service Provider
 *
 * This module provides a singleton instance of the standardized metadata service
 * configured with settings from the Config table.
 */
import type { BaseProviderConfig } from '@/server/adapters/base-metadata-adapter';
import {prisma as _sharedPrisma } from '@/server/db';
import { getConfig, getConfigBoolean, getConfigNumber } from '@/server/utils/configReader';
import { logger } from '@/utils/logger';

import { MetadataService } from './metadataService';

import type { MetadataServiceOptions } from './metadata-types';
// Singleton instance
let metadataServiceInstance: MetadataService | null = null;
/**
 * Get the global metadata service instance
 */
export async function getMetadataService(): Promise<MetadataService> {
  if (metadataServiceInstance) {
    return metadataServiceInstance;
  }

  try {
    // Load provider configurations from Config table
    const providerConfigs = await loadProviderConfigsFromConfig();

    // Create service options
    const options: MetadataServiceOptions = {
      providerConfigs,
      logger: (message: string, error?: unknown) => {
        logger.info(`[MetadataService] ${message}`);
        if (error) {
          logger.error("Error occurred", error);
        }
      }
    };

    // Create and cache the service instance
    metadataServiceInstance = new MetadataService(options);
    return metadataServiceInstance;
  }
  catch (error: unknown) {
    logger.error('Failed to initialize metadata service:', error);
    // Fallback to default configurations
    const options: MetadataServiceOptions = {
      providerConfigs: getDefaultProviderConfigs(),
      logger: (message: string, error?: unknown) => {
        logger.info(`[MetadataService] ${message}`);
        if (error) {
          logger.error("Error occurred", error);
        }
      }
    };
    metadataServiceInstance = new MetadataService(options);
    return metadataServiceInstance;
  }
}

/**
 * Load provider configurations from Config table
 */
async function loadProviderConfigsFromConfig(): Promise<Record<string, BaseProviderConfig>> {
  try {
    // Read all provider configs in parallel
    const [
      anilistEnabled,
      anilistApiUrl,
      anilistTimeout,
      anilistRateLimit,
      comicvineEnabled,
      comicvineApiUrl,
      comicvineApiKey,
      comicvineTimeout,
      comicvineRateLimit,
      fandomEnabled,
      fandomApiUrl,
      fandomTimeout,
      fandomRateLimit
    ] = await Promise.all([
      getConfigBoolean('anilist.enabled', true),
      getConfig('anilist.apiUrl'),
      getConfigNumber('anilist.timeout', 30000),
      getConfigNumber('anilist.rateLimit', 1),
      getConfigBoolean('comicvine.enabled', false),
      getConfig('comicvine.apiUrl'),
      getConfig('comicvine.apiKey'),
      getConfigNumber('comicvine.timeout', 30000),
      getConfigNumber('comicvine.rateLimit', 1),
      getConfigBoolean('fandom.enabled', true),
      getConfig('fandom.apiUrl'),
      getConfigNumber('fandom.timeout', 30000),
      getConfigNumber('fandom.rateLimit', 1)
    ]);

    return {
      'anilist': {
        enabled: anilistEnabled,
        apiUrl: anilistApiUrl ?? 'https://graphql.anilist.co',
        timeout: anilistTimeout,
        rateLimit: anilistRateLimit
      },
      'comicvine': {
        enabled: comicvineEnabled,
        apiUrl: comicvineApiUrl ?? 'https://comicvine.gamespot.com/api',
        apiKey: comicvineApiKey ?? '',
        timeout: comicvineTimeout,
        rateLimit: comicvineRateLimit
      },
      'fandom': {
        enabled: fandomEnabled,
        apiUrl: fandomApiUrl ?? 'https://onepiece.fandom.com',
        timeout: fandomTimeout,
        rateLimit: fandomRateLimit
      }
    };
  } catch (error) {
    logger.error('Failed to load provider configs from Config table, using defaults:', error);
    return getDefaultProviderConfigs();
  }
}
/**
 * Get default provider configurations
 */
function getDefaultProviderConfigs(): Record<string, BaseProviderConfig> {
  return {
    'anilist': {
      enabled: true,
      apiUrl: 'https://graphql.anilist.co',
      timeout: 30000,
      rateLimit: 1 // 1 request per second
    },
    'comicvine': {
      enabled: false,
      apiUrl: 'https://comicvine.gamespot.com/api',
      apiKey: '',
      timeout: 30000,
      rateLimit: 1 // 1 request per second
    },
    'fandom': {
      enabled: false,
      apiUrl: 'https://onepiece.fandom.com',
      timeout: 30000,
      rateLimit: 1 // 1 request per second
    }
  };
}
/**
 * Reset the metadata service instance (useful for testing)
 */
export function resetMetadataService(): void {
  metadataServiceInstance = null;
}