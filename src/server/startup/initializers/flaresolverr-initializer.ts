/**
 * FlareSolverr Initializer Module
 *
 * Single boot-time entry point for the FlareSolverr Cloudflare bypass service.
 * Delegates to `bootstrapFlareSolverr` in the singleton, which handles binary
 * download, orphan cleanup, shutdown handlers, DB-driven autostart, and
 * version compatibility checks.
 */

import { bootstrapFlareSolverr, flareSolverr } from '@/server/services/flaresolverr';
import { logger } from '@/utils/logger';

import { formatError } from '../error-utils';

/**
 * Initializes the FlareSolverr service at app boot.
 *
 * Loads configuration from the database (so the UI's `autoStart` setting is
 * respected), downloads the flaresolverr-go binary if missing, cleans up
 * orphaned processes from prior runs, and starts the binary when autoStart is
 * enabled.
 */
export async function initializeFlareSolverr(): Promise<void> {
  try {
    await bootstrapFlareSolverr({ loadFromDatabase: true });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Error initializing FlareSolverr: ${formatError(errorMessage)}`);
    // Don't throw - FlareSolverr is optional and other services should continue
  }
}

/**
 * Shuts down the FlareSolverr service.
 *
 * Destroys all active sessions and stops the FlareSolverr binary if it was
 * started by the app.
 */
export async function shutdownFlareSolverr(): Promise<void> {
  try {
    logger.info('Shutting down FlareSolverr service...');
    await flareSolverr.shutdown();
    logger.info('FlareSolverr shutdown completed');
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Error shutting down FlareSolverr: ${formatError(errorMessage)}`);
  }
}
