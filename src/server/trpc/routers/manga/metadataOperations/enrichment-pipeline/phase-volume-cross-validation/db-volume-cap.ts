/**
 * DB-driven volume cap (iter-MM-8).
 *
 * Many non-canonical Volume write paths (fandom helpers, reconciliation,
 * wikipedia fallback) don't have a UnifiedProviderResults bundle in scope
 * but still need to refuse over-cap volume writes. They use this helper
 * to read the persisted authoritative volume count from Metadata and
 * derive a cap.
 *
 * Order of precedence:
 *   0. A finished series: exactly max(caller value, `Metadata.volumes`).
 *   1. Caller-supplied value (if > 0) wins.
 *   2. Persisted `Metadata.volumes` (AniList anchor).
 *   3. KR-webtoon special case: countryOfOrigin = 'KR' AND volumes = 0
 *      AND format != 'NOVEL'  -> cap = 1 (placeholder only).
 *   4. No signal -> Infinity (no cap; caller decides).
 *
 * Mirrors the audit script's rules so cleanups and the pipeline agree
 * on what counts as "overshoot".
 */

import { prisma } from '@/server/db';

const KR_WEBTOON_CAP = 1;
const OVERSHOOT_FACTOR = 1.1;

export interface VolumeCap {
  cap: number;
  source: 'caller' | 'metadata' | 'kr-webtoon' | 'none';
}

/** One volume past the count, for a finished series whose files outrun its volumes. */
const TRAILING_VOLUMES_FOR_FILES = 1;

/** Statuses that mean the run has ended: the volume count is final. */
const FINISHED_STATUSES = new Set<string>(['COMPLETED', 'CANCELLED']);

export interface VolumeCapSignal {
  volumes: number | null;
  status: string | null;
  endDate: Date | null;
  country: string | null;
  format: string | null;
  /** Downloaded chapters are numbered past the end of the last counted volume. */
  filesPastLastVolume?: boolean | null;
}

/**
 * The cap for one title's stored signal and an optional caller hint.
 *
 * A finished series is capped at exactly its volume count. The 1.1x allowance
 * is for a running series whose next volume may not be counted yet; on a
 * finished one it let a "Volume 75" be rebuilt for a 74-volume series (Bleach)
 * by one phase and by the daily sweep, which the phantom prune then deleted on
 * the next refresh, unlinking its chapters each time. A finished series takes
 * the larger of the hint and the stored count: a hint resolved from a sparse
 * source (Tokyo Ghoul: 8 of 14) must not cut real volumes.
 *
 * One exception: when downloaded chapters are numbered past the end of the last
 * counted volume (Solo Leveling: 15 collected volumes end at chapter 48, files
 * run to 201), exactly one further volume is allowed to hold them. It is stable
 * because every reader of the cap sees the same files, and the phantom prune
 * never removes a volume that holds a file.
 *
 * Pure — no DB.
 */
export function volumeCapFor(signal: VolumeCapSignal | null, callerHint?: number): VolumeCap {
  const hint = callerHint !== undefined && callerHint > 0 ? callerHint : 0;
  const stored = Math.max(0, signal?.volumes ?? 0);
  const finished = Boolean(signal?.endDate) || FINISHED_STATUSES.has(signal?.status ?? '');
  if (finished && (hint > 0 || stored > 0)) {
    const trailing = signal?.filesPastLastVolume === true ? TRAILING_VOLUMES_FOR_FILES : 0;
    return { cap: Math.ceil(Math.max(hint, stored)) + trailing, source: hint > stored ? 'caller' : 'metadata' };
  }
  if (hint > 0) return { cap: Math.ceil(hint * OVERSHOOT_FACTOR), source: 'caller' };
  if (!signal) return { cap: Infinity, source: 'none' };
  if (stored > 0) return { cap: Math.ceil(stored * OVERSHOOT_FACTOR), source: 'metadata' };
  if (signal.country === 'KR' && signal.format !== 'NOVEL') return { cap: KR_WEBTOON_CAP, source: 'kr-webtoon' };
  return { cap: Infinity, source: 'none' };
}

/** A downloaded row that may sit past the last counted volume. */
export interface PastFileRow {
  chapterNumber: number | null;
  /** `Chapter.volume`, which survives the per-run volume rebuild. */
  volume: number | null;
}

/** 139.5 after a last volume ending at 139: an extra of that volume, not a new one. */
function isDecimalRightAfter(n: number | null, lastEnd: number | null): boolean {
  return n !== null && lastEnd !== null && !Number.isInteger(n) && n > lastEnd && n < lastEnd + 1;
}

/**
 * Do downloaded chapters need one volume past the count?
 *
 * - A whole-numbered file at least one past the last counted volume's end
 *   (Solo Leveling: volumes end at 48, files run to 201). A decimal extra does
 *   not count: Attack on Titan's 139.5 after volume 34 (ending 139) belongs to
 *   volume 34 and must not allow a volume 35.
 * - A downloaded row already filed in a volume past the count, other than such
 *   a decimal extra: Yofukashi no Uta's chapters 10-22 (in no provider range)
 *   in its "Misc" volume 21, Jujutsu Kaisen's chapter 0 and "Vol 00"/"V31"
 *   archives in volume 31, Vinland Saga's "Vol 30" archive. Refusing the
 *   volume would leave those files without one.
 *
 * Pure — no DB.
 */
export function filesOutrunLastVolume(
  rows: readonly PastFileRow[],
  lastEnd: number | null,
  count: number | null,
): boolean {
  return rows.some((row) => {
    const n = row.chapterNumber;
    const wholePastEnd = n !== null && lastEnd !== null && Number.isInteger(n) && n >= lastEnd + 1;
    const filedPastCount = count !== null && count > 0 && row.volume !== null && row.volume > count
      && !isDecimalRightAfter(n, lastEnd);
    return wholePastEnd || filedPastCount;
  });
}

/** Most candidate rows any title needs to decide `filesOutrunLastVolume`. */
const PAST_FILE_ROW_LIMIT = 500;

interface VolumeCapRow extends Omit<VolumeCapSignal, 'filesPastLastVolume'> {
  lastVolumeEnd: number | null;
  pastRows: PastFileRow[] | null;
}

export async function getVolumeCapForManga(
  mangaId: number,
  callerHint?: number,
): Promise<VolumeCap> {
  // Candidates only: downloaded rows numbered past the last counted volume's
  // end, or filed in a volume past the count. `filesOutrunLastVolume` decides.
  const rows = await prisma.$queryRaw<VolumeCapRow[]>`
    SELECT md.volumes AS volumes, md.status::text AS status, md."endDate" AS "endDate",
           md."countryOfOrigin" AS country, md.format AS format,
           le."lastEnd" AS "lastVolumeEnd",
           (SELECT json_agg(json_build_object('chapterNumber', p."chapterNumber", 'volume', p.volume))
              FROM (
                SELECT c."chapterNumber", c.volume FROM "Chapter" c
                WHERE c."mangaId" = m.id AND c."filePath" IS NOT NULL
                  AND (c."chapterNumber" > le."lastEnd" OR c.volume > md.volumes)
                LIMIT ${PAST_FILE_ROW_LIMIT}
              ) p
           ) AS "pastRows"
    FROM "Manga" m JOIN "Metadata" md ON m."metadataId" = md.id
    LEFT JOIN LATERAL (
      SELECT MAX(v."chapterEnd") AS "lastEnd" FROM "Volume" v
      WHERE v."mangaId" = m.id AND v.number BETWEEN 1 AND md.volumes
    ) le ON true
    WHERE m.id = ${mangaId}
  `;
  const row = rows[0];
  if (!row) return volumeCapFor(null, callerHint);
  const { lastVolumeEnd, pastRows, ...signal } = row;
  const filesPastLastVolume = filesOutrunLastVolume(pastRows ?? [], lastVolumeEnd, signal.volumes);
  return volumeCapFor({ ...signal, filesPastLastVolume }, callerHint);
}
