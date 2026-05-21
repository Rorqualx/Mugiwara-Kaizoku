/**
 * Main Server Module
 *
 * This module initializes and configures the main application server, integrating:
 * - Next.js for server-side rendering
 * - tRPC for type-safe API endpoints
 * - Express middleware and error handling
 * - Backup scheduling system
 * - Suwayomi manga server integration
 * - Search provider initialization
 * - Graceful shutdown handling (centralized in server-shutdown.ts)
 *
 * Refactored from monolithic 693-line file into focused modules.
 *
 * @module server
 */

import { createServer } from 'http';

import * as express from 'express';

import { env } from '@/env/server';
import { logger } from '@/utils/logger';

import { validateEnvironmentSecrets } from './env-validation';
import { queueManager } from './queue/index';
import { initializeEventsSystem } from './services/events/initialize';
import { initializeBackupScheduler } from './startup/initializers/backup-initializer';
import { initializeConfigSystem } from './startup/initializers/config-initializer';
import { initializeConversionSystem } from './startup/initializers/conversion-initializer';
import { initializeFlareSolverr } from './startup/initializers/flaresolverr-initializer';
import { initializePathMappings } from './startup/initializers/path-mappings-initializer';
import {
  initializeProviderReleaseService,
  initializeSearchProvidersAndServices
} from './startup/initializers/providers-initializer';
import {
  initializeAutoDownloadScheduler,
  initializeCalendarSyncScheduler,
  initializeCalendarMaintenanceScheduler,
  initializeDownloadMonitorScheduler,
  initializeNativeDownloadWorker,
  initializeImageCacheCleanupService
} from './startup/initializers/schedulers-initializer';
import { ensureDatabaseSchema } from './startup/initializers/schema-ensurer';
import { initializeSuwayomi } from './startup/initializers/suwayomi-initializer';
import { initializePipelineEventBus } from './startup/pipeline-setup';
import {
  registerShutdownHandlers,
  registerHttpServer,
  errorHandlingMiddleware
} from './startup/server-shutdown';
import { app, port, nextApp, nextHandler, formatError } from './startup/server-utils';
import { setupWebSocket } from './startup/websocket-setup';

// ============================================================================
// Startup Timeout Helper
// ============================================================================

/**
 * Wraps a non-critical initializer with a timeout.
 * If the initializer hangs, logs a warning and continues startup.
 */
async function withStartupTimeout<T>(
  fn: () => T | Promise<T>,
  name: string,
  timeoutMs = 30_000
): Promise<T | undefined> {
  try {
    const result = await Promise.race([
      Promise.resolve(fn()),
      new Promise<never>((_resolve, reject) => {
        setTimeout(
          () => { reject(new Error(`Startup timeout: ${name} did not complete within ${timeoutMs}ms`)); },
          timeoutMs
        );
      })
    ]);
    return result;
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    logger.warn(`Non-critical initializer failed: ${name} — ${msg}`);
    return undefined;
  }
}

// ============================================================================
// Server Startup
// ============================================================================

/**
 * Starts the application server
 *
 * Critical services (no timeout — fail startup):
 *   nextApp.prepare, initializeConfigSystem, initializeEventsSystem,
 *   queueManager.initialize, queueManager.createWorker
 *
 * Non-critical services (timeout — log warning, continue):
 *   All schedulers, external services, and optional subsystems
 */
async function startServer(): Promise<void> {
  try {
    // Prevent WebSocket service singleton from auto-creating when lazily imported
    process.env['CUSTOM_PRODUCTION_SERVER'] = 'true';

    logger.info(`Starting server in ${env['NODE_ENV']} mode`);
    logger.info(`Docker environment: ${process.env['DOCKER'] === 'true' ? 'Yes' : 'No'}`);

    // SECURITY: Validate environment secrets before starting server (OWASP A02:2021)
    validateEnvironmentSecrets();

    // ── Critical: Must succeed or startup fails ──────────────────────
    await nextApp.prepare();
    await ensureDatabaseSchema();
    await initializeConfigSystem();
    await initializeEventsSystem();

    logger.info('Initializing queue manager...');
    await queueManager.initialize();

    logger.info('Starting queue worker...');
    await queueManager.createWorker('main-worker', {
      queueNames: ['default'],
      batchSize: 10,
      maxConcurrency: 3
    });
    logger.info('Queue manager initialized successfully');

    // ── Non-critical: Timeout and continue if hung ───────────────────
    await withStartupTimeout(initializeBackupScheduler, 'BackupScheduler', 15_000);
    await withStartupTimeout(initializePathMappings, 'PathMappings', 10_000);
    await withStartupTimeout(initializeSuwayomi, 'Suwayomi', 30_000);
    await withStartupTimeout(initializeFlareSolverr, 'FlareSolverr', 60_000);
    await withStartupTimeout(initializeSearchProvidersAndServices, 'SearchProviders', 30_000);
    await withStartupTimeout(initializeAutoDownloadScheduler, 'AutoDownloadScheduler', 15_000);
    await withStartupTimeout(initializeProviderReleaseService, 'ProviderReleaseService', 15_000);
    await withStartupTimeout(initializeCalendarSyncScheduler, 'CalendarSyncScheduler', 15_000);
    await withStartupTimeout(initializeCalendarMaintenanceScheduler, 'CalendarMaintenanceScheduler', 15_000);
    await withStartupTimeout(initializeDownloadMonitorScheduler, 'DownloadMonitorScheduler', 15_000);
    await withStartupTimeout(initializeNativeDownloadWorker, 'NativeDownloadWorker', 15_000);
    await withStartupTimeout(initializeImageCacheCleanupService, 'ImageCacheCleanupService', 15_000);
    await withStartupTimeout(initializeConversionSystem, 'ConversionSystem', 30_000);
    await withStartupTimeout(initializePipelineEventBus, 'PipelineEventBus', 5_000);

    // ── HTTP Server Setup ────────────────────────────────────────────
    const server = createServer(app);

    // Initialize WebSocket upgrade handling on the HTTP server
    await withStartupTimeout(() => setupWebSocket(server), 'WebSocket', 15_000);

    // Register HTTP server for graceful shutdown
    registerHttpServer(server);

    // Let Next.js handle ALL routes (including /api/trpc via API routes)
    // tRPC is handled by pages/api/trpc/[trpc].ts which has full NextAuth
    // session support via getServerSession(). Express middleware would break
    // session auth since Express req/res aren't NextApiRequest/NextApiResponse.
    app.all('*', (req: express.Request, res: express.Response) => {
      return nextHandler(req, res);
    });

    // Register centralized shutdown handlers (sole SIGTERM/SIGINT listener)
    registerShutdownHandlers();

    // Register error handling middleware
    app.use(errorHandlingMiddleware);

    // Start server - listen on all interfaces (0.0.0.0)
    server.listen(port, () => {
      logger.info(`Server listening on all interfaces (0.0.0.0) on port ${port}`);
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Failed to start server: ${formatError(errorMessage)}`);
    process.exit(1);
  }
}

// Start server
void startServer();
