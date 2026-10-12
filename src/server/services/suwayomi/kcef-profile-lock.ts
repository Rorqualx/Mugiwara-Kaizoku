/**
 * Stale Chromium profile lock for Suwayomi's embedded browser (KCEF).
 *
 * KCEF keeps its Chromium profile in `<rootDir>/cache/kcef`, which lives on
 * the persistent config volume. Chromium marks a profile as in use with a
 * `SingletonLock` symlink whose target is `<hostname>-<pid>`, and refuses to
 * start when that names another machine. Every container recreate gets a new
 * hostname, so a lock left by a JVM that was killed rather than shut down
 * blocks the embedded browser on every later boot ("The profile appears to be
 * in use by another Chromium process ... on another computer"), and sources
 * that need the browser return nothing.
 *
 * The lock is cleared before the JVM is spawned when its owner cannot be
 * alive: a different host, or a pid that no longer exists on this one.
 */

import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';

import { logger } from '@/utils/logger';

const log = logger.child('SuwayomiKcefProfileLock');

const SINGLETON_FILES = ['SingletonLock', 'SingletonSocket', 'SingletonCookie'] as const;

/** Chromium profile directory of the embedded browser under Suwayomi's root. */
export function kcefProfileDir(suwayomiRootDir: string): string {
  return path.join(suwayomiRootDir, 'cache', 'kcef');
}

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error: unknown) {
    // EPERM: the process exists but belongs to someone else.
    return typeof error === 'object' && error !== null && 'code' in error && error.code === 'EPERM';
  }
}

/**
 * Whether a `SingletonLock` target (`<hostname>-<pid>`) names a process that
 * may still be running here. Anything unparseable is treated as stale.
 */
export function isKcefLockOwnerAlive(lockTarget: string, hostname: string = os.hostname()): boolean {
  const separator = lockTarget.lastIndexOf('-');
  if (separator <= 0) return false;
  const lockHost = lockTarget.slice(0, separator);
  const pid = Number(lockTarget.slice(separator + 1));
  if (lockHost !== hostname || !Number.isInteger(pid) || pid <= 0) return false;
  return isProcessAlive(pid);
}

/**
 * Remove the profile's singleton files when the lock's owner is gone.
 * Returns true if a stale lock was cleared. Never throws: on any error the
 * spawn proceeds and Chromium reports the lock itself.
 */
export async function clearStaleKcefProfileLock(suwayomiRootDir: string): Promise<boolean> {
  const profileDir = kcefProfileDir(suwayomiRootDir);
  try {
    let lockTarget: string;
    try {
      lockTarget = await fs.readlink(path.join(profileDir, 'SingletonLock'));
    } catch {
      return false; // no lock (or not a symlink): nothing to clear
    }
    if (isKcefLockOwnerAlive(lockTarget)) return false;

    await Promise.all(
      SINGLETON_FILES.map((name) => fs.rm(path.join(profileDir, name), { force: true })),
    );
    log.info('Cleared stale embedded-browser profile lock', { profileDir, lockTarget });
    return true;
  } catch (error: unknown) {
    log.warn('Could not clear embedded-browser profile lock', {
      profileDir,
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}
