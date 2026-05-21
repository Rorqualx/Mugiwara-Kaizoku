/**
 * Lightweight audit after applying Fandom data
 */

import { prisma } from '@/server/db';
import { logger } from '@/utils/logger';

/** Lightweight audit after applying Fandom data — logs warnings for data quality issues */
export async function auditEnrichmentResult(mangaId: number): Promise<void> {
  const [unlinkedChapterCount, volumesWithRanges] = await Promise.all([
    prisma.chapter.count({ where: { mangaId, volume: null } }),
    prisma.volume.findMany({
      where: { mangaId, chapterStart: { not: null }, chapterEnd: { not: null } },
      select: { number: true, chapterStart: true, chapterEnd: true },
      orderBy: { number: 'asc' },
    }),
  ]);

  if (unlinkedChapterCount > 0) {
    logger.warn(`[enrichmentPipeline] Audit: ${unlinkedChapterCount} chapters without volume assignment for manga ${mangaId}`);
  }

  const overlaps: string[] = [];
  for (let i = 1; i < volumesWithRanges.length; i++) {
    const prev = volumesWithRanges[i - 1];
    const curr = volumesWithRanges[i];
    if (!prev || !curr) continue;
    if (curr.chapterStart !== null && prev.chapterEnd !== null && curr.chapterStart <= prev.chapterEnd) {
      overlaps.push(`Vol${prev.number}(${prev.chapterStart}-${prev.chapterEnd}) / Vol${curr.number}(${curr.chapterStart}-${curr.chapterEnd})`);
    }
  }
  if (overlaps.length > 0) {
    logger.warn(`[enrichmentPipeline] Audit: Overlapping volume ranges for manga ${mangaId}: ${overlaps.join(', ')}`);
  }
}