/**
 * App Configuration Service
 *
 * Provides DB-backed configuration for application-level settings
 * that don't belong to a specific integration/provider.
 *
 * Covers: base URL, bcrypt salt rounds.
 * Logger settings stay in .env (infrastructure needed before DB).
 */

import { ConfigScope, ConfigValueType } from '@prisma/client';

import { logger } from '@/utils/logger';

import { configService } from './configService';

/**
 * Application configuration interface
 */
export interface AppConfig {
  baseUrl: string;
  bcryptSaltRounds: number;
}

const DEFAULTS: AppConfig = {
  baseUrl: 'http://localhost:3000',
  bcryptSaltRounds: 10,
};

/**
 * App configuration service — reads from the Config table
 */
export class AppConfigService {
  private async ensureInitialized(): Promise<void> {
    if (!configService.isInitialized()) {
      await configService.initialize();
    }
  }

  async loadConfig(): Promise<AppConfig> {
    try {
      await this.ensureInitialized();

      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      const baseUrl = (await configService.get<string>('app.baseUrl')) ?? DEFAULTS.baseUrl;
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      const bcryptSaltRounds = (await configService.get<number>('app.bcryptSaltRounds')) ?? DEFAULTS.bcryptSaltRounds;

      return { baseUrl, bcryptSaltRounds };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`[AppConfig] Error loading config: ${errorMessage}`);
      return DEFAULTS;
    }
  }

  async getBaseUrl(): Promise<string> {
    const config = await this.loadConfig();
    return config.baseUrl;
  }

  async getBcryptSaltRounds(): Promise<number> {
    const config = await this.loadConfig();
    return config.bcryptSaltRounds;
  }

  async updateConfig(config: Partial<AppConfig>): Promise<void> {
    await this.ensureInitialized();

    if (config.baseUrl !== undefined) {
      await configService.set('app.baseUrl', config.baseUrl, {
        scope: ConfigScope.SYSTEM,
        valueType: ConfigValueType.STRING,
      });
    }
    if (config.bcryptSaltRounds !== undefined) {
      await configService.set('app.bcryptSaltRounds', config.bcryptSaltRounds, {
        scope: ConfigScope.SYSTEM,
        valueType: ConfigValueType.NUMBER,
      });
    }

    logger.info('[AppConfig] Configuration updated');
  }
}

/** Singleton instance */
export const appConfigService = new AppConfigService();
