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

/**
 * Tag overflow chapters as verified-unassigned.
 *
 * Chapters beyond the last volume's chapterEnd that have no volume assignment
 * are set to volume = -1. The frontend renders these in an "Unassigned Chapters"
 * section with options to reassign or delete.
 *
 * Previously this module created estimated overflow volumes (24, 25, ...) which
 * produced phantom volumes for completed manga. The new approach is conservative:
 * leave them unassigned and let the user decide.
 */
export async function assignOverflowChapters(
  mangaId: number,
  _expectedVolumeCount?: number,
): Promise<void> {
  const volumes = await prisma.volume.findMany({
    where: { mangaId, number: { gt: 0 }, chapterStart: { not: null }, chapterEnd: { not: null } },
    select: { number: true, chapterEnd: true },
    orderBy: { number: 'desc' },
  });

  if (volumes.length < 2) return;
  const lastVolume = volumes[0];
  if (!lastVolume?.chapterEnd) return;
  const lastVolEnd = lastVolume.chapterEnd;

  // Check if any chapters exist beyond the last volume range
  const maxChResult = await prisma.chapter.aggregate({
    where: { mangaId },
    _max: { chapterNumber: true },
  });
  if (maxChResult._max.chapterNumber === null || maxChResult._max.chapterNumber <= lastVolEnd) return;

  // Find unassigned chapters beyond the last volume range
  const overflowCount = await prisma.chapter.count({
    where: { mangaId, chapterNumber: { gt: lastVolEnd }, volume: null },
  });
  if (overflowCount === 0) return;

  // Mark as verified-unassigned (volume = -1) instead of creating phantom volumes
  const updated = await prisma.chapter.updateMany({
    where: { mangaId, chapterNumber: { gt: lastVolEnd }, volume: null },
    data: { volume: -1 },
  });

  logger.info(
    `[enrichmentPipeline] Tagged ${updated.count} overflow chapters as unassigned ` +
    `(beyond ch ${lastVolEnd}) for manga ${mangaId}`,
  );
}
