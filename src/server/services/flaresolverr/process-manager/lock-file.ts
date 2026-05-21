/**
 * FlareSolverr Lock File Manager
 *
 * Handles atomic lock file operations for preventing multi-instance conflicts.
 * Uses exclusive file flags for atomic writes and stale lock detection.
 *
 * Lock file format: .flaresolverr.lock (JSON with full metadata)
 * Separate from old .flaresolverr.pid for backward compatibility during migration.
 *
 * @module flaresolverr/process-manager/lock-file
 */

import { execSync } from 'child_process';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { logger } from '@/utils/logger';

import type { LockResult, ProcessLockFile } from './types';

// =============================================================================
// Constants
// =============================================================================

/** Lock file path */
const LOCK_FILE_PATH = path.join(process.cwd(), '.flaresolverr.lock');

/** Old PID file path (for migration) */
const OLD_PID_FILE_PATH = path.join(process.cwd(), '.flaresolverr.pid');

/** Stale lock threshold (5 minutes - if lock older and process dead, consider stale) */
const STALE_LOCK_THRESHOLD_MS = 5 * 60 * 1000;

/** Unique app instance ID generated at startup */
const APP_INSTANCE_ID = crypto.randomUUID();

// =============================================================================
// Lock File Operations
// =============================================================================

/**
 * Get the app instance ID for this process
 */
export function getAppInstanceId(): string {
  return APP_INSTANCE_ID;
}

/**
 * Get the lock file path
 */
export function getLockFilePath(): string {
  return LOCK_FILE_PATH;
}

/**
 * Get the old PID file path (for migration)
 */
export function getOldPidFilePath(): string {
  return OLD_PID_FILE_PATH;
}

/**
 * Check if a process is running by sending signal 0
 */
function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/**
 * Validate lock file structure
 */
function isValidLockData(data: unknown): data is ProcessLockFile {
  return (
    typeof data === 'object' &&
    data !== null &&
    'pid' in data &&
    'pgid' in data &&
    'appInstanceId' in data &&
    'createdAt' in data &&
    'port' in data &&
    'binaryPath' in data &&
    'hostname' in data
  );
}

/**
 * Read the current lock file
 * @returns Lock file data or null if not found/invalid
 */
export function readLockFile(): ProcessLockFile | null {
  try {
    if (!fs.existsSync(LOCK_FILE_PATH)) {
      return null;
    }
    const content = fs.readFileSync(LOCK_FILE_PATH, 'utf-8');
    const data = JSON.parse(content) as unknown;

    if (!isValidLockData(data)) {
      logger.warn('[LockFile] Invalid lock file structure');
      return null;
    }

    return data;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.debug('[LockFile] Failed to read lock file', { error: errorMessage });
    return null;
  }
}

/**
 * Check if a lock is stale (process dead and lock old)
 */
export function isLockStale(lock: ProcessLockFile): boolean {
  // If process is still alive, lock is not stale
  if (isProcessAlive(lock.pid)) {
    return false;
  }

  // Process is dead - check age
  const age = Date.now() - lock.createdAt;
  return age > STALE_LOCK_THRESHOLD_MS;
}

/**
 * Check if we own the current lock
 */
export function isOwnedByUs(lock: ProcessLockFile | null): boolean {
  if (!lock) {
    return false;
  }
  return lock.appInstanceId === APP_INSTANCE_ID;
}

/**
 * Check if existing lock allows acquisition
 * @returns null if lock can be acquired, or LockResult if blocked
 */
function checkExistingLock(existingLock: ProcessLockFile | null): LockResult | null {
  if (!existingLock) {
    return null; // No lock, can acquire
  }

  // We already own it - can update
  if (isOwnedByUs(existingLock)) {
    logger.debug('[LockFile] Updating our own lock');
    return null;
  }

  // Another instance owns it and process is running
  if (isProcessAlive(existingLock.pid)) {
    logger.warn('[LockFile] Lock held by another instance', {
      pid: existingLock.pid,
      appInstanceId: existingLock.appInstanceId,
    });
    return {
      acquired: false,
      reason: 'process_running',
      existingLock,
    };
  }

  // Process dead - check if stale
  if (isLockStale(existingLock)) {
    logger.info('[LockFile] Acquiring stale lock', { previousPid: existingLock.pid });
    return null; // Can acquire
  }

  // Lock not stale yet but process dead - safe to acquire
  logger.debug('[LockFile] Lock exists but process dead, acquiring');
  return null;
}

/**
 * Write lock file atomically
 */
function writeLockFileAtomic(lockData: ProcessLockFile): void {
  const tempPath = `${LOCK_FILE_PATH}.${process.pid}.tmp`;
  fs.writeFileSync(tempPath, JSON.stringify(lockData, null, 2), { flag: 'wx' });
  fs.renameSync(tempPath, LOCK_FILE_PATH);
}

/**
 * Attempt to acquire the lock
 *
 * @param pid Process ID
 * @param pgid Process Group ID
 * @param port Port number
 * @param binaryPath Path to the binary
 * @returns Lock result indicating success or reason for failure
 */
export function acquireLock(
  pid: number,
  pgid: number,
  port: number,
  binaryPath: string
): LockResult {
  try {
    const existingLock = readLockFile();
    const blockResult = checkExistingLock(existingLock);
    if (blockResult) {
      return blockResult;
    }

    const lockData: ProcessLockFile = {
      pid,
      pgid,
      appInstanceId: APP_INSTANCE_ID,
      createdAt: Date.now(),
      port,
      binaryPath,
      hostname: os.hostname(),
    };

    writeLockFileAtomic(lockData);

    logger.info('[LockFile] Lock acquired', { pid, pgid, port });
    return { acquired: true };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('[LockFile] Failed to acquire lock', { error: errorMessage });
    return { acquired: false, reason: 'io_error' };
  }
}

/**
 * Release the lock
 * Only releases if we own it
 * @returns True if lock was released (or didn't exist)
 */
export function releaseLock(): boolean {
  try {
    const lock = readLockFile();

    if (!lock) {
      return true;
    }

    if (!isOwnedByUs(lock)) {
      logger.warn('[LockFile] Attempted to release lock owned by another instance', {
        owner: lock.appInstanceId,
        us: APP_INSTANCE_ID,
      });
      return false;
    }

    fs.unlinkSync(LOCK_FILE_PATH);
    logger.info('[LockFile] Lock released');
    return true;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.warn('[LockFile] Failed to release lock', { error: errorMessage });
    return false;
  }
}

/**
 * Force remove the lock file (for cleanup scenarios)
 * Use with caution - only when you're sure no process owns it
 */
export function forceRemoveLock(): void {
  try {
    if (fs.existsSync(LOCK_FILE_PATH)) {
      fs.unlinkSync(LOCK_FILE_PATH);
      logger.debug('[LockFile] Force removed lock file');
    }
  } catch {
    // Best effort
  }
}

// =============================================================================
// Migration from Old PID File
// =============================================================================

/**
 * Read the old PID file format
 * @returns PID or null if not found
 */
export function readOldPidFile(): number | null {
  try {
    if (!fs.existsSync(OLD_PID_FILE_PATH)) {
      return null;
    }
    const content = fs.readFileSync(OLD_PID_FILE_PATH, 'utf-8').trim();
    const pid = parseInt(content, 10);
    return isNaN(pid) ? null : pid;
  } catch {
    return null;
  }
}

/**
 * Remove the old PID file
 */
export function removeOldPidFile(): void {
  try {
    if (fs.existsSync(OLD_PID_FILE_PATH)) {
      fs.unlinkSync(OLD_PID_FILE_PATH);
      logger.debug('[LockFile] Removed old PID file');
    }
  } catch {
    // Best effort
  }
}

/**
 * Get process group ID for a given PID
 */
function getProcessGroupId(pid: number): number {
  try {
    const result = execSync(`ps -o pgid= -p ${pid} 2>/dev/null || echo ${pid}`, {
      encoding: 'utf-8',
    }).trim();
    const parsedPgid = parseInt(result, 10);
    return isNaN(parsedPgid) ? pid : parsedPgid;
  } catch {
    return pid;
  }
}

/**
 * Migrate from old PID file to new lock file format
 *
 * If an old PID file exists with a running process, adopt it into the new format.
 * This provides backward compatibility during the transition.
 *
 * @param port Port to use in lock file
 * @param binaryPath Binary path to use in lock file
 * @returns True if migration happened, false if no migration needed
 */
export function migrateFromOldPidFile(port: number, binaryPath: string): boolean {
  const oldPid = readOldPidFile();

  if (oldPid === null) {
    return false;
  }

  if (!isProcessAlive(oldPid)) {
    logger.debug('[LockFile] Old PID file found but process not running', { pid: oldPid });
    removeOldPidFile();
    return false;
  }

  logger.info('[LockFile] Migrating from old PID file', { pid: oldPid });

  const pgid = getProcessGroupId(oldPid);
  const result = acquireLock(oldPid, pgid, port, binaryPath);

  if (result.acquired) {
    removeOldPidFile();
    logger.info('[LockFile] Migration complete', { pid: oldPid, pgid });
    return true;
  }

  return false;
}
