/**
 * FlareSolverr-Go Process Launcher
 *
 * Handles spawning and managing the flaresolverr-go binary process
 * with proper environment variables and lifecycle management.
 *
 * This module now delegates to ProcessManager for actual process management
 * while maintaining backward compatibility with existing callers.
 *
 * @module flaresolverr/goLauncher
 */

import * as path from 'path';

import { logger } from '@/utils/logger';

import { processManager } from './process-manager';

import type { ChildProcess } from 'child_process';

// =============================================================================
// Types
// =============================================================================

/** Launch options for flaresolverr-go */
export interface LaunchOptions {
  /** Port to listen on (default: 8191) */
  port?: number;
  /** Run in headless mode (default: true) */
  headless?: boolean;
  /** Browser pool size (default: 1) */
  browserPoolSize?: number;
  /** Custom Chrome/Chromium path */
  browserPath?: string;
  /** Log level (default: info) */
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
}

/** Result of launching flaresolverr-go */
export interface LaunchResult {
  success: boolean;
  pid: number | null;
  process: ChildProcess | null;
  error?: string;
}

// =============================================================================
// Constants
// =============================================================================

/** Default port for FlareSolverr */
const DEFAULT_PORT = 8191;

// =============================================================================
// Process Launching
// =============================================================================

/**
 * Launch flaresolverr-go binary as a subprocess
 *
 * Now delegates to ProcessManager for proper lifecycle management including:
 * - Process group tracking for complete cleanup
 * - Lock files to prevent multi-instance conflicts
 * - Validated process operations
 *
 * @param options Launch options
 * @returns Launch result with process handle
 */
export async function launchFlareSolverrGo(options: LaunchOptions = {}): Promise<LaunchResult> {
  const port = options.port ?? DEFAULT_PORT;

  logger.info('[GoLauncher] Delegating to ProcessManager', {
    port,
    headless: options.headless !== false,
  });

  // Build spawn options, only including defined properties
  const spawnOptions: Parameters<typeof processManager.spawn>[0] = { port };
  if (options.headless !== undefined) {
    spawnOptions.headless = options.headless;
  }
  if (options.browserPoolSize !== undefined) {
    spawnOptions.browserPoolSize = options.browserPoolSize;
  }
  if (options.browserPath !== undefined) {
    spawnOptions.browserPath = options.browserPath;
  }
  if (options.logLevel !== undefined) {
    spawnOptions.logLevel = options.logLevel;
  }

  const result = await processManager.spawn(spawnOptions);

  // Convert SpawnResult to LaunchResult for backward compatibility
  const launchResult: LaunchResult = {
    success: result.success,
    pid: result.pid,
    process: null, // ProcessManager doesn't expose the ChildProcess directly
  };

  if (result.error !== undefined) {
    launchResult.error = result.error;
  }

  return launchResult;
}

/** Log file path */
const LOG_FILE_PATH = path.join(process.cwd(), 'logs', 'flaresolverr-go.log');

/**
 * Get the log file path
 */
export function getLogFilePath(): string {
  return LOG_FILE_PATH;
}
