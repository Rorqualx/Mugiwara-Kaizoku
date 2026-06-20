// @file-size-justified: Cohesive tRPC router - all FlareSolverr endpoints in one file for discoverability
/**
 * FlareSolverr Settings Router
 *
 * Provides tRPC procedures for managing FlareSolverr configuration:
 * - getSettings: Fetch current FlareSolverr configuration
 * - updateSettings: Update FlareSolverr settings
 * - testConnection: Test connectivity to a FlareSolverr URL
 * - getHealthStatus: Get real-time health and version info
 * - getSessionList: List active sessions
 * - clearSessions: Clear all sessions
 * - getLogs: View internal FlareSolverr logs
 * - clearLogs: Clear the log file
 *
 * @module server/trpc/routers/flaresolverr
 */

import * as fs from 'fs';

import axios from 'axios';
import { z } from 'zod';

import { prisma } from '@/server/db';
import { getBinaryInfo, updateBinary as updateBinaryFromGithub } from '@/server/services/flaresolverr/binaryManager';
import { getChromeInfo, verifyChromeWorks } from '@/server/services/flaresolverr/chromeChecker';
import { flareSolverrConfigService } from '@/server/services/flaresolverr/configService';
import { getLogFilePath } from '@/server/services/flaresolverr/goLauncher';
import { flareSolverr } from '@/server/services/flaresolverr/singleton';
import type { FlareSolverrApiResponse } from '@/server/services/flaresolverr/types';
import { realtimeEmitter } from '@/server/services/realtime/RealtimeEventEmitter';
import { adminProcedure, protectedProcedure } from '@/server/trpc/procedures';
import { router } from '@/server/trpc/trpc';
import { logger } from '@/utils/logger';

import { flareSolverrMetricsProcedures } from './flaresolverr-metrics';


// =============================================================================
// Schemas
// =============================================================================

// Type for settings used in updateSettings return
interface FlareSolverrSettings {
  enabled: boolean;
  autoStart: boolean;
  url: string;
  timeout: number;
  sessionTTL: number;
  disableMedia: boolean;
  defaultWaitSecs: number;
}

const updateSettingsSchema = z.object({
  enabled: z.boolean().optional(),
  autoStart: z.boolean().optional(),
  url: z.string().url().optional(),
  timeout: z.number().int().min(1000).max(300000).optional(),
  sessionTTL: z.number().int().min(60000).max(86400000).optional(),
  disableMedia: z.boolean().optional(),
  defaultWaitSecs: z.number().int().min(0).max(60).optional(),
});

const testConnectionSchema = z.object({
  url: z.string().url(),
});

/**
 * Defense-in-depth SSRF check for `testConnection`.
 *
 * The procedure is `protectedProcedure` (auth required) and is meant for
 * probing user-controlled FlareSolverr instances — those are commonly on the
 * LAN, so blanket-rejecting RFC1918 is wrong. Reject only the link-local
 * range (169.254.0.0/16) which covers AWS / Azure / GCP instance-metadata
 * endpoints, plus the well-known metadata hostnames, plus non-http(s)
 * protocols.
 */
function isAllowedFlareSolverrTestUrl(rawUrl: string): { ok: true } | { ok: false; reason: string } {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return { ok: false, reason: 'Invalid URL' };
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { ok: false, reason: 'Only http(s) URLs are allowed' };
  }

  const host = parsed.hostname.toLowerCase();
  const ipv4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (ipv4) {
    const o1 = Number(ipv4[1]);
    const o2 = Number(ipv4[2]);
    if (o1 === 169 && o2 === 254) {
      return { ok: false, reason: 'Link-local addresses (169.254.0.0/16) are not allowed' };
    }
  }

  const cloudMetadataHosts = new Set([
    'metadata.google.internal',
    'metadata.azure.com',
    'metadata.aws.com',
    'instance-data.ec2.internal',
  ]);
  if (cloudMetadataHosts.has(host)) {
    return { ok: false, reason: 'Cloud metadata hostnames are not allowed' };
  }

  return { ok: true };
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Get or create default FlareSolverr config
 */
async function getOrCreateConfig(): Promise<{
  id: string;
  enabled: boolean;
  autoStart: boolean;
  url: string;
  timeout: number;
  sessionTTL: number;
  disableMedia: boolean;
  defaultWaitSecs: number;
  createdAt: Date;
  updatedAt: Date;
}> {
  // Delegate to the centralized FlareSolverr config service (no env reads)
  const config = await flareSolverrConfigService.getOrCreateConfig();
  return { id: 'default', ...config };
}

/**
 * Test FlareSolverr connectivity
 */
async function testFlareSolverrConnection(url: string): Promise<{
  success: boolean;
  version?: string;
  message: string;
  responseTime?: number;
}> {
  const startTime = Date.now();

  try {
    const response = await axios.post<FlareSolverrApiResponse>(
      url,
      { cmd: 'sessions.list' },
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000,
      }
    );

    const responseTime = Date.now() - startTime;

    if (response.data.status === 'ok') {
      return {
        success: true,
        version: response.data.version ?? 'unknown',
        message: `Connected successfully (${responseTime}ms)`,
        responseTime,
      };
    }

    return {
      success: false,
      message: response.data.message.length > 0
        ? response.data.message
        : 'Unknown error from FlareSolverr',
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      message: `Connection failed: ${errorMessage}`,
    };
  }
}

// =============================================================================
// Router
// =============================================================================

export const flareSolverrRouter = router({
  /**
   * Get current FlareSolverr settings
   */
  getSettings: protectedProcedure.query(async (): Promise<{
    enabled: boolean;
    autoStart: boolean;
    url: string;
    timeout: number;
    sessionTTL: number;
    disableMedia: boolean;
    defaultWaitSecs: number;
    createdAt: Date;
    updatedAt: Date;
  }> => {
    const config = await getOrCreateConfig();
    return {
      enabled: config.enabled,
      autoStart: config.autoStart,
      url: config.url,
      timeout: config.timeout,
      sessionTTL: config.sessionTTL,
      disableMedia: config.disableMedia,
      defaultWaitSecs: config.defaultWaitSecs,
      createdAt: config.createdAt,
      updatedAt: config.updatedAt,
    };
  }),

  /**
   * Update FlareSolverr settings
   */
  updateSettings: adminProcedure
    .input(updateSettingsSchema)
    .mutation(async ({ input }): Promise<{
      success: boolean;
      settings: FlareSolverrSettings;
      message: string;
    }> => {
      // Ensure config exists
      await getOrCreateConfig();

      // Update config
      const updatedConfig = await prisma.flareSolverrConfig.update({
        where: { id: 'default' },
        data: {
          ...(input.enabled !== undefined && { enabled: input.enabled }),
          ...(input.autoStart !== undefined && { autoStart: input.autoStart }),
          ...(input.url !== undefined && { url: input.url }),
          ...(input.timeout !== undefined && { timeout: input.timeout }),
          ...(input.sessionTTL !== undefined && { sessionTTL: input.sessionTTL }),
          ...(input.disableMedia !== undefined && { disableMedia: input.disableMedia }),
          ...(input.defaultWaitSecs !== undefined && { defaultWaitSecs: input.defaultWaitSecs }),
        },
      });

      // Update the singleton client with new config
      flareSolverr.updateConfig({
        enabled: updatedConfig.enabled,
        url: updatedConfig.url,
        timeout: updatedConfig.timeout,
        sessionTTL: updatedConfig.sessionTTL,
        disableMedia: updatedConfig.disableMedia,
        defaultWaitSeconds: updatedConfig.defaultWaitSecs,
      });

      logger.info('[FlareSolverr] Settings updated', {
        enabled: updatedConfig.enabled,
        autoStart: updatedConfig.autoStart,
        url: updatedConfig.url,
        timeout: updatedConfig.timeout,
        sessionTTL: updatedConfig.sessionTTL,
        disableMedia: updatedConfig.disableMedia,
        defaultWaitSecs: updatedConfig.defaultWaitSecs,
      });

      // Emit WebSocket event for real-time sync
      void realtimeEmitter.emitSystemEvent({
        eventType: 'flaresolverr:settingsUpdated',
        source: 'flaresolverr-router',
        message: 'FlareSolverr settings updated',
        data: {
          enabled: updatedConfig.enabled,
          autoStart: updatedConfig.autoStart,
          url: updatedConfig.url,
        },
      });

      return {
        success: true,
        settings: {
          enabled: updatedConfig.enabled,
          autoStart: updatedConfig.autoStart,
          url: updatedConfig.url,
          timeout: updatedConfig.timeout,
          sessionTTL: updatedConfig.sessionTTL,
          disableMedia: updatedConfig.disableMedia,
          defaultWaitSecs: updatedConfig.defaultWaitSecs,
        },
        message: 'Settings updated successfully',
      };
    }),

  /**
   * Test connection to a FlareSolverr URL
   *
   * If successful, also syncs the singleton's config with the database
   * to fix stale cache issues after direct database updates.
   */
  testConnection: protectedProcedure
    .input(testConnectionSchema)
    .mutation(async ({ input }): Promise<{
      success: boolean;
      version?: string;
      message: string;
      responseTime?: number;
    }> => {
      const allowed = isAllowedFlareSolverrTestUrl(input.url);
      if (!allowed.ok) {
        logger.warn('[FlareSolverr] testConnection rejected', { url: input.url, reason: allowed.reason });
        return { success: false, message: allowed.reason };
      }

      const result = await testFlareSolverrConnection(input.url);

      // If connection succeeds, sync singleton with database config
      // This fixes stale cache issues after direct DB updates
      if (result.success) {
        const config = await getOrCreateConfig();
        flareSolverr.updateConfig({
          enabled: config.enabled,
          url: config.url,
          timeout: config.timeout,
          sessionTTL: config.sessionTTL,
          disableMedia: config.disableMedia,
          defaultWaitSeconds: config.defaultWaitSecs,
        });
        logger.debug('[FlareSolverr] Singleton config synced after successful test', {
          url: config.url,
        });
      }

      return result;
    }),

  /**
   * Get real-time health status.
   *
   * No singleton-config side effects: the singleton is seeded at boot via
   * `bootstrapFlareSolverr` and refreshed whenever settings are saved
   * through `updateSettings`. A polled query should not mutate runtime
   * state on every call.
   */
  getHealthStatus: protectedProcedure.query(async (): Promise<{
    healthy: boolean;
    enabled: boolean;
    isRunning: boolean;
    autoStart: boolean;
    version: string | null;
    minimumVersion: string;
    isOutdated: boolean | null;
    sessionCount: number;
    url: string;
    lastChecked: Date;
    lifecycleStatus: {
      consecutiveFailures: number;
      isRestarting: boolean;
      canRestart: boolean;
    };
  }> => {
    const config = await getOrCreateConfig();

    const healthy = await flareSolverr.isHealthy();
    const isRunning = await flareSolverr.isRunning();
    const versionInfo = flareSolverr.getVersionInfo();
    const lifecycleStatus = flareSolverr.getLifecycleStatus();
    const sessions = await flareSolverr.listSessions();

    return {
      healthy,
      enabled: config.enabled,
      isRunning,
      autoStart: config.autoStart,
      version: versionInfo.currentVersion,
      minimumVersion: versionInfo.minimumVersion,
      isOutdated: versionInfo.isOutdated,
      sessionCount: sessions.length,
      url: config.url,
      lastChecked: new Date(),
      lifecycleStatus: {
        consecutiveFailures: lifecycleStatus.consecutiveFailures,
        isRestarting: lifecycleStatus.isRestarting,
        canRestart: lifecycleStatus.canRestart,
      },
    };
  }),

  /**
   * List active FlareSolverr sessions
   */
  getSessionList: protectedProcedure.query(async (): Promise<{
    sessions: string[];
    count: number;
  }> => {
    const sessions = await flareSolverr.listSessions();
    return {
      sessions,
      count: sessions.length,
    };
  }),

  /**
   * Clear all FlareSolverr sessions
   */
  clearSessions: adminProcedure.mutation(async (): Promise<{
    success: boolean;
    clearedCount: number;
    message: string;
  }> => {
    const sessions = await flareSolverr.listSessions();

    // Process all session destructions in parallel
    const results = await Promise.all(
      sessions.map((session) => flareSolverr.destroySession(session))
    );
    const clearedCount = results.filter(Boolean).length;

    logger.info('[FlareSolverr] Sessions cleared', {
      total: sessions.length,
      cleared: clearedCount,
    });

    // Emit WebSocket event for real-time sync
    void realtimeEmitter.emitSystemEvent({
      eventType: 'flaresolverr:sessionsCleared',
      source: 'flaresolverr-router',
      message: `Cleared ${clearedCount} of ${sessions.length} sessions`,
      data: { total: sessions.length, cleared: clearedCount },
    });

    return {
      success: true,
      clearedCount,
      message: `Cleared ${clearedCount} of ${sessions.length} sessions`,
    };
  }),

  /**
   * Start the internal FlareSolverr instance
   */
  start: adminProcedure.mutation(async (): Promise<{
    success: boolean;
    message: string;
  }> => {
    try {
      const started = await flareSolverr.start();
      // Emit WebSocket event for real-time sync
      void realtimeEmitter.emitSystemEvent({
        eventType: 'flaresolverr:started',
        source: 'flaresolverr-router',
        message: started ? 'FlareSolverr started successfully' : 'FlareSolverr start attempted',
        data: { success: started },
      });
      return {
        success: started,
        message: started
          ? 'FlareSolverr started successfully'
          : 'FlareSolverr is already running or failed to start',
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('[FlareSolverr] Start failed', { error: errorMessage });
      return {
        success: false,
        message: `Start failed: ${errorMessage}`,
      };
    }
  }),

  /**
   * Stop the internal FlareSolverr instance
   */
  stop: adminProcedure.mutation(async (): Promise<{
    success: boolean;
    message: string;
  }> => {
    try {
      const stopped = await flareSolverr.stop();
      // Emit WebSocket event for real-time sync
      void realtimeEmitter.emitSystemEvent({
        eventType: 'flaresolverr:stopped',
        source: 'flaresolverr-router',
        message: stopped ? 'FlareSolverr stopped successfully' : 'FlareSolverr stop attempted',
        data: { success: stopped },
      });
      return {
        success: stopped,
        message: stopped
          ? 'FlareSolverr stopped successfully'
          : 'FlareSolverr is already stopped or failed to stop',
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('[FlareSolverr] Stop failed', { error: errorMessage });
      return {
        success: false,
        message: `Stop failed: ${errorMessage}`,
      };
    }
  }),

  /**
   * Force restart FlareSolverr service
   */
  restart: adminProcedure.mutation(async (): Promise<{
    success: boolean;
    message: string;
  }> => {
    try {
      const restarted = await flareSolverr.forceRestart();
      // Emit WebSocket event for real-time sync
      void realtimeEmitter.emitSystemEvent({
        eventType: 'flaresolverr:restarted',
        source: 'flaresolverr-router',
        message: restarted ? 'FlareSolverr restarted successfully' : 'FlareSolverr restart attempted',
        data: { success: restarted },
      });
      return {
        success: restarted,
        message: restarted
          ? 'FlareSolverr restarted successfully'
          : 'Failed to restart FlareSolverr',
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('[FlareSolverr] Restart failed', { error: errorMessage });
      return {
        success: false,
        message: `Restart failed: ${errorMessage}`,
      };
    }
  }),

  // =========================================================================
  // Binary Management Procedures (flaresolverr-go)
  // =========================================================================

  /**
   * Get flaresolverr-go binary information
   */
  getBinaryInfo: protectedProcedure.query(async (): Promise<{
    installed: boolean;
    path: string | null;
    version: string | null;
    platform: string;
    arch: string;
    updateAvailable: boolean;
    latestVersion: string | null;
  }> => {
    const info = await getBinaryInfo();
    return {
      installed: info.installed,
      path: info.path,
      version: info.version,
      platform: info.platform,
      arch: info.arch,
      updateAvailable: info.updateAvailable,
      latestVersion: info.latestVersion,
    };
  }),

  /**
   * Update flaresolverr-go binary to latest version
   */
  updateBinary: adminProcedure.mutation(async (): Promise<{
    success: boolean;
    message: string;
    version?: string;
  }> => {
    try {
      logger.info('[FlareSolverr] Updating binary to latest version');

      // Stop running instance first
      const isRunning = await flareSolverr.isRunning();
      if (isRunning) {
        await flareSolverr.stop();
      }

      const success = await updateBinaryFromGithub();

      if (success) {
        // Get the new version info
        const info = await getBinaryInfo();

        // Emit WebSocket event for real-time sync
        void realtimeEmitter.emitSystemEvent({
          eventType: 'flaresolverr:binaryUpdated',
          source: 'flaresolverr-router',
          message: `Binary updated to ${info.version ?? 'latest'}`,
          data: { version: info.version },
        });

        // Restart if it was running before
        if (isRunning) {
          await flareSolverr.start();
        }

        const result: { success: boolean; message: string; version?: string } = {
          success: true,
          message: 'Binary updated successfully',
        };
        if (info.version) {
          result.version = info.version;
        }
        return result;
      }

      return {
        success: false,
        message: 'Binary update failed',
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('[FlareSolverr] Binary update failed', { error: errorMessage });
      return {
        success: false,
        message: `Update failed: ${errorMessage}`,
      };
    }
  }),

  /**
   * Check Chrome/Chromium installation status
   */
  checkChrome: protectedProcedure.query((): {
    installed: boolean;
    path: string | null;
    version: string | null;
    browser: 'chrome' | 'chromium' | null;
    works: boolean;
  } => {
    const info = getChromeInfo();
    const works = info.installed ? verifyChromeWorks() : false;

    return {
      installed: info.installed,
      path: info.path,
      version: info.version,
      browser: info.browser,
      works,
    };
  }),

  /**
   * Get FlareSolverr internal logs.
   *
   * Reads up to the last ~1MB of the log file (rather than the whole thing)
   * before splitting and slicing — the dashboard polls every 10s and the log
   * file has no rotation, so a naive readFileSync was unbounded.
   */
  getLogs: protectedProcedure
    .input(z.object({ lines: z.number().int().min(10).max(1000).default(100) }).optional())
    .query(({ input }): { logs: string[]; logPath: string; exists: boolean; totalLines: number } => {
      const logPath = getLogFilePath();
      const maxLines = input?.lines ?? 100;
      const TAIL_BYTES = 1024 * 1024; // 1 MB tail window

      if (!fs.existsSync(logPath)) {
        return { logs: [], logPath, exists: false, totalLines: 0 };
      }

      try {
        const stat = fs.statSync(logPath);
        const startOffset = Math.max(0, stat.size - TAIL_BYTES);
        const truncated = startOffset > 0;

        const fd = fs.openSync(logPath, 'r');
        try {
          const buf = Buffer.alloc(stat.size - startOffset);
          fs.readSync(fd, buf, 0, buf.length, startOffset);
          const content = buf.toString('utf-8');
          // If we started mid-file, drop the leading partial line.
          const lines = content.split('\n').filter((line) => line.trim() !== '');
          const usable = truncated ? lines.slice(1) : lines;
          const logs = usable.slice(-maxLines);
          return { logs, logPath, exists: true, totalLines: usable.length };
        } finally {
          fs.closeSync(fd);
        }
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error('[FlareSolverr] Failed to read logs', { error: errorMessage });
        return { logs: [], logPath, exists: true, totalLines: 0 };
      }
    }),

  /**
   * Clear FlareSolverr log file
   */
  clearLogs: adminProcedure.mutation((): { success: boolean; message: string } => {
    const logPath = getLogFilePath();
    if (!fs.existsSync(logPath)) {
      return { success: true, message: 'Log file does not exist' };
    }
    try {
      fs.writeFileSync(logPath, '', 'utf-8');
      logger.info('[FlareSolverr] Log file cleared');
      return { success: true, message: 'Log file cleared successfully' };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('[FlareSolverr] Failed to clear logs', { error: errorMessage });
      return { success: false, message: `Failed to clear logs: ${errorMessage}` };
    }
  }),

  // =========================================================================
  // Metrics procedures live in `./flaresolverr-metrics.ts` and are spread
  // into this router so client call sites stay flat
  // (`trpc.flaresolverr.getRecentMetrics`, etc.).
  // =========================================================================
  ...flareSolverrMetricsProcedures,
});
