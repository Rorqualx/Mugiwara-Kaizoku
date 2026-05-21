/**
 * Server Shutdown Module
 *
 * Centralized graceful shutdown handler. ALL shutdown logic lives here —
 * no other module should register SIGTERM/SIGINT handlers.
 *
 * Shutdown phases (ordered):
 * 1. Stop all schedulers (prevent new work)
 * 2. Close HTTP server (stop accepting connections)
 * 3. Drain queue workers via queueManager.shutdown()
 * 4. Mark orphaned pending jobs as failed
 * 5. Stop external services (Suwayomi, FlareSolverr)
 * 6. Flush logs + disconnect database
 */


import { JobStatus } from '@prisma/client';

import { db, prisma } from '@/server/db';
import { autoDownloadScheduler } from '@/server/queue/autoDownloadScheduler';
import { calendarMaintenanceScheduler } from '@/server/queue/calendar/CalendarMaintenanceScheduler';
import { calendarSyncScheduler } from '@/server/queue/calendar/CalendarSyncScheduler';
import { downloadMonitorScheduler } from '@/server/queue/downloadMonitorScheduler';
import { queueManager } from '@/server/queue/index';
import { providerReleaseService } from '@/server/services/calendar/ProviderReleaseService';
import { stopNativeDownloadWorker } from '@/server/services/downloads/NativeDownloadWorker';
import { imageCacheCleanupService } from '@/server/services/image-cache/ImageCacheCleanupService';
import { suwayomiService } from '@/server/services/suwayomi/service';
import { logger } from '@/utils/logger';
import { cleanup as cleanupLogger } from '@/utils/serverLogger/stream-registry';


import { formatError } from './error-utils';
import { stopBackupScheduler } from './initializers/backup-initializer';
import { stopConversionSystem } from './initializers/conversion-initializer';
import { shutdownFlareSolverr } from './initializers/flaresolverr-initializer';

import type * as express from 'express';
import type { Server } from 'http';

// ============================================================================
// HTTP Server Registration
// ============================================================================

let httpServer: Server | null = null;

/**
 * Register the HTTP server for graceful close during shutdown.
 * Call this once after createServer().
 */
export function registerHttpServer(server: Server): void {
  httpServer = server;
}

// ============================================================================
// Shutdown Phase Functions
// ============================================================================

/** Phase 1: Stop all schedulers to prevent new work */
async function stopAllSchedulers(): Promise<void> {
  logger.info('Shutdown phase 1: Stopping schedulers...');
  stopBackupScheduler();
  autoDownloadScheduler.stop();
  downloadMonitorScheduler.stop();
  await calendarSyncScheduler.stop();
  await calendarMaintenanceScheduler.stop();
  stopNativeDownloadWorker();
  await stopConversionSystem();
  imageCacheCleanupService.stop();
  providerReleaseService.dispose();
  logger.info('All schedulers stopped');
}

/** Phase 1.5: Close WebSocket connections */
async function closeWebSocketConnections(): Promise<void> {
  logger.info('Shutdown phase 1.5: Closing WebSocket connections...');
  try {
    const { shutdownWebSocket } = await import('./websocket-setup');
    shutdownWebSocket();
    logger.info('WebSocket connections closed');
  } catch {
    // Non-critical — WebSocket may not have been initialized
  }
}

/** Phase 2: Close HTTP server to stop accepting connections */
async function closeHttpServer(): Promise<void> {
  if (!httpServer) return;

  logger.info('Shutdown phase 2: Closing HTTP server...');
  await new Promise<void>((resolve) => {
    httpServer?.close(() => { resolve(); });
    setTimeout(resolve, 5_000);
  });
  logger.info('HTTP server closed');
}

/** Phase 3: Drain queue workers */
async function drainQueueWorkers(): Promise<void> {
  logger.info('Shutdown phase 3: Draining queue workers...');
  const stats = await queueManager.getQueueStats();
  logger.info(`Queue stats before shutdown: ${JSON.stringify(stats)}`);
  await queueManager.shutdown();
  logger.info('Queue workers drained');
}

/** Phase 4: Mark orphaned pending jobs as failed */
async function markOrphanedJobs(): Promise<void> {
  logger.info('Shutdown phase 4: Marking orphaned jobs...');
  const pendingJobs = await prisma.jobs.findMany({
    where: { status: JobStatus.pending }
  });

  await Promise.allSettled(
    pendingJobs.map(job =>
      prisma.jobs.update({
        where: {
          id_partition_key: {
            id: job["id"],
            partition_key: job.partition_key
          }
        },
        data: {
          status: JobStatus.failed,
          last_error: { message: 'Server shutdown' }
        }
      })
    )
  );
}

/** Phase 5: Stop external services (Suwayomi, FlareSolverr) */
async function stopExternalServices(): Promise<void> {
  logger.info('Shutdown phase 5: Stopping external services...');
  try {
    const stopped = await suwayomiService.stopServer();
    logger.info(stopped
      ? 'Suwayomi server stopped successfully'
      : 'Suwayomi server may not have stopped cleanly');
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    logger.error(`Error stopping Suwayomi server: ${formatError(msg)}`);
  }

  try {
    await shutdownFlareSolverr();
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    logger.error(`Error stopping FlareSolverr: ${formatError(msg)}`);
  }
}

/** Phase 6: Flush logs and disconnect database */
async function flushAndDisconnect(): Promise<void> {
  logger.info('Shutdown phase 6: Flushing logs and disconnecting database...');
  try {
    cleanupLogger();
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    process.stderr.write(`Error flushing log streams: ${msg}\n`);
  }

  await db.disconnect();
  logger.info('Cleanup completed successfully');
}

// ============================================================================
// Cleanup Operations
// ============================================================================

/**
 * Performs all cleanup operations before server shutdown in ordered phases.
 */
export async function cleanup(): Promise<void> {
  try {
    await stopAllSchedulers();
    await closeWebSocketConnections();
    await closeHttpServer();
    await drainQueueWorkers();
    await markOrphanedJobs();
    await stopExternalServices();
    await flushAndDisconnect();
  } catch (error: unknown) {
    logger.error(`Error during cleanup: ${formatError((error instanceof Error ? error.message : String(error)))}`);
  }
}

// ============================================================================
// Graceful Shutdown
// ============================================================================

let cleanupInProgress = false;

/**
 * Handles graceful shutdown on receiving termination signals
 */
export async function gracefulShutdown(signal: string): Promise<void> {
  if (cleanupInProgress) {
    logger.info(`${signal} received but cleanup already in progress`);
    return;
  }

  cleanupInProgress = true;
  logger.info(`${signal} received. Starting graceful shutdown...`);

  try {
    await cleanup();
    logger.info('Graceful shutdown completed');
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Error during graceful shutdown: ${formatError(errorMessage)}`);
  } finally {
    process.exit(0);
  }
}

/**
 * Registers process signal handlers for graceful shutdown.
 * This is the ONLY place signal handlers should be registered.
 */
/**
 * Operational errors that should NOT take the server down.
 *
 * These represent transient/race conditions that escape a missing `.catch()`
 * somewhere — far better to log and keep serving than to graceful-shutdown
 * the whole process. Genuinely fatal classes (OOM, pool exhaustion, anything
 * unrecognized) still trigger shutdown.
 *
 * - Prisma P2025/P2002/P2003/P2034: row-not-found, unique/FK conflicts,
 *   transaction conflicts — all "the data moved under me" races
 * - AbortError / ABORT_ERR: AbortController cancellations
 * - ETIMEDOUT/ECONNRESET/ECONNREFUSED/EPIPE: external network blips
 */
const OPERATIONAL_PRISMA_CODES = new Set(['P2025', 'P2002', 'P2003', 'P2034']);
const OPERATIONAL_SYSTEM_CODES = new Set([
  'ETIMEDOUT', 'ECONNRESET', 'ECONNREFUSED', 'EPIPE', 'ABORT_ERR',
]);

function isOperationalError(reason: unknown): boolean {
  if (!reason || typeof reason !== 'object') return false;
  const err = reason as { name?: unknown; code?: unknown };
  if (err.name === 'AbortError') return true;
  if (typeof err.code === 'string') {
    if (OPERATIONAL_PRISMA_CODES.has(err.code)) return true;
    if (OPERATIONAL_SYSTEM_CODES.has(err.code)) return true;
  }
  return false;
}

function describeReason(reason: unknown): string {
  if (reason instanceof Error) {
    const code = (reason as { code?: unknown }).code;
    return code ? `${reason.name}[${String(code)}]: ${reason.message}` : `${reason.name}: ${reason.message}`;
  }
  return String(reason);
}

export function registerShutdownHandlers(): void {
  process.on('SIGTERM', () => { void gracefulShutdown('SIGTERM'); });
  process.on('SIGINT', () => { void gracefulShutdown('SIGINT'); });
  process.on('SIGHUP', () => { void gracefulShutdown('SIGHUP'); });

  process.on('uncaughtException', (error) => {
    if (isOperationalError(error)) {
      logger.warn(`Operational uncaught exception (continuing): ${describeReason(error)}`);
      return;
    }
    logger.error(`Uncaught exception: ${formatError(error)}`);
    void gracefulShutdown('uncaughtException');
  });

  process.on('unhandledRejection', (reason, promise) => {
    if (isOperationalError(reason)) {
      logger.warn(`Operational unhandled rejection (continuing): ${describeReason(reason)}`);
      return;
    }
    logger.error(`Unhandled rejection at ${promise}: ${reason}`);
    void gracefulShutdown('unhandledRejection');
  });
}

/**
 * Express error handling middleware
 */
export function errorHandlingMiddleware(
  err: Error,
  _req: express.Request,
  res: express.Response,
  _next: express.NextFunction
): void {
  logger.error(`Unhandled error: ${formatError(err)}`);
  res["status"](500).json({ error: 'Internal server error' });
}
