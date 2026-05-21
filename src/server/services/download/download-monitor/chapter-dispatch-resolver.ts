/**
 * iter-EX — Resolves the outcome of ChapterDispatchAttempt rows based on
 * the chapter's eventual state. Companion to `resolveCoverageAttempts` in
 * chapter-manager.ts.
 *
 * Strategy:
 *   - Pick attempts older than DISPATCH_RESOLVE_GRACE_MS that are still
 *     `outcome='dispatched'`. The grace lets the dispatch flow actually
 *     complete (or fail) before we observe the chapter state.
 *   - For each: read the chapter's current downloadStatus + last updatedAt.
 *       * COMPLETED → outcome='completed'
 *       * PENDING (re-cycled by soft-fail) → outcome='failed'
 *       * ERROR (legacy hard-fail)         → outcome='failed'
 *       * Still DOWNLOADING                → leave 'dispatched'
 *   - After DISPATCH_ORPHAN_MS without resolution → outcome='orphan'.
 *   - Pure observation — never mutates chapters or jobs.
 */
import { logger } from '@/utils/logger';

import type { PrismaClient, ChapterDispatchAttempt } from '@prisma/client';

const DISPATCH_RESOLVE_GRACE_MS = 10 * 60 * 1000; // 10 min
const DISPATCH_ORPHAN_MS = 24 * 60 * 60 * 1000;    // 24h

export interface DispatchResolveStats {
  scanned: number;
  resolved: number;
  orphaned: number;
}

type ChapterOutcomeStatus = 'completed' | 'failed' | 'in_flight';

interface ChapterSnapshot {
  id: number;
  downloadStatus: string;
  updatedAt: Date;
}

function classifyChapter(downloadStatus: string, attemptCreatedAt: Date, chapterUpdatedAt: Date): ChapterOutcomeStatus {
  if (downloadStatus === 'COMPLETED' && chapterUpdatedAt >= attemptCreatedAt) return 'completed';
  if (downloadStatus === 'PENDING' && chapterUpdatedAt >= attemptCreatedAt) return 'failed';
  if (downloadStatus === 'ERROR') return 'failed';
  return 'in_flight';
}

async function markOrphan(prisma: PrismaClient, attemptId: bigint): Promise<void> {
  await prisma.chapterDispatchAttempt.update({
    where: { id: attemptId },
    data: { outcome: 'orphan', resolvedAt: new Date() },
  });
}

type ResolveOutcome = 'resolved' | 'orphaned' | 'inflight';

async function resolveAttempt(
  prisma: PrismaClient,
  attempt: ChapterDispatchAttempt,
  ch: ChapterSnapshot | undefined,
  orphanCutoff: Date,
): Promise<ResolveOutcome> {
  const isOrphanAge = attempt.createdAt < orphanCutoff;
  if (!ch) {
    if (isOrphanAge) { await markOrphan(prisma, attempt.id); return 'orphaned'; }
    return 'inflight';
  }
  const verdict = classifyChapter(String(ch.downloadStatus), attempt.createdAt, ch.updatedAt);
  if (verdict === 'in_flight') {
    if (isOrphanAge) { await markOrphan(prisma, attempt.id); return 'orphaned'; }
    return 'inflight';
  }
  await prisma.chapterDispatchAttempt.update({
    where: { id: attempt.id },
    data: { outcome: verdict, resolvedAt: new Date() },
  });
  return 'resolved';
}

export async function resolveChapterDispatchAttempts(
  prisma: PrismaClient,
  maxPerCycle = 100,
): Promise<DispatchResolveStats> {
  const stats: DispatchResolveStats = { scanned: 0, resolved: 0, orphaned: 0 };
  const now = Date.now();
  const graceCutoff = new Date(now - DISPATCH_RESOLVE_GRACE_MS);
  const orphanCutoff = new Date(now - DISPATCH_ORPHAN_MS);

  const pending = await prisma.chapterDispatchAttempt.findMany({
    where: { outcome: 'dispatched', createdAt: { lt: graceCutoff } },
    orderBy: { createdAt: 'asc' },
    take: maxPerCycle,
  });
  stats.scanned = pending.length;
  if (pending.length === 0) return stats;

  const chapterIds = [...new Set(pending.map(a => a.chapterId))];
  const chapters = await prisma.chapter.findMany({
    where: { id: { in: chapterIds } },
    select: { id: true, downloadStatus: true, updatedAt: true },
  });
  const chapterMap = new Map<number, ChapterSnapshot>(
    chapters.map(c => [c.id, { id: c.id, downloadStatus: String(c.downloadStatus), updatedAt: c.updatedAt }]),
  );

  for (const attempt of pending) {
    // eslint-disable-next-line no-await-in-loop -- serial per-row by design
    const outcome = await resolveAttempt(prisma, attempt, chapterMap.get(attempt.chapterId), orphanCutoff);
    if (outcome === 'resolved') stats.resolved++;
    else if (outcome === 'orphaned') stats.orphaned++;
  }

  if (stats.resolved > 0 || stats.orphaned > 0) {
    logger.info(
      `[DownloadMonitor] Dispatch resolve: scanned=${stats.scanned} ` +
      `resolved=${stats.resolved} orphaned=${stats.orphaned}`,
    );
  }
  return stats;
}
