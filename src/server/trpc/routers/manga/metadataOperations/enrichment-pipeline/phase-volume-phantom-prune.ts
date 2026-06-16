/**
 * Phantom Out-of-Range Volume Pruner
 *
 * Deletes volumes whose declared chapter range lies entirely beyond the manga's
 * real chapters AND which have zero linked Chapter rows. These are provider
 * numbering artifacts — e.g. ComicVine listing volumes 11-13 as chapters 91-117
 * for a series whose real chapters stop at 58. Such a volume can never gain a
 * chapter from this library and renders as an empty "0/0 chapters · 0 B" phantom
 * row in the volume browser.
 *
 * This is the finalize-stage backstop for the cross-validation discontinuity
 * guard (constraint-validation.ts): it cleans rows already persisted by an
 * earlier run and any provider path that bypasses cross-validation.
 *
 * Conservative on two axes so legitimate data is never touched:
 *   1. Only fires for finished series (COMPLETED / CANCELLED). An ongoing manga
 *      may have a not-yet-populated trailing volume; a finished series has all
 *      its chapters, so an empty out-of-range volume is provably spurious.
 *   2. Requires BOTH zero linked chapters AND chapterStart beyond the max real
 *      chapter. Any volume that actually holds chapters is always preserved.
 *
 * Leaves the "Specials" volume 0 alone (number > 0 filter).
 */

import { prisma } from '@/server/db';
import { logger } from '@/utils/logger';

import type { MangaPublicationStatus } from '@prisma/client';

function isTerminalStatus(status: MangaPublicationStatus | null | undefined): boolean {
  return status === 'COMPLETED' || status === 'CANCELLED';
}

export async function pruneOutOfRangeVolumes(mangaId: number): Promise<number> {
  const manga = await prisma.manga.findUnique({
    where: { id: mangaId },
    select: { publicationStatus: true },
  });
  if (!isTerminalStatus(manga?.publicationStatus)) return 0;

  const maxChResult = await prisma.chapter.aggregate({
    where: { mangaId, chapterNumber: { not: null } },
    _max: { chapterNumber: true },
  });
  const maxRealChapter = maxChResult._max.chapterNumber;
  if (maxRealChapter === null) return 0;

  // Real numbered volumes whose declared start is beyond the highest real chapter.
  const candidates = await prisma.volume.findMany({
    where: {
      mangaId,
      number: { gt: 0 },
      chapterStart: { gt: maxRealChapter },
    },
    select: { id: true, _count: { select: { chapters: true } } },
  });

  const phantomIds = candidates.filter(v => v._count.chapters === 0).map(v => v.id);
  if (phantomIds.length === 0) return 0;

  await prisma.volume.deleteMany({ where: { id: { in: phantomIds } } });
  logger.info(
    `[enrichmentPipeline] Pruned ${phantomIds.length} phantom out-of-range volume(s) for manga ${mangaId} ` +
    `(declared start beyond max real chapter ${maxRealChapter}, zero linked chapters)`,
  );
  return phantomIds.length;
}
