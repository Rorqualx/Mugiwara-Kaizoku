/**
 * Overflow Chapter Handler
 *
 * Handles chapters that fall beyond the last known volume range.
 * Instead of creating phantom overflow volumes (which produced ghost volumes
 * for completed manga like Dorohedoro), this module marks overflow chapters
 * as awaiting their volume (volume = -1, see `@/lib/metadata/awaiting-volume`)
 * so the UI lists them after the last volume as "Not yet in a volume".
 */

import {
  AWAITING_VOLUME, lastRangedVolumeEnd, planAwaitingVolumeTags, type AwaitingVolumeRow,
} from '@/lib/metadata/awaiting-volume';
import { prisma } from '@/server/db';
import { logger } from '@/utils/logger';

import type { MangaPublicationStatus } from '@prisma/client';

/** A series whose run has ended — its tankōbon volume structure is complete. */
function isTerminalStatus(status: MangaPublicationStatus | null | undefined): boolean {
  return status === 'COMPLETED' || status === 'CANCELLED';
}

/**
 * Integer chapters beyond the final volume are *spurious* (vs. real not-yet-volumized chapters)
 * when the series has ended AND its volume structure is cross-validated (multi-source). Then the
 * overflow is provider numbering noise — e.g. MangaDex listing per-volume omake as sequential
 * chapters 168-192 when the canonical omake already exist as decimals. For an ongoing or
 * single-source manga, overflow may be genuine latest chapters, so we keep them.
 */
export function shouldDeleteSpuriousOverflow(
  status: MangaPublicationStatus | null | undefined,
  lastVolumeSource: string | null,
): boolean {
  return isTerminalStatus(status) && (lastVolumeSource ?? '').includes('+');
}

/**
 * The chapter count of a finished series, inside which no chapter is overflow:
 * Metadata.chapters when the run has ended (terminal status or an end date),
 * else null. `volume = -1` means "past the last volume, waiting for a
 * tankōbon" — that cannot be true of a chapter a finished series already
 * counts. Its volume is merely unknown here (a volume missing from the
 * rebuild), so it is left NULL for the volume-id backfill to place.
 */
export function finishedSeriesChapterCount(
  status: MangaPublicationStatus | null | undefined,
  hasEndDate: boolean,
  storedChapters: number | null | undefined,
): number | null {
  if (!isTerminalStatus(status) && !hasEndDate) return null;
  return storedChapters !== null && storedChapters !== undefined && storedChapters > 0 ? storedChapters : null;
}

/** True when an overflow row may be tagged "unassigned" (-1): not one of a finished series' own chapters. */
export function isTaggableOverflow(chapterNumber: number | null, finishedCount: number | null): boolean {
  if (chapterNumber === null) return false;
  return finishedCount === null || chapterNumber > finishedCount;
}

/**
 * Undo an earlier "-1" on chapters a finished series counts and no volume
 * holds, so the volume-id backfill can place them. Returns rows reset.
 */
async function untagCountedChapters(mangaId: number, finishedCount: number | null): Promise<number> {
  if (finishedCount === null) return 0;
  const reset = await prisma.chapter.updateMany({
    where: { mangaId, volume: -1, volumeId: null, chapterNumber: { gte: 1, lte: finishedCount } },
    data: { volume: null },
  });
  if (reset.count > 0) {
    logger.info(
      `[enrichmentPipeline] Cleared the unassigned tag on ${reset.count} chapter(s) within the ` +
      `finished series' ${finishedCount} chapters for manga ${mangaId}`,
    );
  }
  return reset.count;
}

interface OverflowVolume { id: number; number: number; chapterEnd: number }

/** Smallest free decimal in (base, base+1) — base=147 → 147.1, skipping already-taken numbers. */
export function pickDecimalAfter(base: number, taken: Set<number>): number | null {
  for (let k = 1; k <= 9; k++) {
    const cand = Math.round((base + k / 10) * 10) / 10;
    if (!taken.has(cand)) return cand;
  }
  return null;
}

/** A file-backed integer-omake's parent volume: the `vN.zip` archive it lives in (authoritative
 *  for whole-volume archives), else the nearest preceding volume within 10 chapters. */
export function resolveOmakeParentVolume(
  fileName: string,
  chapterNum: number,
  volumes: OverflowVolume[],
  volByNum: Map<number, OverflowVolume>,
): OverflowVolume | null {
  const fileMatch = /^v(\d+)\.zip$/i.exec(fileName);
  if (fileMatch?.[1]) {
    const v = volByNum.get(parseInt(fileMatch[1], 10));
    if (v) return v;
  }
  let best: OverflowVolume | null = null;
  let bestDist = Infinity;
  for (const v of volumes) {
    const dist = chapterNum - v.chapterEnd;
    if (dist > 0 && dist < bestDist) { bestDist = dist; best = v; }
  }
  return bestDist <= 10 ? best : null;
}

/**
 * Renumber file-backed integer overflow to a decimal in its parent volume.
 *
 * A finished series' real omake sometimes arrive as integer chapters beyond the final volume
 * (MangaDex numbers per-volume omake 168, 178, … and the row gets linked to the volume archive).
 * They aren't spurious — they point to real files — but as integers they sort wrong and inflate
 * the chapter count. Convert each to a decimal in its parent volume (169 → 147.1 in vol 21), keeping
 * the file + assigning the volume, so `Metadata.chapters` backfills to the true count.
 */
async function renumberFileBackedOverflow(
  mangaId: number,
  lastVolEnd: number,
  volumes: OverflowVolume[],
  finishedCount: number | null,
): Promise<void> {
  const fileOverflow = await prisma.chapter.findMany({
    where: { mangaId, chapterNumber: { gt: lastVolEnd }, filePath: { not: null } },
    select: { id: true, chapterNumber: true, fileName: true },
  });
  const ints = fileOverflow
    .filter((c): c is { id: number; chapterNumber: number; fileName: string } =>
      c.chapterNumber !== null && Number.isInteger(c.chapterNumber) && isTaggableOverflow(c.chapterNumber, finishedCount))
    .sort((a, b) => a.chapterNumber - b.chapterNumber);
  if (ints.length === 0) return;

  const existing = await prisma.chapter.findMany({
    where: { mangaId, chapterNumber: { not: null } },
    select: { chapterNumber: true },
  });
  const taken = new Set<number>(existing.map(c => c.chapterNumber as number));
  const volByNum = new Map(volumes.map(v => [v.number, v]));

  const updates: Array<{ id: number; chapterNumber: number; volume: number; volumeId: number }> = [];
  for (const ch of ints) {
    const parent = resolveOmakeParentVolume(ch.fileName, ch.chapterNumber, volumes, volByNum);
    if (!parent) continue;
    const dec = pickDecimalAfter(parent.chapterEnd, taken);
    if (dec === null) continue;
    taken.delete(ch.chapterNumber);
    taken.add(dec);
    updates.push({ id: ch.id, chapterNumber: dec, volume: parent.number, volumeId: parent.id });
  }
  if (updates.length === 0) return;

  await Promise.all(updates.map(u =>
    prisma.chapter.update({
      where: { id: u.id },
      data: { chapterNumber: u.chapterNumber, volume: u.volume, volumeId: u.volumeId },
    }),
  ));
  logger.info(
    `[enrichmentPipeline] Renumbered ${updates.length} file-backed omake to decimals in their ` +
    `parent volume for manga ${mangaId}`,
  );
}

/**
 * Handle chapters beyond the last volume's chapterEnd.
 *
 * - Finished + cross-validated series: integer overflow with no file is spurious provider numbering
 *   (the real omake live as decimals in the final volume) — DELETE it so the chapter count and the
 *   volume browser stay accurate. Decimals and any downloaded files are never touched.
 * - Otherwise: tag the overflow as awaiting its volume (volume = -1, see awaiting-volume.ts) — it
 *   is real latest content whose tankōbon is not out yet.
 *
 * Never creates phantom overflow volumes (the old behaviour that produced ghost vols 24/25).
 */
export async function assignOverflowChapters(
  mangaId: number,
  _expectedVolumeCount?: number,
): Promise<void> {
  const signal = await loadOverflowSignal(mangaId);
  if (!signal) return;
  const { status, finishedCount, volumes, lastVolEnd } = signal;

  if (shouldDeleteSpuriousOverflow(status, volumes[0]?.source ?? null)) {
    const overflowVolumes = volumes.map(v => ({ id: v.id, number: v.number, chapterEnd: v.chapterEnd as number }));
    // File-backed integer overflow = real omake → decimal in its parent volume (keeps the file).
    await renumberFileBackedOverflow(mangaId, lastVolEnd, overflowVolumes, finishedCount);
    // No-file integer overflow = spurious provider numbering → delete (167.x decimals are kept).
    const noFile = await prisma.chapter.findMany({
      where: { mangaId, chapterNumber: { gt: lastVolEnd }, filePath: null },
      select: { id: true, chapterNumber: true },
    });
    const spuriousIds = noFile
      .filter(c => c.chapterNumber !== null && Number.isInteger(c.chapterNumber))
      .filter(c => isTaggableOverflow(c.chapterNumber, finishedCount))
      .map(c => c.id);
    if (spuriousIds.length > 0) {
      await prisma.chapter.deleteMany({ where: { id: { in: spuriousIds } } });
      logger.info(
        `[enrichmentPipeline] Deleted ${spuriousIds.length} spurious overflow chapters ` +
        `(beyond ch ${lastVolEnd}, finished+cross-validated series) for manga ${mangaId}`,
      );
    }
    return;
  }

  await tagAwaitingRows(mangaId, signal);
}

interface OverflowSignal {
  status: MangaPublicationStatus | null;
  finishedCount: number | null;
  /** Numbered volumes with a full range, highest number first. */
  volumes: Array<{ id: number; number: number; chapterEnd: number | null; source: string | null }>;
  /** Every volume row, for the stale-number check. */
  allVolumes: AwaitingVolumeRow[];
  lastVolEnd: number;
}

/**
 * What the overflow decisions need, read after undoing "-1" on a finished
 * series' own chapters. Null when there is no overflow to consider: fewer than
 * two ranged volumes, or no chapter numbered past the last range.
 */
async function loadOverflowSignal(mangaId: number): Promise<OverflowSignal | null> {
  const manga = await prisma.manga.findUnique({
    where: { id: mangaId },
    select: { publicationStatus: true, Metadata: { select: { endDate: true, chapters: true } } },
  });
  const finishedCount = finishedSeriesChapterCount(
    manga?.publicationStatus, Boolean(manga?.Metadata?.endDate), manga?.Metadata?.chapters,
  );
  await untagCountedChapters(mangaId, finishedCount);

  const allVolumes = await prisma.volume.findMany({
    where: { mangaId },
    select: { id: true, number: true, chapterStart: true, chapterEnd: true, source: true },
    orderBy: { number: 'desc' },
  });
  const volumes = allVolumes.filter(v => v.number > 0 && v.chapterStart !== null && v.chapterEnd !== null);
  if (volumes.length < 2) return null;
  // The furthest range end, not the highest-numbered volume's: a stray "0-0"
  // range on a high number must not make every chapter overflow.
  const lastVolEnd = lastRangedVolumeEnd(volumes);
  if (lastVolEnd === null) return null;

  const maxChResult = await prisma.chapter.aggregate({ where: { mangaId }, _max: { chapterNumber: true } });
  if (maxChResult._max.chapterNumber === null || maxChResult._max.chapterNumber <= lastVolEnd) return null;
  return { status: manga?.publicationStatus ?? null, finishedCount, volumes, allVolumes, lastVolEnd };
}

/**
 * A downloaded row numbered past every chapter a finished series has. No
 * volume is still to come for it, so "awaiting its volume" (-1) would be
 * false: it is a mis-numbered file (Tokyo Ghoul's archive rows 145-159 in a
 * 144-chapter series hold chapters 69-121).
 */
export function isMisnumberedFile(
  row: { chapterNumber: number | null; filePath: string | null },
  finishedCount: number | null,
): boolean {
  return finishedCount !== null && row.filePath !== null && row.chapterNumber !== null
    && row.chapterNumber >= Math.floor(finishedCount) + 1;
}

/**
 * Mis-numbered files stay as they are, with no volume (the "Unassigned"
 * bucket, where they can be reassigned or removed); an earlier "-1" on them
 * is undone. Logged so the files can be repaired.
 */
async function leaveMisnumberedFilesUnassigned(
  mangaId: number,
  rows: Array<{ id: number; chapterNumber: number | null; volume: number | null }>,
  finishedCount: number | null,
): Promise<void> {
  if (rows.length === 0) return;
  const tagged = rows.filter(r => r.volume === AWAITING_VOLUME).map(r => r.id);
  if (tagged.length > 0) {
    await prisma.chapter.updateMany({ where: { id: { in: tagged } }, data: { volume: null } });
  }
  logger.warn(
    `[enrichmentPipeline] ${rows.length} downloaded chapter row(s) numbered past the finished series' ` +
    `${finishedCount} chapters are mis-numbered files, left unassigned for manga ${mangaId}: ` +
    rows.map(r => r.chapterNumber).join(', '),
  );
}

async function tagAwaitingRows(mangaId: number, signal: OverflowSignal): Promise<number> {
  const lastEnd = signal.lastVolEnd;
  // A tag on a chapter the volumes now reach is stale (its volume came out, or
  // the ranges moved): back to "unknown" for the range and decimal passes.
  const released = await prisma.chapter.updateMany({
    where: { mangaId, volume: AWAITING_VOLUME, volumeId: null, chapterNumber: { lt: lastEnd + 1 } },
    data: { volume: null },
  });
  if (released.count > 0) {
    logger.info(`[enrichmentPipeline] Cleared the awaiting-volume tag on ${released.count} chapter(s) within the volumes of manga ${mangaId}`);
  }
  const found = await prisma.chapter.findMany({
    where: { mangaId, volumeId: null, chapterNumber: { gt: lastEnd } },
    select: { id: true, chapterNumber: true, volume: true, volumeId: true, filePath: true },
  });
  const misnumbered = found.filter(r => isMisnumberedFile(r, signal.finishedCount));
  await leaveMisnumberedFilesUnassigned(mangaId, misnumbered, signal.finishedCount);
  const rows = found.filter(r => !misnumbered.includes(r));
  // A finished series' own chapters are never overflow (finishedSeriesChapterCount).
  const ids = planAwaitingVolumeTags(rows, signal.allVolumes, n => !isTaggableOverflow(n, signal.finishedCount));
  if (ids.length === 0) return 0;
  await prisma.chapter.updateMany({ where: { id: { in: ids } }, data: { volume: AWAITING_VOLUME } });
  logger.info(
    `[enrichmentPipeline] Tagged ${ids.length} chapters past the last volume (ends ch ${lastEnd}) ` +
    `as awaiting their volume for manga ${mangaId}`,
  );
  return ids.length;
}

/**
 * Re-apply the awaiting-volume tag after the late finalize passes (volume-id
 * backfill, manual manifest) cleared stale volume numbers. Without it the first
 * refresh left those chapters `volume = NULL` and only the second one tagged
 * them -1 (Sakamoto Days 256-278), so refreshes were not idempotent. Same gate
 * as assignOverflowChapters: a finished, cross-validated series' overflow is
 * never tagged.
 */
export async function tagChaptersAwaitingVolume(mangaId: number): Promise<number> {
  const signal = await loadOverflowSignal(mangaId);
  if (!signal) return 0;
  if (shouldDeleteSpuriousOverflow(signal.status, signal.volumes[0]?.source ?? null)) return 0;
  return tagAwaitingRows(mangaId, signal);
}
