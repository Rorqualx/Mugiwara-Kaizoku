/**
 * Enrichment state analysis
 */

import { prisma } from '@/server/db';

export interface EnrichmentState {
  totalChapters: number;
  filledTitles: number;
  coveragePct: number;
  chaptersWithTitle: Set<number>;
  chaptersWithVolume: Set<number>;
  chaptersWithReleaseDate: Set<number>;
  chaptersWithPages: Set<number>;
  volumesWithDescription: Set<number>;
  /** True when volume ranges are missing or chapter-to-volume assignments are poor */
  volumeCoverageNeedsHelp: boolean;
}

/** Query DB to determine what Fandom already populated */
export async function getExistingEnrichmentState(mangaId: number): Promise<EnrichmentState> {
  const [chapters, volumes, volumesWithRanges] = await Promise.all([
    prisma.chapter.findMany({
      where: { mangaId },
      select: { chapterNumber: true, title: true, volume: true, releaseDate: true, pages: true },
    }),
    prisma.volume.findMany({
      where: { mangaId },
      select: { number: true, description: true },
    }),
    prisma.volume.count({
      where: { mangaId, chapterStart: { not: null }, chapterEnd: { not: null } },
    }),
  ]);

  const chaptersWithTitle = new Set<number>();
  const chaptersWithVolume = new Set<number>();
  const chaptersWithReleaseDate = new Set<number>();
  const chaptersWithPages = new Set<number>();

  for (const ch of chapters) {
    if (ch.chapterNumber === null) continue;
    if (ch.title && ch.title.length > 0) chaptersWithTitle.add(ch.chapterNumber);
    if (ch.volume !== null) chaptersWithVolume.add(ch.chapterNumber);
    if (ch.releaseDate !== null) chaptersWithReleaseDate.add(ch.chapterNumber);
    if (ch.pages !== null) chaptersWithPages.add(ch.chapterNumber);
  }

  const volumesWithDescription = new Set<number>();
  for (const vol of volumes) {
    if (vol.description && vol.description.length > 0) volumesWithDescription.add(vol.number);
  }

  const totalChapters = chapters.length;
  const filledTitles = chaptersWithTitle.size;

  // Volume coverage needs help when:
  // - Fewer than 50% of chapters have volume assignments, OR
  // - Volume records exist but fewer than 50% have chapter ranges
  const volumeCoveragePct = totalChapters > 0 ? chaptersWithVolume.size / totalChapters : 1;
  const rangesCoveragePct = volumes.length > 0 ? volumesWithRanges / volumes.length : 1;
  const volumeCoverageNeedsHelp = volumeCoveragePct < 0.5 || rangesCoveragePct < 0.5;

  return {
    totalChapters,
    filledTitles,
    coveragePct: totalChapters > 0 ? filledTitles / totalChapters : 1,
    chaptersWithTitle,
    chaptersWithVolume,
    chaptersWithReleaseDate,
    chaptersWithPages,
    volumesWithDescription,
    volumeCoverageNeedsHelp,
  };
}