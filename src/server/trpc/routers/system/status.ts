/**
 * System Status Router Module
 *
 * Provides comprehensive system status information including database connection,
 * system resources, Docker status, application version, and integration statuses.
 *
 * Extracted from: system.ts (lines 869-1092)
 *
 * @module system/status
 */

import * as os from 'os';

import { env } from '@/env/server';
import { prisma } from '@/server/db';
import { getGlobalConfigService } from '@/server/services/config/globalConfigService';
import { eventEmitter } from '@/server/services/eventEmitter';
import { realtimeEmitter } from '@/server/services/realtime';
import { adminProcedure } from '@/server/trpc/procedures';
import { router } from '@/server/trpc/trpc';
import { getCpuUsagePercent } from '@/server/utils/system-cpu';
import { getDiskUsage } from '@/server/utils/system-disk';
import { getAvailableMemory } from '@/server/utils/system-memory';
import { logger } from '@/utils/logging';
import { isObject, hasProperty } from '@/utils/type-guards';

import { getPackageVersion, getProviderValue } from './utils';

// ============================================================================
// Type Definitions
// ============================================================================

/** Database statistics for system status */
interface DatabaseStats {
  mangaCount: number;
  chapterCount: number;
  libraryCount: number;
  taskCount: number;
  queueCount: number;
}

/** Database connection and statistics information */
interface DatabaseInfo {
  name: string;
  host: string;
  port: string;
  user: string;
  isConnected: boolean;
  stats: DatabaseStats;
}

/** System information and performance metrics */
interface SystemMetrics {
  platform: NodeJS.Platform;
  arch: string;
  cpus: os.CpuInfo[];
  totalMemory: number;
  freeMemory: number;
  uptime: number;
  loadAvg: number[];
  hostname: string;
  networkInterfaces: NodeJS.Dict<os.NetworkInterfaceInfo[]>;
  cpu: { usage: number };
  memory: { usagePercent: number };
  disk: { usagePercent: number };
}

/** Docker status information */
interface DockerInfo {
  isDocker: boolean;
  containerInfo: { port: string | undefined; timezone: string | undefined } | null;
}

/** Application version and runtime information */
interface ApplicationInfo {
  version: string;
  nodeEnv: string;
  port: string | undefined;
  nodeVersion: string;
  startTime: string;
}

/** Base provider status */
interface ProviderStatus {
  enabled: boolean;
  status: 'active' | 'inactive';
}

/** Anilist provider status with metadata flag */
interface AnilistStatus extends ProviderStatus {
  useForMetadata: boolean;
}

/** Comicvine provider status with API configuration flag */
interface ComicvineStatus extends ProviderStatus {
  apiConfigured: boolean;
}

/** Metadata provider integration statuses */
interface MetadataIntegrations {
  anilist: AnilistStatus;
  comicvine: ComicvineStatus;
  fandom: ProviderStatus;
}

/** Complete integration status */
interface IntegrationStatus {
  metadata: MetadataIntegrations;
  sources: {
    suwayomi: {
      status: 'active' | 'inactive';
      sourceCount: number;
      availableSources: string[];
    };
  };
}

/** Complete system status response */
interface SystemStatusResponse {
  status: 'ok';
  database: DatabaseInfo;
  system: SystemMetrics;
  docker: DockerInfo;
  application: ApplicationInfo;
  integrations: IntegrationStatus;
}

// ============================================================================
// Helper Functions
// ============================================================================

/** Gets database connection status and statistics */
async function getDatabaseInfo(): Promise<DatabaseInfo> {
  const dbInfo: DatabaseInfo = {
    name: 'kaizoku',
    host: 'localhost',
    port: '5432',
    user: 'kaizoku',
    isConnected: false,
    stats: {
      mangaCount: 0,
      chapterCount: 0,
      libraryCount: 0,
      taskCount: 0,
      queueCount: 0
    }
  };

  try {
    await prisma.$queryRaw`SELECT 1`;
    dbInfo.isConnected = true;

    // Get database statistics
    const [mangaCount, chapterCount, libraryCount] = await Promise.all([
      prisma.manga.count(),
      prisma.chapter.count(),
      prisma.library.count()
    ]);

    // Get job counts from the unified jobs table
    const jobStats = await prisma.$queryRaw<[{ total: bigint; pending: bigint; active: bigint }]>`
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'pending') as pending,
        COUNT(*) FILTER (WHERE status = 'active') as active
      FROM jobs
    `;

    dbInfo.stats = {
      mangaCount,
      chapterCount,
      libraryCount,
      taskCount: Number(jobStats[0].total),
      queueCount: Number(jobStats[0].pending)
    };
  } catch (error: unknown) {
    logger.error('Database connection test failed', error instanceof Error ? error.message : String(error));
    dbInfo.isConnected = false;
  }

  return dbInfo;
}

/** Gets system resource metrics from the operating system */
async function getSystemMetrics(): Promise<SystemMetrics> {
  // Sample CPU and disk concurrently — CPU sampling sleeps ~100ms, statfs
  // is a single syscall, so they overlap at no extra latency cost.
  const [cpuUsage, diskUsage] = await Promise.all([
    getCpuUsagePercent(),
    getDiskUsage(process.cwd())
  ]);

  const cpus = os.cpus();
  const totalMemory = os.totalmem();
  // Available (reclaimable) memory, not just MemFree — `os.freemem()` is
  // misleading on macOS and Linux. See @/server/utils/system-memory.
  const freeMemory = getAvailableMemory();
  const usedMemory = totalMemory - freeMemory;
  const memoryUsagePercent = (usedMemory / totalMemory) * 100;

  return {
    platform: os.platform(),
    arch: os.arch(),
    cpus,
    totalMemory,
    freeMemory,
    uptime: os.uptime(),
    loadAvg: os.loadavg(),
    hostname: os.hostname(),
    networkInterfaces: os.networkInterfaces(),
    cpu: {
      usage: cpuUsage
    },
    memory: {
      usagePercent: memoryUsagePercent
    },
    disk: {
      usagePercent: diskUsage.usagePercent
    }
  };
}

/** Gets Docker container information */
function getDockerInfo(): DockerInfo {
  const isDocker = env.DOCKER === 'true';

  return {
    isDocker,
    containerInfo: isDocker
      ? {
          port: env.KAIZOKU_PORT,
          timezone: env.TZ
        }
      : null
  };
}

/** Gets application version and runtime information */
function getApplicationInfo(): ApplicationInfo {
  return {
    version: env.NEXT_PUBLIC_APP_VERSION ?? getPackageVersion(),
    nodeEnv: env.NODE_ENV,
    port: env.KAIZOKU_PORT,
    nodeVersion: process.version,
    startTime: new Date(Date.now() - process.uptime() * 1000).toISOString()
  };
}

/** Gets integration status from ConfigService for all metadata providers */
async function getIntegrationStatus(): Promise<IntegrationStatus> {
  logger.info('Getting integration status from ConfigService');
  let metadata: Record<string, unknown> = { providers: {} };

  try {
    // Initialize ConfigService if needed
    const configService = getGlobalConfigService();
    if (!configService.isInitialized()) {
      await configService.initialize();
    }

    // Get all metadata provider settings
    const metadataConfig = await configService.getByNamespace('metadataProviders');
    logger.info('ConfigService metadata config:', {
      keys: Object.keys(metadataConfig),
      configCount: Object.keys(metadataConfig).length
    });

    // Process config entries to build metadata structure
    metadata = processMetadataConfig(metadataConfig);

    logger.info('Processed metadata from ConfigService:', {
      providers: Object.keys(metadata['providers'] as Record<string, unknown>),
      defaultProvider: metadata['defaultProvider'],
      structure: JSON.stringify(metadata).substring(0, 500)
    });
  } catch (error: unknown) {
    logger.error(
      'Failed to get metadata from ConfigService:',
      error instanceof Error ? error.message : String(error)
    );
    // Use empty metadata structure as fallback
    metadata = { providers: {} };
  }

  // Build integrations status from metadata
  return buildIntegrationsFromMetadata(metadata);
}

/** Processes metadata configuration entries into a structured object */
function processMetadataConfig(
  metadataConfig: Record<string, { value: unknown }>
): Record<string, unknown> {
  const metadata: Record<string, unknown> = { providers: {} };

  for (const [key, config] of Object.entries(metadataConfig)) {
    const keyParts = key.split('.');

    // Handle metadataProviders.defaultProvider
    if (key === 'metadataProviders.defaultProvider') {
      metadata['defaultProvider'] = config.value;
    }

    // Handle metadataProviders.enableMultiProviderSearch
    if (key === 'metadataProviders.enableMultiProviderSearch') {
      metadata['enableMultiProviderSearch'] = config.value;
    }

    // Handle metadataProviders.providers.{provider}.apiKey
    if (keyParts.length >= 4 && keyParts[1] === 'providers' && keyParts[3] === 'apiKey') {
      const provider = keyParts[2];
      if (provider) {
        const providers = metadata['providers'] as Record<string, unknown>;
        if (!providers[provider]) {
          providers[provider] = { settings: {} };
        }
        (providers[provider] as Record<string, unknown>)['apiKey'] = config.value as boolean;
      }
    }

    // Handle metadataProviders.providers.{provider}.settings.{key}
    if (keyParts.length >= 5 && keyParts[1] === 'providers' && keyParts[3] === 'settings') {
      const provider = keyParts[2];
      if (provider) {
        const settingKey = keyParts.slice(4).join('.');
        const providers = metadata['providers'] as Record<string, unknown>;
        if (!providers[provider]) {
          providers[provider] = { settings: {} };
        }
        ((providers[provider] as Record<string, unknown>)['settings'] as Record<string, unknown>)[
          settingKey
        ] = config.value;
      }
    }
  }

  return metadata;
}

/** Builds integration status from processed metadata */
function buildIntegrationsFromMetadata(metadata: Record<string, unknown>): IntegrationStatus {
  const providers = (metadata['providers'] ?? {}) as unknown;

  // Safely extract Anilist status
  const anilistApiKey = getProviderValue(providers, 'anilist', 'apiKey');
  const anilistSettings = getProviderValue(providers, 'anilist', 'settings');
  const anilistUseForMetadata =
    isObject(anilistSettings) && hasProperty(anilistSettings, 'useForMetadata')
      ? anilistSettings['useForMetadata']
      : false;

  // Safely extract Comicvine status
  const comicvineApiKey = getProviderValue(providers, 'comicvine', 'apiKey');
  const comicvineSettings = getProviderValue(providers, 'comicvine', 'settings');
  const comicvineSettingsApiKey =
    isObject(comicvineSettings) && hasProperty(comicvineSettings, 'apiKey')
      ? comicvineSettings['apiKey']
      : undefined;

  // Safely extract Fandom status
  const fandomApiKey = getProviderValue(providers, 'fandom', 'apiKey');

  return {
    metadata: {
      anilist: {
        enabled: !!anilistApiKey,
        useForMetadata: !!anilistUseForMetadata,
        status: anilistApiKey ? 'active' : 'inactive'
      },
      comicvine: {
        enabled: !!comicvineApiKey,
        status: comicvineApiKey ? 'active' : 'inactive',
        apiConfigured: !!comicvineSettingsApiKey
      },
      fandom: {
        enabled: !!fandomApiKey,
        status: fandomApiKey ? 'active' : 'inactive'
      }
    },
    sources: {
      suwayomi: {
        // TODO: Check actual suwayomi status
        status: 'inactive',
        sourceCount: 0,
        availableSources: []
      }
    }
  };
}

/** Emits system health check notification */
async function emitHealthCheck(dbInfo: DatabaseInfo, systemInfo: SystemMetrics): Promise<void> {
  await eventEmitter.emit('system:warning', {
    message: 'System health check completed',
    context: JSON.stringify({
      status: 'ok',
      databaseConnected: dbInfo.isConnected,
      cpuUsage: systemInfo.cpu.usage,
      memoryUsage: systemInfo.memory.usagePercent,
      diskUsage: systemInfo.disk.usagePercent,
      uptime: systemInfo.uptime,
      activeJobs: dbInfo.stats.taskCount,
      queuedJobs: dbInfo.stats.queueCount
    })
  });
}

// ============================================================================
// Router Definition
// ============================================================================

/** System status router - provides comprehensive system status information */
export const statusRouter = router({
  /** Retrieves comprehensive system status including database, resources, and integrations */
  getStatus: adminProcedure.query(async (): Promise<SystemStatusResponse> => {
    try {
      // Gather all system information in parallel where possible
      const [dbInfo, integrations, systemInfo] = await Promise.all([
        getDatabaseInfo(),
        getIntegrationStatus(),
        getSystemMetrics()
      ]);

      const dockerInfo = getDockerInfo();
      const appInfo = getApplicationInfo();

      // Emit system health check notification
      await emitHealthCheck(dbInfo, systemInfo);

      // Emit via WebSocket for real-time monitoring
      void realtimeEmitter.emitSystemStatus({
        status: dbInfo.isConnected ? 'healthy' : 'degraded',
        uptime: systemInfo.uptime,
        memoryUsage: systemInfo.memory.usagePercent,
        cpuUsage: systemInfo.cpu.usage,
        activeJobs: dbInfo.stats.taskCount - dbInfo.stats.queueCount,
        queuedJobs: dbInfo.stats.queueCount,
      });

      // Return the comprehensive status information
      return {
        status: 'ok',
        database: dbInfo,
        system: systemInfo,
        docker: dockerInfo,
        application: appInfo,
        integrations
      };
    } catch (error: unknown) {
      logger.error(`Failed to get system status: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  })
});

// Export alias for consistency with other system routers
export { statusRouter as systemStatusRouter };

// Export types for use in other modules
export type {
  SystemStatusResponse,
  DatabaseInfo,
  SystemMetrics,
  DockerInfo,
  ApplicationInfo,
  IntegrationStatus
};
