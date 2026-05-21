/**
 * Build volume and chapter data structures
 */

import { stripHtml } from '@/lib/html-sanitizer';
import { logger } from '@/utils/logger';

import type { ComicVineData } from './types';

/**
 * Extract cover image URL from issue data
 * Handles both primary path format (coverImages object) and API response format (image object)
 * to ensure consistent behavior between primary and secondary code paths
 */
function extractIssueCoverUrl(issueData: Record<string, unknown>): string | undefined {
  // Primary path format: coverImages { small, medium, large, original }
  const coverImages = issueData["coverImages"] as Record<string, unknown> | undefined;
  if (coverImages) {
    const url = coverImages["large"] ?? coverImages["medium"] ?? coverImages["original"] ?? coverImages["small"];
    if (typeof url === 'string') return url;
  }

  // Secondary/API format: image { original_url, medium_url, small_url }
  const image = issueData["image"] as Record<string, unknown> | undefined;
  if (image) {
    const url = image["original_url"] ?? image["medium_url"] ?? image["small_url"];
    if (typeof url === 'string') return url;
  }

  return undefined;
}

/**
 * Create placeholder volume data from API issue data
 * Matches primary path (url-handlers.ts:parseComicVineUrl) volume structure
 */
export function createVolumeDataFromIssues(issues: Array<Record<string, unknown>>): unknown[] {
  logger.info('[ComicVine] Creating volume data from API issues:', issues.length);
  return issues.map((issue: unknown, index: number) => {
    const issueData = issue as Record<string, unknown>;
    // Extract cover using unified function that handles both formats
    const coverImageUrl = extractIssueCoverUrl(issueData);
    // Strip HTML tags from description
    const rawDescription = (issueData["description"] ?? issueData["deck"]) as string | undefined;
    const cleanDescription = rawDescription ? stripHtml(rawDescription) : undefined;
    // Extract volume/issue number - handle both issueNumber (primary) and issue_number (API)
    const volumeNumber = parseFloat(
      (issueData["issueNumber"] ?? issueData["issue_number"] ?? String(index + 1)) as string
    );

    return {
      volumeNumber,
      number: volumeNumber, // Match primary path - add number field for compatibility
      title: issueData["name"] ?? `Issue #${issueData["issue_number"] ?? issueData["issueNumber"]}`,
      issueNumber: issueData["issue_number"] ?? issueData["issueNumber"],
      coverImageUrl,
      coverImage: coverImageUrl, // Match primary path - add alias for compatibility
      description: cleanDescription,
      volumeSummary: cleanDescription, // Match primary path structure
      releaseDate: issueData["cover_date"] ?? issueData["coverDate"] ?? issueData["store_date"] ?? issueData["storeDate"],
      chapterCount: 0,
      chapters: [],
      needsChapterScraping: true, // Match primary path - Step 3 will load chapters
      status: 'api_data'
    };
  });
}

/**
 * Create placeholder volume data based on volume count
 */
export function createPlaceholderVolumeData(volumeCount: number): unknown[] {
  logger.info(`[ComicVine] Creating placeholder volumeData for ${volumeCount} volumes`);
  return Array.from({ length: volumeCount }, (_, i) => ({
    volumeNumber: i + 1,
    title: `Volume ${i + 1}`,
    url: null,
    coverImageUrl: null,
    chapters: [],
    chapterCount: 0,
    status: 'needs_url'
  }));
}

/**
 * Ensure volume data is populated with either scraped, API, or placeholder data
 */
export function ensureVolumeData(
  volumeData: unknown[],
  data: ComicVineData,
  volumeCount: number
): unknown[] {
  if (volumeData.length > 0) {
    logger.info('[ComicVine] Using scraped volumeData with chapters and cover art:', {
      volumeCount: volumeData.length,
      volumesWithChapters: volumeData.filter((v: unknown) => {
        const chapters = (v as Record<string, unknown>)["chapters"] as unknown[] | undefined;
        return (chapters?.length ?? 0) > 0;
      }).length,
      volumesWithCover: volumeData.filter((v: unknown) => (v as Record<string, unknown>)["coverImageUrl"]).length
    });
    return volumeData;
  }

  if (data.issues && data.issues.length > 0) {
    return createVolumeDataFromIssues(data.issues);
  }

  if (volumeCount > 0) {
    return createPlaceholderVolumeData(volumeCount);
  }

  logger.warn('[ComicVine] No volumeData from scraping and no issue data from API');
  return [];
}

/**
 * Log generated volume data analysis
 */
export function logVolumeDataAnalysis(volumeData: unknown[]): void {
  const firstVol = volumeData[0] as Record<string, unknown> | undefined;
  const lastVol = volumeData[volumeData.length - 1] as Record<string, unknown> | undefined;

  logger.info('[ComicVine] Generated volumeData analysis:', {
    totalVolumes: volumeData.length,
    volumesWithCoverArt: volumeData.filter((v: unknown) => (v as Record<string, unknown>)["coverImageUrl"]).length,
    volumesWithChapters: volumeData.filter((v: unknown) => {
      const vol = v as Record<string, unknown>;
      return vol["chapters"] && (vol["chapters"] as unknown[]).length > 0;
    }).length,
    firstVolume: firstVol ? {
      volumeNumber: firstVol["volumeNumber"],
      title: firstVol["title"],
      hasCoverImageUrl: !!firstVol["coverImageUrl"],
      coverImageUrl: firstVol["coverImageUrl"],
      chapterCount: (firstVol["chapters"] as unknown[] | undefined)?.length ?? 0,
      status: firstVol["status"]
    } : null,
    lastVolume: lastVol ? {
      volumeNumber: lastVol["volumeNumber"],
      title: lastVol["title"],
      hasCoverImageUrl: !!lastVol["coverImageUrl"],
      coverImageUrl: lastVol["coverImageUrl"],
      chapterCount: (lastVol["chapters"] as unknown[] | undefined)?.length ?? 0,
      status: lastVol["status"]
    } : null
  });
}
