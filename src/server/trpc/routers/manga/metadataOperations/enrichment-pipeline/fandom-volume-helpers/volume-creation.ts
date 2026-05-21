/**
 * Create missing Volume records from Fandom data
 */

import { prisma } from '@/server/db';
import { logger } from '@/utils/logger';

import { getVolumeCapForManga } from '../phase-volume-cross-validation/db-volume-cap';

import { buildVolRangesFromMap } from './range-builders';

/**
 * Create Volume records that Fandom knows about but are missing from DB.
 *
 * @param expectedVolumeCount - Max expected volume count (0 or undefined =
 *   fall back to DB-driven cap via getVolumeCapForManga).
 *   Volumes beyond cap are rejected to prevent phantom volumes.
 *
 * iter-MM-8: when expectedVolumeCount is missing we resolve the cap from
 * persisted Metadata + KR-webtoon rule, so legacy callers that didn't
 * thread the value through still get protected.
 */
export async function createMissingVolumes(
  mangaId: number,
  chapterVolumeMap: Record<number, number>,
  expectedVolumeCount?: number,
): Promise<void> {
  if (Object.keys(chapterVolumeMap).length === 0) return;

  const { cap, source: capSource } = await getVolumeCapForManga(mangaId, expectedVolumeCount);
  const maxVolume = cap;
  if (capSource === 'kr-webtoon') {
    logger.info(`[enrichmentPipeline] KR webtoon cap=${cap} applied to createMissingVolumes for manga ${mangaId}`);
  }

  const fandomVolNums = new Set<number>();
  for (const vNum of Object.values(chapterVolumeMap)) {
    if (vNum > 0 && vNum <= maxVolume) fandomVolNums.add(vNum);
  }
  if (fandomVolNums.size === 0) return;

  const existingVolumes = await prisma.volume.findMany({
    where: { mangaId },
    select: { number: true },
  });
  const existingVolNums = new Set(existingVolumes.map(v => v.number));

  const volRanges = buildVolRangesFromMap(chapterVolumeMap);

  const volumesToCreate = [...fandomVolNums]
    .filter(vn => !existingVolNums.has(vn))
    .map(vn => ({
      mangaId,
      number: vn,
      source: 'fandom' as const,
      chapterStart: volRanges[vn]?.start ?? null,
      chapterEnd: volRanges[vn]?.end ?? null,
      totalChapters: volRanges[vn]?.chapterCount ?? null,
    }));

  if (volumesToCreate.length > 0) {
    await prisma.volume.createMany({ data: volumesToCreate });
    logger.info(`[enrichmentPipeline] Created ${volumesToCreate.length} missing volumes from Fandom data`);
  }
}