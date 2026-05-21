/**
 * Database application of Wikipedia data
 */

import { prisma } from '@/server/db';
import { logger } from '@/utils/logger';

import type { ChapterEnrichmentMaps } from '../types';

/** Apply gap-filled Wikipedia data to existing DB chapters (updates only, no creates) */
export async function applyWikipediaDataToDb(
  mangaId: number,
  maps: ChapterEnrichmentMaps,
): Promise<void> {
  const existingChapters = await prisma.chapter.findMany({
    where: { mangaId },
    select: { chapterNumber: true },
  });
  const existingNumbers = new Set(existingChapters.map(c => c.chapterNumber));

  await updateExistingChapters(mangaId, maps, existingNumbers);
  await updateVolumeDescriptions(mangaId, maps.volumeDescriptionMap);
}

/** Update chapters that exist in DB with gap-filled data */
export async function updateExistingChapters(
  mangaId: number,
  maps: ChapterEnrichmentMaps,
  existingNumbers: Set<number | null>,
): Promise<void> {
  const allChapterNums = new Set([
    ...Object.keys(maps.chapterTitleMap).map(Number),
    ...Object.keys(maps.chapterVolumeMap).map(Number),
    ...Object.keys(maps.chapterReleaseDateMap).map(Number),
    ...Object.keys(maps.chapterPagesMap).map(Number),
  ]);

  let updatedCount = 0;
  for (const chapterNum of allChapterNums) {
    if (!existingNumbers.has(chapterNum)) continue;

    const updateData = buildChapterUpdate(chapterNum, maps);
    if (Object.keys(updateData).length === 0) continue;

    // eslint-disable-next-line no-await-in-loop -- Sequential DB updates for chapter enrichment
    const result = await prisma.chapter.updateMany({
      where: { mangaId, chapterNumber: chapterNum },
      data: updateData,
    });
    if (result.count > 0) updatedCount++;
  }

  if (updatedCount > 0) {
    logger.info(`[enrichmentPipeline] Wikipedia updated ${updatedCount} existing chapters`);
  }
}

/** Build update payload for a single chapter */
export function buildChapterUpdate(chapterNum: number, maps: ChapterEnrichmentMaps): Record<string, unknown> {
  const data: Record<string, unknown> = {};
  const titleVal = maps.chapterTitleMap[chapterNum];
  const volVal = maps.chapterVolumeMap[chapterNum];
  const dateVal = maps.chapterReleaseDateMap[chapterNum];
  const pagesVal = maps.chapterPagesMap[chapterNum];
  if (titleVal) data['title'] = titleVal;
  if (volVal !== undefined) data['volume'] = volVal;
  if (dateVal) data['releaseDate'] = new Date(dateVal);
  if (pagesVal) data['pages'] = pagesVal;
  return data;
}

/** Update volume descriptions from Wikipedia */
export async function updateVolumeDescriptions(
  mangaId: number,
  volumeDescriptionMap: Record<number, string>,
): Promise<void> {
  const entries = Object.entries(volumeDescriptionMap);
  if (entries.length === 0) return;

  let volUpdated = 0;
  for (const [volNumStr, description] of entries) {
    // eslint-disable-next-line no-await-in-loop -- Sequential DB updates for volume descriptions
    const res = await prisma.volume.updateMany({
      where: { mangaId, number: Number(volNumStr) },
      data: { description },
    });
    if (res.count > 0) volUpdated++;
  }

  if (volUpdated > 0) {
    logger.info(`[enrichmentPipeline] Wikipedia updated ${volUpdated} volume descriptions`);
  }
}