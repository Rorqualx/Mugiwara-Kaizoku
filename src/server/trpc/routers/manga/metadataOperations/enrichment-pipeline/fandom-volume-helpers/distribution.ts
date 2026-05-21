/**
 * Distribution and gap-fill logic for volume assignment
 */

import { prisma } from '@/server/db';
import { logger } from '@/utils/logger';

import type { MutableVolume } from '../volume-range-sanitization';

/** When zero volumes have ranges, distribute all chapters evenly across volumes */
export async function evenDistributionFallback(
  mangaId: number,
  allVolumes: { number: number }[],
): Promise<void> {
  const unassigned = await prisma.chapter.findMany({
    where: { mangaId, volume: null },
    select: { id: true, chapterNumber: true },
    orderBy: { chapterNumber: 'asc' },
  });

  if (allVolumes.length > 0 && unassigned.length > 0) {
    const total = await distributeChaptersAcrossVolumes(
      mangaId,
      allVolumes.map(v => v.number),
      unassigned,
    );
    logger.info(`[enrichmentPipeline] Even distribution fallback: ${total} chapters across ${allVolumes.length} volumes`);
  }
}

/** Distribute chapters evenly across a set of volumes, updating ranges */
export async function distributeChaptersAcrossVolumes(
  mangaId: number,
  volNums: number[],
  chapters: { id: number; chapterNumber: number | null }[],
): Promise<number> {
  if (volNums.length === 0 || chapters.length === 0) return 0;
  const chapsPerVol = Math.ceil(chapters.length / volNums.length);
  let totalAssigned = 0;
  let cursor = 0;

  for (const volNum of volNums) {
    const batch = chapters.slice(cursor, cursor + chapsPerVol);
    if (batch.length === 0) break;

    for (const ch of batch) {
      // eslint-disable-next-line no-await-in-loop -- Sequential DB updates for gap-fill assignment
      await prisma.chapter.update({ where: { id: ch.id }, data: { volume: volNum } });
    }
    totalAssigned += batch.length;

    const firstCh = batch[0]?.chapterNumber;
    const lastCh = batch[batch.length - 1]?.chapterNumber;
    if (firstCh !== null && firstCh !== undefined && lastCh !== null && lastCh !== undefined) {
      // eslint-disable-next-line no-await-in-loop -- Must update range after batch
      await prisma.volume.updateMany({
        where: { mangaId, number: volNum },
        data: { chapterStart: firstCh, chapterEnd: lastCh },
      });
    }
    cursor += chapsPerVol;
  }
  return totalAssigned;
}

/** When sanitization excludes volumes with bad ranges, infer correct ranges
 *  from gaps between neighboring valid volumes and distribute evenly.
 *  Handles before, between, AND after gaps. */
export async function fillExcludedVolumeGaps(
  mangaId: number,
  excludedVolNums: number[],
  validVolumes: MutableVolume[],
): Promise<number> {
  if (excludedVolNums.length === 0 || validVolumes.length === 0) return 0;

  const unassigned = await prisma.chapter.findMany({
    where: { mangaId, volume: null, chapterNumber: { not: null } },
    select: { id: true, chapterNumber: true },
    orderBy: { chapterNumber: 'asc' },
  });
  if (unassigned.length === 0) return 0;

  const sortedValid = [...validVolumes]
    .filter(v => v.chapterStart !== null)
    .sort((a, b) => (a.chapterStart ?? 0) - (b.chapterStart ?? 0));

  const lowestStart = sortedValid[0]?.chapterStart ?? Infinity;
  const highestEnd = sortedValid[sortedValid.length - 1]?.chapterEnd ?? 0;
  const firstValidNum = sortedValid[0]?.number ?? Infinity;
  const lastValidNum = sortedValid[sortedValid.length - 1]?.number ?? 0;

  let totalAssigned = 0;

  // Gap before first valid volume
  const beforeVols = excludedVolNums.filter(n => n < firstValidNum);
  const chapsBefore = unassigned.filter(ch => (ch.chapterNumber ?? 0) < lowestStart);
  if (beforeVols.length > 0 && chapsBefore.length > 0) {
    totalAssigned += await distributeChaptersAcrossVolumes(mangaId, beforeVols, chapsBefore);
  }

  // Gaps BETWEEN consecutive valid volumes
  totalAssigned += await fillBetweenGaps(mangaId, excludedVolNums, sortedValid, unassigned);

  // Gap after last valid volume
  const afterVols = excludedVolNums.filter(n => n > lastValidNum);
  const chapsAfter = unassigned.filter(ch => (ch.chapterNumber ?? 0) > highestEnd);
  if (afterVols.length > 0 && chapsAfter.length > 0) {
    totalAssigned += await distributeChaptersAcrossVolumes(mangaId, afterVols, chapsAfter);
  }

  return totalAssigned;
}

/** Fill gaps between consecutive pairs of valid volumes */
export async function fillBetweenGaps(
  mangaId: number,
  excludedVolNums: number[],
  sortedValid: MutableVolume[],
  unassigned: { id: number; chapterNumber: number | null }[],
): Promise<number> {
  let totalAssigned = 0;

  for (let i = 0; i < sortedValid.length - 1; i++) {
    const validA = sortedValid[i];
    const validB = sortedValid[i + 1];
    if (!validA || !validB) continue;

    const betweenVols = excludedVolNums
      .filter(n => n > validA.number && n < validB.number)
      .sort((a, b) => a - b);
    if (betweenVols.length === 0) continue;

    const gapChaps = unassigned.filter(ch => {
      const num = ch.chapterNumber ?? 0;
      return num > (validA.chapterEnd ?? 0) && num < (validB.chapterStart ?? Infinity);
    });
    if (gapChaps.length === 0) continue;

    // eslint-disable-next-line no-await-in-loop -- Sequential gap processing between valid volumes
    totalAssigned += await distributeChaptersAcrossVolumes(mangaId, betweenVols, gapChaps);
  }

  return totalAssigned;
}