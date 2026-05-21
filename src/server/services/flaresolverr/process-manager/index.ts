/**
 * FlareSolverr Process Manager
 *
 * Centralized process management for FlareSolverr with:
 * - Process group tracking for complete cleanup
 * - Lock files to prevent multi-instance conflicts
 * - Validated process operations (won't kill unrelated processes)
 * - Single shutdown coordination point
 *
 * @module flaresolverr/process-manager
 */

import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

import { logger } from '@/utils/logger';

import { ensureBinaryExists, getBinaryPath } from '../binaryManager';
import { findChromePath } from '../chromeChecker';

import {
  acquireLock,
  getAppInstanceId,
  getLockFilePath,
  isOwnedByUs,
  migrateFromOldPidFile,
  readLockFile,
  releaseLock,
  removeOldPidFile,
} from './lock-file';
import {
  findFlareSolverrProcessesOnPort,
  getProcessGroupId,
  isProcessRunning,
  killProcessGroup,
  killProcessSafe,
  killProcessTree,
} from './process-tree';

import type { ProcessState, ShutdownOptions, SpawnOptions, SpawnResult } from './types';
import type { ChildProcess } from 'child_process';

// Re-export types
export type {
  LockResult,
  ProcessLockFile,
  ProcessState,
  ProcessValidation,
  ShutdownOptions,
  SpawnOptions,
  SpawnResult,
} from './types';

// =============================================================================
// Constants
// =============================================================================

/** Default FlareSolverr port */
const DEFAULT_PORT = 8191;

/** Log file path */
const LOG_FILE_PATH = path.join(process.cwd(), 'logs', 'flaresolverr-go.log');

/** Default graceful shutdown timeout (5 seconds) */
const DEFAULT_SHUTDOWN_TIMEOUT_MS = 5000;

/** Poll interval when waiting for process to die */
const PROCESS_POLL_INTERVAL_MS = 200;

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Promise-based delay
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/**
 * Ensure logs directory exists
 */
function ensureLogsDirectory(): void {
  const logsDir = path.dirname(LOG_FILE_PATH);
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }
}

/**
 * Build environment variables for FlareSolverr
 */
function buildEnvironment(options: SpawnOptions): NodeJS.ProcessEnv {
  const env = { ...process.env };

  env['PORT'] = String(options.port ?? DEFAULT_PORT);

  if (options.headless !== false) {
    env['HEADLESS'] = 'true';
  }

  if (options.browserPoolSize !== undefined) {
    env['BROWSER_POOL_SIZE'] = String(options.browserPoolSize);
  }

  const browserPath = options.browserPath ?? findChromePath();
  if (browserPath) {
    env['BROWSER_PATH'] = browserPath;
  }

  if (options.logLevel) {
    env['LOG_LEVEL'] = options.logLevel;
  }

  return env;
}

/**
 * Setup stdout handler
 */
function setupStdoutHandler(stdout: NodeJS.ReadableStream): void {
  stdout.on('data', (data: Buffer) => {
    const line = data.toString().trim();
    if (line) {
      logger.debug('[FlareSolverr-Go]', { output: line });
    }
  });
}

/**
 * Setup stderr handler
 */
function setupStderrHandler(stderr: NodeJS.ReadableStream): void {
  stderr.on('data', (data: Buffer) => {
    const line = data.toString().trim();
    if (line) {
      logger.warn('[FlareSolverr-Go]', { error: line });
    }
  });
}

// =============================================================================
// Process Manager Class
// =============================================================================

/**
 * ProcessManager handles FlareSolverr process lifecycle
 *
 * Features:
 * - Spawns processes with process group tracking
 * - Uses lock files to prevent multi-instance conflicts
 * - Validates processes before killing
 * - Provides graceful and force shutdown options
 */
class ProcessManager {
  /** Currently managed child process */
  private childProcess: ChildProcess | null = null;

  /** Whether shutdown is in progress */
  private isShuttingDown = false;

  /** Current port being used */
  private currentPort = DEFAULT_PORT;

  /**
   * Get current process state
   */
  getState(): ProcessState {
    const lock = readLockFile();

    if (!lock) {
      return {
        pid: null,
        pgid: null,
        isRunning: false,
        isOwnedByUs: false,
      };
    }

    return {
      pid: lock.pid,
      pgid: lock.pgid,
      isRunning: isProcessRunning(lock.pid),
      isOwnedByUs: isOwnedByUs(lock),
    };
  }

  /**
   * Get the app instance ID
   */
  getAppInstanceId(): string {
    return getAppInstanceId();
  }

  /**
   * Get the lock file path
   */
  getLockFilePath(): string {
    return getLockFilePath();
  }

  /**
   * Check if we own the current FlareSolverr process
   */
  isOwnedByUs(): boolean {
    const lock = readLockFile();
    return isOwnedByUs(lock);
  }

  /**
   * Check if FlareSolverr is running (regardless of ownership)
   */
  isRunning(): boolean {
    return this.getState().isRunning;
  }

  /**
   * Migrate from old PID file format to new lock file
   */
  migrateFromOldFormat(port: number = DEFAULT_PORT): boolean {
    const binaryPath = getBinaryPath() ?? '';
    return migrateFromOldPidFile(port, binaryPath);
  }

  /**
   * Check if process is already running and handle accordingly
   */
  private checkExistingProcess(): SpawnResult | null {
    const state = this.getState();
    if (!state.isRunning) {
      return null;
    }

    if (state.isOwnedByUs) {
      logger.info('[ProcessManager] FlareSolverr already running (owned by us)', { pid: state.pid });
      return { success: true, pid: state.pid, pgid: state.pgid };
    }

    logger.warn('[ProcessManager] FlareSolverr running but owned by another instance', { pid: state.pid });
    return { success: false, pid: null, pgid: null, error: 'Process owned by another instance' };
  }

  /**
   * Setup process event handlers and pipes
   */
  private setupProcessHandlers(child: ChildProcess, logStream: fs.WriteStream): void {
    // stdio is ['ignore', 'pipe', 'pipe'] so stdout/stderr are non-null
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- stdio config guarantees these exist
    const stdout = child.stdout!;
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- stdio config guarantees these exist
    const stderr = child.stderr!;

    stdout.pipe(logStream);
    stderr.pipe(logStream);

    setupStdoutHandler(stdout);
    setupStderrHandler(stderr);

    child.on('exit', (code, signal) => {
      logger.info('[ProcessManager] Process exited', { code, signal });
      this.handleProcessExit();
      logStream.end();
    });

    child.on('error', (error) => {
      logger.error('[ProcessManager] Process error', { error: error.message });
      this.handleProcessExit();
      logStream.end();
    });
  }

  /**
   * Handle process exit
   */
  private handleProcessExit(): void {
    this.childProcess = null;
    if (isOwnedByUs(readLockFile())) {
      releaseLock();
    }
  }

  /**
   * Spawn FlareSolverr process
   */
  async spawn(options: SpawnOptions = {}): Promise<SpawnResult> {
    const existingResult = this.checkExistingProcess();
    if (existingResult) {
      return existingResult;
    }

    const binaryPath = await ensureBinaryExists();
    if (!binaryPath) {
      logger.error('[ProcessManager] Binary not available');
      return { success: false, pid: null, pgid: null, error: 'FlareSolverr-Go binary not available' };
    }

    const port = options.port ?? DEFAULT_PORT;
    this.currentPort = port;

    ensureLogsDirectory();
    logger.info('[ProcessManager] Spawning FlareSolverr', { binary: binaryPath, port, headless: options.headless !== false });

    return this.doSpawn(binaryPath, port, options);
  }

  /**
   * Execute the spawn operation
   */
  private doSpawn(binaryPath: string, port: number, options: SpawnOptions): SpawnResult {
    try {
      const logStream = fs.createWriteStream(LOG_FILE_PATH, { flags: 'a' });
      const env = buildEnvironment(options);

      const child = spawn(binaryPath, [], { env, detached: true, stdio: ['ignore', 'pipe', 'pipe'] });
      this.childProcess = child;
      this.setupProcessHandlers(child, logStream);
      child.unref();

      if (!child.pid) {
        return { success: false, pid: null, pgid: null, error: 'Failed to get process PID' };
      }

      return this.finishSpawn(child.pid, port, binaryPath);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('[ProcessManager] Failed to spawn', { error: errorMessage });
      return { success: false, pid: null, pgid: null, error: errorMessage };
    }
  }

  /**
   * Finish spawn by acquiring lock
   */
  private finishSpawn(pid: number, port: number, binaryPath: string): SpawnResult {
    const pgid = getProcessGroupId(pid) ?? pid;

    const lockResult = acquireLock(pid, pgid, port, binaryPath);
    if (!lockResult.acquired) {
      logger.error('[ProcessManager] Failed to acquire lock', { reason: lockResult.reason });
      killProcessSafe(pid, 'SIGKILL', false);
      return { success: false, pid: null, pgid: null, error: `Failed to acquire lock: ${lockResult.reason}` };
    }

    removeOldPidFile();
    logger.info('[ProcessManager] Process spawned successfully', { pid, pgid, port });
    return { success: true, pid, pgid };
  }

  /**
   * Shutdown FlareSolverr process
   */
  async shutdown(options: ShutdownOptions = {}): Promise<boolean> {
    if (this.isShuttingDown) {
      logger.debug('[ProcessManager] Shutdown already in progress');
      return true;
    }

    this.isShuttingDown = true;
    try {
      return await this.performShutdown(options);
    } finally {
      this.isShuttingDown = false;
    }
  }

  /**
   * Perform the actual shutdown operation
   */
  private async performShutdown(options: ShutdownOptions): Promise<boolean> {
    const state = this.getState();

    if (!state.isRunning) {
      logger.debug('[ProcessManager] No process running');
      releaseLock();
      return true;
    }

    if (!state.isOwnedByUs && options.graceful !== false) {
      logger.warn('[ProcessManager] Process not owned by us, skipping shutdown');
      return false;
    }

    if (state.pid === null) {
      return true;
    }

    return this.executeShutdown(state.pid, state.pgid, options);
  }

  /**
   * Execute shutdown with the given PID/PGID
   */
  private async executeShutdown(pid: number, pgid: number | null, options: ShutdownOptions): Promise<boolean> {
    const graceful = options.graceful !== false;
    const timeoutMs = options.timeoutMs ?? DEFAULT_SHUTDOWN_TIMEOUT_MS;

    logger.info('[ProcessManager] Shutting down FlareSolverr', { pid, pgid, graceful, timeoutMs });

    if (graceful) {
      return this.gracefulShutdown(pid, pgid, timeoutMs);
    }
    return this.forceShutdown(pid, pgid);
  }

  /**
   * Graceful shutdown with timeout
   */
  private async gracefulShutdown(pid: number, pgid: number | null, timeoutMs: number): Promise<boolean> {
    this.sendTermSignal(pid, pgid);
    const died = await this.waitForProcessExit(pid, timeoutMs);

    if (died) {
      logger.info('[ProcessManager] Process stopped gracefully');
      releaseLock();
      return true;
    }

    logger.warn('[ProcessManager] Process did not stop gracefully, forcing');
    return this.forceShutdown(pid, pgid);
  }

  /**
   * Send SIGTERM to process or group
   */
  private sendTermSignal(pid: number, pgid: number | null): void {
    if (pgid) {
      killProcessGroup(pgid, 'SIGTERM');
    } else {
      killProcessTree(pid, 'SIGTERM');
    }
  }

  /**
   * Force shutdown
   */
  private forceShutdown(pid: number, pgid: number | null): boolean {
    if (pgid) {
      killProcessGroup(pgid, 'SIGKILL');
    } else {
      killProcessTree(pid, 'SIGKILL');
    }

    releaseLock();
    logger.info('[ProcessManager] Process force killed');
    return true;
  }

  /**
   * Wait for process to exit
   */
  private async waitForProcessExit(pid: number, timeoutMs: number): Promise<boolean> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeoutMs) {
      if (!isProcessRunning(pid)) {
        return true;
      }
      // eslint-disable-next-line no-await-in-loop -- Polling loop with delay
      await delay(PROCESS_POLL_INTERVAL_MS);
    }

    return !isProcessRunning(pid);
  }

  /**
   * Clean up orphaned FlareSolverr processes
   */
  async cleanupOrphans(port?: number, force: boolean = false): Promise<number> {
    const targetPort = port ?? this.currentPort;
    logger.info('[ProcessManager] Cleaning up orphaned processes', { port: targetPort });

    const pids = findFlareSolverrProcessesOnPort(targetPort);
    const lock = readLockFile();
    const orphanPids = pids.filter((pid) => pid !== lock?.pid);

    if (orphanPids.length === 0) {
      logger.debug('[ProcessManager] No orphaned processes found');
      return 0;
    }

    const killed = await this.killOrphans(orphanPids, force);
    logger.info('[ProcessManager] Orphan cleanup complete', { found: orphanPids.length, killed });
    return killed;
  }

  /**
   * Kill orphaned processes
   */
  private async killOrphans(orphanPids: number[], force: boolean): Promise<number> {
    const signal = force ? 'SIGKILL' : 'SIGTERM';
    let killed = 0;

    for (const pid of orphanPids) {
      logger.info('[ProcessManager] Killing orphaned process', { pid, signal });
      if (killProcessSafe(pid, signal)) {
        killed++;
      }
    }

    if (!force && killed > 0) {
      await delay(2000);
      this.forceKillSurvivors(orphanPids);
    }

    return killed;
  }

  /**
   * Force kill any processes that survived SIGTERM
   */
  private forceKillSurvivors(pids: number[]): void {
    for (const pid of pids) {
      if (isProcessRunning(pid)) {
        logger.warn('[ProcessManager] Force killing survivor', { pid });
        killProcessSafe(pid, 'SIGKILL');
      }
    }
  }

  /**
   * Synchronous cleanup for crash handlers
   */
  cleanupSync(): void {
    try {
      const lock = readLockFile();
      if (!lock || !isOwnedByUs(lock)) {
        return;
      }

      if (lock.pgid) {
        killProcessGroup(lock.pgid, 'SIGKILL');
      } else {
        killProcessSafe(lock.pid, 'SIGKILL', false);
      }
      releaseLock();
    } catch {
      // Best effort during crash
    }
  }
}

// =============================================================================
// Singleton Export
// =============================================================================

/** Singleton process manager instance */
export const processManager = new ProcessManager();

// Re-export utilities for direct use if needed
export {
  isProcessRunning,
  findFlareSolverrProcessesOnPort,
  killProcessSafe,
  killProcessGroup,
  killProcessTree,
} from './process-tree';

export { readLockFile, releaseLock, forceRemoveLock } from './lock-file';
