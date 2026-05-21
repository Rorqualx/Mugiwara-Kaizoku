/**
 * Regression test for the process-wide restore lock in
 * src/server/services/backup/restore.ts.
 *
 * Restore is destructive (truncates DB, overwrites config files, repopulates
 * media) and uses temp directories under process.cwd(). Two concurrent
 * restoreBackup or restoreFromFile calls must not race on those directories
 * or on pg_restore. The lock here is a process-wide boolean — the second
 * concurrent acquire throws ValidationError immediately.
 *
 * The test exercises the lock helpers directly rather than going through
 * restoreBackup so it doesn't depend on prisma's connection-failure timing,
 * which differs between bun:test and jest test environments.
 *
 * @jest-environment node
 */

import { describe, it, expect, afterEach } from '@jest/globals';

import {
  acquireRestoreLock,
  releaseRestoreLock,
  isRestoreInProgress,
} from '@/server/services/backup/restore';
import { ValidationError } from '@/utils/errors';

describe('restore lock', () => {
  afterEach(() => {
    // Defensive: make sure no test leaks lock state into the next.
    if (isRestoreInProgress()) {
      releaseRestoreLock();
    }
  });

  it('a second acquire while held throws ValidationError', () => {
    acquireRestoreLock('restoreBackup');
    expect(isRestoreInProgress()).toBe(true);

    expect(() => acquireRestoreLock('restoreFromFile')).toThrow(ValidationError);
    expect(() => acquireRestoreLock('restoreFromFile')).toThrow(
      /another restore is already in progress/i,
    );

    releaseRestoreLock();
    expect(isRestoreInProgress()).toBe(false);
  });

  it('release allows a subsequent acquire', () => {
    acquireRestoreLock('restoreBackup');
    releaseRestoreLock();

    expect(() => acquireRestoreLock('restoreFromFile')).not.toThrow();
    releaseRestoreLock();
  });

  it('error message names the blocked operation', () => {
    acquireRestoreLock('restoreBackup');

    expect(() => acquireRestoreLock('restoreFromFile')).toThrow(/restoreFromFile/);

    releaseRestoreLock();
  });
});
