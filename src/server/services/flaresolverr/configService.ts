/**
 * FlareSolverr Configuration Service
 *
 * Typed wrapper around the existing FlareSolverrConfig Prisma model.
 * Consolidates all config reads into a single service, eliminating
 * scattered process.env reads. The DB is the single source of truth.
 */

import { prisma } from '@/server/db';
import { logger } from '@/utils/logger';

/**
 * FlareSolverr database configuration shape
 */
export interface FlareSolverrDbConfig {
  enabled: boolean;
  autoStart: boolean;
  url: string;
  timeout: number;
  sessionTTL: number;
  disableMedia: boolean;
  defaultWaitSecs: number;
}

/** Default values when no DB record exists */
const DEFAULTS: FlareSolverrDbConfig = {
  enabled: true,
  autoStart: false,
  url: 'http://localhost:8191/v1',
  timeout: 60000,
  sessionTTL: 1800000,
  disableMedia: true,
  defaultWaitSecs: 0,
};

/** Default FlareSolverr port */
const DEFAULT_PORT = 8191;

/** Full config type including Prisma timestamps */
type FullConfig = FlareSolverrDbConfig & { createdAt: Date; updatedAt: Date };

/**
 * Create the default FlareSolverr config record in the database
 */
async function createDefaultRecord(): Promise<FullConfig> {
  const config = await prisma.flareSolverrConfig.create({
    data: {
      id: 'default',
      enabled: DEFAULTS.enabled,
      autoStart: DEFAULTS.autoStart,
      url: DEFAULTS.url,
      timeout: DEFAULTS.timeout,
      sessionTTL: DEFAULTS.sessionTTL,
      disableMedia: DEFAULTS.disableMedia,
      defaultWaitSecs: DEFAULTS.defaultWaitSecs,
    },
  });
  logger.info('[FlareSolverr] Created default config from hardcoded defaults');
  return config;
}

/**
 * Return a fallback config object when DB is unavailable
 */
function createFallbackConfig(): FullConfig {
  return {
    ...DEFAULTS,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as FullConfig;
}

/**
 * FlareSolverr configuration service
 *
 * Reads from prisma.flareSolverrConfig (existing Prisma model).
 * Creates a default record on first access if none exists.
 */
export class FlareSolverrConfigService {
  /**
   * Get or create the FlareSolverr config record
   */
  async getOrCreateConfig(): Promise<FullConfig> {
    try {
      const config = await prisma.flareSolverrConfig.findUnique({
        where: { id: 'default' },
      });

      return config ?? await createDefaultRecord();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`[FlareSolverr] Error loading config: ${errorMessage}`);
      return createFallbackConfig();
    }
  }

  async getUrl(): Promise<string> {
    const config = await this.getOrCreateConfig();
    return config.url;
  }

  async isEnabled(): Promise<boolean> {
    const config = await this.getOrCreateConfig();
    return config.enabled;
  }

  async getTimeout(): Promise<number> {
    const config = await this.getOrCreateConfig();
    return config.timeout;
  }

  async getSessionTTL(): Promise<number> {
    const config = await this.getOrCreateConfig();
    return config.sessionTTL;
  }

  async isAutoStartEnabled(): Promise<boolean> {
    const config = await this.getOrCreateConfig();
    return config.autoStart;
  }

  /**
   * Get the FlareSolverr port (hardcoded default — rarely changed)
   */
  getPort(): number {
    return DEFAULT_PORT;
  }
}

/** Singleton instance */
export const flareSolverrConfigService = new FlareSolverrConfigService();
