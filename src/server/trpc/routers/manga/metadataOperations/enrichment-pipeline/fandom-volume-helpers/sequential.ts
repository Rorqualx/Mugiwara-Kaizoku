/**
 * Sequential distribution fallback for fractional chapter numbers
 */

import { prisma } from '@/server/db';
import { logger } from '@/utils/logger';

/** Sequential distribution fallback for manga with numbering mismatches */
export async function assignVolumesSequentially(mangaId: number): Promise<void> {
  const volumes = await prisma.volume.findMany({
    where: { mangaId },
    select: { number: true, totalChapters: true },
    orderBy: { number: 'asc' },
  });

  const chapters = await prisma.chapter.findMany({
    where: { mangaId },
    select: { id: true, chapterNumber: true, volume: true },
    orderBy: { chapterNumber: 'asc' },
  });

  if (chapters.length === 0 || volumes.length === 0) return;

  logger.info(`[enrichmentPipeline] Numbering mismatch — sequential distribution for ${volumes.length} volumes, ${chapters.length} chapters`);

  let cursor = 0;
  let assigned = 0;

  for (const vol of volumes) {
    const count = vol.totalChapters ?? 0;
    if (count <= 0 || cursor >= chapters.length) continue;

    const batch = chapters.slice(cursor, cursor + count);
    for (const ch of batch) {
      if (ch.volume !== null) continue; // Skip already-assigned chapters
      // eslint-disable-next-line no-await-in-loop -- Sequential volume assignment
      await prisma.chapter.update({ where: { id: ch.id }, data: { volume: vol.number } });
    }
    assigned += batch.length;

    const first = batch[0]?.chapterNumber;
    const last = batch[batch.length - 1]?.chapterNumber;
    if (first !== null && first !== undefined && last !== null && last !== undefined) {
      // eslint-disable-next-line no-await-in-loop -- Must update range after assignment
      await prisma.volume.updateMany({
        where: { mangaId, number: vol.number },
        data: { chapterStart: first, chapterEnd: last },
      });
    }
    cursor += count;
  }

  logger.info(`[enrichmentPipeline] Sequential distribution: ${assigned} chapters across ${volumes.length} volumes`);
}