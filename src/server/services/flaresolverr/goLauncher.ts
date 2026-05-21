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

import * as fs from 'fs';
import * as path from 'path';

import { logger } from '@/utils/logger';

import { processManager, readLockFile } from './process-manager';

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

/** PID file path (legacy - now using lock file via ProcessManager) */
const PID_FILE_PATH = path.join(process.cwd(), '.flaresolverr.pid');

// =============================================================================
// PID File Management (Legacy - maintained for backward compatibility)
// =============================================================================

/**
 * Remove PID file
 * @deprecated Use ProcessManager instead
 */
export function removePidFile(): void {
  try {
    if (fs.existsSync(PID_FILE_PATH)) {
      fs.unlinkSync(PID_FILE_PATH);
    }
  } catch {
    // Ignore errors
  }
}

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

/**
 * Get the PID from the PID file (or lock file)
 * @returns PID or null if not found
 * @deprecated Use processManager.getState() instead
 */
export function getPidFromFile(): number | null {
  // First check new lock file via ProcessManager
  const state = processManager.getState();
  if (state.pid !== null) {
    return state.pid;
  }

  // Fallback to legacy PID file
  try {
    if (!fs.existsSync(PID_FILE_PATH)) {
      return null;
    }
    const pidStr = fs.readFileSync(PID_FILE_PATH, 'utf-8').trim();
    const pid = parseInt(pidStr, 10);
    return isNaN(pid) ? null : pid;
  } catch {
    return null;
  }
}

/**
 * Check if a process is running by PID
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
 * Stop the flaresolverr-go process
 * @param pid Process ID to stop
 * @param force Use SIGKILL instead of SIGTERM
 * @returns True if process was stopped
 * @deprecated Use processManager.shutdown() instead
 */
export function stopProcess(pid: number, force = false): boolean {
  try {
    const signal = force ? 'SIGKILL' : 'SIGTERM';
    process.kill(pid, signal);
    logger.info('[GoLauncher] Sent signal to process', { pid, signal });
    return true;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.warn('[GoLauncher] Failed to stop process', { pid, error: errorMessage });
    return false;
  }
}

/** Log file path */
const LOG_FILE_PATH = path.join(process.cwd(), 'logs', 'flaresolverr-go.log');

/**
 * Get the log file path
 */
export function getLogFilePath(): string {
  return LOG_FILE_PATH;
}

/**
 * Get the PID file path
 * @deprecated Lock file is now managed by ProcessManager
 */
export function getPidFilePath(): string {
  return PID_FILE_PATH;
}

/**
 * Check if flaresolverr-go is currently running
 * @deprecated Use processManager.isRunning() instead
 */
export function isRunning(): boolean {
  return processManager.isRunning();
}

/**
 * Get current binary path if available
 * @deprecated This function returns the path from the lock file if process is running
 */
export function getCurrentBinaryPath(): string | null {
  const lock = readLockFile();
  return lock?.binaryPath ?? null;
}
