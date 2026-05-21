/**
 * Backfill Metadata.chapters from MAX(Chapter.chapterNumber) when AniList/
 * Kitsu/MAL/MU all left it null. Library survey showed 91.7% of null-chapters
 * titles already have populated Chapter rows from prior enrichment.
 *
 * Uses FLOOR(MAX(chapterNumber)) where 0 < chapterNumber < 10000 — the
 * highest published chapter, ignoring volume-file shells (index >= 100000)
 * and prequels/specials (chapterNumber <= 0). Spot-check on 12 well-known
 * titles where AL has the value: matches AL exactly for 7/12, overcounts
 * by 4-11 for 5/12 (fan-translated bonus chapters / color-edition extras).
 *
 * Acceptable approximation when AL is null — better than leaving the field
 * blank in the UI. Fill-only — never overrides explicit provider counts.
 */

import { prisma } from '@/server/db';
import { logger } from '@/utils/logger';

export async function backfillMetadataChaptersFromChapterRows(mangaId: number): Promise<void> {
  try {
    const meta = (await prisma.manga.findUnique({
      where: { id: mangaId },
      select: { Metadata: { select: { id: true, chapters: true } } },
    }))?.Metadata;
    if (!meta) return;
    if (meta.chapters !== null) return;

    const rows = await prisma.$queryRaw<Array<{ floor_max: number | null }>>`
      SELECT FLOOR(MAX(c."chapterNumber"))::int AS floor_max
      FROM "Chapter" c
      WHERE c."mangaId" = ${mangaId}
        AND c."chapterNumber" > 0
        AND c."chapterNumber" < 10000
    `;
    const floorMax = rows[0]?.floor_max ?? null;
    if (floorMax === null || floorMax < 1) return;

    await prisma.metadata.update({
      where: { id: meta.id },
      data: { chapters: floorMax },
    });
    logger.info(`[enrichmentPipeline] Backfilled Metadata.chapters=${floorMax} for manga ${mangaId} (was null)`);
  } catch (err) {
    logger.warn(`[enrichmentPipeline] Failed to backfill Metadata.chapters for manga ${mangaId} (non-critical)`, err);
  }
}
