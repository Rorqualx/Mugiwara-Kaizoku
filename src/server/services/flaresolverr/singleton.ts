/**
 * FlareSolverr Singleton with Lifecycle Management
 *
 * Provides a global FlareSolverr client instance with initialization
 * and shutdown helpers.
 *
 * Now delegates process management to ProcessManager for:
 * - Process group tracking (complete cleanup including Chrome)
 * - Lock files (prevent multi-instance conflicts)
 * - Validated process operations
 *
 * @module flaresolverr/singleton
 */

import { prisma } from '@/server/db';
import { logger } from '@/utils/logger';

import { ensureBinaryExists, getBinaryInfo, updateBinary } from './binaryManager';
import { isChromiumInstalled } from './chromeChecker';
import { flareSolverrConfigService } from './configService';
import { FlareSolverrClient } from './flareSolverrClient';
import { processManager } from './process-manager';

/** Default FlareSolverr port — from configService (hardcoded default, no env read) */
const FLARESOLVERR_PORT = flareSolverrConfigService.getPort();

/**
 * Global FlareSolverr client instance
 *
 * Usage:
 * ```typescript
 * import { flareSolverr } from '@/server/services/flaresolverr';
 *
 * const html = await flareSolverr.fetch('https://example.com');
 * ```
 */
export const flareSolverr = new FlareSolverrClient();

// Clean up expired sessions periodically (every 5 minutes)
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    flareSolverr.cleanupExpiredSessions();
  }, 5 * 60 * 1000);
}

// ============================================================================
// Process Cleanup (Delegates to ProcessManager)
// ============================================================================

/**
 * Clean up orphaned FlareSolverr processes
 *
 * Delegates to ProcessManager which:
 * 1. Uses lock files to track ownership
 * 2. Validates processes before killing
 * 3. Kills entire process groups (including Chrome)
 *
 * @param options.force - Force kill (SIGKILL) instead of graceful (SIGTERM)
 * @param options.waitMs - Time to wait for process to die (default: 3000ms)
 * @returns Number of processes cleaned up
 */
export async function cleanupOrphanedProcesses(options?: {
  force?: boolean;
  waitMs?: number;
}): Promise<number> {
  const force = options?.force ?? false;

  logger.info('[FlareSolverr] Cleaning up orphaned processes via ProcessManager', { force });

  // Migrate from old PID file format if needed
  processManager.migrateFromOldFormat(FLARESOLVERR_PORT);

  // Delegate to ProcessManager
  return processManager.cleanupOrphans(FLARESOLVERR_PORT, force);
}

// ============================================================================
// Database Configuration Loading
// ============================================================================

/**
 * Load FlareSolverr configuration from database
 * Falls back to environment variables if no database config exists
 * @returns The autoStart setting (true by default)
 */
async function loadConfigFromDatabase(): Promise<{ autoStart: boolean }> {
  try {
    const config = await prisma.flareSolverrConfig.findUnique({
      where: { id: 'default' },
    });

    if (config) {
      logger.info('[FlareSolverr] Loading config from database', {
        enabled: config.enabled,
        autoStart: config.autoStart,
        url: config.url,
        timeout: config.timeout,
        sessionTTL: config.sessionTTL,
        disableMedia: config.disableMedia,
        defaultWaitSecs: config.defaultWaitSecs,
      });

      flareSolverr.updateConfig({
        enabled: config.enabled,
        url: config.url,
        timeout: config.timeout,
        sessionTTL: config.sessionTTL,
        disableMedia: config.disableMedia,
        defaultWaitSeconds: config.defaultWaitSecs,
      });

      return { autoStart: config.autoStart };
    }

    logger.debug('[FlareSolverr] No database config found, using hardcoded defaults');
    return { autoStart: false };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.warn('[FlareSolverr] Failed to load config from database, using hardcoded defaults', {
      error: errorMessage,
    });
    return { autoStart: false };
  }
}

/**
 * Reload configuration from database
 * Can be called when settings are updated via the UI
 * @returns The autoStart setting
 */
export async function reloadConfigFromDatabase(): Promise<{ autoStart: boolean }> {
  const config = await loadConfigFromDatabase();
  await flareSolverr.isHealthy();
  return config;
}

// ============================================================================
// Binary Auto-Update
// ============================================================================

/**
 * Log binary update success
 */
async function logUpdateSuccess(): Promise<void> {
  const newInfo = await getBinaryInfo();
  logger.info('[FlareSolverr] Binary auto-updated successfully', {
    version: newInfo.version,
    platform: newInfo.platform,
    arch: newInfo.arch,
  });
}

/**
 * Handle binary auto-update if available
 */
async function handleBinaryAutoUpdate(info: Awaited<ReturnType<typeof getBinaryInfo>>): Promise<void> {
  if (!info.updateAvailable || !info.latestVersion) {
    return;
  }

  logger.info('[FlareSolverr] Update available, auto-updating binary', {
    currentVersion: info.version,
    latestVersion: info.latestVersion,
  });

  const updateSuccess = await updateBinary();
  if (updateSuccess) {
    await logUpdateSuccess();
  } else {
    logger.warn('[FlareSolverr] Auto-update failed, continuing with current version', {
      version: info.version,
    });
  }
}

/**
 * Ensure binary exists and auto-update if a newer version is available
 * @returns true if binary is ready, false otherwise
 */
async function ensureBinaryWithAutoUpdate(): Promise<boolean> {
  logger.info('[FlareSolverr] Checking flaresolverr-go binary...');

  const binaryPath = await ensureBinaryExists();
  if (!binaryPath) {
    logger.warn('[FlareSolverr] Binary download failed', {
      recommendation: 'Check network connection and try again, or use an external FlareSolverr instance',
    });
    return false;
  }

  const info = await getBinaryInfo();
  await handleBinaryAutoUpdate(info);

  if (!info.updateAvailable) {
    logger.info('[FlareSolverr] Binary ready (up-to-date)', {
      path: binaryPath,
      version: info.version,
      platform: info.platform,
      arch: info.arch,
    });
  }

  return true;
}

/**
 * Check Chrome dependency and log warnings if not available
 */
function checkChromeDependency(): void {
  const chromeAvailable = isChromiumInstalled();
  if (!chromeAvailable) {
    logger.warn('[FlareSolverr] Chrome/Chromium not found - required for flaresolverr-go', {
      macosHint: 'Install Google Chrome from https://www.google.com/chrome/',
      linuxHint: 'Install chromium via your package manager (apt install chromium-browser)',
    });
  } else {
    logger.debug('[FlareSolverr] Chrome/Chromium found - ready for local FlareSolverr');
  }
}

// ============================================================================
// Lifecycle Management
// ============================================================================

/** Whether shutdown handler has been registered */
let shutdownHandlerRegistered = false;

/**
 * Handle crash - synchronous cleanup for uncaught exceptions
 * Uses ProcessManager's cleanupSync for safe process group cleanup
 */
function handleCrash(type: string, error: Error | unknown): void {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorStack = error instanceof Error ? error.stack : undefined;

  // Write to stderr directly for crash handling when logger may be unavailable
  process.stderr.write(`[FlareSolverr] ${type}: ${errorMessage}\n`);
  if (errorStack) {
    process.stderr.write(`${errorStack}\n`);
  }

  processManager.cleanupSync();
}

/**
 * Register process shutdown handlers to stop FlareSolverr
 *
 * This ensures FlareSolverr is stopped when the app exits, including:
 * - Graceful shutdown (SIGINT, SIGTERM)
 * - Process exit (beforeExit, exit)
 * - Crashes (uncaughtException, unhandledRejection)
 *
 * Note: The main server-shutdown.ts also handles shutdown.
 * This provides FlareSolverr-specific handlers for crash recovery.
 */
export function registerShutdownHandler(): void {
  if (shutdownHandlerRegistered) {
    return;
  }

  process.on('exit', (code) => {
    logger.debug('[FlareSolverr] Exit handler triggered', { code });
    // ProcessManager's cleanupSync is idempotent - safe to call multiple times
    processManager.cleanupSync();
  });

  process.on('uncaughtException', (error) => {
    handleCrash('uncaughtException', error);
    throw error;
  });

  process.on('unhandledRejection', (reason) => {
    handleCrash('unhandledRejection', reason);
  });

  shutdownHandlerRegistered = true;
  logger.debug('[FlareSolverr] Shutdown handlers registered (crash handlers only)');
}

// ============================================================================
// Initialization Helpers
// ============================================================================

/**
 * Setup binary and check Chrome dependency
 */
async function setupBinary(): Promise<void> {
  try {
    const binaryReady = await ensureBinaryWithAutoUpdate();
    if (binaryReady) {
      checkChromeDependency();
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.warn('[FlareSolverr] Binary setup skipped', { error: errorMessage });
  }
}

/**
 * Cleanup orphans with error handling
 */
async function cleanupOrphansOnStartup(): Promise<void> {
  try {
    const cleaned = await cleanupOrphanedProcesses({ force: false, waitMs: 2000 });
    if (cleaned > 0) {
      logger.info('[FlareSolverr] Cleaned up orphaned processes from previous run', { count: cleaned });
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.warn('[FlareSolverr] Failed to clean up orphaned processes', { error: errorMessage });
  }
}

/**
 * Bootstrap the FlareSolverr client at app startup.
 *
 * Renamed from `initializeFlareSolverr` to avoid colliding with the public boot
 * entry point in `startup/initializers/flaresolverr-initializer.ts`. That
 * initializer is the single call site for boot; this function should not be
 * called from request paths.
 *
 * @param options.autoStart - Start FlareSolverr if not running (overrides database setting)
 * @param options.registerShutdown - Register shutdown handlers (default: true)
 * @param options.restartIfOutdated - Restart if running an outdated version (default: true)
 * @param options.cleanupOrphans - Clean up orphaned processes on startup (default: true)
 * @param options.loadFromDatabase - Load configuration from database (default: true)
 */
export async function bootstrapFlareSolverr(options?: {
  autoStart?: boolean;
  registerShutdown?: boolean;
  restartIfOutdated?: boolean;
  cleanupOrphans?: boolean;
  loadFromDatabase?: boolean;
}): Promise<void> {
  // Migrate from old PID file format
  processManager.migrateFromOldFormat(FLARESOLVERR_PORT);

  // Load configuration from database first (unless explicitly disabled)
  let dbAutoStart = false;
  if (options?.loadFromDatabase !== false) {
    const dbConfig = await loadConfigFromDatabase();
    dbAutoStart = dbConfig.autoStart;
  }

  // Ensure flaresolverr-go binary is downloaded and auto-updated at startup
  await setupBinary();

  // Clean up orphaned processes from previous runs (unless explicitly disabled)
  if (options?.cleanupOrphans !== false) {
    await cleanupOrphansOnStartup();
  }

  // Register shutdown handler by default
  if (options?.registerShutdown !== false) {
    registerShutdownHandler();
  }

  // Determine autoStart: explicit option > database setting
  const shouldAutoStart = options?.autoStart ?? dbAutoStart;

  logger.info('[FlareSolverr] Initializing with autoStart setting', {
    autoStart: shouldAutoStart,
    source: options?.autoStart !== undefined ? 'explicit' : 'database',
  });

  // Initialize the client
  const initOptions: { autoStart?: boolean; restartIfOutdated?: boolean } = {
    restartIfOutdated: options?.restartIfOutdated !== false,
    autoStart: shouldAutoStart,
  };
  await flareSolverr.initialize(initOptions);
}
