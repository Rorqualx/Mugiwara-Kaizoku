/**
 * Post-finalize fill: populate Chapter.pages (and pageCount) from
 * MangaDex's chapter feed. Wikipedia's chapterList occasionally carries
 * `pages` on volume tables, used as a secondary source.
 *
 * Fill-when-null/zero only — never overrides a real page count written
 * earlier in the pipeline.
 */

import { prisma } from '@/server/db';
import { logger } from '@/utils/logger';

import type { UnifiedProviderResults } from '../types';

interface ProviderChapter { number: number; pages?: number }

export async function fillChapterPagesFromProviders(
  mangaId: number,
  providerResults: UnifiedProviderResults,
): Promise<void> {
  try {
    const mangadex = providerResults.mangadexChapterList ?? [];
    const wikipedia = providerResults.wikipediaResult?.chapterList ?? [];
    const pagesByNumber = buildPagesMap(mangadex, wikipedia);
    if (pagesByNumber.size === 0) return;

    const chapters = await prisma.chapter.findMany({
      where: {
        mangaId,
        chapterNumber: { not: null },
        OR: [{ pages: null }, { pages: 0 }, { pageCount: null }, { pageCount: 0 }],
      },
      select: { id: true, chapterNumber: true, pages: true, pageCount: true },
    });

    let filled = 0;
    for (const c of chapters) {
      if (c.chapterNumber === null) continue;
      const pages = pagesByNumber.get(c.chapterNumber);
      if (!pages || pages <= 0) continue;
      const data: { pages?: number; pageCount?: number } = {};
      if (c.pages === null || c.pages === 0) data.pages = pages;
      if (c.pageCount === null || c.pageCount === 0) data.pageCount = pages;
      if (Object.keys(data).length === 0) continue;
      // eslint-disable-next-line no-await-in-loop -- per-chapter sequential update
      await prisma.chapter.update({ where: { id: c.id }, data });
      filled++;
    }
    if (filled > 0) {
      logger.info(`[enrichmentPipeline] Filled ${filled} chapter page counts from MangaDex/Wikipedia for manga ${mangaId}`);
    }
  } catch (err) {
    logger.warn(`[enrichmentPipeline] Failed to fill chapter page counts for manga ${mangaId} (non-critical)`, err);
  }
}

function buildPagesMap(
  mangadex: ProviderChapter[],
  wikipedia: ProviderChapter[],
): Map<number, number> {
  const map = new Map<number, number>();
  // Wikipedia first so MangaDex wins on conflict (more reliable per-chapter counts)
  for (const ch of wikipedia) {
    if (typeof ch.pages === 'number' && ch.pages > 0) map.set(ch.number, ch.pages);
  }
  for (const ch of mangadex) {
    if (typeof ch.pages === 'number' && ch.pages > 0) map.set(ch.number, ch.pages);
  }
  return map;
}
