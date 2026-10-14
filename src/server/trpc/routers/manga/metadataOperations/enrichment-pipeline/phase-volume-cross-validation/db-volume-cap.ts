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
import { logger } from '@/utils/logger';

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

/** Has the run ended (an end date, or a finished status)? */
function isFinished(signal: Pick<VolumeCapSignal, 'endDate' | 'status'> | null): boolean {
  return Boolean(signal?.endDate) || FINISHED_STATUSES.has(signal?.status ?? '');
}

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
  const finished = isFinished(signal);
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

/** One provider's count of a series' chapters. */
export interface FinalChapterClaim {
  provider: string;
  chapters: number | null;
}

/** Two providers' final chapters this close agree (Tokyo Ghoul: 143, and 144 with an extra). */
const FINAL_CHAPTER_TOLERANCE = 1;

/**
 * The final chapter two providers agree on, or null when no two do.
 *
 * Each provider counts once. Returns the higher of the agreeing pair, so an
 * extra chapter one of them counts (Tokyo Ghoul: AniList and Kitsu 144,
 * MangaUpdates 143) stays inside the series. Pure — no DB.
 */
export function corroboratedFinalChapter(claims: readonly FinalChapterClaim[]): number | null {
  const byProvider = new Map<string, number>();
  for (const claim of claims) {
    if (claim.chapters !== null && claim.chapters > 0 && !byProvider.has(claim.provider)) {
      byProvider.set(claim.provider, claim.chapters);
    }
  }
  const values = [...byProvider.values()].sort((a, b) => b - a);
  for (let i = 0; i < values.length; i++) {
    const v = values[i] ?? 0;
    if (values.some((w, j) => j !== i && Math.abs(w - v) <= FINAL_CHAPTER_TOLERANCE)) return v;
  }
  return null;
}

/** 139.5 after a last volume ending at 139: an extra of that volume, not a new one. */
function isDecimalRightAfter(n: number | null, lastEnd: number | null): boolean {
  return n !== null && lastEnd !== null && !Number.isInteger(n) && n > lastEnd && n < lastEnd + 1;
}

/**
 * Does the agreed final chapter leave room for a volume past the last counted
 * one? At least half an average volume must lie between them. Tokyo Ghoul's 14
 * volumes end at 143 and the series at 144: no room. Solo Leveling's 15 end at
 * 48 and the series at 201: room.
 */
function finalLeavesRoomForAVolume(finalChapter: number, lastEnd: number, count: number | null): boolean {
  const avgSpan = count !== null && count > 0 ? lastEnd / count : 0;
  const minRoom = Math.max(2, Math.ceil(avgSpan / 2));
  return finalChapter - lastEnd >= minRoom;
}

/**
 * Downloaded rows numbered past the last counted volume although the agreed
 * final chapter says no further volume exists: Tokyo Ghoul's "V09"-"V13"
 * archive rows numbered 144-159 hold chapters 69-121. They are mis-numbered
 * files, not a reason for another volume. A row past the agreed final
 * chapter always is; one between the last volume's end and the final chapter
 * is when that gap is too small to hold a volume. Empty without an agreed
 * final chapter. Pure — no DB.
 */
export function misnumberedPastFinalRows(
  rows: readonly PastFileRow[],
  lastEnd: number | null,
  count: number | null,
  finalChapter: number | null,
): PastFileRow[] {
  if (finalChapter === null) return [];
  const room = lastEnd === null || finalLeavesRoomForAVolume(finalChapter, lastEnd, count);
  return rows.filter((row) => {
    const n = row.chapterNumber;
    if (n === null) return false;
    if (n > finalChapter && !isDecimalRightAfter(n, Math.floor(finalChapter))) return true;
    if (lastEnd === null || n <= lastEnd || isDecimalRightAfter(n, lastEnd)) return false;
    return !room;
  });
}

/**
 * Do downloaded chapters need one volume past the count?
 *
 * - A whole-numbered file at least one past the last counted volume's end
 *   (Solo Leveling: volumes end at 48, files run to 201). A decimal extra does
 *   not count: Attack on Titan's 139.5 after volume 34 (ending 139) belongs to
 *   volume 34 and must not allow a volume 35.
 * - A downloaded row already filed in a volume past the count, other than such
 *   a decimal extra or a chapter a counted volume's range already holds
 *   (`countedRanges`; see `isInCountedRange`): Jujutsu Kaisen's chapter 0 and
 *   "Vol 00"/"V31" archives in volume 31, Vinland Saga's "Vol 30" archive.
 *   Refusing the volume would leave those files without one.
 *
 * With a final chapter two providers agree on (`finalChapter`), a numbered row
 * past the last volume's end is evidence only when it lies inside the series
 * and the series leaves room for another volume; otherwise it is a
 * mis-numbered file (`misnumberedPastFinalRows`) and earns nothing, even when
 * an earlier run already filed it past the count (Tokyo Ghoul's rows 144-159
 * in a rebuilt "volume 15").
 *
 * Pure — no DB.
 */
export function filesOutrunLastVolume(
  rows: readonly PastFileRow[],
  lastEnd: number | null,
  count: number | null,
  finalChapter: number | null = null,
  countedRanges: readonly CountedRange[] = [],
): boolean {
  const misnumbered = new Set(misnumberedPastFinalRows(rows, lastEnd, count, finalChapter));
  return rows.some((row) => {
    if (misnumbered.has(row)) return false;
    const n = row.chapterNumber;
    const wholePastEnd = n !== null && lastEnd !== null && Number.isInteger(n) && n >= lastEnd + 1;
    const filedPastCount = count !== null && count > 0 && row.volume !== null && row.volume > count
      && !isDecimalRightAfter(n, lastEnd) && !isInCountedRange(n, countedRanges);
    return wholePastEnd || filedPastCount;
  });
}

/** A counted volume's chapter range (volumes 1..count that have one). */
export interface CountedRange {
  start: number;
  end: number;
}

/**
 * A row whose chapter a counted volume already holds is not evidence of a
 * volume past the count: its number is stale. Yofukashi no Uta's chapters
 * 10-22 sat in a "volume 21" built while no provider range held them; once
 * Fandom's 9-18 and 19-29 did, the stale 21 still earned the trailing volume,
 * reconciliation rebuilt it over them, and each refresh kept the number alive.
 */
function isInCountedRange(n: number | null, ranges: readonly CountedRange[]): boolean {
  if (n === null) return false;
  const whole = Math.floor(n);
  return ranges.some(r => whole >= r.start && whole <= r.end);
}

/** Most candidate rows any title needs to decide `filesOutrunLastVolume`. */
const PAST_FILE_ROW_LIMIT = 500;

interface VolumeCapRow extends Omit<VolumeCapSignal, 'filesPastLastVolume'> {
  lastVolumeEnd: number | null;
  countedRanges: CountedRange[] | null;
  pastRows: PastFileRow[] | null;
  /** Chapter counts: the stored (selected) one and Kitsu's and MangaUpdates' own. */
  finalClaims: FinalChapterClaim[] | null;
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
           (SELECT json_agg(json_build_object('start', v."chapterStart", 'end', v."chapterEnd"))
              FROM "Volume" v
              WHERE v."mangaId" = m.id AND v.number BETWEEN 1 AND md.volumes
                AND v."chapterStart" IS NOT NULL AND v."chapterEnd" IS NOT NULL
           ) AS "countedRanges",
           (SELECT json_agg(json_build_object('chapterNumber', p."chapterNumber", 'volume', p.volume))
              FROM (
                SELECT c."chapterNumber", c.volume FROM "Chapter" c
                WHERE c."mangaId" = m.id AND c."filePath" IS NOT NULL
                  AND (c."chapterNumber" > le."lastEnd" OR c.volume > md.volumes)
                LIMIT ${PAST_FILE_ROW_LIMIT}
              ) p
           ) AS "pastRows",
           json_build_array(
             json_build_object(
               'provider', COALESCE(m."providerMetadata"->'metadataProvenance'->'chapters'->>'provider', 'metadata'),
               'chapters', md.chapters),
             json_build_object('provider', 'kitsu', 'chapters',
               CASE WHEN jsonb_typeof(m."providerMetadata"->'kitsu'->'chapterCount') = 'number'
                 THEN (m."providerMetadata"->'kitsu'->>'chapterCount')::float END),
             json_build_object('provider', 'mangaupdates', 'chapters',
               CASE WHEN jsonb_typeof(m."providerMetadata"->'mangaupdates'->'latestChapter') = 'number'
                 THEN (m."providerMetadata"->'mangaupdates'->>'latestChapter')::float END)
           ) AS "finalClaims"
    FROM "Manga" m JOIN "Metadata" md ON m."metadataId" = md.id
    LEFT JOIN LATERAL (
      SELECT MAX(v."chapterEnd") AS "lastEnd" FROM "Volume" v
      WHERE v."mangaId" = m.id AND v.number BETWEEN 1 AND md.volumes
    ) le ON true
    WHERE m.id = ${mangaId}
  `;
  const row = rows[0];
  if (!row) return volumeCapFor(null, callerHint);
  const { lastVolumeEnd, pastRows, finalClaims, countedRanges, ...signal } = row;
  // Only a finished series has a final chapter; a running one's count is just its latest.
  const finalChapter = isFinished(signal) ? corroboratedFinalChapter(finalClaims ?? []) : null;
  const misnumbered = misnumberedPastFinalRows(pastRows ?? [], lastVolumeEnd, signal.volumes, finalChapter);
  if (misnumbered.length > 0) {
    logger.warn(
      `[volumeCap] manga ${mangaId}: ${misnumbered.length} downloaded rows are numbered past the last volume ` +
      `(ends at ${lastVolumeEnd}) although providers agree the series ends at chapter ${finalChapter} ` +
      `(${misnumbered.map(r => r.chapterNumber).join(', ')}). Treated as mis-numbered files: left as they are, ` +
      'and no volume is built for them.',
    );
  }
  const filesPastLastVolume = filesOutrunLastVolume(pastRows ?? [], lastVolumeEnd, signal.volumes, finalChapter, countedRanges ?? []);
  return volumeCapFor({ ...signal, filesPastLastVolume }, callerHint);
}
