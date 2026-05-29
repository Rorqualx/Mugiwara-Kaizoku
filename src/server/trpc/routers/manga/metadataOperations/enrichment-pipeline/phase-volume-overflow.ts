/**
 * Overflow Chapter Handler
 *
 * Handles chapters that fall beyond the last known volume range.
 * Instead of creating phantom overflow volumes (which produced ghost volumes
 * for completed manga like Dorohedoro), this module marks overflow chapters
 * as verified-unassigned (volume = -1) so the UI groups them under
 * "Unassigned Chapters" where users can reassign them manually.
 */

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
): Promise<void> {
  const fileOverflow = await prisma.chapter.findMany({
    where: { mangaId, chapterNumber: { gt: lastVolEnd }, filePath: { not: null } },
    select: { id: true, chapterNumber: true, fileName: true },
  });
  const ints = fileOverflow
    .filter((c): c is { id: number; chapterNumber: number; fileName: string } =>
      c.chapterNumber !== null && Number.isInteger(c.chapterNumber))
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
 * - Otherwise: conservatively tag overflow as verified-unassigned (volume = -1) for the UI's
 *   "Unassigned Chapters" section — it may be real latest content awaiting a tankōbon.
 *
 * Never creates phantom overflow volumes (the old behaviour that produced ghost vols 24/25).
 */
export async function assignOverflowChapters(
  mangaId: number,
  _expectedVolumeCount?: number,
): Promise<void> {
  const volumes = await prisma.volume.findMany({
    where: { mangaId, number: { gt: 0 }, chapterStart: { not: null }, chapterEnd: { not: null } },
    select: { id: true, number: true, chapterEnd: true, source: true },
    orderBy: { number: 'desc' },
  });

  if (volumes.length < 2) return;
  const lastVolume = volumes[0];
  if (!lastVolume?.chapterEnd) return;
  const lastVolEnd = lastVolume.chapterEnd;

  const maxChResult = await prisma.chapter.aggregate({
    where: { mangaId },
    _max: { chapterNumber: true },
  });
  if (maxChResult._max.chapterNumber === null || maxChResult._max.chapterNumber <= lastVolEnd) return;

  const manga = await prisma.manga.findUnique({
    where: { id: mangaId },
    select: { publicationStatus: true },
  });

  if (shouldDeleteSpuriousOverflow(manga?.publicationStatus, lastVolume.source)) {
    const overflowVolumes = volumes.map(v => ({ id: v.id, number: v.number, chapterEnd: v.chapterEnd as number }));
    // File-backed integer overflow = real omake → decimal in its parent volume (keeps the file).
    await renumberFileBackedOverflow(mangaId, lastVolEnd, overflowVolumes);
    // No-file integer overflow = spurious provider numbering → delete (167.x decimals are kept).
    const noFile = await prisma.chapter.findMany({
      where: { mangaId, chapterNumber: { gt: lastVolEnd }, filePath: null },
      select: { id: true, chapterNumber: true },
    });
    const spuriousIds = noFile
      .filter(c => c.chapterNumber !== null && Number.isInteger(c.chapterNumber))
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

  // Conservative path: tag still-unassigned overflow as verified-unassigned.
  const toTag = await prisma.chapter.findMany({
    where: { mangaId, chapterNumber: { gt: lastVolEnd }, volume: null },
    select: { id: true },
  });
  if (toTag.length === 0) return;
  await prisma.chapter.updateMany({
    where: { id: { in: toTag.map(c => c.id) } },
    data: { volume: -1 },
  });
  logger.info(
    `[enrichmentPipeline] Tagged ${toTag.length} overflow chapters as unassigned ` +
    `(beyond ch ${lastVolEnd}) for manga ${mangaId}`,
  );
}
