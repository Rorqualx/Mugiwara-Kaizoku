/**
 * Wikipedia Metadata Fetch Router
 *
 * Handles fetching enhanced metadata from Wikipedia for manga titles.
 *
 * Procedures:
 * - fetchWikipediaMetadata: Fetch enhanced metadata from Wikipedia
 *
 * Extracted from: metadata-wikipedia.ts (lines 30-73)
 */

import { z } from 'zod';

import type { WikipediaParseResult } from '@/server/services/wikipedia/adaptive';
import { adaptiveExtract } from '@/server/services/wikipedia/wikipedia/manga-extractor';
import type { WikipediaMangaData } from '@/server/services/wikipedia/wikipedia/types';
import { publicProcedure } from '@/server/trpc/procedures';
import { router } from '@/server/trpc/trpc';
import { createErrorResult, createSuccessResult } from '@/utils/async-result';
import type { AsyncResult } from '@/utils/async-result';
import { logger } from '@/utils/logger';

/**
 * Parse date from originalRun string like "September 23, 2015 – February 22, 2022"
 * @param originalRun - The original run string
 * @param type - 'start' or 'end' to indicate which date to extract
 * @returns ISO date string or undefined
 */
function parseOriginalRunDate(originalRun: string | undefined, type: 'start' | 'end'): string | undefined {
  if (!originalRun) return undefined;

  // Common separators: – (en-dash), - (hyphen), to, ~
  const separatorPattern = /\s*[–\-~]\s*|\s+to\s+/i;
  const parts = originalRun.split(separatorPattern);

  if (parts.length === 0) return undefined;

  const dateStr = type === 'start' ? parts[0] : parts[parts.length - 1];
  if (!dateStr) return undefined;

  // Check for "present" which means ongoing
  if (type === 'end' && /present/i.test(dateStr.trim())) {
    return undefined; // Still ongoing
  }

  // Try to parse the date string
  const parsed = parseDateString(dateStr.trim());
  return parsed;
}

/**
 * Parse various date string formats to ISO date string
 * Handles: "September 23, 2015", "2015-09-23", "Sep 2015", "2015"
 */
function parseDateString(dateStr: string): string | undefined {
  // Remove common noise
  const cleaned = dateStr
    .replace(/\(.*?\)/g, '') // Remove parenthetical content
    .replace(/\[.*?\]/g, '') // Remove bracketed content
    .trim();

  // Try ISO format first (YYYY-MM-DD)
  const isoMatch = cleaned.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    return cleaned;
  }

  // Try "Month Day, Year" format (September 23, 2015)
  const fullDateMatch = cleaned.match(/([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})/);
  if (fullDateMatch) {
    const month = parseMonth(fullDateMatch[1] ?? '');
    const day = fullDateMatch[2];
    const year = fullDateMatch[3];
    if (month && day && year) {
      return `${year}-${month}-${day.padStart(2, '0')}`;
    }
  }

  // Try "Day Month Year" format (23 September 2015)
  const dmyMatch = cleaned.match(/(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/);
  if (dmyMatch) {
    const day = dmyMatch[1];
    const month = parseMonth(dmyMatch[2] ?? '');
    const year = dmyMatch[3];
    if (month && day && year) {
      return `${year}-${month}-${day.padStart(2, '0')}`;
    }
  }

  // Try "Month Year" format (September 2015)
  const monthYearMatch = cleaned.match(/([A-Za-z]+)\s+(\d{4})/);
  if (monthYearMatch) {
    const month = parseMonth(monthYearMatch[1] ?? '');
    const year = monthYearMatch[2];
    if (month && year) {
      return `${year}-${month}-01`;
    }
  }

  // Try just year (2015)
  const yearMatch = cleaned.match(/^(\d{4})$/);
  if (yearMatch) {
    return `${yearMatch[1]}-01-01`;
  }

  return undefined;
}

/**
 * Parse month name to two-digit month number
 */
function parseMonth(monthStr: string): string | undefined {
  const months: Record<string, string> = {
    january: '01', jan: '01',
    february: '02', feb: '02',
    march: '03', mar: '03',
    april: '04', apr: '04',
    may: '05',
    june: '06', jun: '06',
    july: '07', jul: '07',
    august: '08', aug: '08',
    september: '09', sep: '09', sept: '09',
    october: '10', oct: '10',
    november: '11', nov: '11',
    december: '12', dec: '12',
  };
  return months[monthStr.toLowerCase()];
}

/**
 * Derive manga publication status from originalRun string
 *
 * Logic:
 * - If ends with "present", "ongoing", or similar → ONGOING
 * - If has a concrete end date → COMPLETED
 * - If only start date (no separator) → ONGOING (assume still publishing)
 * - Otherwise → UNKNOWN
 *
 * @param originalRun - The original run string (e.g., "September 23, 2015 – present")
 * @returns Status string: 'ONGOING', 'COMPLETED', or 'UNKNOWN'
 */
function deriveStatusFromOriginalRun(originalRun: string | undefined): string {
  if (!originalRun) {
    return 'UNKNOWN';
  }

  const runLower = originalRun.toLowerCase().trim();

  // Check for ongoing indicators
  const ongoingIndicators = ['present', 'ongoing', 'current', 'continuing'];
  for (const indicator of ongoingIndicators) {
    if (runLower.includes(indicator)) {
      return 'ONGOING';
    }
  }

  // Check if there's a date range separator (– or -)
  const hasSeparator = /[–-]/.test(originalRun);

  if (hasSeparator) {
    // Has a separator - check if there's content after it
    const parts = originalRun.split(/[–-]/);
    const afterSeparator = parts[1]?.trim();

    if (afterSeparator && afterSeparator.length > 0) {
      // Has end date content - check if it's a real date (not "present")
      const datePattern = /\d{4}/; // Contains a year
      if (datePattern.test(afterSeparator)) {
        return 'COMPLETED';
      }
    }
  }

  // If only start date with no end indication, assume ongoing
  const hasStartDate = /\d{4}/.test(originalRun);
  if (hasStartDate && !hasSeparator) {
    return 'ONGOING';
  }

  return 'UNKNOWN';
}

/**
 * Check if parse result has substantial data worth using.
 * Uses strict thresholds to ensure quality results.
 */
function hasSubstantialData(result: WikipediaParseResult): boolean {
  // Check success first
  if (!result.success) return false;

  // Get counts from data object or top-level arrays
  const volumeCount = result.data?.volumeList?.length ?? result.data?.volumes ?? result.volumes.length;
  const chapterCount = result.data?.chapterList?.length ?? result.data?.chapters ?? result.chapters.length;

  return (
    // At least 3 volumes
    volumeCount >= 3 ||
    // 5+ chapters with at least 1 volume
    (chapterCount >= 5 && volumeCount >= 1) ||
    // Many chapters alone (20+)
    chapterCount >= 20
  );
}

/**
 * Merge arrays, removing duplicates.
 */
function mergeArrays<T>(a?: T[], b?: T[]): T[] | undefined {
  const merged = [...new Set([...(a ?? []), ...(b ?? [])])];
  return merged.length > 0 ? merged : undefined;
}

/**
 * Merge two Wikipedia results with metadata-aware logic.
 * - primary: typically from basic findBestMatch (has synopsis, cover)
 * - secondary: typically from adaptive parser (has better volume/chapter lists, metadata)
 *
 * Strategy: Use primary for identity/synopsis, prefer secondary for metadata and lists.
 */
// eslint-disable-next-line max-lines-per-function, complexity, max-statements -- Field-by-field merge of WikipediaMangaData requires explicit handling of 30+ optional fields; splitting would fragment cohesive merge logic
function mergeWikipediaResults(
  primary: WikipediaMangaData,
  secondary: WikipediaMangaData
): WikipediaMangaData {
  // Start with required title field
  const merged: WikipediaMangaData = {
    title: primary.title || secondary.title,
  };

  // Add optional string fields only if they have values
  const wikipediaUrl = primary.wikipediaUrl ?? secondary.wikipediaUrl;
  if (wikipediaUrl) merged.wikipediaUrl = wikipediaUrl;

  const synopsis = primary.synopsis ?? secondary.synopsis;
  if (synopsis) merged.synopsis = synopsis;

  const description = primary.description ?? secondary.description;
  if (description) merged.description = description;

  const plot = primary.plot ?? secondary.plot;
  if (plot) merged.plot = plot;

  const coverImage = primary.coverImage ?? secondary.coverImage;
  if (coverImage) merged.coverImage = coverImage;

  // Prefer secondary for metadata (adaptive often extracts better)
  const status = secondary.status ?? primary.status;
  if (status) merged.status = status;

  const originalRun = secondary.originalRun ?? primary.originalRun;
  if (originalRun) merged.originalRun = originalRun;

  const publicationStatus = secondary.publicationStatus ?? primary.publicationStatus;
  if (publicationStatus) merged.publicationStatus = publicationStatus;

  const publisher = secondary.publisher ?? primary.publisher;
  if (publisher) merged.publisher = publisher;

  const englishPublisher = secondary.englishPublisher ?? primary.englishPublisher;
  if (englishPublisher) merged.englishPublisher = englishPublisher;

  const magazine = secondary.magazine ?? primary.magazine;
  if (magazine) merged.magazine = magazine;

  const englishMagazine = secondary.englishMagazine ?? primary.englishMagazine;
  if (englishMagazine) merged.englishMagazine = englishMagazine;

  const demographic = secondary.demographic ?? primary.demographic;
  if (demographic) merged.demographic = demographic;

  const imprint = secondary.imprint ?? primary.imprint;
  if (imprint) merged.imprint = imprint;

  const mangaType = secondary.mangaType ?? primary.mangaType;
  if (mangaType) merged.mangaType = mangaType;

  // Merge arrays from both sources (only add if non-empty)
  const alternativeTitles = mergeArrays(primary.alternativeTitles, secondary.alternativeTitles);
  if (alternativeTitles) merged.alternativeTitles = alternativeTitles;

  const author = mergeArrays(primary.author, secondary.author);
  if (author) merged.author = author;

  const artist = mergeArrays(primary.artist, secondary.artist);
  if (artist) merged.artist = artist;

  const editor = mergeArrays(primary.editor, secondary.editor);
  if (editor) merged.editor = editor;

  const genres = mergeArrays(primary.genres, secondary.genres);
  if (genres) merged.genres = genres;

  const licensedBy = mergeArrays(primary.licensedBy, secondary.licensedBy);
  if (licensedBy) merged.licensedBy = licensedBy;

  // Prefer lists from whichever source has more
  const volumeList = (secondary.volumeList?.length ?? 0) > (primary.volumeList?.length ?? 0)
    ? secondary.volumeList
    : primary.volumeList;
  if (volumeList && volumeList.length > 0) {
    merged.volumeList = volumeList;
  }

  const chapterList = (secondary.chapterList?.length ?? 0) > (primary.chapterList?.length ?? 0)
    ? secondary.chapterList
    : primary.chapterList;
  if (chapterList && chapterList.length > 0) {
    merged.chapterList = chapterList;
  }

  // Use counts from best source
  const maxVolumes = Math.max(primary.volumes ?? 0, secondary.volumes ?? 0);
  if (maxVolumes > 0) {
    merged.volumes = maxVolumes;
  }

  const maxChapters = Math.max(primary.chapters ?? 0, secondary.chapters ?? 0);
  if (maxChapters > 0) {
    merged.chapters = maxChapters;
  }

  return merged;
}

/**
 * Build WikipediaMangaData from top-level arrays in parse result.
 * Used when parseResult.data is null but volumes/chapters arrays exist.
 */
function buildDataFromArrays(result: WikipediaParseResult, title: string): WikipediaMangaData | null {
  const hasVolumes = result.volumes.length > 0;
  const hasChapters = result.chapters.length > 0;

  if (!hasVolumes && !hasChapters) {
    return null;
  }

  return {
    title,
    volumeList: result.volumes,
    chapterList: result.chapters,
    volumes: result.volumes.length,
    chapters: result.chapters.length,
  };
}

// Parsing hints schema (from static analysis)
const parsingHintsSchema = z.object({
  pageType: z.string(),
  structureType: z.string(),
  recommendedParser: z.string(),
  relevantSections: z.array(z.string()),
  tableTypes: z.array(z.string()),
  hasVolumeData: z.boolean(),
  hasChapterData: z.boolean(),
  listPageUrl: z.string().nullable(),
}).optional();

export const wikipediaFetchRouter = router({
  /**
   * Fetch enhanced metadata from Wikipedia
   */
  fetchWikipediaMetadata: publicProcedure
    .input(
      z.object({
        title: z.string().min(1),
        enrichExisting: z.boolean().optional().default(false),
        // Parsing hints from static analysis (optional)
        parsingHints: parsingHintsSchema,
      })
    )
    // eslint-disable-next-line max-lines-per-function, complexity -- Complex mutation with adaptive parsing, fallback chain, and metadata transformation. Breaking apart would reduce cohesion.
    .mutation(async ({ input }): Promise<AsyncResult<unknown, Error>> => {
      try {
        const { title, parsingHints } = input;

        logger.info(`Fetching Wikipedia metadata for: ${title}`, {
          hasParsingHints: !!parsingHints,
          recommendedParser: parsingHints?.recommendedParser,
          pageType: parsingHints?.pageType,
        });

        // Import Wikipedia service for fallback
        const { wikipediaService } = await import(
          '@/server/services/wikipedia/wikipedia/service'
        );

        let result: WikipediaMangaData | null = null;

        // STAGE 1: Try adaptive parser first (with or without hints)
        const adaptiveUrl = parsingHints?.listPageUrl ?? title;
        logger.info('[Wikipedia Router] Trying adaptive parser first', {
          adaptiveUrl,
          hasListPageHint: !!parsingHints?.listPageUrl,
          recommendedParser: parsingHints?.recommendedParser,
        });

        const parseResult = await adaptiveExtract(adaptiveUrl, {
          preferListPage: true,
          extractChapters: parsingHints?.hasChapterData ?? true,
          useCache: true,
          enrichWithMainArticle: true,
        });

        if (parseResult.success && hasSubstantialData(parseResult)) {
          logger.info('[Wikipedia Router] Adaptive parser succeeded with substantial data', {
            volumes: parseResult.data?.volumes ?? parseResult.data?.volumeList?.length ?? 0,
            chapters: parseResult.data?.chapters ?? parseResult.data?.chapterList?.length ?? 0,
            confidence: parseResult.confidence,
            usedCache: parseResult.usedCache,
          });
          result = parseResult.data;
        } else {
          // STAGE 2: Fall back to basic extraction
          logger.info('[Wikipedia Router] Adaptive parser returned insufficient data, trying findBestMatch', {
            adaptiveSuccess: parseResult.success,
            adaptiveError: parseResult.error,
            adaptiveConfidence: parseResult.confidence,
            adaptiveVolumes: parseResult.data?.volumes ?? parseResult.data?.volumeList?.length ?? 0,
            adaptiveChapters: parseResult.data?.chapters ?? parseResult.data?.chapterList?.length ?? 0,
          });

          const basicResult = await wikipediaService.findBestMatch(title);

          // Get adaptive data - either from data object or build from arrays
          const adaptiveData = parseResult.data ?? buildDataFromArrays(parseResult, title);

          // STAGE 3: Smart merge - don't lose adaptive data!
          if (basicResult && adaptiveData) {
            // Merge both sources (basic for synopsis, adaptive for metadata)
            logger.info('[Wikipedia Router] Merging basic and adaptive data');
            result = mergeWikipediaResults(basicResult, adaptiveData);
          } else if (adaptiveData) {
            // Use adaptive alone (fallback failed but we have partial data)
            logger.info('[Wikipedia Router] Using adaptive data only (findBestMatch returned null)');
            result = adaptiveData;
          } else if (basicResult) {
            // Use basic alone (adaptive had no data)
            result = basicResult;
          } else {
            // Both failed
            result = null;
          }
        }

        if (!result) {
          return createErrorResult(
            new Error('No Wikipedia page found for this title')
          );
        }

        // Log status sources for debugging
        const derivedStatus = deriveStatusFromOriginalRun(result.originalRun);
        logger.info('[Wikipedia Router] Status sources:', {
          resultStatus: result.status,
          derivedStatus,
          originalRun: result.originalRun,
          finalStatus: result.status ?? derivedStatus
        });

        // Transform to metadata format
        const metadata = {
          title: result.title,
          alternativeTitles: result.alternativeTitles ?? [],
          description: result.synopsis ?? result.plot ?? result.description ?? '',
          synopsis: result.synopsis,
          authors: result.author ?? [],
          artists: result.artist ?? [],
          editor: result.editor,
          publisher: result.publisher,
          englishPublisher: result.englishPublisher,
          volumes: result.volumes,
          chapters: result.chapters,
          genres: result.genres ?? [],
          demographic: result.demographic,
          originalRun: result.originalRun,
          // Parse startDate and endDate from originalRun if not directly available
          startDate: result.startDate ?? parseOriginalRunDate(result.originalRun, 'start'),
          endDate: result.endDate ?? parseOriginalRunDate(result.originalRun, 'end'),
          // Derive status from originalRun dates (uses result.status if available, otherwise derives)
          status: result.status ?? derivedStatus,
          publicationStatus: result.publicationStatus,
          magazine: result.magazine,
          wikipediaUrl: result.wikipediaUrl,
          volumeList: result.volumeList,
          chapterList: result.chapterList,
          // New fields from extended extraction
          mangaType: result.mangaType,
          licensedBy: result.licensedBy,
          coverImage: result.coverImage,
          enrichedWithWikipedia: true,
        };

        return createSuccessResult(metadata);
      } catch (error: unknown) {
        logger.error(
          `Error fetching Wikipedia metadata: ${error instanceof Error ? error.message : String(error)}`
        );
        return createErrorResult(
          error instanceof Error
            ? error
            : new Error(
                `Failed to fetch Wikipedia metadata: ${String(error)}`
              )
        );
      }
    }),
});
