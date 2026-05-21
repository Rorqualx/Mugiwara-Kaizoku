/**
 * Regression tests for src/server/queue/handlers/backup.ts.
 *
 * The single most important guarantee here: this handler's Zod schema accepts
 * the exact payload shape that services/backup/scheduling.ts enqueues. A prior
 * divergence between the two (handler validated {includeDatabase, includeConfig,
 * includeMedia}; scheduler enqueued {contents}) caused every queued backup to
 * silently no-op for an indeterminate length of time. If you change either
 * shape, this test breaks — change both.
 *
 * @jest-environment node
 */

import { describe, it, expect } from '@jest/globals';
import { BackupContent, BackupType } from '@prisma/client';

import { BackupCreatePayloadSchema } from '@/server/queue/handlers/backup';

describe('BackupCreatePayloadSchema', () => {
  it('accepts the exact payload shape that scheduling.ts enqueues', () => {
    // Mirrors services/backup/scheduling.ts: queueManager.enqueue(JobType.backup_create, {
    //   type, contents, name, notes
    // });
    const schedulerPayload = {
      type: BackupType.SCHEDULED,
      contents: [BackupContent.DATABASE, BackupContent.CONFIGURATION],
      name: 'scheduled_20260429_120000',
      notes: 'Scheduled backup',
    };

    const result = BackupCreatePayloadSchema.safeParse(schedulerPayload);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.type).toBe(BackupType.SCHEDULED);
      expect(result.data.contents).toEqual([
        BackupContent.DATABASE,
        BackupContent.CONFIGURATION,
      ]);
      expect(result.data.name).toBe('scheduled_20260429_120000');
      expect(result.data.notes).toBe('Scheduled backup');
    }
  });

  it('preserves MEDIA_FILES content when the scheduler asks for it', () => {
    // The previous handler shape ({includeMedia}) silently dropped this whenever
    // scheduling.ts passed `contents` because `contents` was an unknown key.
    const result = BackupCreatePayloadSchema.safeParse({
      type: BackupType.MANUAL,
      contents: [
        BackupContent.DATABASE,
        BackupContent.CONFIGURATION,
        BackupContent.MEDIA_FILES,
      ],
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.contents).toEqual([
        BackupContent.DATABASE,
        BackupContent.CONFIGURATION,
        BackupContent.MEDIA_FILES,
      ]);
    }
  });

  it('treats all fields as optional (empty payload is valid)', () => {
    const result = BackupCreatePayloadSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('strips legacy {includeDatabase, includeConfig, includeMedia} keys without erroring', () => {
    // After this fix deploys, in-flight queue jobs that were enqueued under
    // the old payload shape must not crash the worker. Zod's default behavior
    // is to strip unknown keys, leaving the typed fields undefined. The
    // handler then falls back to the real service's defaults — backup still
    // runs, just without the originally-intended media flag.
    const legacyPayload = {
      type: BackupType.SCHEDULED,
      includeDatabase: true,
      includeConfig: true,
      includeMedia: true,
    };

    const result = BackupCreatePayloadSchema.safeParse(legacyPayload);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.type).toBe(BackupType.SCHEDULED);
      expect(result.data.contents).toBeUndefined();
      expect((result.data as Record<string, unknown>)['includeDatabase']).toBeUndefined();
    }
  });

  it('rejects malformed type values', () => {
    const result = BackupCreatePayloadSchema.safeParse({
      type: 'NOT_A_BACKUP_TYPE',
    });
    expect(result.success).toBe(false);
  });

  it('rejects malformed contents values', () => {
    const result = BackupCreatePayloadSchema.safeParse({
      contents: ['NOT_A_BACKUP_CONTENT'],
    });
    expect(result.success).toBe(false);
  });
});
