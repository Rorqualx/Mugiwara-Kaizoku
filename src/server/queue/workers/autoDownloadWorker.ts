// @ts-nocheck
// TODO: Disabled until ReadingProgress, ReaderBookmark, AutoDownloadRule, ReadingHistory, ImageCache, BookmarkedVolume, and BookmarkedManga Prisma models are implemented in schema.prisma

/**
 * Auto-Download Worker
 *
 * Handles automatic downloading of manga chapters based on configured rules.
 *
 * Download Workflow:
 * 1. Check for missing chapters that need downloading
 * 2. Use Prowlarr to search indexers for torrents/NZBs
 * 3. Send selected downloads to configured download client
 * 4. Import completed downloads into library
 *
 * IMPORTANT: Prowlarr is used here ONLY for finding downloadable content.
 * It does NOT provide manga metadata (descriptions, covers, etc.).
 * Metadata comes from AniList, ComicVine, Fandom, or MangaDex providers.
 */

import { ChapterStatus } from '@prisma/client';

import { prisma } from '@/server/db';
import { DownloadManager } from '@/server/services/download/downloadManager';
import { ProwlarrMangaSearch } from '@/server/services/prowlarr/mangaSearch';
import type { SearchMangaResult } from '@/server/services/prowlarr/mangaSearch';
import { realtimeEmitter } from '@/server/services/realtime/RealtimeEventEmitter';
import { createErrorResult, createSuccessResult, isError } from '@/utils/async-result';
import type { AsyncResult } from '@/utils/async-result';
import { toNumberId } from '@/utils/id-converters';
import { logger } from '@/utils/logger';


import type { Chapter as ChapterEntity } from '@prisma/client';

// Helper functions for safe type handling
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

// Define DownloadMethod and DownloadMode since they're not in Prisma
export enum DownloadMethod {
  PROWLARR = 'PROWLARR',
  DIRECT = 'DIRECT',
}

export enum DownloadMode {
  AUTO = 'AUTO',
  MANUAL = 'MANUAL',
}

// MangalDownloadService removed - mangal is deprecated
// MANGAL_SUPPORTED_SOURCES removed - mangal is deprecated
const prowlarrMangaSearch = new ProwlarrMangaSearch(); // For searching torrents/NZBs
const downloadManager = new DownloadManager();
// const mangalDownloadService = new MangalDownloadService(); // Mangal is deprecated
export async function processAutoDownload(mangaId: number): Promise<AsyncResult<void, Error>> {
  try {
    logger.info(`[AutoDownload] Processing manga ${mangaId}`);

    // Emit WebSocket event for auto-download started
    void realtimeEmitter.emitSystemEvent({
      eventType: 'auto-download:started',
      source: 'autoDownloadWorker',
      message: `Auto-download processing started for manga ${mangaId}`,
      data: { mangaId }
    });
    // Get manga with chapters, auto-download rule, and metadata.
    // Metadata.synonyms feeds the Prowlarr relevance gate downstream so
    // wrong-target releases (Akira-style) don't survive scoring.
    const manga = await prisma.manga.findUnique({
      where: {
        id: mangaId
      },
      include: {
        Chapter: true,
        autoDownloadRule: true,
        Metadata: { select: { synonyms: true } }
      }
    });
    if (!manga) {
      logger.info(`[AutoDownload] Manga ${mangaId} not found`);
      return createErrorResult(new Error('Manga not found'));
    }

    // Check if auto-download is enabled for this manga
    if (!manga.autoDownloadRule?.enabled) {
      logger.info(`[AutoDownload] No enabled rule for manga ${mangaId}`);
      return createSuccessResult(undefined);
    }

    const rule = manga.autoDownloadRule;

    // Filter for chapters that are:
    // 1. Not completed (downloadStatus !== COMPLETED)
    // 2. Monitored (monitored === true)
    const missingChapters = manga.Chapter.filter(
      (ch: ChapterEntity) => ch.downloadStatus !== ChapterStatus.COMPLETED && ch.monitored === true
    ) as ChapterEntity[];

    if (missingChapters.length === 0) {
      logger.info(`[AutoDownload] No monitored missing chapters for manga ${manga["title"]}`);

      // Emit WebSocket event for no chapters to download
      void realtimeEmitter.emitSystemEvent({
        eventType: 'auto-download:complete',
        source: 'autoDownloadWorker',
        message: `No missing chapters to download for ${manga["title"]}`,
        data: { mangaId, mangaTitle: manga["title"], chaptersFound: 0 }
      });

      return createSuccessResult(undefined);
    }
    logger.info(`[AutoDownload] Found ${missingChapters.length} monitored missing chapters`);
    // NOTE: Mangal support was deprecated and removed
    // Use Prowlarr for all downloads
    logger.info(`[AutoDownload] Searching via Prowlarr for ${manga["title"]}`);
    const searchResult = await searchViaProwlarr(manga, missingChapters, rule, mangaId);
    if (isError(searchResult)) {
      return searchResult;
    }
    return createSuccessResult(undefined);
  }
  catch (error: unknown) {
  logger.error(`[AutoDownload] Error processing manga ${mangaId}:`, error);
    return createErrorResult(error instanceof Error ? error : new Error(String(error)));
  }
}

async function searchViaProwlarr(manga: Record<string, unknown>, chapters: ChapterEntity[], rule: Record<string, unknown>, mangaId: number): Promise<AsyncResult<void, Error>> {
  try {
    const mangaTitle = typeof manga["title"] === 'string' ? manga["title"] : '';
    // Pull synonyms off the included Metadata relation; they feed the
    // relevance gate so wrong-target releases get dropped before scoring.
    const metadata = manga["Metadata"];
    const synonyms = (typeof metadata === 'object' && metadata !== null && Array.isArray((metadata as { synonyms?: unknown }).synonyms))
      ? ((metadata as { synonyms: unknown[] }).synonyms).filter((s): s is string => typeof s === 'string')
      : [];
    const acceptedTitles = [mangaTitle, ...synonyms].filter((t) => t.length > 0);
    // Scope the post-search blocklist check to this manga — without it,
    // a block on a same-titled release for a different series would leak in.
    const searchResults = await prowlarrMangaSearch.searchManga(mangaTitle, { mangaId, acceptedTitles });
    if (isError(searchResults)) {
      return createErrorResult(searchResults.error instanceof Error ? searchResults.error : new Error(String(searchResults.error)));
    }
    // After isError check passes, searchResults is guaranteed to be success.
    // `data` is a SearchMangaResult ({ results, queryFailures }) — the release
    // array lives on `.results`. Reading `.data` directly here handed an object
    // to filterResults() and blew up with "d.filter is not a function".
    const successData = (searchResults.data as SearchMangaResult | undefined)?.results ?? [];
    if (successData.length === 0) {
      logger.info(`[AutoDownload] No results found via Prowlarr`);
      return createSuccessResult(undefined);
    }
    // Filter results based on auto-download criteria
    const filteredResults = filterResults(successData, rule);
    if (filteredResults.length === 0) {
      logger.info(`[AutoDownload] No results match criteria`);
      return createSuccessResult(undefined);
    }
    // Download best match
    const bestMatch = filteredResults[0];
    const request = {
      mangaId: toNumberId(manga["id"]),
      chapterIds: chapters.map((ch) => toNumberId(ch["id"])),
      method: DownloadMethod.PROWLARR,
      mode: DownloadMode.AUTO,
      prowlarrResult: bestMatch
    };
    const result = await downloadManager.processDownloadRequest(request);
    if (isError(result)) {
      logger.error(`[AutoDownload] Download failed:`, result.error);
      return result;
    }
    logger.info(`[AutoDownload] Successfully queued download`);

    // Emit WebSocket event for download queued
    void realtimeEmitter.emitDownloadProgress({
      taskId: `auto-download-${toNumberId(manga["id"])}`,
      mangaId: toNumberId(manga["id"]),
      progress: 0,
      status: 'queued',
      message: `Auto-download queued for ${mangaTitle}`,
      chapterCount: chapters.length
    });

    return createSuccessResult(undefined);
  }
  catch (error: unknown) {
    logger.error(`[AutoDownload] Error processing rule:`, error);

    // Emit WebSocket event for error
    void realtimeEmitter.emitSystemEvent({
      eventType: 'auto-download:error',
      source: 'autoDownloadWorker',
      message: `Auto-download failed: ${error instanceof Error ? error.message : String(error)}`,
      data: { error: error instanceof Error ? error.message : String(error) }
    });

    return createErrorResult(error instanceof Error ? error : new Error(String(error)));
  }
}
function calculatePriority(result: Record<string, unknown>, rule: Record<string, unknown>): number {
  let priority = typeof result['priority'] === 'number' ? result['priority'] : 0;
  const title = typeof result["title"] === 'string' ? result["title"].toLowerCase() : '';

  // Prioritize preferred groups
  if (Array.isArray(rule['preferredGroups']) && rule['preferredGroups'].length > 0) {
    for (const group of rule['preferredGroups']) {
      if (typeof group === 'string' && title.includes(group.toLowerCase())) {
        priority += 10;
      }
    }
  }
  return priority;
}

function filterResults(results: unknown[], rule: Record<string, unknown>): Array<Record<string, unknown> & { calculatedPriority: number }> {
  return results
    .filter((result: unknown) => {
      if (!isRecord(result)) return false;
      // Filter by size
      if (rule['maxSize'] && typeof result['size'] === 'number' && result['size'] > Number(rule['maxSize']) * 1024 * 1024) {
        return false;
      }
      // Filter by excluded groups
      const title = typeof result["title"] === 'string' ? result["title"].toLowerCase() : '';
      if (Array.isArray(rule['excludeGroups']) && rule['excludeGroups'].length > 0) {
        for (const group of rule['excludeGroups']) {
          if (typeof group === 'string' && title.includes(group.toLowerCase())) {
            return false;
          }
        }
      }
      return true;
    })
    .map((result) => {
      const rec = result as Record<string, unknown>;
      return {
        ...rec,
        calculatedPriority: calculatePriority(rec, rule)
      };
    })
    .sort((a, b) => {
      // Sort by priority (higher is better)
      const priorityDiff = b.calculatedPriority - a.calculatedPriority;
      if (priorityDiff !== 0) return priorityDiff;
      // Then by seeders for torrents
      const aSeeders = typeof a['seeders'] === 'number' ? a['seeders'] : 0;
      const bSeeders = typeof b['seeders'] === 'number' ? b['seeders'] : 0;
      return bSeeders - aSeeders;
    });
}