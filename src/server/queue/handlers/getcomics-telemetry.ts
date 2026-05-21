/**
 * iter-CDB-0.3 — Telemetry + iter-EX failure feedback for GetComics
 * downloads.
 *
 * Two responsibilities:
 *   1. `recordHostAttempt(...)` — fire-and-forget write to
 *      `HostDownloadAttempt` (per-host scorecard table).
 *   2. `markGetComicsDispatchFailed(chapterId)` — on host failure,
 *      flip the latest `ChapterDispatchAttempt` for
 *      `(chapterId, source='getcomics', outcome='dispatched')` to
 *      `outcome='failed'` with `resolvedAt=now`, bypassing the iter-EX
 *      resolver's 10-min grace. Effect: next dispatch cycle's
 *      `loadFailedSourcesForManga` skips GetComics for this chapter
 *      → falls through to Prowlarr.
 */
import { prisma } from '@/server/db';
import { detectHostType } from '@/server/services/getcomics/hosts';
import { logger } from '@/utils/logger';

const log = logger.child('GetComicsTelemetry');

export type HostOutcome =
  | 'success'
  | 'failed'
  | 'cloudflare_blocked'
  | 'expired'
  | 'quota'
  | 'parse_failed';

export interface HostAttemptArgs {
  url: string;
  chapterId?: number | null;
  jobId?: bigint | null;
  outcome: HostOutcome;
  durationMs?: number;
  fileBytes?: number;
  retries?: number;
  errorMessage?: string;
}

export function recordHostAttempt(args: HostAttemptArgs): void {
  const host = detectHostType(args.url) ?? 'direct';
  void prisma.hostDownloadAttempt.create({
    data: {
      url: args.url,
      host,
      outcome: args.outcome,
      chapterId: args.chapterId ?? null,
      jobId: args.jobId ?? null,
      durationMs: args.durationMs ?? null,
      fileBytes: args.fileBytes ?? null,
      retries: args.retries ?? 0,
      errorMessage: args.errorMessage ?? null,
    },
  }).catch((err: unknown) => {
    log.warn('Failed to write HostDownloadAttempt', { url: args.url, host, err });
  });
}

/**
 * Flips the most recent dispatched ChapterDispatchAttempt for this chapter+
 * source='getcomics' to outcome='failed', skipping the resolver's grace
 * window. iter-EX's read-side guard picks this up immediately so the next
 * dispatch cycle routes around GetComics.
 */
export async function markGetComicsDispatchFailed(chapterId: number | null | undefined): Promise<void> {
  if (chapterId === null || chapterId === undefined) return;
  try {
    const result = await prisma.chapterDispatchAttempt.updateMany({
      where: { chapterId, source: 'getcomics', outcome: 'dispatched' },
      data: { outcome: 'failed', resolvedAt: new Date() },
    });
    if (result.count > 0) {
      log.info('Flipped ChapterDispatchAttempt(s) to failed after host error', {
        chapterId, flipped: result.count,
      });
    }
  } catch (err: unknown) {
    log.warn('Failed to mark ChapterDispatchAttempt failed', { chapterId, err });
  }
}
