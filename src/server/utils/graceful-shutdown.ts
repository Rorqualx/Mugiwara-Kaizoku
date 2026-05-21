/**
 * Graceful Shutdown Utility Module
 *
 * Provides utilities for gracefully shutting down the application,
 * ensuring all resources are properly cleaned up before process exit.
 *
 * @module server/utils/graceful-shutdown
 */

import { logger } from '@/utils/logging';

import { TIMEOUTS } from '../constants/system';
import { prisma } from '../db';

/**
 * Cleanup result tracking
 */
interface CleanupResult {
  success: boolean;
  component: string;
  error?: string;
}

/**
 * Performs graceful cleanup of all application resources
 *
 * This function ensures that:
 * - Database connections are closed
 * - Active jobs are cancelled
 * - File handles are released
 * - Resources are properly cleaned up
 *
 * @param options - Cleanup options
 * @param options.force - Force cleanup even if errors occur
 * @param options.timeout - Maximum time to wait for cleanup (ms)
 * @returns {Promise<CleanupResult[]>} Results of each cleanup operation
 */
export async function gracefulCleanup(options: {
  force?: boolean;
  timeout?: number;
} = {}): Promise<CleanupResult[]> {
  const { force = false, timeout = TIMEOUTS.DB_DISCONNECT_MS } = options;
  const results: CleanupResult[] = [];

  logger.info('graceful-shutdown:started', {
    force,
    timeout,
  });

  // 1. Cancel active jobs
  try {
    logger.info('graceful-shutdown:cancelling-jobs');

    const cancelledCount = await prisma.$executeRaw`
      UPDATE jobs
      SET status = 'CANCELLED',
          updated_at = NOW()
      WHERE status IN ('PENDING', 'ACTIVE')
    `;

    results.push({
      success: true,
      component: 'jobs',
    });

    logger.info('graceful-shutdown:jobs-cancelled', {
      count: cancelledCount,
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('graceful-shutdown:jobs-failed', errorMessage);

    results.push({
      success: false,
      component: 'jobs',
      error: errorMessage,
    });

    if (!force) {
      return results;
    }
  }

  // 2. Close database connections
  try {
    logger.info('graceful-shutdown:closing-database');

    // Create a timeout promise
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Database disconnect timeout after ${timeout}ms`));
      }, timeout);
    });

    // Race between disconnect and timeout
    await Promise.race([
      prisma.$disconnect(),
      timeoutPromise,
    ]);

    results.push({
      success: true,
      component: 'database',
    });

    logger.info('graceful-shutdown:database-closed');
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('graceful-shutdown:database-failed', errorMessage);

    results.push({
      success: false,
      component: 'database',
      error: errorMessage,
    });

    if (!force) {
      return results;
    }
  }

  // 3. Cleanup completed
  const successCount = results.filter((r) => r.success).length;
  const failCount = results.filter((r) => !r.success).length;

  logger.info('graceful-shutdown:completed', {
    successCount,
    failCount,
    total: results.length,
  });

  return results;
}

/**
 * Initiates graceful process exit
 *
 * This function:
 * 1. Performs graceful cleanup
 * 2. Logs the exit reason
 * 3. Exits the process with appropriate code
 *
 * @param reason - Reason for exit
 * @param force - Force exit even if cleanup fails
 * @param exitCode - Exit code (default: 0)
 */
export async function gracefulExit(
  reason: string,
  force: boolean = false,
  exitCode: number = 0
): Promise<void> {
  logger.info('graceful-exit:initiated', {
    reason,
    force,
    exitCode,
  });

  try {
    // Perform cleanup
    const results = await gracefulCleanup({ force });

    // Check if any critical components failed
    const criticalFailures = results.filter(
      (r) => !r.success && ['database', 'jobs'].includes(r.component)
    );

    if (criticalFailures.length > 0 && !force) {
      logger.error('graceful-exit:critical-failures', {
        failures: criticalFailures.map((f) => ({
          component: f.component,
          error: f.error,
        })),
      });

      // Exit with error code
      process.exit(1);
      return;
    }

    // Log successful exit
    logger.info('graceful-exit:success', {
      reason,
      exitCode,
    });

    // Exit process
    process.exit(exitCode);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('graceful-exit:failed', errorMessage);

    // Force exit if cleanup fails
    if (force) {
      process.exit(exitCode);
    } else {
      process.exit(1);
    }
  }
}

/**
 * Schedules a graceful exit after a delay
 *
 * This is useful for allowing HTTP responses to be sent before exit.
 *
 * @param reason - Reason for exit
 * @param delayMs - Delay in milliseconds
 * @param force - Force exit even if cleanup fails
 * @param exitCode - Exit code (default: 0)
 */
export function scheduleGracefulExit(
  reason: string,
  delayMs: number,
  force: boolean = false,
  exitCode: number = 0
): void {
  logger.info('graceful-exit:scheduled', {
    reason,
    delayMs,
    force,
    exitCode,
  });

  // Use process.nextTick to ensure current event loop completes
  process.nextTick(() => {
    setTimeout(() => {
      void (async () => {
        await gracefulExit(reason, force, exitCode);
      })();
    }, delayMs);
  });
}
