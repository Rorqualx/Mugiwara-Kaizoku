/**
 * Prowlarr Configuration Service
 *
 * Provides unified API for accessing Prowlarr integration configuration.
 * Uses the central configuration system (Config table) as the single source of truth.
 * Environment variables are only used as a one-time seed (see env-seeders/).
 */

import { ConfigScope, ConfigValueType } from '@prisma/client';

import { logger } from '@/utils/logger';

import { configService } from '../config/configService';

import type { ConfigService } from '../config/configService';

/**
 * Interface for Prowlarr configuration
 */
export interface ProwlarrConfig {
  baseUrl: string;
  apiKey: string;
  username: string;
  password: string;
}

const DEFAULT_CONFIG: ProwlarrConfig = {
  baseUrl: '',
  apiKey: '',
  username: '',
  password: '',
};

/**
 * Ensure the centralized config service is initialized
 */
async function ensureInitialized(): Promise<void> {
  if (!configService.isInitialized()) {
    await configService.initialize();
  }
}

/**
 * Read all Prowlarr config values from the Config table
 */
async function readProwlarrValues(): Promise<ProwlarrConfig> {
  await ensureInitialized();

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  const baseUrl = (await configService.get<string>('prowlarr.baseUrl')) ?? DEFAULT_CONFIG.baseUrl;
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  const apiKey = (await configService.get<string>('prowlarr.apiKey')) ?? DEFAULT_CONFIG.apiKey;
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  const username = (await configService.get<string>('prowlarr.username')) ?? DEFAULT_CONFIG.username;
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  const password = (await configService.get<string>('prowlarr.password')) ?? DEFAULT_CONFIG.password;

  return { baseUrl, apiKey, username, password };
}

/**
 * Write a single Prowlarr config field to the Config table
 */
async function writeField(key: string, value: string): Promise<void> {
  await configService.set(key, value, {
    scope: ConfigScope.INTEGRATION,
    valueType: ConfigValueType.STRING,
  });
}

/**
 * Prowlarr configuration service that integrates with the centralized config system
 */
export class ProwlarrConfigService {
  /**
   * Loads the current Prowlarr configuration from the Config table
   */
  async loadConfig(): Promise<ProwlarrConfig> {
    try {
      return await readProwlarrValues();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`Error loading Prowlarr config: ${errorMessage}`);
      return DEFAULT_CONFIG;
    }
  }

  /**
   * Updates the Prowlarr configuration in the Config table
   */
  async updateConfig(config: Partial<ProwlarrConfig>): Promise<void> {
    await ensureInitialized();

    if (config.baseUrl !== undefined) await writeField('prowlarr.baseUrl', config.baseUrl);
    if (config.apiKey !== undefined) await writeField('prowlarr.apiKey', config.apiKey);
    if (config.username !== undefined) await writeField('prowlarr.username', config.username);
    if (config.password !== undefined) await writeField('prowlarr.password', config.password);

    logger.info('Prowlarr configuration updated successfully');
  }

  async getBaseUrl(): Promise<string> {
    const config = await this.loadConfig();
    return config.baseUrl;
  }

  async getApiKey(): Promise<string> {
    const config = await this.loadConfig();
    return config.apiKey;
  }
}

/** Singleton instance for server-side usage */
export const prowlarrConfigService = new ProwlarrConfigService();

/** Factory function for creating/retrieving an instance */
let prowlarrConfigServiceInstance: ProwlarrConfigService | null = null;

export function getProwlarrConfigService(_configService: ConfigService): ProwlarrConfigService {
  prowlarrConfigServiceInstance ??= new ProwlarrConfigService();
  return prowlarrConfigServiceInstance;
}
