/**
 * Volume range updates from Fandom mapping
 */

import { prisma } from '@/server/db';
import { logger } from '@/utils/logger';

import { buildVolRangesFromMap, hasExcessiveOverlaps, hasMonotonicityViolations, hasWideSpanVolumes } from './range-builders';

/** Update Volume records with chapterStart/chapterEnd from Fandom mapping.
 *  Clears all existing ranges first to prevent mixed provider/Fandom sources,
 *  then applies all Fandom evidence unconditionally. */
export async function updateVolumeRanges(
  mangaId: number,
  chapterVolumeMap: Record<number, number>,
): Promise<void> {
  if (Object.keys(chapterVolumeMap).length === 0) return;

  const volRanges = buildVolRangesFromMap(chapterVolumeMap);

  // Validate ranges BEFORE writing — reject if unreliable (overlapping, scrambled, or wide-span)
  if (hasExcessiveOverlaps(volRanges) || hasMonotonicityViolations(volRanges) || hasWideSpanVolumes(volRanges)) {
    logger.warn(`[enrichmentPipeline] Fandom volume ranges are unreliable — skipping range update, will use even distribution`);
    return;
  }

  // Clear all existing ranges to prevent mixed provider/Fandom sources
  await prisma.volume.updateMany({
    where: { mangaId },
    data: { chapterStart: null, chapterEnd: null },
  });

  let volUpdated = 0;
  for (const [volNumStr, range] of Object.entries(volRanges)) {
    const vn = Number(volNumStr);
    if (!Number.isInteger(range.start) || !Number.isInteger(range.end)) continue;

    // eslint-disable-next-line no-await-in-loop -- Sequential DB updates for volume ranges
    const res = await prisma.volume.updateMany({
      where: { mangaId, number: vn },
      data: { chapterStart: range.start, chapterEnd: range.end },
    });
    if (res.count > 0) volUpdated++;
  }
  logger.info(`[enrichmentPipeline] Updated ${volUpdated} volumes with Fandom chapter ranges`);
}

interface ChapterRange {
  start: number;
  end: number;
}

/**
 * Whether Fandom's range for a volume should replace the stored one.
 *
 * Fandom's range must be a superset of the stored range and strictly wider —
 * the stored (Wikipedia) range undercounted — without being unreasonably
 * wider (Vol 23: 69-71 → 37-98 means Fandom numbers its volumes differently),
 * and it must not reach into a neighbouring volume's range: Dandadan's open
 * volume 25 was widened from 214-248 to 211-248 while volume 24 ends at 213.
 *
 * @param previousEnd last chapter of the nearest lower volume with a range
 * @param nextStart first chapter of the nearest higher volume with a range
 */
export function acceptsFandomWidening(
  stored: ChapterRange,
  fandom: ChapterRange,
  previousEnd: number | null,
  nextStart: number | null,
): boolean {
  const storedSpan = stored.end - stored.start;
  const fandomSpan = fandom.end - fandom.start;
  const isSupersetAndWider = fandom.start <= stored.start && fandom.end >= stored.end && fandomSpan > storedSpan;
  if (!isSupersetAndWider) return false;
  if (fandomSpan > storedSpan * 3 + 2) return false;
  if (previousEnd !== null && fandom.start <= previousEnd) return false;
  if (nextStart !== null && fandom.end >= nextStart) return false;
  return true;
}

/**
 * Cross-validate Phase 2 (Wikipedia) volume ranges against Fandom's chapterVolumeMap.
 *
 * For each volume that exists in BOTH sources, compare chapter boundaries.
 * If Fandom's range is strictly wider (starts earlier or ends later) for the same
 * volume number, Wikipedia's regex likely missed some chapters — use Fandom's wider range.
 *
 * Does NOT use Fandom ranges when:
 * - Fandom's volume map is unreliable (checked before calling this function)
 * - Fandom uses different volume numbers than Wikipedia (no matching volume number)
 * - the wider range would overlap a neighbouring volume (see `acceptsFandomWidening`)
 */
export async function crossValidateVolumeRanges(
  mangaId: number,
  fandomVolumeMap: Record<number, number>,
): Promise<void> {
  const dbVolumes = await prisma.volume.findMany({
    where: { mangaId, chapterStart: { not: null }, chapterEnd: { not: null } },
    select: { number: true, chapterStart: true, chapterEnd: true },
    orderBy: { number: 'asc' },
  });

  if (dbVolumes.length === 0 || Object.keys(fandomVolumeMap).length === 0) return;

  const fandomRanges = buildVolRangesFromMap(fandomVolumeMap);
  // Working copy in volume order, updated as corrections land so each
  // volume is checked against its neighbours' current ranges.
  const ranges = dbVolumes.map(v => ({ number: v.number, start: v.chapterStart as number, end: v.chapterEnd as number }));

  let corrected = 0;
  for (const [i, current] of ranges.entries()) {
    const fandomRange = fandomRanges[current.number];
    if (!fandomRange) continue;

    const previousEnd = ranges[i - 1]?.end ?? null;
    const nextStart = ranges[i + 1]?.start ?? null;
    if (!acceptsFandomWidening(current, fandomRange, previousEnd, nextStart)) continue;

    // eslint-disable-next-line no-await-in-loop -- Sequential DB updates for volume range correction
    await prisma.volume.updateMany({
      where: { mangaId, number: current.number },
      data: { chapterStart: fandomRange.start, chapterEnd: fandomRange.end },
    });
    corrected++;
    logger.debug(
      `[enrichmentPipeline] Cross-validation: Vol ${current.number} corrected from ${current.start}-${current.end} to ${fandomRange.start}-${fandomRange.end}`,
    );
    current.start = fandomRange.start;
    current.end = fandomRange.end;
  }

  if (corrected > 0) {
    logger.info(`[enrichmentPipeline] Cross-validation: corrected ${corrected} volume ranges using Fandom data`);
  }
}
