/**
 * Core chapter-to-volume assignment logic
 */

import { prisma } from '@/server/db';
import { logger } from '@/utils/logger';

import { sanitizeVolumeRanges } from '../volume-range-sanitization';

import { evenDistributionFallback } from './distribution';
import { fillExcludedVolumeGaps } from './distribution';
import { assignVolumesSequentially } from './sequential';

import type { MutableVolume } from '../volume-range-sanitization';

/** Assign volumes to chapters using Volume records' chapterStart/chapterEnd ranges.
 *  Uses unified sanitization, complete gap-fill, and even-distribution fallback. */
export async function assignVolumesFromRanges(mangaId: number): Promise<void> {
  const allVolumes = await prisma.volume.findMany({
    where: { mangaId },
    select: { number: true, chapterStart: true, chapterEnd: true, totalChapters: true },
    orderBy: { number: 'asc' },
  });

  const hasFractionalRanges = allVolumes.some(v =>
    (v.chapterStart !== null && !Number.isInteger(v.chapterStart)) ||
    (v.chapterEnd !== null && !Number.isInteger(v.chapterEnd)),
  );

  if (hasFractionalRanges) {
    await assignVolumesSequentially(mangaId);
    return;
  }

  // Unified sanitization — single pass
  const { valid: validVolumes, excluded } = sanitizeVolumeRanges(
    allVolumes.map(v => ({ number: v.number, chapterStart: v.chapterStart, chapterEnd: v.chapterEnd })),
  );

  // Even distribution fallback when NO volumes have ranges
  if (validVolumes.length === 0) {
    await evenDistributionFallback(mangaId, allVolumes);
    return;
  }

  // Assign chapters to valid volume ranges (pick narrowest match)
  await assignChaptersToValidRanges(mangaId, validVolumes);

  // Gap-fill excluded volumes from unassigned chapters
  const excludedNums = excluded.map(v => v.number);
  if (excludedNums.length > 0) {
    await clearAndGapFill(mangaId, excludedNums, validVolumes);
  }

  // Final pass: assign any remaining unassigned chapters to nearest volume
  await assignRemainingToNearest(mangaId, validVolumes, excluded);
}

/** Assign chapters to valid volume ranges, picking the narrowest match */
export async function assignChaptersToValidRanges(
  mangaId: number,
  validVolumes: MutableVolume[],
): Promise<void> {
  const chapters = await prisma.chapter.findMany({
    where: { mangaId },
    select: { id: true, chapterNumber: true, volume: true },
  });

  let assigned = 0;
  for (const ch of chapters) {
    if (ch.chapterNumber === null) continue;
    // Only assign unassigned chapters — don't override Fandom's per-chapter assignments
    if (ch.volume !== null) continue;

    const matchingVol = findNarrowestMatch(ch.chapterNumber, validVolumes);
    if (!matchingVol) continue;

    // eslint-disable-next-line no-await-in-loop -- Sequential DB updates for volume assignment
    await prisma.chapter.update({ where: { id: ch.id }, data: { volume: matchingVol.number } });
    assigned++;
  }

  if (assigned > 0) {
    logger.info(`[enrichmentPipeline] Volume assignment: ${assigned} assigned`);
  }
}

/** Find the volume with the narrowest range containing a chapter number */
export function findNarrowestMatch(
  chNum: number,
  volumes: MutableVolume[],
): MutableVolume | undefined {
  const candidates = volumes.filter(v =>
    v.chapterStart !== null && v.chapterEnd !== null &&
    chNum >= v.chapterStart && chNum <= v.chapterEnd,
  );
  if (candidates.length === 0) return undefined;
  return candidates.reduce((best, v) => {
    const bestSpan = (best.chapterEnd ?? 0) - (best.chapterStart ?? 0);
    const vSpan = (v.chapterEnd ?? 0) - (v.chapterStart ?? 0);
    return vSpan < bestSpan ? v : best;
  });
}

/** Final pass: assign remaining unassigned chapters to the nearest volume by chapter number.
 *  Handles boundary gaps (e.g., ch 17 between Vol 2 end=16 and Vol 3 start=18)
 *  and chapters beyond the last volume. */
async function assignRemainingToNearest(
  mangaId: number,
  validVolumes: MutableVolume[],
  excluded: MutableVolume[],
): Promise<void> {
  const allVols = [...validVolumes, ...excluded]
    .filter(v => v.chapterStart !== null && v.chapterEnd !== null)
    .sort((a, b) => (a.chapterStart ?? 0) - (b.chapterStart ?? 0));

  if (allVols.length === 0) return;

  const remaining = await prisma.chapter.findMany({
    where: { mangaId, volume: null, chapterNumber: { not: null } },
    select: { id: true, chapterNumber: true },
    orderBy: { chapterNumber: 'asc' },
  });
  if (remaining.length === 0) return;

  let assigned = 0;
  for (const ch of remaining) {
    const chNum = ch.chapterNumber ?? 0;
    let bestVol: MutableVolume | undefined;
    let bestDist = Infinity;

    for (const v of allVols) {
      const start = v.chapterStart ?? 0;
      const end = v.chapterEnd ?? 0;
      // Distance: 0 if within range, otherwise distance to nearest edge
      const dist = chNum >= start && chNum <= end ? 0 : Math.min(Math.abs(chNum - start), Math.abs(chNum - end));
      if (dist < bestDist) { bestDist = dist; bestVol = v; }
    }

    if (bestVol && bestDist <= 5) {
      // eslint-disable-next-line no-await-in-loop -- Sequential DB updates for nearest-neighbor assignment
      await prisma.chapter.update({ where: { id: ch.id }, data: { volume: bestVol.number } });
      assigned++;
    }
  }

  if (assigned > 0) {
    logger.info(`[enrichmentPipeline] Nearest-neighbor: assigned ${assigned} boundary/gap chapters`);
  }
}

/** Gap-fill excluded volumes from unassigned chapters (never clears existing assignments) */
export async function clearAndGapFill(
  mangaId: number,
  excludedNums: number[],
  validVolumes: MutableVolume[],
): Promise<void> {
  // Don't clear existing assignments — Fandom's per-chapter data is authoritative
  const gapResult = await fillExcludedVolumeGaps(mangaId, excludedNums, validVolumes);
  if (gapResult > 0) {
    logger.info(`[enrichmentPipeline] Gap-fill: assigned ${gapResult} chapters to ${excludedNums.length} uncovered volumes`);
  }
}