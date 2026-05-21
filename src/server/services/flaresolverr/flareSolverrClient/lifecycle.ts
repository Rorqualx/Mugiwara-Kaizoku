/**
 * FlareSolverr Lifecycle Management
 *
 * Process lifecycle management for flaresolverr-go including
 * start, stop, restart, and health checking.
 *
 * Now delegates to ProcessManager for proper lifecycle management.
 *
 * @module flaresolverr/flareSolverrClient/lifecycle
 */

import { logger } from '@/utils/logger';

import { processManager } from '../process-manager';

/**
 * Promise-based delay helper
 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/**
 * Get the current FlareSolverr process ID
 * @deprecated Use processManager.getState() instead
 */
export function getPid(): number | null {
  const state = processManager.getState();
  return state.pid;
}

/**
 * Check if FlareSolverr process is running by PID
 * @deprecated Use processManager.isRunning() instead
 */
export function isProcessRunning(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if the internal FlareSolverr instance is currently running
 */
export function checkIsRunning(): boolean {
  return processManager.isRunning();
}

/**
 * Stop the FlareSolverr process
 *
 * Delegates to ProcessManager for proper process group cleanup.
 */
export async function stopFlareSolverr(): Promise<boolean> {
  logger.info('[FlareSolverr] Attempting to stop FlareSolverr via ProcessManager');

  try {
    const result = await processManager.shutdown({ graceful: true, timeoutMs: 5000 });
    if (result) {
      logger.info('[FlareSolverr] Process stopped successfully');
    }
    return result;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('[FlareSolverr] Error stopping process', { error: errorMessage });
    return false;
  }
}

/**
 * Start FlareSolverr using the Go binary
 *
 * Delegates to ProcessManager for proper lifecycle management.
 *
 * @param configUrl The configured FlareSolverr URL (used to extract port)
 */
export async function startFlareSolverr(configUrl: string): Promise<boolean> {
  logger.info('[FlareSolverr] Attempting to start FlareSolverr via ProcessManager');

  try {
    const port = parseInt(new URL(configUrl).port, 10) || 8191;

    const result = await processManager.spawn({
      port,
      headless: true,
      browserPoolSize: 1,
    });

    if (!result.success) {
      logger.error('[FlareSolverr] Failed to launch', { error: result.error });
      return false;
    }

    logger.info('[FlareSolverr] Process launched', { pid: result.pid, pgid: result.pgid });

    // Wait for service to stabilize
    await delay(3000);
    return true;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('[FlareSolverr] Failed to start', { error: errorMessage });
    return false;
  }
}
