/**
 * Fandom DB Persistence Helpers
 *
 * Applies Fandom enrichment data (titles, covers, volumes) to the database.
 * Handles chapter creation/update, volume range management, orphaned chapter
 * assignment, and redirect sentinel cleanup.
 *
 * Extracted from phase-fandom-enrichment.ts to keep file sizes manageable.
 *
 * @module enrichment-pipeline/fandom-db-persistence
 */

import { prisma } from '@/server/db';
import { logger } from '@/utils/logger';

import { updateVolumeRanges, crossValidateVolumeRanges, createMissingVolumes, updateVolumeDescriptions, assignVolumesFromRanges, isUnreliableVolumeMap } from './fandom-volume-helpers';
import { evenDistributionFallback } from './fandom-volume-helpers/distribution';
import { assignSpecialChapters } from './special-chapter-placement';

import type { ChapterEnrichmentMaps } from './types';

/** Chapter row from DB with id, chapterNumber, volume, filePath */
interface ChapterRow { id: number; chapterNumber: number | null; volume: number | null; volumeId: number | null; filePath: string | null }

/** Shape for new chapter records to be batch-created */
interface NewChapterData {
  mangaId: number;
  fileName: string;
  index: number;
  chapterNumber: number;
  title: string;
  alternativeTitles: string[];
  size: number;
  downloadStatus: 'PENDING';
  volume: number | null;
  downloadUrl: null;
  coverImage: string | null;
  description: string | null;
  releaseDate: Date | null;
  pageCount: number | null;
  pages: number | null;
  monitored: boolean;
  updatedAt: Date;
}

/** Detect chapters with obviously wrong volume assignments via neighbor comparison */
// eslint-disable-next-line complexity -- Neighbor-based suspect detection requires multi-condition null checks
function detectSuspectChapters(allChapters: ChapterRow[]): Set<number> {
  const suspectIds = new Set<number>();
  for (let i = 0; i < allChapters.length; i++) {
    const ch = allChapters[i];
    if (!ch) continue;
    if (ch.volume === null || ch.chapterNumber === null) continue;
    const nextVol = allChapters[i + 1]?.volume;
    const prevVol = allChapters[i - 1]?.volume;
    const farFromNext = nextVol !== null && nextVol !== undefined && Math.abs(ch.volume - nextVol) > 2;
    const farFromPrev = prevVol !== null && prevVol !== undefined && Math.abs(ch.volume - prevVol) > 2;
    const hasNeighbor = (nextVol !== null && nextVol !== undefined) || (prevVol !== null && prevVol !== undefined);
    if (hasNeighbor && ((!prevVol && farFromNext) || (!nextVol && farFromPrev) || (farFromNext && farFromPrev))) {
      suspectIds.add(ch.id);
    }
  }
  return suspectIds;
}

/** Build sorted volume boundaries from chapter assignments, excluding suspect IDs.
 *  Skips negative/fractional chapter numbers (side stories like "Chapter -17") to prevent
 *  volume boundaries from spanning hundreds of chapters incorrectly. */
function buildSortedBoundaries(
  allChapters: ChapterRow[],
  suspectIds: Set<number>,
): Array<[number, { min: number; max: number }]> {
  const volBoundaries = new Map<number, { min: number; max: number }>();
  for (const ch of allChapters) {
    if (ch.volume === null || ch.chapterNumber === null || suspectIds.has(ch.id)) continue;
    // Skip negative and fractional chapter numbers — they're side stories/specials
    // that shouldn't define volume boundaries (e.g., Bleach "Chapter -17")
    if (ch.chapterNumber < 0 || !Number.isInteger(ch.chapterNumber)) continue;
    const existing = volBoundaries.get(ch.volume);
    if (existing) {
      existing.min = Math.min(existing.min, ch.chapterNumber);
      existing.max = Math.max(existing.max, ch.chapterNumber);
    } else {
      volBoundaries.set(ch.volume, { min: ch.chapterNumber, max: ch.chapterNumber });
    }
  }
  return [...volBoundaries.entries()].sort((a, b) => a[1].min - b[1].min);
}

/** Find the correct volume for a chapter number using sorted boundaries */
function findVolumeForChapter(
  chNum: number,
  sortedBoundaries: Array<[number, { min: number; max: number }]>,
): number | null {
  for (const [volNum, range] of sortedBoundaries) {
    if (chNum >= range.min && chNum <= range.max) return volNum;
  }
  for (let i = 0; i < sortedBoundaries.length; i++) {
    const entry = sortedBoundaries[i];
    if (!entry) continue;
    const [volNum, range] = entry;
    if (chNum < range.min) {
      return i > 0 ? (sortedBoundaries[i - 1]?.[0] ?? volNum) : volNum;
    }
  }
  // Chapters beyond the last volume's max range should remain unassigned,
  // not forced into the last volume (prevents phantom chapters in the final volume).
  return null;
}

/**
 * Fix chapters with no volume OR misassigned volumes.
 * Uses chapter-derived boundaries to determine the correct volume for each chapter.
 */
export async function assignOrphanedChapters(mangaId: number): Promise<void> {
  const allChapters = await prisma.chapter.findMany({
    where: { mangaId, chapterNumber: { not: null } },
    select: { id: true, chapterNumber: true, volume: true, volumeId: true, filePath: true },
    orderBy: { chapterNumber: 'asc' },
  });
  if (allChapters.length === 0) return;

  const suspectIds = detectSuspectChapters(allChapters);
  const sortedBoundaries = buildSortedBoundaries(allChapters, suspectIds);

  logger.info(`[enrichmentPipeline] Volume boundaries: ${sortedBoundaries.map(([v, r]) => `Vol${v}(${r.min}-${r.max})`).join(', ')}`);
  if (suspectIds.size > 0) {
    logger.info(`[enrichmentPipeline] Suspect chapters excluded from boundaries: ${[...suspectIds].join(', ')}`);
  }

  let fixed = 0;
  for (const ch of allChapters) {
    if (ch.chapterNumber === null) continue;
    const correctVol = findVolumeForChapter(ch.chapterNumber, sortedBoundaries);
    if (correctVol === null) continue;
    // Protect file-backed chapters — import pipeline volume is authoritative
    if (ch.filePath !== null && ch.volume !== null) continue;
    if (ch.volume === null || ch.volume !== correctVol) {
      // eslint-disable-next-line no-await-in-loop -- Sequential DB updates
      await prisma.chapter.update({
        where: { id: ch.id },
        data: { volume: correctVol },
      });
      fixed++;
    }
  }

  if (fixed > 0) {
    logger.info(`[enrichmentPipeline] Fixed ${fixed} chapter volume assignments via range lookup`);
  }

  await assignSpecialChapters(mangaId, allChapters);
}

export { assignSpecialChapters };

/**
 * Clear volume assignments for redirect-corrected chapters (sentinel -1),
 * but ONLY when no provider ranges exist.
 */
export async function clearRedirectSentinels(
  mangaId: number,
  chapterVolumeMap: Record<number, number>,
): Promise<void> {
  const volumesWithRanges = await prisma.volume.count({
    where: { mangaId, chapterStart: { not: null }, chapterEnd: { not: null } },
  });
  const totalVolumes = await prisma.volume.count({ where: { mangaId } });
  const hasProviderRanges = totalVolumes > 0 && volumesWithRanges > totalVolumes * 0.5;

  const correctedChapterNums = Object.entries(chapterVolumeMap)
    .filter(([_, v]) => v === -1)
    .map(([k]) => Number(k));

  if (correctedChapterNums.length === 0) return;

  if (!hasProviderRanges) {
    await prisma.chapter.updateMany({
      where: { mangaId, chapterNumber: { in: correctedChapterNums }, filePath: null },
      data: { volume: null },
    });
    logger.info(`[enrichmentPipeline] Cleared volume for ${correctedChapterNums.length} redirect-corrected chapters`);
  } else {
    logger.info(`[enrichmentPipeline] Skipped redirect volume-clear for ${correctedChapterNums.length} chapters (provider ranges are authoritative)`);
  }
}

/** Pattern matching generic chapter titles like "Chapter 1", "Episode 5", "第1話" */
const GENERIC_TITLE_PATTERN = /^(?:(?:Chapter|Episode|Ch\.?)\s+\d+|第\d+[話章])$/i;

/** Pattern matching Japanese-only generic titles like "第1話", "第2章" */
const JAPANESE_GENERIC_PATTERN = /^第(\d+)[話章]$/;

/** Build update data for a single chapter (existing chapters only) */
/** Apply covers/descriptions for chapters that have cover/desc data but no title entry.
 *  This catches the gap where the cover/desc maps are populated by the per-volume-iterator
 *  or redirect-fetcher but the chapter wasn't in the title map (e.g., untitled chapters). */
async function applyOrphanedCoverDescriptions(
  mangaId: number,
  maps: ChapterEnrichmentMaps,
  existingNumbers: Set<number | null>,
): Promise<{ covers: number; descs: number }> {
  const titleKeys = new Set(Object.keys(maps.chapterTitleMap).map(Number));
  let covers = 0;
  let descs = 0;

  for (const numStr of Object.keys(maps.chapterCoverMap)) {
    const num = Number(numStr);
    if (titleKeys.has(num) || !existingNumbers.has(num)) continue;
    const coverVal = maps.chapterCoverMap[num];
    if (!coverVal) continue;
    // eslint-disable-next-line no-await-in-loop -- Sequential DB updates
    await prisma.chapter.updateMany({
      where: { mangaId, chapterNumber: num, coverImage: null },
      data: { coverImage: coverVal },
    });
    covers++;
  }

  for (const numStr of Object.keys(maps.chapterDescriptionMap)) {
    const num = Number(numStr);
    if (titleKeys.has(num) || !existingNumbers.has(num)) continue;
    const descVal = maps.chapterDescriptionMap[num];
    if (!descVal) continue;
    // eslint-disable-next-line no-await-in-loop -- Sequential DB updates
    await prisma.chapter.updateMany({
      where: { mangaId, chapterNumber: num, description: null },
      data: { description: descVal },
    });
    descs++;
  }

  return { covers, descs };
}

function buildChapterUpdateData(
  chapterNum: number,
  chTitle: string,
  maps: ChapterEnrichmentMaps,
  skipFandomVolumeAssignment = false,
): Record<string, unknown> {
  const coverImg = maps.chapterCoverMap[chapterNum];
  const desc = maps.chapterDescriptionMap[chapterNum];
  const pages = maps.chapterPagesMap[chapterNum];
  const releaseDate = maps.chapterReleaseDateMap[chapterNum];
  const volNum = maps.chapterVolumeMap[chapterNum];

  // Only set title if it's a real title — generic "Chapter N" should never
  // overwrite an existing title that may be real (from MangaDex, AniList, etc.)
  const isRealTitle = !GENERIC_TITLE_PATTERN.test(chTitle);

  // Validate releaseDate before creating Date object — invalid dates cause PrismaClientValidationError
  let parsedDate: Date | undefined;
  if (releaseDate) {
    const d = new Date(releaseDate);
    if (!isNaN(d.getTime())) parsedDate = d;
  }

  return {
    ...(isRealTitle ? { title: chTitle } : {}),
    // Sentinel -1 means "clear wrong volume" (set by redirect gap-fill when title was corrected)
    ...(volNum === -1 ? { volume: null } :
       volNum !== undefined && !skipFandomVolumeAssignment ? { volume: volNum } : {}),
    ...(coverImg ? { coverImage: coverImg } : {}),
    ...(desc ? { description: desc } : {}),
    ...(pages ? { pages } : {}),
    ...(parsedDate ? { releaseDate: parsedDate } : {}),
  };
}

/** Build data for a new chapter from Fandom enrichment maps */
function buildNewChapterData(
  opts: { mangaId: number; chapterNum: number; title: string; index: number; maps: ChapterEnrichmentMaps; skipVolume?: boolean },
): NewChapterData {
  const { mangaId, chapterNum, title: chTitle, index, maps, skipVolume } = opts;
  const releaseStr = maps.chapterReleaseDateMap[chapterNum];
  return {
    mangaId,
    fileName: `chapter-${chapterNum}.cbz`,
    index,
    chapterNumber: chapterNum,
    title: chTitle,
    alternativeTitles: [],
    size: 0,
    downloadStatus: 'PENDING' as const,
    volume: skipVolume ? null : (maps.chapterVolumeMap[chapterNum] ?? null),
    downloadUrl: null,
    coverImage: maps.chapterCoverMap[chapterNum] ?? null,
    description: maps.chapterDescriptionMap[chapterNum] ?? null,
    releaseDate: releaseStr && !isNaN(new Date(releaseStr).getTime()) ? new Date(releaseStr) : null,
    pageCount: maps.chapterPagesMap[chapterNum] ?? null,
    pages: maps.chapterPagesMap[chapterNum] ?? null,
    monitored: true,
    updatedAt: new Date(),
  };
}

/**
 * Compute the highest plausible chapter number for a series, used to reject
 * phantom Fandom chapters before they're created. The Fandom adaptive parser
 * occasionally emits an isolated far-outlier number — a year misread as a
 * chapter (`chapter-2008.cbz` on a 123-chapter series), a footnote/reference
 * number, etc. These sit alone far above the dense body of real chapters after
 * a large gap.
 *
 * Walk the sorted numbers; the bound is the last value before the first gap
 * that is both large (> max(100, 50% of the running max)) AND followed only by
 * a small minority tail. A substantial run after a gap is treated as real and
 * kept, so legitimately long/offset-numbered series are never truncated. Only
 * the creation of NEW chapters is gated, so a false drop merely skips an
 * auto-placeholder — the real chapter still imports when downloaded.
 */
export function plausibleMaxChapter(allNumbers: number[]): number {
  const sorted = [...new Set(allNumbers)].filter(n => Number.isFinite(n)).sort((a, b) => a - b);
  if (sorted.length === 0) return Infinity;
  let lastKept = sorted[0] as number;
  for (let i = 1; i < sorted.length; i++) {
    const n = sorted[i] as number;
    const gapLimit = Math.max(100, lastKept * 0.5);
    if (n - lastKept > gapLimit) {
      const tailCount = sorted.length - i;
      // Small minority after a big gap → phantom outlier tail. Drop it.
      if (tailCount <= Math.max(20, sorted.length * 0.1)) return lastKept;
      // Otherwise it's a substantial run (real, just offset) — keep going.
    }
    lastKept = n;
  }
  return lastKept;
}

interface ClassifyContext {
  existingNumbers: Set<number | null>;
  fileBackedNumbers: Set<number>;
  chaptersWithoutVolume: Set<number>;
  hasBadFandomVolumes: boolean;
  phantomBound: number;
  startIndex: number;
}

interface ClassifyResult {
  chaptersToCreate: NewChapterData[];
  updatedCount: number;
  createdCount: number;
  coversApplied: number;
  descsApplied: number;
  skippedPhantom: number;
}

/**
 * Walk the Fandom title map: update existing chapters in place, collect new ones
 * to create, and skip phantom far-outliers (number above `phantomBound`).
 * Extracted from applyFandomDataToDb to keep that function within budget.
 */
async function classifyFandomChapters(
  mangaId: number,
  maps: ChapterEnrichmentMaps,
  ctx: ClassifyContext,
): Promise<ClassifyResult> {
  let nextIndex = ctx.startIndex;
  let updatedCount = 0, createdCount = 0, coversApplied = 0, descsApplied = 0, skippedPhantom = 0;
  const chaptersToCreate: NewChapterData[] = [];

  for (const [chapterNumStr, chTitle] of Object.entries(maps.chapterTitleMap)) {
    const chapterNum = Number(chapterNumStr);
    // Accept chapter 0 (canonical "Chapter 0" prequel like Dragon Ball / FMA) and
    // decimal specials (0.1, 0.2 prologues, 1.5 interludes). Reject only negatives.
    if (isNaN(chapterNum) || chapterNum < 0) continue;

    if (ctx.existingNumbers.has(chapterNum)) {
      const isFileBacked = ctx.fileBackedNumbers.has(chapterNum);
      const canAssignVolume = ctx.chaptersWithoutVolume.has(chapterNum) && !ctx.hasBadFandomVolumes && !isFileBacked;
      const updateData = buildChapterUpdateData(chapterNum, chTitle, maps, !canAssignVolume);
      if (Object.keys(updateData).length === 0) continue;
      // eslint-disable-next-line no-await-in-loop -- Sequential DB updates for chapter enrichment
      const updated = await prisma.chapter.updateMany({
        where: { mangaId, chapterNumber: chapterNum },
        data: updateData,
      });
      if (updated.count > 0) updatedCount++;
    } else if (chapterNum > ctx.phantomBound) {
      // Phantom far-outlier (e.g. a year misparsed as a chapter number) — skip.
      skippedPhantom++;
    } else {
      // New chapter: apply Fandom volume unless the map itself is corrupt
      chaptersToCreate.push(buildNewChapterData({ mangaId, chapterNum, title: chTitle, index: nextIndex++, maps, skipVolume: ctx.hasBadFandomVolumes }));
      createdCount++;
    }
    if (maps.chapterCoverMap[chapterNum]) coversApplied++;
    if (maps.chapterDescriptionMap[chapterNum]) descsApplied++;
  }

  return { chaptersToCreate, updatedCount, createdCount, coversApplied, descsApplied, skippedPhantom };
}

/** Update existing DB chapters with Fandom data AND create missing chapters */
export async function applyFandomDataToDb(
  mangaId: number,
  maps: ChapterEnrichmentMaps,
  expectedVolumeCount?: number | undefined,
  extraGalleryUrls?: string[],
): Promise<void> {
  let coversApplied = 0;
  let descsApplied = 0;

  const existingChapters = await prisma.chapter.findMany({
    where: { mangaId },
    select: { chapterNumber: true, title: true, filePath: true, volume: true, volumeId: true },
  });
  const existingNumbers = new Set(existingChapters.map(c => c.chapterNumber));
  const fileBackedNumbers = new Set(
    existingChapters.filter(c => c.filePath !== null && c.chapterNumber !== null).map(c => c.chapterNumber as number),
  );
  // Gap-fill map: chapters that have NO volume assignment yet are candidates
  // for Fandom fill-in. Chapters that already have a volume (from the provider
  // cross-validation phase) are left alone to preserve authoritative data.
  const chaptersWithoutVolume = new Set(
    existingChapters
      .filter(c => c.volume === null && c.volumeId === null && c.chapterNumber !== null)
      .map(c => c.chapterNumber as number),
  );

  const maxIndexResult = await prisma.chapter.aggregate({
    where: { mangaId },
    _max: { index: true },
  });
  const nextIndex = (maxIndexResult._max.index ?? 0) + 1;

  const hasBadFandomVolumes = isUnreliableVolumeMap(maps.chapterVolumeMap);
  // Previously: wholesale-skip when providers covered >50% of volumes. Now we
  // gap-fill per-chapter: only apply Fandom's volume assignment when the chapter
  // has no existing volume. `hasBadFandomVolumes` still forces a global skip.

  // Upper bound for NEW chapter creation, derived from existing file-backed
  // chapters + the Fandom-discovered numbers. Blocks phantom far-outliers
  // (misparsed years/footnotes) from being created as PENDING placeholders.
  const phantomBound = plausibleMaxChapter([
    ...fileBackedNumbers,
    ...Object.keys(maps.chapterTitleMap).map(Number).filter(n => !isNaN(n)),
  ]);

  const classified = await classifyFandomChapters(mangaId, maps, {
    existingNumbers, fileBackedNumbers, chaptersWithoutVolume,
    hasBadFandomVolumes, phantomBound, startIndex: nextIndex,
  });
  const { chaptersToCreate, updatedCount, createdCount, skippedPhantom } = classified;
  coversApplied += classified.coversApplied;
  descsApplied += classified.descsApplied;

  if (chaptersToCreate.length > 0) {
    const BATCH_SIZE = 50;
    for (let i = 0; i < chaptersToCreate.length; i += BATCH_SIZE) {
      const batch = chaptersToCreate.slice(i, i + BATCH_SIZE);
      // eslint-disable-next-line no-await-in-loop -- Sequential batching for DB insert safety
      await prisma.chapter.createMany({ data: batch, skipDuplicates: true });
    }
    logger.info(`[enrichmentPipeline] Created ${createdCount} missing chapters from Fandom data`);
  }

  // Apply covers/descriptions for chapters that exist in DB but had no title entry
  const orphanResult = await applyOrphanedCoverDescriptions(mangaId, maps, existingNumbers);
  coversApplied += orphanResult.covers;
  descsApplied += orphanResult.descs;

  if (skippedPhantom > 0) {
    logger.warn(`[enrichmentPipeline] Skipped ${skippedPhantom} phantom Fandom chapter(s) above plausible max ${phantomBound} for manga ${mangaId}`);
  }

  logger.info(`[enrichmentPipeline] Updated ${updatedCount} chapters, created ${createdCount} new: ${coversApplied} covers, ${descsApplied} descriptions (${orphanResult.covers} orphaned covers, ${orphanResult.descs} orphaned descs)`);

  // Normalize Japanese generic titles (第N話 → Chapter N) when no real title was found
  await normalizeJapaneseGenericTitles(mangaId, existingChapters, maps.chapterTitleMap);

  await applyVolumeRangesAndAssignments(mangaId, maps, hasBadFandomVolumes, expectedVolumeCount);

  // Collect gallery images from volume covers + chapter covers into Metadata.galleryImages
  await collectGalleryImages(mangaId, extraGalleryUrls);
}

/** Collect volume and chapter cover images into Metadata.galleryImages for gallery display */
async function collectGalleryImages(mangaId: number, extraGalleryUrls?: string[]): Promise<void> {
  try {
    const [volumes, chapters] = await Promise.all([
      prisma.volume.findMany({ where: { mangaId }, select: { coverImage: true }, orderBy: { number: 'asc' } }),
      prisma.chapter.findMany({ where: { mangaId, coverImage: { not: null } }, select: { coverImage: true }, orderBy: { chapterNumber: 'asc' } }),
    ]);

    const images = new Set<string>();
    for (const v of volumes) {
      if (v.coverImage) images.add(v.coverImage);
    }
    for (const c of chapters) {
      if (c.coverImage) images.add(c.coverImage);
    }
    if (extraGalleryUrls) {
      for (const url of extraGalleryUrls) {
        if (typeof url === 'string' && url.length > 0) images.add(url);
      }
    }

    if (images.size === 0) return;

    const metadata = await prisma.metadata.findFirst({ where: { Manga: { id: mangaId } }, select: { id: true } });
    if (!metadata) return;

    await prisma.metadata.update({
      where: { id: metadata.id },
      data: { galleryImages: [...images] },
    });

    const wikiCount = extraGalleryUrls?.length ?? 0;
    logger.info(`[enrichmentPipeline] Gallery: collected ${images.size} images (volumes + chapters${wikiCount > 0 ? ` + ${wikiCount} wiki` : ''})`);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.debug(`[enrichmentPipeline] Gallery image collection failed: ${msg}`);
  }
}

/**
 * Replace Japanese generic titles (第N話, 第N章) with English equivalents (Chapter N).
 * Only normalizes titles that are still generic after enrichment — real titles from
 * any source are never overwritten.
 */
async function normalizeJapaneseGenericTitles(
  mangaId: number,
  existingChapters: Array<{ chapterNumber: number | null; title: string }>,
  chapterTitleMap: Record<number, string>,
): Promise<void> {
  const toNormalize: Array<{ chapterNumber: number; newTitle: string }> = [];

  for (const ch of existingChapters) {
    if (ch.chapterNumber === null) continue;
    // Skip if enrichment found a real title for this chapter
    const enrichedTitle = chapterTitleMap[ch.chapterNumber];
    if (enrichedTitle && !GENERIC_TITLE_PATTERN.test(enrichedTitle)) continue;
    // Check if the DB title is Japanese-generic
    const match = JAPANESE_GENERIC_PATTERN.exec(ch.title);
    if (match?.[1]) {
      toNormalize.push({ chapterNumber: ch.chapterNumber, newTitle: `Chapter ${match[1]}` });
    }
  }

  if (toNormalize.length === 0) return;

  for (const { chapterNumber, newTitle } of toNormalize) {
    // eslint-disable-next-line no-await-in-loop -- Sequential DB updates for title normalization
    await prisma.chapter.updateMany({
      where: { mangaId, chapterNumber },
      data: { title: newTitle },
    });
  }
  logger.info(`[enrichmentPipeline] Normalized ${toNormalize.length} Japanese generic titles (第N話 → Chapter N)`);
}

/** Manage Volume ranges and chapter-to-volume assignments from Fandom data.
 *  Protects Phase 2 provider ranges and detects unreliable Fandom data. */
async function applyVolumeRangesAndAssignments(
  mangaId: number,
  maps: ChapterEnrichmentMaps,
  hasBadFandomVolumes: boolean,
  expectedVolumeCount?: number | undefined,
): Promise<void> {
  // Ensure all expected volumes exist BEFORE any assignment or distribution.
  // Prevents chapters from being crammed into the few volumes with provider data
  // when AniList reports a higher total (e.g., only vols 13-14 exist for a 14-vol series).
  if (expectedVolumeCount !== undefined && expectedVolumeCount > 0) {
    await ensureExpectedVolumes(mangaId, expectedVolumeCount);
    const { fillEmptyVolumeRanges } = await import('./phase-volume-reconciliation');
    await fillEmptyVolumeRanges(mangaId);
  }

  const volumesWithRanges = await prisma.volume.count({
    where: { mangaId, chapterStart: { not: null }, chapterEnd: { not: null } },
  });
  const totalVolumes = await prisma.volume.count({ where: { mangaId } });
  const hasProviderRanges = totalVolumes > 0 && volumesWithRanges > totalVolumes * 0.5;

  const fandomRangesSkipped = await applyOrSkipFandomRanges(mangaId, maps, hasProviderRanges, hasBadFandomVolumes, volumesWithRanges);

  await createMissingVolumes(mangaId, maps.chapterVolumeMap);
  await updateVolumeDescriptions(mangaId, maps.volumeDescriptionMap);

  const chaptersWithVolume = await prisma.chapter.count({ where: { mangaId, volume: { not: null } } });
  const totalChapters = await prisma.chapter.count({ where: { mangaId } });

  await resolveVolumeAssignments(mangaId, { fandomRangesSkipped, hasBadFandomVolumes, hasProviderRanges, totalVolumes, chaptersWithVolume, totalChapters, expectedVolumeCount: expectedVolumeCount ?? 0 });
  await safetyNetEvenDistribution(mangaId, totalVolumes, totalChapters, expectedVolumeCount ?? 0);
}

/** Apply or skip Fandom volume ranges depending on provider range state */
async function applyOrSkipFandomRanges(
  mangaId: number,
  maps: ChapterEnrichmentMaps,
  hasProviderRanges: boolean,
  hasBadFandomVolumes: boolean,
  volumesWithRanges: number,
): Promise<boolean> {
  if (hasProviderRanges) {
    logger.info(`[enrichmentPipeline] Phase 2 provided ${volumesWithRanges} volume ranges — preserving provider ranges`);
    if (!hasBadFandomVolumes && Object.keys(maps.chapterVolumeMap).length > 0) {
      await crossValidateVolumeRanges(mangaId, maps.chapterVolumeMap);
    }
    return false;
  }

  const beforeRanges = volumesWithRanges;
  await updateVolumeRanges(mangaId, maps.chapterVolumeMap);
  const afterRanges = await prisma.volume.count({
    where: { mangaId, chapterStart: { not: null }, chapterEnd: { not: null } },
  });
  return afterRanges <= beforeRanges && afterRanges === 0;
}

/** Decide which volume assignment strategy to use */
async function resolveVolumeAssignments(
  mangaId: number,
  ctx: { fandomRangesSkipped: boolean; hasBadFandomVolumes: boolean; hasProviderRanges: boolean; totalVolumes: number; chaptersWithVolume: number; totalChapters: number; expectedVolumeCount: number },
): Promise<void> {
  const { fandomRangesSkipped, hasBadFandomVolumes, hasProviderRanges, totalVolumes, chaptersWithVolume, totalChapters, expectedVolumeCount } = ctx;
  const hasGoodAssignments = totalChapters > 0 && chaptersWithVolume > totalChapters * 0.8;

  if (fandomRangesSkipped && totalVolumes > 0) {
    await prisma.chapter.updateMany({ where: { mangaId, filePath: null }, data: { volume: null } });
    logger.info(`[enrichmentPipeline] Fandom ranges skipped (overlaps) — clearing stale assignments (non-file-backed), using even distribution`);
    // Ensure all expected volumes exist before distribution to avoid cramming
    // chapters into only the few volumes that have provider data
    const allVolumes = await ensureExpectedVolumes(mangaId, expectedVolumeCount);
    await evenDistributionFallback(mangaId, allVolumes);
  } else if (hasBadFandomVolumes) {
    await prisma.chapter.updateMany({ where: { mangaId, filePath: null }, data: { volume: null } });
    logger.info(`[enrichmentPipeline] Fandom volume data unreliable — clearing stale assignments (non-file-backed), reassigning from ranges`);
    await assignVolumesFromRanges(mangaId);
  } else if (hasGoodAssignments) {
    logger.info(`[enrichmentPipeline] Preserving existing chapter volume assignments (${chaptersWithVolume}/${totalChapters})`);
  } else if (hasProviderRanges) {
    await prisma.chapter.updateMany({ where: { mangaId, filePath: null }, data: { volume: null } });
    logger.info(`[enrichmentPipeline] Cleared chapter volume assignments (non-file-backed, provider ranges exist) — will reassign`);
    await assignVolumesFromRanges(mangaId);
  } else {
    await assignVolumesFromRanges(mangaId);
  }
}

/** Ensure Volume records 1..expectedVolumeCount exist, creating any missing ones */
async function ensureExpectedVolumes(mangaId: number, expectedVolumeCount: number): Promise<{ number: number }[]> {
  const existing = await prisma.volume.findMany({ where: { mangaId }, select: { number: true }, orderBy: { number: 'asc' } });
  if (expectedVolumeCount <= 0) return existing;

  const existingSet = new Set(existing.map(v => v.number));
  const toCreate: Array<{ mangaId: number; number: number }> = [];
  for (let v = 1; v <= expectedVolumeCount; v++) {
    if (!existingSet.has(v)) toCreate.push({ mangaId, number: v });
  }

  if (toCreate.length > 0) {
    await prisma.volume.createMany({ data: toCreate, skipDuplicates: true });
    logger.info(`[enrichmentPipeline] Created ${toCreate.length} missing Volume records (expected: ${expectedVolumeCount}) for manga ${mangaId}`);
    return prisma.volume.findMany({ where: { mangaId }, select: { number: true }, orderBy: { number: 'asc' } });
  }
  return existing;
}

/** Safety net: run even distribution if volumes exist but too few have ranges */
async function safetyNetEvenDistribution(mangaId: number, totalVolumes: number, totalChapters: number, expectedVolumeCount: number): Promise<void> {
  const finalRangeCount = await prisma.volume.count({
    where: { mangaId, chapterStart: { not: null }, chapterEnd: { not: null } },
  });
  const finalUnassigned = await prisma.chapter.count({ where: { mangaId, volume: null } });

  if (totalVolumes > 0 && finalRangeCount < totalVolumes * 0.5 && finalUnassigned > totalChapters * 0.5) {
    logger.info(
      `[enrichmentPipeline] Safety net: only ${finalRangeCount}/${totalVolumes} volumes have ranges, ` +
      `${finalUnassigned}/${totalChapters} chapters unassigned — running even distribution`,
    );
    await prisma.chapter.updateMany({ where: { mangaId, filePath: null }, data: { volume: null } });
    const allVolumes = await ensureExpectedVolumes(mangaId, expectedVolumeCount);
    await evenDistributionFallback(mangaId, allVolumes);
  }
}
