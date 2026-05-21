/**
 * Manga Router Chapter Operations
 *
 * Functions for extracting, merging, and creating chapters from
 * various provider data sources (Fandom, etc).
 *
 * Extracted from: helpers.ts (lines 454-733)
 */

import {
  getUnifiedFilenameMatcher,
  parseFilename,
} from '@/server/services/matching';
import type {
  FilenameMatchResult,
  VolumeForMatching,
  SupportedProvider,
} from '@/server/services/matching/types';
import { isPrismaContext } from '@/types/api/manga-router-types';
import { logger } from '@/utils/logger';

import { parseReleaseDate } from './normalizers';
import { isRecord, safeGet, safeGetString, parseNumber } from './type-guards';

import type { ChapterToCreate, ChapterEnrichment } from './types';

// ============================================================================
// Chapter Merging and Sorting
// ============================================================================

/**
 * Merge missing chapters from enrichment data that aren't in the main chapter list
 */
export function mergeMissingChaptersFromEnrichment(
  chaptersToCreate: ChapterToCreate[],
  chapterEnrichment: ChapterEnrichment,
  mangaId: number
): ChapterToCreate[] {
  try {
    // Get all chapter numbers AND titles from ComicVine chapters for deduplication
    const comicvineChapterNumbers = new Set(chaptersToCreate.map(c => c.chapterNumber));

    // CRITICAL: Also track chapter titles to prevent duplicates with different numbers
    // Normalize titles by removing special characters and converting to lowercase for comparison
    const normalizeTitle = (title: string): string =>
      title.toLowerCase().replace(/[^a-z0-9]/g, '');

    const comicvineTitles = new Set(
      chaptersToCreate.map(c => normalizeTitle(c.title))
    );

    // Check enrichment data for chapters not in ComicVine
    const missingChapters: ChapterToCreate[] = [];

    for (const [chapterNumStr, enrichmentData] of Object.entries(chapterEnrichment)) {
      const chapterNum = Number(chapterNumStr);

      // Skip if we already have this chapter number
      if (comicvineChapterNumbers.has(chapterNum)) continue;

      // Skip if we have a chapter with the same title (different number)
      const enrichmentTitle = enrichmentData.title ?? `Chapter ${chapterNum}`;
      if (comicvineTitles.has(normalizeTitle(enrichmentTitle))) {
        logger.debug(`Skipping enrichment chapter ${chapterNum} - title "${enrichmentTitle}" already exists`);
        continue;
      }

      // This is a genuinely missing chapter - add it
      logger.info(`Adding missing chapter ${chapterNum} from enrichment data`);

      const volumeNumber = Math.ceil(chapterNum / 10); // Simple estimation

      missingChapters.push({
        mangaId,
        title: enrichmentTitle,
        alternativeTitles: enrichmentData.alternativeTitles ?? [],
        index: chapterNum,
        chapterNumber: chapterNum,
        fileName: `v${volumeNumber.toString().padStart(2, '0')}-c${chapterNum.toString().padStart(3, '0')}.cbz`,
        size: 0,
        downloadStatus: 'PENDING' as const,
        volume: volumeNumber,
        downloadUrl: enrichmentData.url ?? null,
        coverImage: enrichmentData.coverImage ?? null,
        description: enrichmentData.summary ?? null,
        releaseDate: enrichmentData.releaseDate ? parseReleaseDate(enrichmentData.releaseDate) : null,
        pageCount: enrichmentData.pages ?? null,
        monitored: true,
        updatedAt: new Date()
      });
    }

    if (missingChapters.length > 0) {
      logger.info(`Added ${missingChapters.length} missing chapters from enrichment data`);
      return [...chaptersToCreate, ...missingChapters];
    }

    return chaptersToCreate;
  } catch (error) {
    logger.error('Error merging missing chapters from enrichment:', error);
    return chaptersToCreate;
  }
}

/**
 * Sort chapters by chapter number and assign sequential indices
 * Returns a new array without mutating the input
 */
export function sortAndAssignSequentialIndices(chapters: ChapterToCreate[]): ChapterToCreate[] {
  // Sort by chapter number
  const sorted = [...chapters].sort((a, b) => Number(a.chapterNumber) - Number(b.chapterNumber));

  // Return new array with sequential indices (no parameter mutation)
  return sorted.map((chapter, index) => ({
    ...chapter,
    index: index + 1
  }));
}

// ============================================================================
// Database Operations
// ============================================================================

/**
 * Batch create chapters in database
 */
export async function batchCreateChaptersInDatabase(
  context: unknown,
  chapters: ChapterToCreate[]
): Promise<void> {
  if (!isPrismaContext(context)) {
    throw new Error('Invalid context: missing prisma');
  }

  const batchSize = 50;
  const batches: ChapterToCreate[][] = [];

  // Split into batches
  for (let i = 0; i < chapters.length; i += batchSize) {
    batches.push(chapters.slice(i, i + batchSize));
  }

  // Create batches sequentially to avoid overwhelming the database
  for (const batch of batches) {
    // eslint-disable-next-line no-await-in-loop
    await context.prisma.chapter.createMany({
      data: batch,
      skipDuplicates: true,
    });
  }

  logger.info(`Created ${chapters.length} chapters in ${batches.length} batches`);
}

// ============================================================================
// Fandom Data Extraction
// ============================================================================

/**
 * Extract chapters from Fandom volume data
 */
export function extractChaptersFromFandomVolumes(
  volumeData: unknown[],
  mangaId: number
): ChapterToCreate[] {
  logger.info(`Processing ${volumeData.length} volumes from FANDOM data`);
  const chaptersToCreate: ChapterToCreate[] = [];

  for (const volume of volumeData) {
    if (!isRecord(volume)) continue;

    const volumeNumber = parseNumber(safeGet(volume, 'volumeNumber'), 1);
    const chapters = safeGet(volume, 'chapters');

    if (!Array.isArray(chapters)) {
      logger.warn(`Volume ${volumeNumber} has no chapters array`);
      continue;
    }

    logger.info(`Volume ${volumeNumber} has ${chapters.length} chapters`);

    for (const chapter of chapters) {
      if (!isRecord(chapter)) continue;

      const chapterNum = parseNumber(safeGet(chapter, 'number') ?? safeGet(chapter, 'chapterNumber'), 0);

      chaptersToCreate.push({
        mangaId: mangaId,
        title: safeGetString(chapter, 'title', `Chapter ${chapterNum}`),
        alternativeTitles: [],
        index: chapterNum,
        chapterNumber: chapterNum,
        fileName: `v${volumeNumber.toString().padStart(2, '0')}-c${chapterNum.toString().padStart(3, '0')}.cbz`,
        size: 0,
        downloadStatus: 'PENDING' as const,
        volume: volumeNumber,
        downloadUrl: safeGetString(chapter, 'url') || null,
        coverImage: safeGetString(chapter, 'coverImageUrl') || null,
        description: safeGetString(chapter, 'description') || null,
        releaseDate: null,
        pageCount: null,
        monitored: true,
        updatedAt: new Date()
      });
    }
  }

  logger.info(`Extracted ${chaptersToCreate.length} chapters from ${volumeData.length} volumes`);
  return chaptersToCreate;
}

/**
 * Extract chapters from flat Fandom chapters array
 */
export function extractChaptersFromFandomArray(
  chapters: unknown[],
  mangaId: number
): ChapterToCreate[] {
  logger.info(`Found ${chapters.length} chapters in FANDOM data`);
  const chaptersToCreate: ChapterToCreate[] = [];

  for (const chapter of chapters) {
    if (!isRecord(chapter)) continue;

    const chapterNumRaw = safeGet(chapter, 'number') ?? safeGet(chapter, 'chapterNumber');
    const chapterNum = parseNumber(chapterNumRaw, 0);

    // Use the volume number directly from the chapter data
    const volumeRaw = safeGet(chapter, 'volume');
    let volumeNumber = parseNumber(volumeRaw, 0);

    // Fallback if volume is not set in chapter data (allow Volume 0 for prequels like JJK 0)
    if (volumeNumber < 0) {
      volumeNumber = -1;
      logger.warn(`Chapter ${chapterNum} has no volume set in FANDOM data, marking as unassigned (volume=-1)`);
    } else {
      logger.info(`Chapter ${chapterNum} has volume ${volumeNumber} from FANDOM data`);
    }

    logger.info(`Creating chapter ${chapterNum} with volume ${volumeNumber}`);

    chaptersToCreate.push({
      mangaId: mangaId,
      title: safeGetString(chapter, 'title', `Chapter ${chapterNum}`),
      alternativeTitles: [],
      index: chapterNum,
      chapterNumber: chapterNum,
      fileName: `v${volumeNumber.toString().padStart(2, '0')}-c${chapterNum.toString().padStart(3, '0')}.cbz`,
      size: 0,
      downloadStatus: 'PENDING' as const,
      volume: volumeNumber,
      downloadUrl: safeGetString(chapter, 'url') || null,
      coverImage: safeGetString(chapter, 'coverImageUrl') || null,
      description: safeGetString(chapter, 'description') || null,
      releaseDate: null,
      pageCount: null,
      monitored: true,
      updatedAt: new Date()
    });
  }

  // Sort chapters by index to ensure proper order
  chaptersToCreate.sort((a, b) => Number(a.index) - Number(b.index));

  logger.info(`Prepared ${chaptersToCreate.length} chapters for creation`);
  return chaptersToCreate;
}

// ============================================================================
// Main Chapter Creation from Fandom
// ============================================================================

/**
 * Create chapters from Fandom data
 * Handles both volumeData array structure and flat chapters array
 */
export async function createFandomChapters(
  context: unknown,
  mangaId: number,
  fandomData: unknown
): Promise<void> {
  logger.info(`Creating chapters from FANDOM data...`, {
    isRecord: isRecord(fandomData),
    dataKeys: isRecord(fandomData) ? Object.keys(fandomData).slice(0, 15) : [],
    hasVolumeData: isRecord(fandomData) ? !!safeGet(fandomData, 'volumeData') : false
  });

  let chaptersToCreate: ChapterToCreate[] = [];

  // Check if we have volumeData array structure (from wizard import)
  if (isRecord(fandomData)) {
    const volumeData = safeGet(fandomData, 'volumeData');
    logger.info(`Checking volumeData:`, {
      exists: !!volumeData,
      isArray: Array.isArray(volumeData),
      type: volumeData ? typeof volumeData : 'undefined',
      length: Array.isArray(volumeData) ? volumeData.length : 0
    });

    if (Array.isArray(volumeData)) {
      chaptersToCreate = extractChaptersFromFandomVolumes(volumeData, mangaId);
    }
  }

  // Check if we have chapters array in the new structure (fallback for flat structure)
  if (chaptersToCreate.length === 0 && isRecord(fandomData)) {
    const chapters = safeGet(fandomData, 'chapters');
    if (Array.isArray(chapters)) {
      chaptersToCreate = extractChaptersFromFandomArray(chapters, mangaId);
    } else {
      logger.warn('No chapters array found in FANDOM data');
    }
  }

  // Create chapters in database
  if (chaptersToCreate.length > 0) {
    await batchCreateChaptersInDatabase(context, chaptersToCreate);
    logger.info(`Successfully created all ${chaptersToCreate.length} chapters from Fandom data`);
  }
}

// ============================================================================
// File Matching Operations
// ============================================================================

/**
 * Options for file matching
 */
export interface FileMatchingOptions {
  /** Provider used for import (affects matching algorithm) */
  provider: SupportedProvider;
  /** Array of filenames to match */
  filenames: string[];
  /** Volume data for matching */
  volumes: VolumeForMatching[];
  /** Auto-match threshold (default: 0.85) */
  threshold?: number | undefined;
}

/**
 * Result of file matching operation
 */
export interface FileMatchingResult {
  /** Map of volume number to matched filename */
  volumeToFile: Map<number, string>;
  /** Map of chapter number to matched filename */
  chapterToFile: Map<number, string>;
  /** Number of successful matches */
  matchedCount: number;
  /** Number of unmatched files */
  unmatchedCount: number;
  /** Detailed match results */
  details: FilenameMatchResult[];
}

/**
 * Match files to volumes using the unified filename matcher
 *
 * @param options - File matching options
 * @returns File matching result with volume and chapter mappings
 */
export function matchFilesToVolumes(options: FileMatchingOptions): FileMatchingResult {
  const { provider, filenames, volumes, threshold } = options;

  logger.info(`[FileMatching] Matching ${filenames.length} files to ${volumes.length} volumes using ${provider}`);

  // Parse filenames
  const parsedFiles = filenames.map(parseFilename);

  // Get the unified matcher
  const matcher = getUnifiedFilenameMatcher();

  // Set threshold if provided
  if (threshold !== undefined) {
    matcher.setThreshold(threshold);
  }

  // Match files to volumes
  const matchResults = matcher.matchFilesToVolumes(parsedFiles, volumes, provider);

  // Build volume-to-file mapping
  const volumeToFile = new Map<number, string>();
  const chapterToFile = new Map<number, string>();

  let matchedCount = 0;
  let unmatchedCount = 0;

  for (const result of matchResults) {
    if (result.bestMatch) {
      volumeToFile.set(result.bestMatch.volumeNumber, result.file.filename);
      matchedCount++;
    } else {
      unmatchedCount++;
    }
  }

  // Build chapter-to-file mapping based on volume assignments
  for (const volume of volumes) {
    const volumeNumber = volume.volumeNumber ?? volume.number;
    if (volumeNumber === undefined) continue;

    const matchedFile = volumeToFile.get(volumeNumber);
    if (!matchedFile) continue;

    // Get chapters for this volume (if available)
    const volumeChapters = (volume as Record<string, unknown>)['chapters'];
    if (Array.isArray(volumeChapters)) {
      for (const chapter of volumeChapters) {
        if (!isRecord(chapter)) continue;

        const chapterNum = parseNumber(
          safeGet(chapter, 'number') ?? safeGet(chapter, 'chapterNumber'),
          0
        );

        if (chapterNum > 0) {
          chapterToFile.set(chapterNum, matchedFile);
        }
      }
    }
  }

  logger.info(
    `[FileMatching] Complete: ${matchedCount} volumes matched, ${chapterToFile.size} chapters mapped, ${unmatchedCount} unmatched`
  );

  return {
    volumeToFile,
    chapterToFile,
    matchedCount,
    unmatchedCount,
    details: matchResults,
  };
}

/**
 * Apply file matching results to chapters being created
 *
 * @param chapters - Chapters to update with file paths
 * @param chapterToFile - Map of chapter number to filename
 * @returns Updated chapters with file paths
 */
export function applyFileMatchingToChapters(
  chapters: ChapterToCreate[],
  chapterToFile: Map<number, string>
): ChapterToCreate[] {
  return chapters.map(chapter => {
    const matchedFile = chapterToFile.get(chapter.chapterNumber);

    if (matchedFile) {
      logger.debug(`[FileMatching] Matched chapter ${chapter.chapterNumber} to file: ${matchedFile}`);
      return {
        ...chapter,
        fileName: matchedFile,
      };
    }

    return chapter;
  });
}

/**
 * Extract chapters from volumes with file matching
 *
 * Enhanced version of extractChaptersFromFandomVolumes that also matches files
 *
 * @param volumeData - Volume data from provider
 * @param mangaId - Manga ID
 * @param matchingOptions - Optional file matching options
 * @returns Chapters with matched file paths
 */
export function extractChaptersFromVolumesWithMatching(
  volumeData: unknown[],
  mangaId: number,
  matchingOptions?: {
    filenames: string[];
    provider: SupportedProvider;
  }
): ChapterToCreate[] {
  // First, extract chapters normally
  let chapters = extractChaptersFromFandomVolumes(volumeData, mangaId);

  // If matching options provided, match files to chapters
  if (matchingOptions && matchingOptions.filenames.length > 0) {
    logger.info(`[FileMatching] Applying file matching to ${chapters.length} chapters`);

    // Convert volumeData to VolumeForMatching format
    const volumes: VolumeForMatching[] = volumeData
      .filter(isRecord)
      .map(v => {
        const volumeNum = safeGet(v, 'volumeNumber');
        const num = safeGet(v, 'number');
        return {
          volumeNumber: volumeNum !== undefined ? parseNumber(volumeNum, 0) : undefined,
          number: num !== undefined ? parseNumber(num, 0) : undefined,
          title: safeGetString(v, 'title'),
          name: safeGetString(v, 'name'),
          releaseDate: safeGetString(v, 'releaseDate'),
          chapters: safeGet(v, 'chapters') as unknown[],
        };
      });

    // Match files to volumes
    const matchResult = matchFilesToVolumes({
      provider: matchingOptions.provider,
      filenames: matchingOptions.filenames,
      volumes,
    });

    // Apply matches to chapters
    chapters = applyFileMatchingToChapters(chapters, matchResult.chapterToFile);
  }

  return chapters;
}
