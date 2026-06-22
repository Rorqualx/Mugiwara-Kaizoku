/**
 * SQL implementation of the per-manga grid aggregate.
 *
 * This is a faithful Postgres re-implementation of the canonical JS
 * `buildChapterStats` (`@/components/library/utils/chapter-stats-builder`) so
 * `manga.query` can compute the grid aggregate without materializing every
 * Chapter row in the server process. Its ONLY contract is producing output
 * deep-equal to `buildChapterStats` — the JS function stays canonical; this is
 * validated against it by `scripts/surveys/parity-chapter-stats-harness.ts`.
 *
 * Two notions of "counts" are mirrored exactly (see chapter-stats-builder):
 *  - scalar fields filter with `isRealChapter`
 *    (chapterNumber != null ? chapterNumber < 100000 : index < 100000);
 *  - the volume tally filters with `isNumbered` (chapterNumber != null);
 *  - monitored / lastReadAt scan ALL rows (incl. sentinel-band rows).
 *
 * The tally replicates `computeCardTally`'s whole-volume-archive rule: a
 * file-backed, COMPLETED, NULL-chapterNumber container row marks every numbered
 * chapter in its volume downloaded.
 *
 * @module server/trpc/routers/manga/chapter-stats-sql
 */
import { Prisma } from '@prisma/client';

import { buildChapterStats } from '@/components/library/utils/chapter-stats-builder';
import type { MangaChapterStats, RecentChapterPreview } from '@/components/library/utils/chapter-stats-builder';
import { prisma } from '@/server/db';


/** One raw row per mangaId that has at least one chapter. */
interface RawStatRow {
  mangaId: number;
  realCount: bigint | number | null;
  downloadedCount: bigint | number | null;
  readCount: bigint | number | null;
  hasErrors: boolean | null;
  latestChapter: number | null;
  isMonitored: boolean | null;
  lastReadAt: Date | null;
  totalChapters: bigint | number | string | null;
  downloadedChapters: bigint | number | string | null;
  totalVolumes: bigint | number | string | null;
  downloadedVolumes: bigint | number | string | null;
}

const num = (v: bigint | number | string | null | undefined): number => (v === null || v === undefined ? 0 : Number(v));

function rowToStats(row: RawStatRow): MangaChapterStats {
  return {
    realChapterCount: num(row.realCount),
    downloadedCount: num(row.downloadedCount),
    readCount: num(row.readCount),
    hasErrors: row.hasErrors === true,
    latestChapterNumber: row.latestChapter !== null ? String(row.latestChapter) : null,
    lastReadAt: row.lastReadAt !== null ? new Date(row.lastReadAt).toISOString() : null,
    isMonitored: row.isMonitored === true,
    tally: {
      downloadedChapters: num(row.downloadedChapters),
      totalChapters: num(row.totalChapters),
      downloadedVolumes: num(row.downloadedVolumes),
      totalVolumes: num(row.totalVolumes),
    },
  };
}

/**
 * Compute the grid aggregate for the given manga ids in a single SQL pass.
 * Manga with no chapters are returned with the empty aggregate (identical to
 * `buildChapterStats([])`), so the map always has an entry for every requested id.
 */
export async function buildChapterStatsSql(mangaIds: number[]): Promise<Map<number, MangaChapterStats>> {
  const result = new Map<number, MangaChapterStats>();
  if (mangaIds.length === 0) return result;

  const empty = buildChapterStats([]);
  for (const id of mangaIds) result.set(id, empty);

  const rows = await prisma.$queryRaw<RawStatRow[]>(Prisma.sql`
    WITH base AS (
      SELECT
        "mangaId",
        "downloadStatus",
        "isRead",
        "monitored",
        "updatedAt",
        "chapterNumber",
        (CASE WHEN "chapterNumber" IS NOT NULL THEN "chapterNumber" < 100000 ELSE "index" < 100000 END) AS is_real,
        ("chapterNumber" IS NOT NULL) AS is_numbered,
        (CASE WHEN "volume" IS NOT NULL AND "volume" >= 0 THEN "volume" ELSE -1 END) AS bucket,
        ("downloadStatus" = 'COMPLETED' AND "filePath" IS NOT NULL AND "filePath" <> '') AS is_file_done
      FROM "Chapter"
      WHERE "mangaId" IN (${Prisma.join(mangaIds)})
    ),
    scalar_agg AS (
      SELECT
        "mangaId",
        COUNT(*) FILTER (WHERE is_real) AS "realCount",
        COUNT(*) FILTER (WHERE is_real AND "downloadStatus" = 'COMPLETED') AS "downloadedCount",
        COUNT(*) FILTER (WHERE is_real AND "isRead") AS "readCount",
        bool_or(is_real AND "downloadStatus" = 'ERROR') AS "hasErrors",
        MAX("chapterNumber") FILTER (WHERE is_real) AS "latestChapter",
        bool_or("monitored") AS "isMonitored",
        MAX("updatedAt") FILTER (WHERE "isRead") AS "lastReadAt"
      FROM base
      GROUP BY "mangaId"
    ),
    vol_agg AS (
      SELECT
        "mangaId",
        bucket,
        COUNT(*) FILTER (WHERE is_numbered) AS numbered_count,
        COUNT(*) FILTER (WHERE is_numbered AND "downloadStatus" = 'COMPLETED') AS numbered_done,
        bool_or((NOT is_numbered) AND is_file_done) AS has_file_archive
      FROM base
      GROUP BY "mangaId", bucket
    ),
    vol_contrib AS (
      SELECT
        "mangaId",
        CASE
          WHEN bucket = -1 THEN numbered_count
          WHEN numbered_count > 0 THEN numbered_count
          WHEN has_file_archive THEN 1
          ELSE 0
        END AS t_total,
        CASE
          WHEN bucket = -1 THEN numbered_done
          WHEN numbered_count > 0 THEN (CASE WHEN has_file_archive THEN numbered_count ELSE numbered_done END)
          WHEN has_file_archive THEN 1
          ELSE 0
        END AS t_down,
        CASE
          WHEN bucket = -1 THEN 0
          WHEN numbered_count > 0 THEN 1
          WHEN has_file_archive THEN 1
          ELSE 0
        END AS t_vol_total,
        CASE
          WHEN bucket = -1 THEN 0
          WHEN numbered_count > 0 THEN (CASE WHEN (CASE WHEN has_file_archive THEN numbered_count ELSE numbered_done END) = numbered_count THEN 1 ELSE 0 END)
          WHEN has_file_archive THEN 1
          ELSE 0
        END AS t_vol_down
      FROM vol_agg
    ),
    tally_agg AS (
      SELECT
        "mangaId",
        SUM(t_total) AS "totalChapters",
        SUM(t_down) AS "downloadedChapters",
        SUM(t_vol_total) AS "totalVolumes",
        SUM(t_vol_down) AS "downloadedVolumes"
      FROM vol_contrib
      GROUP BY "mangaId"
    )
    SELECT
      s."mangaId" AS "mangaId",
      s."realCount", s."downloadedCount", s."readCount", s."hasErrors",
      s."latestChapter", s."isMonitored", s."lastReadAt",
      t."totalChapters", t."downloadedChapters", t."totalVolumes", t."downloadedVolumes"
    FROM scalar_agg s
    LEFT JOIN tally_agg t ON t."mangaId" = s."mangaId"
  `);

  for (const row of rows) result.set(Number(row.mangaId), rowToStats(row));
  return result;
}

/** One raw row for a top-5 recent real chapter. */
interface RawRecentRow {
  mangaId: number;
  id: number;
  chapterNumber: number | null;
  title: string | null;
  isRead: boolean;
  downloadStatus: string;
}

/**
 * Fetch the top-5 most-recent *real* chapters per manga (the grid preview),
 * mirroring `toGridManga`'s `recentChapters`: real chapters only, ordered by
 * chapterNumber descending (NULL → 0), capped at 5. Bounded per-manga so the
 * SQL path never materializes the full chapter array.
 */
async function buildRecentChapters(mangaIds: number[]): Promise<Map<number, RecentChapterPreview[]>> {
  const out = new Map<number, RecentChapterPreview[]>();
  if (mangaIds.length === 0) return out;

  const rows = await prisma.$queryRaw<RawRecentRow[]>(Prisma.sql`
    SELECT "mangaId", id, "chapterNumber", title, "isRead", "downloadStatus"::text AS "downloadStatus"
    FROM (
      SELECT
        "mangaId", id, "chapterNumber", title, "isRead", "downloadStatus",
        row_number() OVER (PARTITION BY "mangaId" ORDER BY COALESCE("chapterNumber", 0) DESC, "index" DESC) AS rn
      FROM "Chapter"
      WHERE "mangaId" IN (${Prisma.join(mangaIds)})
        AND (CASE WHEN "chapterNumber" IS NOT NULL THEN "chapterNumber" < 100000 ELSE "index" < 100000 END)
    ) t
    WHERE rn <= 5
    ORDER BY "mangaId", rn
  `);

  for (const r of rows) {
    const arr = out.get(Number(r.mangaId)) ?? [];
    arr.push({ id: r.id, chapterNumber: r.chapterNumber, title: r.title, isRead: r.isRead, downloadStatus: r.downloadStatus });
    out.set(Number(r.mangaId), arr);
  }
  return out;
}

/** The grid per-manga payload assembled entirely in SQL (no chapter materialization). */
export interface GridChapterData {
  chapterStats: MangaChapterStats;
  recentChapters: RecentChapterPreview[];
}

/**
 * Compute `{ chapterStats, recentChapters }` for the grid in two bounded SQL
 * passes instead of fetching every chapter row. Output is identical to
 * `toGridManga` (chapterStats is parity-validated against `buildChapterStats`).
 */
export async function buildGridMangaData(mangaIds: number[]): Promise<Map<number, GridChapterData>> {
  const [stats, recent] = await Promise.all([buildChapterStatsSql(mangaIds), buildRecentChapters(mangaIds)]);
  const out = new Map<number, GridChapterData>();
  for (const id of mangaIds) {
    out.set(id, { chapterStats: stats.get(id) ?? buildChapterStats([]), recentChapters: recent.get(id) ?? [] });
  }
  return out;
}
