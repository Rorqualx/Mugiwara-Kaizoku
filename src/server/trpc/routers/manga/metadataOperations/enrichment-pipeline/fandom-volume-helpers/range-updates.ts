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

  let corrected = 0;
  for (const dbVol of dbVolumes) {
    const fandomRange = fandomRanges[dbVol.number];
    if (!fandomRange) continue;

    const wikiStart = dbVol.chapterStart as number;
    const wikiEnd = dbVol.chapterEnd as number;
    const { start: fandomStart, end: fandomEnd } = fandomRange;

    // Fandom range must be a superset of Wikipedia's range (same or wider on both ends)
    // and strictly wider overall — this means Wikipedia undercounted
    const wikiSpan = wikiEnd - wikiStart;
    const fandomSpan = fandomEnd - fandomStart;
    const isSupersetAndWider =
      fandomStart <= wikiStart &&
      fandomEnd >= wikiEnd &&
      fandomSpan > wikiSpan;

    // Reject corrections where Fandom's range is unreasonably wider than Wikipedia's
    // (e.g., Vol 23: 69-71 → 37-98 means Fandom has wrong volume numbers)
    const isReasonablyWider = fandomSpan <= wikiSpan * 3 + 2;

    if (isSupersetAndWider && isReasonablyWider) {
      // eslint-disable-next-line no-await-in-loop -- Sequential DB updates for volume range correction
      await prisma.volume.updateMany({
        where: { mangaId, number: dbVol.number },
        data: { chapterStart: fandomStart, chapterEnd: fandomEnd },
      });
      corrected++;
      logger.debug(
        `[enrichmentPipeline] Cross-validation: Vol ${dbVol.number} corrected from ${wikiStart}-${wikiEnd} to ${fandomStart}-${fandomEnd}`,
      );
    }
  }

  if (corrected > 0) {
    logger.info(`[enrichmentPipeline] Cross-validation: corrected ${corrected} volume ranges using Fandom data`);
  }
}