/**
 * Volume range application from Wikipedia
 */

import { prisma } from '@/server/db';
import { logger } from '@/utils/logger';

import { updateVolumeRanges, assignVolumesFromRanges, isUnreliableVolumeMap, createMissingVolumes } from '../fandom-volume-helpers';

/** Validate and fix off-by-one issues in the chapter-to-volume map.
 *  If all chapters are shifted (e.g. start at 0 instead of 1), adjusts them. */
export function validateAndFixChapterVolumeMap(
  chapterVolumeMap: Record<number, number>,
): Record<number, number> {
  const chapterNums = Object.keys(chapterVolumeMap).map(Number).sort((a, b) => a - b);
  if (chapterNums.length === 0) return chapterVolumeMap;

  // Check for off-by-one: if first chapter is 0, shift all chapters up by 1
  if (chapterNums[0] === 0) {
    logger.warn('[enrichmentPipeline] Wikipedia volume ranges start at ch 0 — shifting +1');
    const adjusted: Record<number, number> = {};
    for (const [chNumStr, volNum] of Object.entries(chapterVolumeMap)) {
      adjusted[Number(chNumStr) + 1] = volNum;
    }
    return adjusted;
  }

  return chapterVolumeMap;
}

/** Apply Wikipedia volume data to set Volume ranges and chapter assignments.
 *  Only runs when Fandom's volume data was missing/unreliable.
 *  Skips if Phase 2 (ComicVine) already provided good ranges. */
export async function applyWikipediaVolumeRanges(
  mangaId: number,
  chapterVolumeMap: Record<number, number>,
): Promise<void> {
  // Validate Wikipedia's data isn't also bad
  if (isUnreliableVolumeMap(chapterVolumeMap)) {
    logger.warn(`[enrichmentPipeline] Wikipedia volume data also has excessive overlaps — skipping`);
    return;
  }

  // Safety guard: don't overwrite existing good ranges from Phase 2 (ComicVine)
  const [totalVolumes, volumesWithRanges] = await Promise.all([
    prisma.volume.count({ where: { mangaId } }),
    prisma.volume.count({
      where: { mangaId, chapterStart: { not: null }, chapterEnd: { not: null } },
    }),
  ]);

  if (totalVolumes > 0 && volumesWithRanges > totalVolumes * 0.5) {
    logger.info(
      `[enrichmentPipeline] Existing volume ranges are good (${volumesWithRanges}/${totalVolumes}) — skipping Wikipedia overwrite`,
    );
    // Still assign chapters from existing ranges if not assigned yet
    await assignVolumesFromRanges(mangaId);
    return;
  }

  // Validate and fix off-by-one issues before applying
  const fixedMap = validateAndFixChapterVolumeMap(chapterVolumeMap);

  // Clear existing chapter volumes and set from Wikipedia
  await prisma.chapter.updateMany({
    where: { mangaId },
    data: { volume: null },
  });

  // Create missing Volume records before setting ranges
  await createMissingVolumes(mangaId, fixedMap);

  // Update Volume records with ranges from Wikipedia
  await updateVolumeRanges(mangaId, fixedMap);

  // Set chapter.volume using the new ranges
  await assignVolumesFromRanges(mangaId);

  logger.info(`[enrichmentPipeline] Wikipedia set volume ranges and assigned chapters from ${Object.keys(fixedMap).length} volume mappings`);
}