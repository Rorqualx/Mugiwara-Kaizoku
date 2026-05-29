/**
 * Phase 2.5 / 4.5: Chapter Count Reconciliation
 *
 * Runs after DB persistence (Phase 2) and optionally after AI enrichment
 * (Phase 4) to create PENDING chapters that provider data missed.
 *
 * Problem: Phase 2 creates chapters from AniList/MangaDex scalars. If they
 * return 9 chapters, later phases can only UPDATE those 9 — Fandom/Wikipedia
 * data for chapters 10+ is discovered but discarded.
 *
 * Solution: Merge all source chapter lists, find chapter numbers NOT in DB,
 * and batch-create PENDING placeholders with the best available title.
 */

import { prisma } from '@/server/db';
import { logger } from '@/utils/logger';

import { isBonusTitle, type ChapterDataItem } from './types';

import type { Prisma } from '@prisma/client';

const log = logger.child('ChapterReconciliation');

// ============================================================================
// Main Entry Point
// ============================================================================

/**
 * Reconcile chapter count by creating PENDING chapters for any chapter
 * numbers present in source data but missing from the database.
 *
 * @param mangaId - Manga ID to reconcile
 * @param allSourceChapters - Merged + deduplicated chapters from all sources
 * @param expectedChapterCount - Best estimate of total chapters
 * @returns Number of chapters created
 */
/**
 * Build placeholder chapters for gap numbers from 1 to expectedChapterCount
 * not covered by any source or already in DB.
 *
 * The metadata scalar (e.g. AniList's `chapters: 1140`) is the exact upper
 * bound. Source scrapes may be incomplete (Fandom returning only 38 of 95),
 * so we MUST create placeholders for the gaps — otherwise those chapters
 * can never be downloaded.
 *
 * No arbitrary buffer is applied. Chapters beyond expectedChapterCount come
 * from source data (Fandom/Wikipedia scrapes), not placeholders.
 */
function buildExtraPlaceholders(
  allSourceChapters: ChapterDataItem[],
  existingNumbers: Set<number>,
  expectedChapterCount: number,
): ChapterDataItem[] {
  if (expectedChapterCount <= 0) return [];

  const sourceNumbers = new Set(allSourceChapters.map(ch => ch.number));

  const placeholders: ChapterDataItem[] = [];
  for (let n = 1; n <= expectedChapterCount; n++) {
    if (!existingNumbers.has(n) && !sourceNumbers.has(n)) {
      placeholders.push({ number: n });
    }
  }
  return placeholders;
}

export async function reconcileChapterCount(
  mangaId: number,
  allSourceChapters: ChapterDataItem[],
  expectedChapterCount: number,
): Promise<number> {
  if (allSourceChapters.length === 0 && expectedChapterCount === 0) return 0;

  // Query DB for existing chapter numbers (include id + volume for update logic)
  const existing = await prisma.chapter.findMany({
    where: { mangaId },
    select: { id: true, chapterNumber: true, index: true, volume: true, filePath: true },
  });

  // Update volume assignments for existing chapters that have no volume
  const volumeUpdates = await updateExistingChapterVolumes(existing, allSourceChapters);

  const existingNumbers = new Set<number>();
  let maxIndex = 0;
  for (const ch of existing) {
    if (ch.chapterNumber !== null) existingNumbers.add(ch.chapterNumber);
    if (ch.index > maxIndex) maxIndex = ch.index;
  }

  // Find chapter numbers in sources but not in DB.
  // Cap at 2x expected count or 500 — any chapter number beyond that from source
  // data is almost certainly a misparse (volume number, SBS number, year, ISBN).
  // NOTE: Metadata presence (title, volume) does NOT prove validity — misparsed
  // Wikipedia rows carry metadata from the wrong row type (e.g., a volume row
  // misidentified as a chapter row has number=volume_number, title=volume_title).
  // The real fix belongs upstream in the Wikipedia/Fandom normalizers.
  const maxReasonableChapter = Math.max(expectedChapterCount * 2, 500);
  const missing = allSourceChapters.filter(ch => {
    if (ch.number <= 0) return false;
    if (existingNumbers.has(ch.number)) return false;
    if (ch.number > maxReasonableChapter) {
      log.debug(`Skipping suspicious chapter number ${ch.number} (max reasonable: ${maxReasonableChapter})`);
      return false;
    }
    return true;
  });

  const extraPlaceholders = buildExtraPlaceholders(allSourceChapters, existingNumbers, expectedChapterCount);

  const toCreate = [...missing, ...extraPlaceholders];
  if (toCreate.length === 0) return 0;

  // Sort by chapter number for consistent indexing
  toCreate.sort((a, b) => a.number - b.number);

  const records: Prisma.ChapterCreateManyInput[] = toCreate.map((ch, idx) => ({
    mangaId,
    fileName: `c${ch.number.toString().padStart(3, '0')}.cbz`,
    index: maxIndex + idx + 1,
    chapterNumber: ch.number,
    title: ch.title ?? `Chapter ${ch.number}`,
    alternativeTitles: [] as string[],
    size: 0,
    downloadStatus: 'PENDING' as const,
    volume: ch.volume ?? null,
    downloadUrl: null,
    coverImage: ch.cover ?? null,
    description: ch.description ?? null,
    releaseDate: ch.releaseDate ? (() => { const d = Date.parse(ch.releaseDate); return isNaN(d) ? null : new Date(d); })() : null,
    pageCount: ch.pages ?? null,
    pages: ch.pages ?? null,
    monitored: true,
    updatedAt: new Date(),
  }));

  // Batch-create in chunks of 50
  const batchSize = 50;
  for (let i = 0; i < records.length; i += batchSize) {
    // eslint-disable-next-line no-await-in-loop -- Sequential batch inserts
    await prisma.chapter.createMany({
      data: records.slice(i, i + batchSize),
      skipDuplicates: true,
    });
  }

  log.info(`Reconciliation created ${records.length} PENDING chapters for manga ${mangaId}`, {
    fromSources: missing.length,
    placeholders: extraPlaceholders.length,
    volumeUpdates,
    existingCount: existing.length,
    expectedChapterCount,
  });

  return records.length;
}

// ============================================================================
// Volume Assignment Updates
// ============================================================================

interface ExistingChapterRow {
  id: number;
  chapterNumber: number | null;
  index: number;
  volume: number | null;
  filePath: string | null;
}

/**
 * Update volume assignments for existing chapters that have no volume set.
 *
 * When source data (e.g. Wikipedia) provides chapter-to-volume mappings,
 * existing DB chapters with `volume = null` should be updated to reflect
 * the correct volume number.
 *
 * @param existingChapters - Rows from the DB with id, chapterNumber, volume
 * @param sourceChapters - Merged source chapters (may contain volume info)
 * @returns Number of chapters updated
 */
async function updateExistingChapterVolumes(
  existingChapters: ExistingChapterRow[],
  sourceChapters: ChapterDataItem[],
): Promise<number> {
  // Build a map of chapter number -> volume from source data
  const sourceVolumeMap = new Map<number, number>();
  for (const src of sourceChapters) {
    if (src.volume !== undefined) {
      sourceVolumeMap.set(src.number, src.volume);
    }
  }

  if (sourceVolumeMap.size === 0) return 0;

  // Determine if source data has significantly more volume detail than DB.
  // Phase 2 may assign chapters to only 1-2 volumes from scalar data,
  // while Wikipedia provides precise volume-to-chapter mappings for 20+ volumes.
  const dbVolumes = new Set(existingChapters.filter(ch => ch.volume !== null).map(ch => ch.volume as number));
  const sourceVolumes = new Set(sourceVolumeMap.values());
  const sourceHasMoreDetail = sourceVolumes.size > dbVolumes.size * 2 && sourceVolumes.size >= 5;

  const updates: Array<{ id: number; volume: number }> = [];
  for (const ch of existingChapters) {
    if (ch.chapterNumber === null) continue;
    const sourceVolume = sourceVolumeMap.get(ch.chapterNumber);
    if (sourceVolume === undefined) continue;

    if (ch.volume === null) {
      // No volume — always fill from source
      updates.push({ id: ch.id, volume: sourceVolume });
    } else if (ch.filePath === null && sourceHasMoreDetail && ch.volume !== sourceVolume) {
      // Source has much more granular volume data — trust it over Phase 2 inferred volumes
      updates.push({ id: ch.id, volume: sourceVolume });
    }
  }

  if (updates.length === 0) return 0;

  // Batch update in chunks of 50
  const batchSize = 50;
  for (let i = 0; i < updates.length; i += batchSize) {
    const batch = updates.slice(i, i + batchSize);
    // eslint-disable-next-line no-await-in-loop -- Sequential batch updates
    await prisma.$transaction(
      batch.map((upd) =>
        prisma.chapter.update({
          where: { id: upd.id },
          data: { volume: upd.volume, updatedAt: new Date() },
        }),
      ),
    );
  }

  log.info(`Updated volume assignments for ${updates.length} existing chapters`, {
    sampleUpdates: updates.slice(0, 5).map((u) => ({ id: u.id, volume: u.volume })),
  });

  return updates.length;
}

// ============================================================================
// Source Merging
// ============================================================================

/**
 * Merge chapter data from multiple sources, deduplicating by chapter number.
 * When multiple sources have the same chapter number, the entry with the most
 * metadata wins.
 *
 * Applies two post-processing techniques from parser accuracy experiments:
 * - **E6 (Chapter-Level Fusion)**: Union all sources, cap at 110% of expected
 * - **E2 (Outlier Filtering)**: Beyond the cap, only keep chapters with rich metadata
 *
 * @param expectedChapterCount - Best estimate of total chapters (0 = unknown, skip filtering)
 * @param sourceArrays - Arrays of chapters from each source (e.g. [fandom, wikipedia, comicvine])
 */
export function mergeAllSourceChapters(
  expectedChapterCount: number,
  ...sourceArrays: ChapterDataItem[][]
): ChapterDataItem[] {
  const byNumber = new Map<number, ChapterDataItem>();

  for (const chapters of sourceArrays) {
    for (const ch of chapters) {
      const existing = byNumber.get(ch.number);
      if (!existing || scoreChapter(ch) >= scoreChapter(existing)) {
        byNumber.set(ch.number, ch);
      }
    }
  }

  const merged = [...byNumber.values()].sort((a, b) => a.number - b.number);

  // Drop overflow-integer duplicates / misnumbered extras (Dorohedoro phantom-volume class)
  const deduped = suppressOverflowDuplicateExtras(merged, expectedChapterCount);

  // E6 + E2: Cap at 110% of expected, with metadata exception for outliers
  return applyFusionCap(deduped, expectedChapterCount);
}

/**
 * Drop overflow-integer chapters that are duplicates or misnumbered extras.
 *
 * A source occasionally re-lists a manga's per-volume omake (and the finale) as linear integers
 * past the real chapter count — e.g. Dorohedoro's "Extra Evil"/"Special Chapter" surfacing as
 * 169/178/179 when the canonical omake already exist as decimals (6.1/6.5/…/167.x). Left alone
 * they inflate the chapter count and get bucketed into phantom `reconciliation` volumes (24/25).
 *
 * An integer strictly greater than `expectedChapterCount` is removed when it is either an
 * exact-title duplicate of a non-overflow chapter or explicitly bonus/extra-titled: its canonical
 * home is the decimal / in-range chapter that remains, so no content is lost.
 *
 * Conservative by construction — only fires when `expectedChapterCount` is a positive trusted
 * value, and never touches decimals or chapters within the declared count. Real chapters beyond an
 * undercounting scalar keep ordinary titles and survive.
 */
export function suppressOverflowDuplicateExtras(
  chapters: ChapterDataItem[],
  expectedChapterCount: number,
): ChapterDataItem[] {
  if (expectedChapterCount <= 0) return chapters;

  const normalize = (t: string): string => t.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const nonOverflowTitles = new Set<string>();
  for (const ch of chapters) {
    const isOverflowInteger = Number.isInteger(ch.number) && ch.number > expectedChapterCount;
    if (!isOverflowInteger && ch.title) nonOverflowTitles.add(normalize(ch.title));
  }

  const kept = chapters.filter(ch => {
    if (!Number.isInteger(ch.number) || ch.number <= expectedChapterCount) return true;
    const isExactDuplicate = ch.title !== undefined && nonOverflowTitles.has(normalize(ch.title));
    const isMisnumberedExtra = isBonusTitle(ch.title ?? null);
    return !(isExactDuplicate || isMisnumberedExtra);
  });

  const dropped = chapters.length - kept.length;
  if (dropped > 0) {
    log.debug(`Suppressed ${dropped} overflow duplicate/extra chapters (expected=${expectedChapterCount})`);
  }
  return kept;
}

/**
 * Apply E6 (110% cap) + E2 (metadata-aware outlier filtering).
 *
 * Chapters at or below the cap are always kept.
 * Chapters above the cap are only kept if they have cover OR description
 * metadata — indicating they're likely real chapters, not misparsed data.
 */
function applyFusionCap(
  chapters: ChapterDataItem[],
  expectedChapterCount: number,
): ChapterDataItem[] {
  if (expectedChapterCount <= 0) return chapters;

  const hardCap = Math.ceil(expectedChapterCount * 1.1);

  return chapters.filter(ch => {
    if (ch.number <= hardCap) return true;
    // E2: Beyond cap, only keep metadata-rich chapters
    return ch.cover !== undefined || ch.description !== undefined;
  });
}

/** Score a chapter entry by how much metadata it has */
function scoreChapter(ch: ChapterDataItem): number {
  let score = 0;
  if (ch.title) score += 3;
  if (ch.volume !== undefined) score += 2;
  if (ch.cover) score += 1;
  if (ch.description) score += 1;
  if (ch.pages !== undefined) score += 1;
  if (ch.releaseDate) score += 1;
  return score;
}
