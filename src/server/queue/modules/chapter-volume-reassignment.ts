/**
 * Chapter→Volume reassignment sweep.
 *
 * Periodic maintenance that buckets orphaned `Chapter` rows (those with
 * `chapterNumber` set but `volumeId IS NULL`) into Volume rows. Without
 * this, ongoing series accumulate unassigned chapters in the
 * "Unassigned Chapters & Volumes" section on the manga detail page as
 * new chapters are added past the last canonical volume.
 *
 * Four-step ladder, in order, each step building on the prior:
 *   1. Existing-range backfill — cheapest. Catches chapters that fall
 *      inside an already-built `Volume.chapterStart..chapterEnd` range
 *      but missed the chapter-creation phase's assignment.
 *   2. Trailing placeholders — for manga that have a Volume tree but
 *      whose latest chapters fall past the highest `chapterEnd`. Creates
 *      one new "Vol N+1 (placeholder)" per affected manga covering the
 *      gap from `lastEnd+1` to `maxCh`.
 *   3. Zero-volume placeholders — for manga whose Volume tree was never
 *      built (enrichment didn't yield volume data). Creates one
 *      "Vol 1 (placeholder)" covering `minCh..maxCh`.
 *   4. Misc placeholder — catches sparse-tree gaps (volumes with
 *      gaps between them) and decimal chapters past an integer
 *      `chapterEnd`. Creates one "Misc (placeholder)" per affected
 *      manga to absorb any remaining stragglers.
 *
 * Each step is independent and idempotent — re-running is safe (steps
 * 2/3/4 only fire when there are unassigned chapters to bucket; the
 * placeholders they create cover those chapters so subsequent runs find
 * no orphans for the same manga).
 *
 * Called from `MaintenanceManager.startMaintenance()` on a daily cadence
 * alongside the stale-job-recovery and old-job-cleanup tasks.
 */
import { prisma } from '@/server/db';
import { getVolumeCapForManga } from '@/server/trpc/routers/manga/metadataOperations/enrichment-pipeline/phase-volume-cross-validation/db-volume-cap';
import { logger } from '@/utils/logger';

const log = logger.child('ChapterVolumeReassignment');

export interface ReassignmentReport {
  step0DenormSync: number;
  step1RangeBackfilled: number;
  step2TrailingPlaceholders: number;
  step2ChaptersAssigned: number;
  step3ZeroVolumePlaceholders: number;
  step3ChaptersAssigned: number;
  step4MiscPlaceholders: number;
  step4ChaptersAssigned: number;
  totalReassigned: number;
}

/**
 * Step 0: denormalization sync. Chapter has both a denormalized `volume`
 * (Int) column and a `volumeId` FK to Volume. They MUST stay in sync —
 * the UI's "Unassigned Chapters" bucket reads only the Int column
 * (`extractVolumeNumber` in `src/components/volumeChapters/utils.ts`),
 * so any chapter with `volumeId` set but `volume IS NULL` / `volume=-1`
 * / `volume != Volume.number` displays as unassigned even though it's
 * FK-linked. Previously Steps 1-4 only set `volumeId`, which silently
 * created this mismatch every run. Step 0 backfills the `volume` column
 * from `Volume.number` whenever the FK points somewhere the Int column
 * doesn't agree with. Treats volumeId as the source of truth.
 */
async function step0DenormSync(): Promise<number> {
  const updated: number = await prisma.$executeRaw`
    UPDATE "Chapter" c
    SET "volume" = v."number"
    FROM "Volume" v
    WHERE c."volumeId" = v.id
      AND (c."volume" IS NULL OR c."volume" = -1 OR c."volume" <> v."number")
  `;
  return updated;
}

/** Step 1: assign chapters that already fit an existing Volume range.
 *  Sets BOTH volumeId AND the denormalized `volume` Int in one pass —
 *  Step 0 covers the historical mismatch backlog; this prevents the
 *  mismatch from recurring on every new chapter that lands in range. */
async function step1RangeBackfill(): Promise<number> {
  const updated: number = await prisma.$executeRaw`
    UPDATE "Chapter" c
    SET "volumeId" = v.id, "volume" = v."number"
    FROM "Volume" v
    WHERE c."volumeId" IS NULL
      AND c."chapterNumber" IS NOT NULL
      AND v."mangaId" = c."mangaId"
      AND v."chapterStart" IS NOT NULL AND v."chapterEnd" IS NOT NULL
      AND c."chapterNumber" >= v."chapterStart" AND c."chapterNumber" <= v."chapterEnd"
  `;
  return updated;
}

interface TrailingCandidate {
  mangaId: number;
  lastVolNum: number | null;
  lastChEnd: number | null;
  maxCh: number | null;
}

/** Step 2: trailing placeholders for manga whose newest chapters are past the last volume. */
async function step2TrailingPlaceholders(): Promise<{ created: number; assigned: number }> {
  const candidates = await prisma.$queryRaw<TrailingCandidate[]>`
    SELECT
      m.id AS "mangaId",
      MAX(v.number) AS "lastVolNum",
      MAX(v."chapterEnd") AS "lastChEnd",
      (SELECT MAX("chapterNumber") FROM "Chapter" WHERE "mangaId" = m.id)::int AS "maxCh"
    FROM "Manga" m
    JOIN "Volume" v ON v."mangaId" = m.id
    GROUP BY m.id
    HAVING (SELECT COUNT(*) FROM "Chapter" c WHERE c."mangaId" = m.id AND c."chapterNumber" IS NOT NULL AND c."volumeId" IS NULL) > 0
  `;
  let created = 0;
  let assigned = 0;
  for (const c of candidates) {
    if (c.lastChEnd === null || c.maxCh === null) continue;
    const start = c.lastChEnd + 1;
    const end = c.maxCh;
    if (start > end) continue;
    const newVolNum = (c.lastVolNum ?? 0) + 1;
    // eslint-disable-next-line no-await-in-loop -- per-manga lookup, bounded by candidate count
    const { cap, source: capSource } = await getVolumeCapForManga(c.mangaId);
    if (newVolNum > cap) {
      const orphanCount = end - start + 1;
      log.warn(
        `step2 refused placeholder Vol ${newVolNum} for manga ${c.mangaId} (cap=${cap} from ${capSource}); ` +
        `${orphanCount} orphan chapter(s) [${start}..${end}] indicate upstream merge bug, not real new releases`,
      );
      continue;
    }
    // eslint-disable-next-line no-await-in-loop -- per-manga write, bounded by candidate count
    const vol = await prisma.volume.create({
      data: {
        mangaId: c.mangaId, number: newVolNum,
        title: `Vol ${newVolNum} (placeholder)`,
        chapterStart: start, chapterEnd: end,
      },
    });
    // eslint-disable-next-line no-await-in-loop -- per-manga write, bounded by candidate count
    const upd = await prisma.chapter.updateMany({
      where: { mangaId: c.mangaId, volumeId: null, chapterNumber: { gte: start, lte: end } },
      data: { volumeId: vol.id, volume: vol.number },
    });
    created++;
    assigned += upd.count;
  }
  return { created, assigned };
}

interface ZeroVolCandidate {
  mangaId: number;
  minCh: number | null;
  maxCh: number | null;
}

/** Step 3: bootstrap a Volume row for manga whose volume tree was never built. */
async function step3ZeroVolumePlaceholders(): Promise<{ created: number; assigned: number }> {
  const candidates = await prisma.$queryRaw<ZeroVolCandidate[]>`
    SELECT
      m.id AS "mangaId",
      MIN(c."chapterNumber")::int AS "minCh",
      MAX(c."chapterNumber")::int AS "maxCh"
    FROM "Manga" m
    JOIN "Chapter" c ON c."mangaId" = m.id AND c."chapterNumber" IS NOT NULL
    LEFT JOIN "Volume" v ON v."mangaId" = m.id
    WHERE v.id IS NULL
    GROUP BY m.id
  `;
  let created = 0;
  let assigned = 0;
  for (const c of candidates) {
    if (c.minCh === null || c.maxCh === null) continue;
    // eslint-disable-next-line no-await-in-loop -- per-manga write, bounded by candidate count
    const vol = await prisma.volume.create({
      data: {
        mangaId: c.mangaId, number: 1, title: 'Vol 1 (placeholder)',
        chapterStart: c.minCh, chapterEnd: c.maxCh,
      },
    });
    // eslint-disable-next-line no-await-in-loop -- per-manga write
    const upd = await prisma.chapter.updateMany({
      where: { mangaId: c.mangaId, volumeId: null, chapterNumber: { gte: c.minCh, lte: c.maxCh } },
      data: { volumeId: vol.id, volume: vol.number },
    });
    created++;
    assigned += upd.count;
  }
  return { created, assigned };
}

interface MiscCandidate {
  mangaId: number;
  minCh: number | null;
  maxCh: number | null;
}

/** Step 4: misc placeholder absorbs anything still unassigned (gaps + decimals). */
async function step4MiscPlaceholders(): Promise<{ created: number; assigned: number }> {
  const candidates = await prisma.$queryRaw<MiscCandidate[]>`
    SELECT "mangaId",
      MIN("chapterNumber")::float AS "minCh",
      MAX("chapterNumber")::float AS "maxCh"
    FROM "Chapter"
    WHERE "chapterNumber" IS NOT NULL AND "volumeId" IS NULL
    GROUP BY "mangaId"
  `;
  let created = 0;
  let assigned = 0;
  for (const c of candidates) {
    if (c.minCh === null || c.maxCh === null) continue;
    // eslint-disable-next-line no-await-in-loop -- per-manga lookup, small N
    const maxVol = await prisma.volume.aggregate({ where: { mangaId: c.mangaId }, _max: { number: true } });
    const newNum = (maxVol._max.number ?? 0) + 1;
    // eslint-disable-next-line no-await-in-loop -- per-manga lookup, bounded by candidate count
    const { cap, source: capSource } = await getVolumeCapForManga(c.mangaId);
    if (newNum > cap) {
      // eslint-disable-next-line no-await-in-loop -- per-manga lookup
      const orphans = await prisma.chapter.findMany({
        where: { mangaId: c.mangaId, volumeId: null, chapterNumber: { not: null } },
        select: { chapterNumber: true },
        orderBy: { chapterNumber: 'asc' },
        take: 20,
      });
      const orphanList = orphans.map(o => o.chapterNumber).join(',');
      log.warn(
        `step4 refused Misc placeholder Vol ${newNum} for manga ${c.mangaId} (cap=${cap} from ${capSource}); ` +
        `orphan chapters [${orphanList}${orphans.length === 20 ? ',...' : ''}] indicate upstream merge bug`,
      );
      continue;
    }
    // eslint-disable-next-line no-await-in-loop -- per-manga write
    const vol = await prisma.volume.create({
      data: {
        mangaId: c.mangaId, number: newNum, title: 'Misc (placeholder)',
        chapterStart: c.minCh, chapterEnd: c.maxCh,
      },
    });
    // eslint-disable-next-line no-await-in-loop -- per-manga write
    const upd = await prisma.chapter.updateMany({
      where: { mangaId: c.mangaId, volumeId: null },
      data: { volumeId: vol.id, volume: vol.number },
    });
    created++;
    assigned += upd.count;
  }
  return { created, assigned };
}

/**
 * Run the full chapter→volume reassignment sweep. Safe to call repeatedly;
 * each step short-circuits when there are no orphans to bucket. Returns
 * a structured report so callers can log/expose metrics.
 */
export async function reassignOrphanedChapters(): Promise<ReassignmentReport> {
  const startedAt = Date.now();

  const step0 = await step0DenormSync();
  const step1 = await step1RangeBackfill();
  const step2 = await step2TrailingPlaceholders();
  const step3 = await step3ZeroVolumePlaceholders();
  const step4 = await step4MiscPlaceholders();

  const totalReassigned = step0 + step1 + step2.assigned + step3.assigned + step4.assigned;

  const report: ReassignmentReport = {
    step0DenormSync: step0,
    step1RangeBackfilled: step1,
    step2TrailingPlaceholders: step2.created,
    step2ChaptersAssigned: step2.assigned,
    step3ZeroVolumePlaceholders: step3.created,
    step3ChaptersAssigned: step3.assigned,
    step4MiscPlaceholders: step4.created,
    step4ChaptersAssigned: step4.assigned,
    totalReassigned,
  };

  if (totalReassigned > 0) {
    log.info('Chapter→Volume reassignment sweep complete', {
      ...report,
      durationMs: Date.now() - startedAt,
    });
  }

  return report;
}
