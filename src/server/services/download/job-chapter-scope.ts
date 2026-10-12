/**
 * Which chapters a download job is responsible for.
 *
 * Chapter download state used to be handled per title: "every DOWNLOADING
 * chapter of this manga" was marked completed, failed or reset whenever ONE
 * job for that manga finished, failed or was cancelled. With two jobs running
 * for the same title, each one's outcome was written onto the other's
 * chapters — chapters marked COMPLETED with no file, or reset and downloaded
 * a second time.
 *
 * A job names its chapters in `payload.chapterIds`; those are the only ones
 * it may touch. A job without the list (pack mode, rows from before the list
 * existed) falls back to the title's DOWNLOADING chapters MINUS any chapter a
 * different live job names.
 */

import { extractChapterIdsFromPayload } from './job-payload';

import type { Prisma, PrismaClient } from '@prisma/client';

type ScopeDb = Pick<PrismaClient, 'chapter' | 'jobs'>;

export interface JobChapterRef {
  /** `jobs.id` */
  id: bigint | number | string;
  /** `jobs.payload`; looked up by id when not supplied. */
  payload?: Prisma.JsonValue | undefined;
}

export interface ScopedChapter {
  id: number;
  filePath: string | null;
}

const LIVE_JOB_STATUSES = ['pending', 'active', 'retrying'] as const;

async function loadPayload(db: ScopeDb, job: JobChapterRef): Promise<Prisma.JsonValue | null> {
  if (job.payload !== undefined) return job.payload;
  const row = await db.jobs.findFirst({ where: { id: BigInt(job.id) }, select: { payload: true } });
  return row?.payload ?? null;
}

/** Chapter ids named by live jobs of this title other than `jobId`. */
async function chapterIdsOfOtherLiveJobs(db: ScopeDb, mangaId: number, jobId: bigint): Promise<Set<number>> {
  const others = await db.jobs.findMany({
    where: { manga_id: mangaId, id: { not: jobId }, status: { in: [...LIVE_JOB_STATUSES] } },
    select: { payload: true },
  });
  const claimed = new Set<number>();
  for (const other of others) {
    for (const id of extractChapterIdsFromPayload(other.payload)) claimed.add(id);
  }
  return claimed;
}

/**
 * The DOWNLOADING chapters of `mangaId` that belong to `job`.
 */
export async function findJobDownloadingChapters(
  db: ScopeDb,
  mangaId: number,
  job: JobChapterRef,
): Promise<ScopedChapter[]> {
  const ownIds = extractChapterIdsFromPayload(await loadPayload(db, job));
  if (ownIds.length > 0) {
    return db.chapter.findMany({
      where: { mangaId, id: { in: ownIds }, downloadStatus: 'DOWNLOADING' },
      select: { id: true, filePath: true },
    });
  }

  const [downloading, claimedElsewhere] = await Promise.all([
    db.chapter.findMany({
      where: { mangaId, downloadStatus: 'DOWNLOADING' },
      select: { id: true, filePath: true },
    }),
    chapterIdsOfOtherLiveJobs(db, mangaId, BigInt(job.id)),
  ]);
  return downloading.filter((chapter) => !claimedElsewhere.has(chapter.id));
}
