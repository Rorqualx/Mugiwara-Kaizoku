/**
 * Pre-Parsed Chapter Handler
 *
 * Handles Priority 1: Volumes with pre-parsed chapters array.
 * Used when volume data already contains a structured chapters array
 * from providers like Fandom, AniList, or pre-processed ComicVine data.
 */

import { logger } from '@/utils/logger';

import { safeGet, safeGetString, safeGetStringOptional, parseReleaseDate, isRecord, truncateString } from '../helpers';

// Database column limits (VARCHAR(255))
const MAX_TITLE_LENGTH = 255;
const MAX_FILENAME_LENGTH = 255;

import type { ChapterToCreate, ChapterEnrichment, NormalizedVolume, PreParsedHandlerResult } from '../types';

/** Check if title content looks English (reject accented/CJK characters) */
function isLikelyEnglishContent(title: string): boolean {
  if (!title) return false;
  if (/[àâãäåçéèêëìíîïñòóôõöùúûüýÿœæ]/i.test(title)) return false;
  if (/[\u3000-\u9FFF\uAC00-\uD7AF]/.test(title)) return false;
  return true;
}

/**
 * Determines the chapter title with proper priority fallback
 *
 * Priority: enrichment title > comicvine title > default title
 *
 * @param enrichment - Optional enrichment data
 * @param chapterData - Raw chapter data
 * @param rawChapterNumber - Raw chapter number for fallback
 * @returns Resolved chapter title
 */
function resolveChapterTitle(
  enrichment: ChapterEnrichment[number] | undefined,
  chapterData: Record<string, unknown>,
  rawChapterNumber: unknown
): string {
  if (enrichment?.title) {
    return enrichment.title;
  }

  // Only use provider title if it's likely English (language tag + content check)
  const language = (chapterData['language'] ?? chapterData['translatedLanguage']) as string | undefined;
  if (!language || language === 'en') {
    const providerTitle = safeGetString(chapterData, 'title');
    if (providerTitle && isLikelyEnglishContent(providerTitle)) {
      return providerTitle;
    }
  }

  return `Chapter ${rawChapterNumber}`;
}

/**
 * Resolves the cover image with proper priority fallback
 *
 * Priority: enrichment cover > volume cover > null
 *
 * @param enrichment - Optional enrichment data
 * @param normalized - Normalized volume data
 * @returns Resolved cover image URL or null
 */
function resolveCoverImage(
  enrichment: ChapterEnrichment[number] | undefined,
  normalized: NormalizedVolume
): string | null {
  return enrichment?.coverImage ?? normalized.coverImage ?? null;
}

/**
 * Resolves the chapter description with proper priority fallback
 *
 * Priority: enrichment summary > chapter description > volume description > null
 *
 * @param enrichment - Optional enrichment data
 * @param chapterData - Raw chapter data
 * @param normalized - Normalized volume data
 * @returns Resolved description or null
 */
function resolveDescription(
  enrichment: ChapterEnrichment[number] | undefined,
  chapterData: Record<string, unknown>,
  normalized: NormalizedVolume
): string | null {
  if (enrichment?.summary) {
    return enrichment.summary;
  }

  const chapterDesc = safeGetStringOptional(chapterData, 'description');
  if (chapterDesc) {
    return chapterDesc;
  }

  if (typeof normalized.description === 'string') {
    return normalized.description;
  }

  return null;
}

/**
 * Resolves the release date with proper priority fallback
 *
 * Priority: enrichment release date > volume release date > null
 *
 * @param enrichment - Optional enrichment data
 * @param normalized - Normalized volume data
 * @returns Resolved release date or null
 */
function resolveReleaseDate(
  enrichment: ChapterEnrichment[number] | undefined,
  normalized: NormalizedVolume
): Date | null {
  const enrichmentDate = parseReleaseDate(enrichment?.releaseDate);
  if (enrichmentDate) {
    return enrichmentDate;
  }

  return parseReleaseDate(normalized.releaseDate) ?? null;
}

/**
 * Parameters for chapter creation debug logging
 */
interface ChapterDebugParams {
  rawChapterNumber: unknown;
  chapterNumber: number;
  chapterIndex: number;
  comicvineTitle: string;
  enrichment: ChapterEnrichment[number] | undefined;
  chapterTitle: string;
  chapterData: Record<string, unknown>;
}

/**
 * Logs debug information about chapter creation
 *
 * @param params - Chapter debug parameters
 */
function logChapterCreationDebug(params: ChapterDebugParams): void {
  logger.debug(`Creating chapter from wizard data:`, {
    rawChapterNumber: params.rawChapterNumber,
    calculatedChapterNumber: params.chapterNumber,
    comicvineTitle: params.comicvineTitle,
    enrichmentTitle: params.enrichment?.title,
    finalTitle: params.chapterTitle,
    chapterIndex: params.chapterIndex,
    hasWizardDescription: !!safeGet(params.chapterData, 'description'),
    hasEnrichment: !!params.enrichment,
    enrichmentSummary: params.enrichment?.summary?.substring(0, 50)
  });
}

/**
 * Generates standardized filename for a chapter
 *
 * @param volumeNumber - Volume number
 * @param chapterNumber - Chapter number
 * @returns Formatted filename
 */
function generateChapterFileName(volumeNumber: number, chapterNumber: number): string {
  return `v${volumeNumber.toString().padStart(2, '0')}-c${String(chapterNumber).padStart(3, '0')}.cbz`;
}

/**
 * Parses the raw chapter number from scraped data
 *
 * ComicVine scraping returns chapter numbers in various formats:
 * - Numeric: "300", "301", "0"
 * - Special: "final", "epilogue-1", "special-1"
 *
 * This function extracts the numeric value or returns null for special chapters.
 *
 * @param rawNumber - Raw chapter number from scraped data
 * @returns Parsed numeric chapter number or null for special chapters
 */
function parseChapterNumber(rawNumber: unknown): number | null {
  if (rawNumber === null || rawNumber === undefined) {
    return null;
  }

  // Handle numeric values directly
  if (typeof rawNumber === 'number') {
    return rawNumber;
  }

  // Handle string values
  if (typeof rawNumber === 'string') {
    const trimmed = rawNumber.trim();

    // Check for special chapter markers (final, epilogue, special, etc.)
    if (/^(final|epilogue|special|side|extra|omake|bonus|prologue)/i.test(trimmed)) {
      return null; // Let these be assigned sequential numbers after regular chapters
    }

    // Try to parse as integer
    const parsed = parseInt(trimmed, 10);
    if (!isNaN(parsed)) {
      return parsed;
    }
  }

  return null;
}

/**
 * Checks if a chapter is a special chapter type (final, epilogue, etc.)
 *
 * @param rawNumber - Raw chapter number from scraped data
 * @param chapterData - Full chapter data object
 * @returns True if this is a special chapter
 */
function isSpecialChapter(rawNumber: unknown, chapterData: Record<string, unknown>): boolean {
  // Check raw number for special markers
  if (typeof rawNumber === 'string') {
    const trimmed = rawNumber.trim().toLowerCase();
    if (/^(final|epilogue|special|side|extra|omake|bonus|prologue)/i.test(trimmed)) {
      return true;
    }
  }

  // Check chapter flags
  const isFinal = safeGet(chapterData, 'isFinalChapter');
  const isEpilogue = safeGet(chapterData, 'isEpilogue');
  const isSpecial = safeGet(chapterData, 'isSpecial');

  return Boolean(isFinal) || Boolean(isEpilogue) || Boolean(isSpecial);
}

/**
 * Find the highest numeric chapter number in the chapters array
 */
function findHighestNumericChapter(chapters: unknown[]): number {
  let highest = 0;
  for (const chapterData of chapters) {
    if (!isRecord(chapterData)) continue;
    const rawNumber = safeGet(chapterData, 'number') ?? safeGet(chapterData, 'chapterNumber');
    const parsed = parseChapterNumber(rawNumber);
    if (parsed !== null && parsed > highest) {
      highest = parsed;
    }
  }
  return highest;
}

/**
 * Determine the chapter number from raw scraped data
 *
 * @returns Object with chapterNumber and optionally updated nextSpecial counter
 */
function determineChapterNumber(
  rawChapterNumber: unknown,
  chapterData: Record<string, unknown>,
  currentIndex: number,
  nextSpecialValue: number
): { chapterNumber: number; nextSpecial: number } {
  const parsedNumber = parseChapterNumber(rawChapterNumber);

  if (parsedNumber !== null) {
    return { chapterNumber: parsedNumber, nextSpecial: nextSpecialValue };
  }

  if (isSpecialChapter(rawChapterNumber, chapterData)) {
    const assignedNumber = nextSpecialValue;
    logger.info(`Assigning special chapter number ${assignedNumber} to "${rawChapterNumber}" (type: special/final/epilogue)`);
    return { chapterNumber: assignedNumber, nextSpecial: nextSpecialValue + 1 };
  }

  logger.warn(`Using fallback index ${currentIndex} for chapter with raw number: ${rawChapterNumber}`);
  return { chapterNumber: currentIndex, nextSpecial: nextSpecialValue };
}

/**
 * Options for building a chapter object
 */
interface BuildChapterOptions {
  chapterData: Record<string, unknown>;
  mangaId: number;
  normalized: NormalizedVolume;
  chapterNumber: number;
  chapterIndex: number;
  enrichment: ChapterEnrichment[number] | undefined;
  rawChapterNumber: unknown;
}

/**
 * Build a single chapter object from chapter data
 */
function buildChapter(options: BuildChapterOptions): ChapterToCreate {
  const { chapterData, mangaId, normalized, chapterNumber, chapterIndex, enrichment, rawChapterNumber } = options;
  const comicvineTitle = safeGetString(chapterData, 'title');
  const chapterTitle = resolveChapterTitle(enrichment, chapterData, rawChapterNumber);

  logChapterCreationDebug({
    rawChapterNumber,
    chapterNumber,
    chapterIndex,
    comicvineTitle,
    enrichment,
    chapterTitle,
    chapterData
  });

  return {
    mangaId,
    title: truncateString(chapterTitle, MAX_TITLE_LENGTH),
    alternativeTitles: enrichment?.alternativeTitles ?? [],
    index: chapterIndex,
    chapterNumber,
    fileName: truncateString(generateChapterFileName(normalized.volumeNumber, chapterNumber), MAX_FILENAME_LENGTH),
    size: 0,
    downloadStatus: 'PENDING' as const,
    volume: normalized.volumeNumber,
    downloadUrl: normalized.downloadUrl ?? null,
    coverImage: resolveCoverImage(enrichment, normalized),
    description: resolveDescription(enrichment, chapterData, normalized),
    releaseDate: resolveReleaseDate(enrichment, normalized),
    pageCount: enrichment?.pages ?? null,
    monitored: true,
    updatedAt: new Date()
  };
}

/**
 * Process volumes with pre-parsed chapters array
 *
 * @param normalized - Normalized volume data with chapters array
 * @param mangaId - ID of the manga to associate chapters with
 * @param globalChapterIndex - Current global chapter index for sequential ordering
 * @param chapterEnrichment - Optional enrichment data from providers (e.g., Fandom)
 * @returns Object containing created chapters and updated global chapter index
 */
export function handlePreParsedChapters(
  normalized: NormalizedVolume,
  mangaId: number,
  globalChapterIndex: number,
  chapterEnrichment?: ChapterEnrichment
): PreParsedHandlerResult {
  const chapters: ChapterToCreate[] = [];
  let currentIndex = globalChapterIndex;

  if (!Array.isArray(normalized.chapters) || normalized.chapters.length === 0) {
    logger.warn(`handlePreParsedChapters called without valid chapters array for volume ${normalized.volumeNumber}`);
    return { chapters, globalChapterIndex: currentIndex };
  }

  logger.info(`Volume #${normalized.volumeNumber} has ${normalized.chapters.length} pre-parsed chapters`);

  const highestNumericChapter = findHighestNumericChapter(normalized.chapters);
  let nextSpecialValue = highestNumericChapter + 1;

  for (const chapterData of normalized.chapters) {
    if (!isRecord(chapterData)) {
      logger.warn(`Skipping non-record chapter data in volume ${normalized.volumeNumber}`);
      continue;
    }

    const rawChapterNumber = safeGet(chapterData, 'number') ?? safeGet(chapterData, 'chapterNumber');
    const result = determineChapterNumber(rawChapterNumber, chapterData, currentIndex, nextSpecialValue);
    const chapterNumber = result.chapterNumber;
    nextSpecialValue = result.nextSpecial;
    const chapterIndex = currentIndex++;
    const enrichment = chapterEnrichment?.[chapterNumber];

    chapters.push(buildChapter({
      chapterData,
      mangaId,
      normalized,
      chapterNumber,
      chapterIndex,
      enrichment,
      rawChapterNumber
    }));
  }

  return { chapters, globalChapterIndex: currentIndex };
}
