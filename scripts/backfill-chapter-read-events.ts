/**
 * @quality-check-skip
 *
 * Backfill `CHAPTER_READ` SystemEvents from historical ReadingHistory rows.
 *
 * Reads now emit a user-stamped `chapter.read` SystemEvent going forward (see
 * src/server/trpc/routers/reader/history.ts), so they appear in the per-user
 * actions log (admin user-management drawer). Reads recorded BEFORE that change
 * only live in `ReadingHistory` and are therefore absent from the timeline.
 *
 * This script synthesizes one `CHAPTER_READ` event per ReadingHistory row,
 * stamped at the row's `endedAt`, so historical reads show up too. Summary
 * counts already include them (they come straight from ReadingAnalytics /
 * ReadingHistory), so this only affects the timeline.
 *
 * Idempotent: skips any ReadingHistory row that already has a matching
 * `CHAPTER_READ` event for the same (userId, timestamp=endedAt).
 *
 * Dry-run by default — pass `--apply` to write.
 *
 * Usage:
 *   bun run scripts/backfill-chapter-read-events.ts
 *   bun run scripts/backfill-chapter-read-events.ts --apply
 */
import { randomUUID } from 'crypto';

import { prisma } from '@/server/db';
import { EventType, EventSource, EventLevel } from '@/server/services/events/eventTypes';
import { logger } from '@/utils/logger';

const APPLY = process.argv.includes('--apply');

interface HistoryRow {
  userId: string;
  mangaId: number;
  chapterId: number;
  pagesRead: number;
  totalTime: number;
  endedAt: Date;
}

/** Build the dedup key for an existing/candidate event. */
function dedupKey(userId: string, timestamp: Date): string {
  return `${userId}@${timestamp.getTime()}`;
}

/** Load the set of (userId, timestamp) keys already backfilled. */
async function loadExistingKeys(): Promise<Set<string>> {
  const existing = await prisma.systemEvent.findMany({
    where: { type: EventType.CHAPTER_READ },
    select: { userId: true, timestamp: true },
  });
  return new Set(existing.map((e) => dedupKey(e.userId ?? '', e.timestamp)));
}

/** Insert one synthetic CHAPTER_READ event for a history row. */
async function createReadEvent(row: HistoryRow): Promise<void> {
  await prisma.systemEvent.create({
    data: {
      id: randomUUID(),
      type: EventType.CHAPTER_READ,
      source: EventSource.READER,
      level: EventLevel.INFO,
      message: `Read chapter (${row.pagesRead} pages, ${row.totalTime}s)`,
      relatedEntityId: String(row.mangaId),
      relatedEntityType: 'manga',
      userId: row.userId,
      timestamp: row.endedAt,
      details: JSON.stringify({
        mangaId: row.mangaId,
        chapterId: row.chapterId,
        pagesRead: row.pagesRead,
        totalTime: row.totalTime,
        backfilled: true,
      }),
    },
  });
}

async function main(): Promise<void> {
  const seen = await loadExistingKeys();

  const history = await prisma.readingHistory.findMany({
    select: {
      userId: true,
      mangaId: true,
      chapterId: true,
      pagesRead: true,
      totalTime: true,
      endedAt: true,
    },
    orderBy: { endedAt: 'asc' },
  });

  const toCreate = history.filter((h) => !seen.has(dedupKey(h.userId, h.endedAt)));

  logger.info('Backfill plan', {
    historyRows: history.length,
    alreadyBackfilled: history.length - toCreate.length,
    toCreate: toCreate.length,
    apply: APPLY,
  });

  if (!APPLY) {
    logger.info('Dry run — pass --apply to write these events.');
    return;
  }

  for (const row of toCreate) {
    await createReadEvent(row);
  }

  logger.info('Backfill complete', { created: toCreate.length });
}

main()
  .catch((err: unknown) => {
    logger.error('Backfill failed', { err });
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
