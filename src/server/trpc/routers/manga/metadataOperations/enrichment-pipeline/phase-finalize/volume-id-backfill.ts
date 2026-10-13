/**
 * Post-finalize backfill: link Chapter.volumeId (FK) to Volume.id
 * for chapters that have Chapter.volume (integer) set but volumeId null.
 *
 * The enrichment pipeline sets Chapter.volume throughout multiple phases
 * but rarely backfills the FK. This pass catches all remaining gaps.
 */

import { prisma } from '@/server/db';
import { logger } from '@/utils/logger';

export async function backfillChapterVolumeIds(mangaId: number): Promise<void> {
  try {
    // Pass 0: clear stale FKs that point at a Volume whose chapterStart..chapterEnd
    // range doesn't cover the chapter's number. These come from earlier runs that
    // trusted a Fandom-derived `Chapter.volume` int which contradicted the volume's
    // range (e.g. ch.16 tagged volume=4 but Vol 4 covers 24-28). Resetting lets
    // Pass 2 re-link them correctly.
    const realigned = await clearMisrangedFKs(mangaId);

    // Pass 1: link when Chapter.volume (integer) matches Volume.number, BUT only
    // when the chapter number actually fits the target volume's range (or the
    // target volume has no range — manhwa fallback).
    const integerLinked = await linkByChapterVolumeField(mangaId);

    // Pass 2: range-based — link chapters where Chapter.volume is null but the
    // chapterNumber falls within a Volume's chapterStart..chapterEnd range.
    // Covers manhwa/webtoon sources that never assign a per-chapter volume
    // integer; Volume ranges are authored by the cross-validation phase.
    const rangeLinked = await linkByChapterRange(mangaId);

    // Pass 3: single-volume fallback — when the manga has exactly 1 Volume
    // and chapters still lack volumeId, link all of them to that volume.
    // Handles manhwa/webtoon series where the catalog has one volume covering
    // every chapter (webtoon.fandom.com shared wikis, etc.).
    const singleVolLinked = await linkBySingleVolumeFallback(mangaId);

    // Pass 4: consistency — ensure the legacy `Chapter.volume` int matches the
    // FK target's `Volume.number`. The manga detail UI counts chapters per
    // volume by grouping on the legacy int, so drift here makes correctly-linked
    // chapters disappear from their volume's UI count.
    const aligned = await alignLegacyVolumeFieldToFK(mangaId);

    const total = realigned + integerLinked + rangeLinked + singleVolLinked + aligned;
    if (total > 0) {
      logger.info(
        `[enrichmentPipeline] Backfilled volumeId on ${total} chapters for manga ${mangaId} ` +
        `(${realigned} realigned, ${integerLinked} by integer field, ${rangeLinked} by chapter-range, ` +
        `${singleVolLinked} by single-volume fallback, ${aligned} legacy-int fixups)`,
      );
    }
  } catch (err) {
    logger.warn(`[enrichmentPipeline] volumeId backfill failed for manga ${mangaId} (non-critical)`, err);
  }
}

/**
 * Find chapters whose `volumeId` points at a Volume whose chapter-range
 * excludes the chapter's `chapterNumber`. Clear the FK so the range-based
 * pass can re-assign it correctly. Volumes without a range are left alone
 * (single-volume / range-less catalogs are valid).
 */
async function clearMisrangedFKs(mangaId: number): Promise<number> {
  const linked = await prisma.chapter.findMany({
    where: { mangaId, volumeId: { not: null }, chapterNumber: { not: null } },
    select: { id: true, chapterNumber: true, volumeId: true },
  });
  if (linked.length === 0) return 0;

  const ranged = await prisma.volume.findMany({
    where: { mangaId, chapterStart: { not: null }, chapterEnd: { not: null } },
    select: { id: true, chapterStart: true, chapterEnd: true },
  });
  const rangeMap = new Map(ranged.map(v => [v.id, v]));

  const toClear: number[] = [];
  for (const ch of linked) {
    if (ch.chapterNumber === null || ch.volumeId === null) continue;
    const target = rangeMap.get(ch.volumeId);
    if (!target) continue; // no range on the target volume → trust the FK
    if (target.chapterStart === null || target.chapterEnd === null) continue;
    if (ch.chapterNumber < target.chapterStart || ch.chapterNumber > target.chapterEnd) {
      toClear.push(ch.id);
    }
  }
  if (toClear.length === 0) return 0;

  await prisma.chapter.updateMany({
    where: { id: { in: toClear } },
    data: { volumeId: null, volume: null },
  });
  return toClear.length;
}

/**
 * Final consistency pass: copy each linked chapter's `Volume.number` into
 * `Chapter.volume` (legacy int) when the two disagree. The manga detail UI
 * groups chapters by the legacy int, so drift here makes range-correct
 * chapters disappear from their volume's UI count.
 */
async function alignLegacyVolumeFieldToFK(mangaId: number): Promise<number> {
  const drifted = await prisma.$queryRaw<Array<{ id: number; target: number }>>`
    SELECT c.id, v.number AS target
    FROM "Chapter" c
    JOIN "Volume" v ON v.id = c."volumeId"
    WHERE c."mangaId" = ${mangaId}
      AND c.volume IS DISTINCT FROM v.number
  `;
  if (drifted.length === 0) return 0;

  // Group by target so we can do one updateMany per distinct number.
  const byTarget = new Map<number, number[]>();
  for (const row of drifted) {
    const arr = byTarget.get(row.target) ?? [];
    arr.push(row.id);
    byTarget.set(row.target, arr);
  }
  for (const [target, ids] of byTarget) {
    // eslint-disable-next-line no-await-in-loop -- one updateMany per target value
    await prisma.chapter.updateMany({
      where: { id: { in: ids } },
      data: { volume: target },
    });
  }
  return drifted.length;
}

async function linkBySingleVolumeFallback(mangaId: number): Promise<number> {
  const volumes = await prisma.volume.findMany({
    where: { mangaId },
    select: { id: true, number: true },
  });
  if (volumes.length !== 1) return 0;
  const solo = volumes[0];
  if (!solo) return 0;

  const result = await prisma.chapter.updateMany({
    where: { mangaId, volumeId: null, chapterNumber: { not: null } },
    data: { volumeId: solo.id, volume: solo.number },
  });
  return result.count;
}

interface LegacyVolumeRow { id: number; volume: number | null; chapterNumber: number | null }
interface VolumeTarget { id: number; number: number; chapterStart: number | null; chapterEnd: number | null }

/**
 * Split unlinked rows by whether their legacy `Chapter.volume` int can be linked.
 *
 * A row whose int names a volume with a range that excludes its chapter carries a
 * stale int (a Fandom value, or a Wikipedia misparse: One Piece chapter 1195 arrived
 * as volume 15, whose range is 127-136). Linking it is refused, and the int is cleared
 * too: left in place, the detail UI counted the row under that volume and the volume's
 * whole-volume row went PENDING for it. Pass 2 then links it by range, if any covers it.
 */
export function planLegacyVolumeLinks(
  chapters: LegacyVolumeRow[],
  volByNum: Map<number, VolumeTarget>,
): { links: Array<{ id: number; volumeId: number }>; staleIntIds: number[] } {
  const links: Array<{ id: number; volumeId: number }> = [];
  const staleIntIds: number[] = [];
  for (const ch of chapters) {
    if (ch.volume === null) continue;
    const target = volByNum.get(ch.volume);
    if (!target) continue;
    const { chapterStart: cs, chapterEnd: ce } = target;
    // A decimal extra (255.5) belongs to the volume holding its integer part.
    const n = ch.chapterNumber !== null ? Math.floor(ch.chapterNumber) : null;
    if (cs !== null && ce !== null && n !== null && (n < cs || n > ce)) {
      staleIntIds.push(ch.id);
      continue;
    }
    links.push({ id: ch.id, volumeId: target.id });
  }
  return { links, staleIntIds };
}

async function linkByChapterVolumeField(mangaId: number): Promise<number> {
  const chapters = await prisma.chapter.findMany({
    where: { mangaId, volume: { not: null }, volumeId: null },
    select: { id: true, volume: true, chapterNumber: true },
  });
  if (chapters.length === 0) return 0;

  const volumes = await prisma.volume.findMany({
    where: { mangaId },
    select: { id: true, number: true, chapterStart: true, chapterEnd: true },
  });
  const { links, staleIntIds } = planLegacyVolumeLinks(chapters, new Map(volumes.map(v => [v.number, v])));

  if (staleIntIds.length > 0) {
    await prisma.chapter.updateMany({ where: { id: { in: staleIntIds } }, data: { volume: null } });
  }
  for (const link of links) {
    // eslint-disable-next-line no-await-in-loop -- per-chapter sequential FK update
    await prisma.chapter.update({ where: { id: link.id }, data: { volumeId: link.volumeId } });
  }
  return links.length + staleIntIds.length;
}

async function linkByChapterRange(mangaId: number): Promise<number> {
  const unassigned = await prisma.chapter.findMany({
    where: { mangaId, volumeId: null, chapterNumber: { not: null } },
    select: { id: true, chapterNumber: true },
  });
  if (unassigned.length === 0) return 0;

  const ranged = await prisma.volume.findMany({
    where: { mangaId, chapterStart: { not: null }, chapterEnd: { not: null } },
    select: { id: true, number: true, chapterStart: true, chapterEnd: true },
    orderBy: { number: 'asc' },
  });
  if (ranged.length === 0) return 0;

  let linked = 0;
  for (const ch of unassigned) {
    const n = ch.chapterNumber;
    if (n === null) continue;
    // First volume whose range contains this chapter number
    const hit = ranged.find(v =>
      v.chapterStart !== null && v.chapterEnd !== null &&
      n >= v.chapterStart && n <= v.chapterEnd,
    );
    if (!hit) continue;
    // eslint-disable-next-line no-await-in-loop -- per-chapter sequential update
    await prisma.chapter.update({
      where: { id: ch.id },
      data: { volumeId: hit.id, volume: hit.number },
    });
    linked++;
  }
  return linked;
}
