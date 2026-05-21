/**
 * Helper functions for chapter detail fetching and updating
 * Extracted from manga.ts lines 1361-1632 refactoring
 *
 * @module chapterDetailHelpers
 */

import { logger } from '@/utils/logger';

import type { PrismaClient } from '@prisma/client';

/**
 * Type guard for record objects
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * Safely get a string value from an unknown object
 */
function safeGetString(obj: unknown, key: string): string | null {
  if (!isRecord(obj)) return null;
  const value = obj[key];
  return typeof value === 'string' ? value : null;
}

/**
 * URL to fetch mapping
 */
export interface UrlToFetch {
  chapterId: number;
  url: string;
}

/**
 * Chapter details from external source
 */
export interface ChapterDetails {
  title?: string;
  description?: string;
  coverImageUrl?: string;
  pageCount?: number;
  releaseDate?: string;
}

/**
 * Extract URL from chapter URL data (string or object format)
 *
 * @param urlData - URL data in string or object format
 * @returns Extracted URL or null if invalid
 */
export function extractChapterUrl(urlData: unknown): string | null {
  if (typeof urlData === 'string') {
    return urlData;
  }

  if (isRecord(urlData)) {
    return safeGetString(urlData, 'url');
  }

  return null;
}

/**
 * Convert relative URL to absolute URL
 *
 * @param url - URL to convert (may be relative or absolute)
 * @param origin - Base origin to use for relative URLs
 * @returns Absolute URL
 */
export function makeAbsoluteUrl(url: string, origin: string): string {
  return url.startsWith('http') ? url : `${origin}${url}`;
}

/**
 * Map chapter URLs to chapter records for fetching
 *
 * @param chapters - Database chapter records
 * @param chapterUrls - Array of chapter URLs (string or object format)
 * @param urlOrigin - Base origin for relative URLs
 * @returns Array of chapter IDs mapped to their URLs
 */
export function mapChapterUrlsToFetch(
  chapters: Array<{ id: number; index: number }>,
  chapterUrls: unknown[],
  urlOrigin: string
): UrlToFetch[] {
  const urlsToFetch: UrlToFetch[] = [];
  const maxLength = Math.min(chapters.length, chapterUrls.length);

  for (let i = 0; i < maxLength; i++) {
    const chapter = chapters[i];
    if (!chapter) continue;

    const urlData = chapterUrls[i];
    const url = extractChapterUrl(urlData);

    if (url) {
      const absoluteUrl = makeAbsoluteUrl(url, urlOrigin);
      urlsToFetch.push({
        chapterId: chapter.id,
        url: absoluteUrl
      });
      logger.debug(`Mapped chapter ${chapter.index} (ID: ${chapter.id}) to URL: ${absoluteUrl}`);
    }
  }

  return urlsToFetch;
}

/**
 * Safely parse release date string to Date object
 *
 * @param dateStr - Date string to parse
 * @returns Date object or undefined if parsing fails
 */
export function parseReleaseDate(dateStr: string | undefined): Date | undefined {
  if (!dateStr) return undefined;

  try {
    const releaseDate = new Date(dateStr);
    // Check if date is valid
    if (isNaN(releaseDate.getTime())) {
      return undefined;
    }
    return releaseDate;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.debug(`Could not parse release date: ${dateStr}, error: ${errorMessage}`);
    return undefined;
  }
}

/**
 * Build chapter update data from fetched details
 *
 * @param details - Chapter details from external source
 * @param releaseDate - Parsed release date
 * @returns Prisma update data object
 */
export function buildChapterUpdateData(
  details: ChapterDetails,
  releaseDate: Date | undefined
): Record<string, unknown> {
  return {
    ...(details.title && { title: details.title }),
    ...(details.description && { description: details.description }),
    ...(details.coverImageUrl && { coverImage: details.coverImageUrl }),
    ...(details.pageCount !== undefined && { pageCount: details.pageCount }),
    ...(releaseDate && { releaseDate })
  };
}

/**
 * Update a single chapter with fetched details
 *
 * @param prisma - Prisma client instance
 * @param chapterId - Chapter ID to update
 * @param details - Chapter details from external source
 * @returns Promise that resolves when update is complete
 */
export async function updateChapterWithDetails(
  prisma: PrismaClient,
  chapterId: number,
  details: ChapterDetails
): Promise<void> {
  const releaseDate = parseReleaseDate(details.releaseDate);
  const updateData = buildChapterUpdateData(details, releaseDate);

  await prisma.chapter.update({
    where: { id: chapterId },
    data: updateData
  });

  logger.debug(`Updated chapter ${chapterId} with fetched details: ${details.title ?? 'Unknown'}`);
}

/**
 * Fetch and update chapter details for a batch of chapters
 *
 * @param prisma - Prisma client instance
 * @param chapterDetailService - Service for fetching chapter details
 * @param urlsToFetch - Array of chapter IDs and URLs to fetch
 * @param maxChaptersToFetch - Maximum number of chapters to process
 * @returns Promise that resolves when all updates are complete
 */
export async function fetchAndUpdateChapterDetails(
  prisma: PrismaClient,
  chapterDetailService: { batchFetchChapterDetails: (urls: string[], options?: unknown) => Promise<ChapterDetails[]> },
  urlsToFetch: UrlToFetch[],
  maxChaptersToFetch: number
): Promise<void> {
  const urlBatch = urlsToFetch.slice(0, maxChaptersToFetch);
  logger.info(`Starting batch fetch for ${urlBatch.length} chapter details`);

  const urls = urlBatch.map((item) => item.url);
  const result = await chapterDetailService.batchFetchChapterDetails(urls, {
    onProgress: (completed: number, total: number) => {
      logger.info(`Chapter detail fetch progress: ${completed}/${total}`);
    }
  });

  if (!Array.isArray(result)) {
    logger.warn('Chapter detail fetch returned no data or failed');
    return;
  }

  logger.info(`Successfully fetched ${result.length} chapter details`);

  // Update chapters with fetched details in parallel
  const updatePromises: Promise<void>[] = [];

  for (let i = 0; i < result.length && i < urlBatch.length; i++) {
    const details = result[i];
    const urlBatchItem = urlBatch[i];

    if (!urlBatchItem || !details) continue;

    const { chapterId } = urlBatchItem;
    updatePromises.push(
      updateChapterWithDetails(prisma, chapterId, details)
    );
  }

  // Execute all updates in parallel
  await Promise.all(updatePromises);
  logger.info(`Completed updating ${result.length} chapters with fetched details`);
}
