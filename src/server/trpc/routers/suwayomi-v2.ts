/**
 * Suwayomi V2 Router - GraphQL-based Suwayomi Integration
 *
 * This router provides a GraphQL-first interface to the Suwayomi server,
 * replacing the REST-based polling approach with real-time subscriptions.
 *
 * Features:
 * - Server lifecycle management (start, stop, install)
 * - Source and extension management
 * - Multi-source manga search
 * - Chapter fetching with pagination
 * - Native download queue management via GraphQL
 * - Real-time progress via subscriptions
 *
 * @module server/trpc/routers/suwayomi-v2
 */

import { execFile } from 'child_process';
import * as path from 'path';
import { promisify } from 'util';

import { ConfigSource } from '@prisma/client';
import { z } from 'zod';

import {
  getSuwayomiSourceAdapter,
  type SuwayomiSourceAdapter,
} from '@/server/adapters/suwayomi/SuwayomiSourceAdapter';
import { flareSolverrConfigService } from '@/server/services/flaresolverr/configService';
import { suwayomiService } from '@/server/services/suwayomi/service';
import { isSuccess, isError } from '@/utils/async-result';
import { logger } from '@/utils/logging';

import { protectedProcedure, publicProcedure } from '../procedures';
import { router } from '../trpc';

// SECURITY: Use execFile instead of exec to prevent command injection
const execFileAsync = promisify(execFile);

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Get the configured Suwayomi adapter
 */
function getAdapter(): SuwayomiSourceAdapter {
  return getSuwayomiSourceAdapter({
    enabled: true,
    host: process.env['SUWAYOMI_HOST'] ?? 'localhost',
    port: parseInt(process.env['SUWAYOMI_PORT'] ?? '4567', 10),
    useGraphQL: true,
  });
}

/**
 * Ensure server is running before operations.
 *
 * Probes the health endpoint first; if the JVM is down AND the integration
 * is enabled, attempts a synchronous restart via the supervisor before
 * returning. Bounded by the supervisor's crash-loop guard.
 */
async function ensureServerRunning(): Promise<boolean> {
  return suwayomiService.ensureServerRunningOrRestart();
}

// =============================================================================
// Input Schemas
// =============================================================================

const chapterIdSchema = z.object({
  chapterId: z.number(),
});

const extensionIdSchema = z.object({
  pkgName: z.string(),
});

// =============================================================================
// Router Definition
// =============================================================================

/**
 * Suwayomi V2 Router
 *
 * GraphQL-based router for Suwayomi server integration.
 * Provides improved performance via subscriptions and native queue management.
 */
export const suwayomiV2Router = router({
  // ===========================================================================
  // Server Lifecycle
  // ===========================================================================

  /**
   * Check if Java is installed
   */
  checkJava: publicProcedure.query(async () => {
    try {
      const status = await suwayomiService.getJavaStatus();
      return { available: status.available, version: status.version };
    } catch (error) {
      logger.error('Error checking Java', { error });
      return { available: false, version: null };
    }
  }),

  /**
   * Check if Suwayomi server is running
   */
  isServerRunning: publicProcedure.query(async () => {
    try {
      return await suwayomiService.isServerRunning();
    } catch (error) {
      logger.error('Error checking server status', { error });
      return false;
    }
  }),

  /**
   * Start the Suwayomi server
   */
  startServer: protectedProcedure.mutation(async () => {
    try {
      const started = await suwayomiService.startServer();
      if (started) {
        // Kick off catalog scrape in the background so the Extensions tab
        // renders instantly once the user navigates to it.
        void suwayomiService.prefetchExtensionCatalog();
      }
      return started;
    } catch (error) {
      logger.error('Error starting server', { error });
      return false;
    }
  }),

  /**
   * Stop the Suwayomi server
   */
  stopServer: protectedProcedure.mutation(async () => {
    try {
      return await suwayomiService.stopServer();
    } catch (error) {
      logger.error('Error stopping server', { error });
      return false;
    }
  }),

  /**
   * Install the Suwayomi server
   */
  installServer: protectedProcedure.mutation(async () => {
    try {
      const scriptPath = path.join(process.cwd(), 'scripts', 'install-suwayomi.mjs');
      const normalizedPath = path.normalize(scriptPath);
      const projectRoot = path.normalize(process.cwd());

      // Path traversal protection
      if (!normalizedPath.startsWith(projectRoot)) {
        logger.error('Invalid script path detected');
        return false;
      }

      await execFileAsync('node', [normalizedPath]);
      return true;
    } catch (error) {
      logger.error('Error installing server', { error });
      return false;
    }
  }),

  /**
   * Get server running status
   */
  getServerStatus: publicProcedure.query(async () => {
    const isRunning = await suwayomiService.isServerRunning();
    return { isRunning, port: suwayomiService.getPort() };
  }),

  /**
   * Read the dispatch-level Suwayomi enable flag (`suwayomi.enabled`).
   * This controls whether the unified release-search pipeline asks the
   * Suwayomi adapter for chapter candidates — distinct from whether the
   * JVM process is running (which `getServerStatus` reports).
   */
  getIndexerEnabled: publicProcedure.query(async () => {
    const { configService } = await import('@/server/services/config/configService');
    if (!configService.isInitialized()) await configService.initialize();
    const value = (await configService.get<boolean>('suwayomi.enabled') as boolean | null) ?? false;
    return { enabled: value };
  }),

  /**
   * Toggle whether the unified release-search pipeline asks Suwayomi for
   * chapter candidates. Persists to `suwayomi.enabled` in the Config table.
   * The JVM lifecycle is independent — turning this off doesn't stop the
   * server, just stops the dispatcher from calling it.
   */
  setIndexerEnabled: protectedProcedure
    .input(z.object({ enabled: z.boolean() }))
    .mutation(async ({ input }) => {
      const { configService } = await import('@/server/services/config/configService');
      if (!configService.isInitialized()) await configService.initialize();
      await configService.set('suwayomi.enabled', input.enabled, { source: ConfigSource.DATABASE });

      // publicProcedure caches query results for 30s; invalidate the
      // companion getIndexerEnabled cache entries so the UI's refetch
      // sees the new value immediately instead of the stale previous one.
      const { cache } = await import('@/server/cache/cache-adapter');
      await cache.clear('trpc:suwayomiV2.getIndexerEnabled:*');

      logger.info('[suwayomiV2] suwayomi.enabled set', { enabled: input.enabled });

      // When the user enables Suwayomi mid-session, kick off the JVM in the
      // background so they don't have to also click Start. Fire-and-forget;
      // the UI's status poll will pick up the running state. Disabling does
      // NOT auto-stop — turning the dispatcher gate off shouldn't kill the
      // JVM that other code paths might still be using.
      if (input.enabled) {
        const isRunning = await suwayomiService.isServerRunning();
        if (!isRunning) {
          logger.info('[suwayomiV2] Indexer enabled and server is down; starting JVM');
          void suwayomiService.startServer().catch((err: unknown) => {
            const errorMessage = err instanceof Error ? err.message : String(err);
            logger.warn('[suwayomiV2] Auto-start after enable failed', { error: errorMessage });
          });
        }
      }

      return { enabled: input.enabled };
    }),

  // ===========================================================================
  // Source Management
  // ===========================================================================

  /**
   * Get all installed sources
   */
  getSources: publicProcedure.query(async () => {
    if (!(await ensureServerRunning())) {
      return { sources: [], error: 'Server not running' };
    }

    const adapter = getAdapter();
    const result = await adapter.getSources();

    if (isError(result)) {
      return { sources: [], error: result.error.message };
    }

    if (!isSuccess(result)) {
      return { sources: [], error: null };
    }

    return { sources: result.data, error: null };
  }),

  /**
   * Get all extensions (installed and available)
   */
  getExtensions: publicProcedure.query(async () => {
    if (!(await ensureServerRunning())) {
      return { extensions: [], error: 'Server not running' };
    }

    const adapter = getAdapter();
    const result = await adapter.getExtensions();

    if (isError(result)) {
      return { extensions: [], error: result.error.message };
    }

    if (!isSuccess(result)) {
      return { extensions: [], error: null };
    }

    return { extensions: result.data, error: null };
  }),

  /**
   * Install an extension
   */
  installExtension: protectedProcedure
    .input(extensionIdSchema)
    .mutation(async ({ input }) => {
      if (!(await ensureServerRunning())) {
        return { success: false, error: 'Server not running' };
      }

      const adapter = getAdapter();
      const result = await adapter.installExtension(input.pkgName);

      if (isError(result)) {
        return { success: false, error: result.error.message };
      }

      if (!isSuccess(result)) {
        return { success: false, error: null };
      }

      return { success: result.data, error: null };
    }),

  /**
   * Uninstall an extension
   */
  uninstallExtension: protectedProcedure
    .input(extensionIdSchema)
    .mutation(async ({ input }) => {
      if (!(await ensureServerRunning())) {
        return { success: false, error: 'Server not running' };
      }

      const adapter = getAdapter();
      const result = await adapter.uninstallExtension(input.pkgName);

      if (isError(result)) {
        return { success: false, error: result.error.message };
      }

      if (!isSuccess(result)) {
        return { success: false, error: null };
      }

      return { success: result.data, error: null };
    }),

  getChapterPages: publicProcedure
    .input(chapterIdSchema)
    .query(async ({ input }) => {
      if (!(await ensureServerRunning())) {
        return { pages: [], error: 'Server not running' };
      }

      const adapter = getAdapter();
      const result = await adapter.getChapterPages(input.chapterId);

      if (isError(result)) {
        return { pages: [], error: result.error.message };
      }

      if (!isSuccess(result)) {
        return { pages: [], error: null };
      }

      return { pages: result.data, error: null };
    }),

  /**
   * Single roll-up call for the Extensions-tab status row: server health,
   * keiyoushi catalog presence (any installed extensions known), and
   * FlareSolverr availability.
   */
  getInfrastructureStatus: publicProcedure.query(async () => {
    const isRunning = await suwayomiService.isServerRunning();
    let catalogConfigured = false;
    let extensionCount = 0;
    if (isRunning) {
      const adapter = getAdapter();
      const result = await adapter.getExtensions();
      if (isSuccess(result)) {
        extensionCount = result.data.length;
        catalogConfigured = extensionCount > 0;
      }
    }
    const flareSolverrEnabled = await flareSolverrConfigService.isEnabled();
    return { isRunning, catalogConfigured, extensionCount, flareSolverrEnabled };
  }),

});

// Export the router type
export type SuwayomiV2Router = typeof suwayomiV2Router;
