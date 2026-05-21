/**
 * MangaDex Chapter Downloader
 *
 * Downloads chapter images from MangaDex and bundles them into CBZ files.
 * Supports both full quality and data saver modes.
 *
 * @module server/services/native-download/downloaders/mangadex-downloader
 */

import { EventEmitter } from 'events';
import { createWriteStream, existsSync, mkdirSync } from 'fs';
import { rm, unlink } from 'fs/promises';
import path from 'path';
import { pipeline } from 'stream/promises';

import axios from 'axios';

import { mangadexClient } from '@/server/services/mangadex';
import { logger } from '@/utils/logger';

import { createCBZ, generatePageName, getImageExtension } from './cbz-bundler';
import { createIdleWatchdog } from './stream-watchdog';

import type { ComicInfoMetadata } from './cbz-bundler';

const log = logger.child('MangaDexDownloader');

/**
 * Download quality mode
 */
export type DownloadQuality = 'full' | 'dataSaver';

/**
 * Download progress event
 */
export interface DownloadProgress {
  chapterId: string;
  currentPage: number;
  totalPages: number;
  status: 'downloading' | 'bundling' | 'completed' | 'failed';
  percentage: number;
  error?: string | undefined;
}

/**
 * Download options
 */
export interface MangaDexDownloadOptions {
  chapterId: string;
  outputPath: string;
  quality?: DownloadQuality | undefined;
  metadata?: ComicInfoMetadata | undefined;
  retries?: number | undefined;
  retryDelay?: number | undefined;
  // Aborts in-flight axios requests + cancels retry sleeps when the
  // owning job hits its hard_timeout_at deadline.
  signal?: AbortSignal | undefined;
}

/**
 * Download result
 */
export interface MangaDexDownloadResult {
  success: boolean;
  chapterId: string;
  outputPath: string;
  pageCount: number;
  fileSize: number;
  error?: string;
}

/**
 * MangaDex Chapter Downloader
 */
export class MangaDexDownloader extends EventEmitter {
  private readonly MAX_RETRIES = 3;
  private readonly RETRY_DELAY = 1000; // 1 second
  private readonly CONCURRENT_DOWNLOADS = 3;

  /**
   * Download a chapter from MangaDex
   */
  async downloadChapter(options: MangaDexDownloadOptions): Promise<MangaDexDownloadResult> {
    const {
      chapterId,
      outputPath,
      quality = 'full',
      metadata,
      retries = this.MAX_RETRIES,
      retryDelay = this.RETRY_DELAY,
      signal,
    } = options;

    log.info('Starting chapter download', { chapterId, quality, outputPath });

    try {
      // Get chapter images from MangaDex
      const imageData = await mangadexClient.getChapterImages(chapterId);
      const pages = quality === 'dataSaver'
        ? imageData.chapter.dataSaver
        : imageData.chapter.data;

      if (pages.length === 0) {
        throw new Error('No pages found for chapter');
      }

      this.emitProgress(chapterId, 0, pages.length, 'downloading');

      // Create temp directory for downloaded pages
      const tempDir = path.join(path.dirname(outputPath), `.temp_${chapterId}`);
      if (!existsSync(tempDir)) {
        mkdirSync(tempDir, { recursive: true });
      }

      try {
        // Download all pages
        const downloadedPages = await this.downloadPages(
          chapterId,
          imageData.baseUrl,
          imageData.chapter.hash,
          pages,
          quality,
          tempDir,
          retries,
          retryDelay,
          signal,
        );

        // Bundle into CBZ
        this.emitProgress(chapterId, pages.length, pages.length, 'bundling');

        const cbzResult = await createCBZ({
          outputPath,
          pages: downloadedPages,
          metadata: {
            ...metadata,
            manga: 'YesAndRightToLeft'
          }
        });

        if (!cbzResult.success) {
          throw new Error(cbzResult.error ?? 'Failed to create CBZ');
        }

        this.emitProgress(chapterId, pages.length, pages.length, 'completed');

        log.info('Chapter download completed', {
          chapterId,
          outputPath,
          pageCount: cbzResult.pageCount,
          fileSize: cbzResult.size
        });

        return {
          success: true,
          chapterId,
          outputPath,
          pageCount: cbzResult.pageCount,
          fileSize: cbzResult.size
        };
      } finally {
        // Cleanup temp directory
        try {
          await rm(tempDir, { recursive: true, force: true });
        } catch {
          log.warn('Failed to cleanup temp directory', { tempDir });
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      log.error('Chapter download failed', { chapterId, error: errorMessage });

      this.emitProgress(chapterId, 0, 0, 'failed', errorMessage);

      return {
        success: false,
        chapterId,
        outputPath,
        pageCount: 0,
        fileSize: 0,
        error: errorMessage
      };
    }
  }

  /**
   * Download pages with retry and progress tracking
   */
  // eslint-disable-next-line max-params -- Download orchestration requires chapter context, URL info, pages array, quality settings, temp directory, retry configuration, and abort signal
  private async downloadPages(
    chapterId: string,
    baseUrl: string,
    hash: string,
    pages: string[],
    quality: DownloadQuality,
    tempDir: string,
    retries: number,
    retryDelay: number,
    signal: AbortSignal | undefined,
  ): Promise<Array<{ filePath: string; archiveName: string }>> {
    const results: Array<{ filePath: string; archiveName: string }> = [];
    const qualityPath = quality === 'dataSaver' ? 'data-saver' : 'data';

    // Download in batches for better performance
    for (let i = 0; i < pages.length; i += this.CONCURRENT_DOWNLOADS) {
      const batch = pages.slice(i, i + this.CONCURRENT_DOWNLOADS);

      // eslint-disable-next-line no-await-in-loop -- Intentional batching for controlled concurrency
      const batchResults = await Promise.all(
        batch.map(async (pageName, batchIndex) => {
          const pageIndex = i + batchIndex;
          const imageUrl = `${baseUrl}/${qualityPath}/${hash}/${pageName}`;
          const extension = getImageExtension(pageName);
          const archiveName = generatePageName(pageIndex, extension);
          const filePath = path.join(tempDir, archiveName);

          await this.downloadWithRetry(imageUrl, filePath, retries, retryDelay, signal);

          // Emit progress
          this.emitProgress(chapterId, pageIndex + 1, pages.length, 'downloading');

          return { filePath, archiveName };
        })
      );

      results.push(...batchResults);
    }

    return results;
  }

  /**
   * Download a single file with retry logic
   */
  private async downloadWithRetry(
    url: string,
    outputPath: string,
    retries: number,
    delay: number,
    signal: AbortSignal | undefined,
  ): Promise<void> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= retries; attempt++) {
      if (signal?.aborted) throw signal.reason instanceof Error ? signal.reason : new Error('Aborted');
      try {
        // eslint-disable-next-line no-await-in-loop -- Sequential retry attempts required
        await this.downloadFile(url, outputPath, signal);
        return;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        log.warn('Download attempt failed', {
          url,
          attempt,
          maxAttempts: retries,
          error: lastError.message
        });

        if (signal?.aborted) throw lastError;

        if (attempt < retries) {
          // Exponential backoff
          const backoffDelay = delay * Math.pow(2, attempt - 1);
          // eslint-disable-next-line no-await-in-loop -- Delay between retry attempts
          await this.sleep(backoffDelay, signal);
        }
      }
    }

    throw lastError ?? new Error('Download failed after retries');
  }

  /**
   * Download a file using streams. The 60s idle watchdog catches CDN stalls
   * (connection held open with no bytes flowing) that the request-level axios
   * timeout doesn't cover — suspected cause of the multi-hour zombie jobs.
   */
  private async downloadFile(url: string, outputPath: string, signal?: AbortSignal): Promise<void> {
    const STREAM_IDLE_MS = 60_000;
    const response = await axios({
      method: 'GET',
      url,
      responseType: 'stream',
      timeout: 30000,
      headers: {
        'User-Agent': 'MugiwaraKaizoku/1.0 (MangaDex Client)'
      },
      ...(signal ? { signal } : {}),
    });

    const watchdog = createIdleWatchdog(STREAM_IDLE_MS, signal);
    const writer = createWriteStream(outputPath);
    try {
      await pipeline(response.data, watchdog.observer, writer, { signal: watchdog.signal });
    } catch (err) {
      await unlink(outputPath).catch(() => { /* ENOENT is fine */ });
      throw err;
    } finally {
      watchdog.dispose();
    }
  }

  /**
   * Emit progress event
   */
  private emitProgress(
    chapterId: string,
    currentPage: number,
    totalPages: number,
    status: DownloadProgress['status'],
    error?: string
  ): void {
    const progress: DownloadProgress = {
      chapterId,
      currentPage,
      totalPages,
      status,
      percentage: totalPages > 0 ? Math.round((currentPage / totalPages) * 100) : 0,
      error
    };
    this.emit('progress', progress);
  }

  /**
   * Sleep utility — abortable so retry backoffs don't keep ticking past
   * the owning job's hard timeout.
   */
  private sleep(ms: number, signal?: AbortSignal): Promise<void> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        signal?.removeEventListener('abort', onAbort);
        resolve();
      }, ms);
      const onAbort = (): void => {
        clearTimeout(timer);
        reject(signal?.reason instanceof Error ? signal.reason : new Error('Aborted'));
      };
      if (signal?.aborted) {
        onAbort();
        return;
      }
      signal?.addEventListener('abort', onAbort, { once: true });
    });
  }
}

// Export singleton instance
export const mangadexDownloader = new MangaDexDownloader();

/**
 * Download a chapter (convenience function)
 */
export async function downloadMangaDexChapter(
  options: MangaDexDownloadOptions
): Promise<MangaDexDownloadResult> {
  return mangadexDownloader.downloadChapter(options);
}
