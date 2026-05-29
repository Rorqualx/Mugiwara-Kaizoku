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
    select: { number: true, chapterEnd: true, source: true },
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

  // Overflow candidates with no downloaded file (never touch real downloads or decimals here).
  const candidates = await prisma.chapter.findMany({
    where: { mangaId, chapterNumber: { gt: lastVolEnd }, filePath: null },
    select: { id: true, chapterNumber: true, volume: true },
  });
  if (candidates.length === 0) return;

  if (shouldDeleteSpuriousOverflow(manga?.publicationStatus, lastVolume.source)) {
    // Integer overflow only — 167.x decimals are the final volume's real omake.
    const spuriousIds = candidates
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
  const toTag = candidates.filter(c => c.volume === null).map(c => c.id);
  if (toTag.length === 0) return;
  await prisma.chapter.updateMany({ where: { id: { in: toTag } }, data: { volume: -1 } });
  logger.info(
    `[enrichmentPipeline] Tagged ${toTag.length} overflow chapters as unassigned ` +
    `(beyond ch ${lastVolEnd}) for manga ${mangaId}`,
  );
}
