/**
 * Suwayomi Chapter Downloader
 *
 * Downloads chapter page images via the local Suwayomi server's HTTP proxy
 * (`getChapterPages` GraphQL → page URLs → axios fetch) and bundles them
 * into CBZ files identical in shape to the MangaDex downloader's output.
 *
 * Mirrors {@link MangaDexDownloader} so callers and queue handlers can share
 * the same `DownloadProgress` event listener wiring.
 *
 * @module server/services/native-download/downloaders/suwayomi-downloader
 */
import { EventEmitter } from 'events';
import { createWriteStream, existsSync, mkdirSync } from 'fs';
import { rm, unlink } from 'fs/promises';
import path from 'path';
import { pipeline } from 'stream/promises';

import axios from 'axios';

import { suwayomiConfigService } from '@/server/services/suwayomi/configService';
import {
  buildSuwayomiServerInfo,
  resolvePageUrl,
  type SuwayomiBasicAuth,
  type SuwayomiServerInfo,
} from '@/server/services/suwayomi/download-url-builder';
import { getSuwayomiGraphQLClient } from '@/server/services/suwayomi/graphql/client';
import { logger } from '@/utils/logger';

import { createCBZ, generatePageName, getImageExtension } from './cbz-bundler';
import { createIdleWatchdog } from './stream-watchdog';

import type { ComicInfoMetadata } from './cbz-bundler';

const log = logger.child('SuwayomiDownloader');

/** Download progress event — same shape as MangaDexDownloader emits. */
export interface DownloadProgress {
  chapterId: string;
  currentPage: number;
  totalPages: number;
  status: 'downloading' | 'bundling' | 'completed' | 'failed';
  percentage: number;
  error?: string | undefined;
}

export interface SuwayomiDownloadOptions {
  /** Suwayomi-internal chapter id (numeric) */
  suwayomiChapterId: number;
  outputPath: string;
  metadata?: ComicInfoMetadata | undefined;
  retries?: number | undefined;
  retryDelay?: number | undefined;
  /** Optional Basic Auth — Suwayomi supports it via JVM config. */
  auth?: SuwayomiBasicAuth | undefined;
  // Aborts in-flight axios requests + cancels retry sleeps when the
  // owning job hits its hard_timeout_at deadline.
  signal?: AbortSignal | undefined;
}

export interface SuwayomiDownloadResult {
  success: boolean;
  suwayomiChapterId: number;
  outputPath: string;
  pageCount: number;
  fileSize: number;
  error?: string;
}

interface DownloadedPage {
  filePath: string;
  archiveName: string;
}

interface PageFetch {
  pages: string[];
  server: SuwayomiServerInfo;
  error?: string;
}

function failureResult(
  suwayomiChapterId: number,
  outputPath: string,
  error: string,
): SuwayomiDownloadResult {
  return { success: false, suwayomiChapterId, outputPath, pageCount: 0, fileSize: 0, error };
}

async function safelyRemoveTempDir(tempDir: string): Promise<void> {
  try {
    await rm(tempDir, { recursive: true, force: true });
  } catch {
    log.warn('Failed to clean temp dir', { tempDir });
  }
}

/** Suwayomi chapter downloader. */
export class SuwayomiDownloader extends EventEmitter {
  private readonly MAX_RETRIES = 3;
  private readonly RETRY_DELAY = 1000;
  private readonly CONCURRENT_DOWNLOADS = 3;
  private readonly REQUEST_TIMEOUT_MS = 30000;

  /** Download a chapter from Suwayomi. Never throws — returns a result. */
  async downloadChapter(options: SuwayomiDownloadOptions): Promise<SuwayomiDownloadResult> {
    const eventKey = String(options.suwayomiChapterId);
    log.info('Starting Suwayomi chapter download', {
      suwayomiChapterId: options.suwayomiChapterId, outputPath: options.outputPath,
    });
    const result = await this.runDownload(options, eventKey);
    if (!result.success && result.error) {
      this.emitProgress(eventKey, 0, 0, 'failed', result.error);
    }
    return result;
  }

  private async runDownload(
    options: SuwayomiDownloadOptions, eventKey: string,
  ): Promise<SuwayomiDownloadResult> {
    const { suwayomiChapterId, outputPath, auth, signal } = options;
    if (signal?.aborted) {
      return failureResult(suwayomiChapterId, outputPath, 'Aborted before start');
    }
    const fetch = await this.fetchPageUrls(suwayomiChapterId, auth);
    if (fetch.error) return failureResult(suwayomiChapterId, outputPath, fetch.error);
    if (fetch.pages.length === 0) {
      return failureResult(suwayomiChapterId, outputPath, 'No pages returned from Suwayomi');
    }

    this.emitProgress(eventKey, 0, fetch.pages.length, 'downloading');
    const tempDir = path.join(path.dirname(outputPath), `.temp_suw_${suwayomiChapterId}`);
    if (!existsSync(tempDir)) mkdirSync(tempDir, { recursive: true });

    try {
      return await this.downloadAndBundle(options, eventKey, fetch, tempDir);
    } finally {
      await safelyRemoveTempDir(tempDir);
    }
  }

  private async downloadAndBundle(
    options: SuwayomiDownloadOptions,
    eventKey: string,
    fetch: PageFetch,
    tempDir: string,
  ): Promise<SuwayomiDownloadResult> {
    const {
      suwayomiChapterId, outputPath, metadata, signal,
      retries = this.MAX_RETRIES, retryDelay = this.RETRY_DELAY,
    } = options;

    const downloaded = await this.downloadAllPages({
      eventKey, pages: fetch.pages, server: fetch.server, tempDir, retries, retryDelay, signal,
    });

    this.emitProgress(eventKey, fetch.pages.length, fetch.pages.length, 'bundling');
    const cbz = await createCBZ({
      outputPath, pages: downloaded, metadata: { ...metadata, manga: 'YesAndRightToLeft' },
    });
    if (!cbz.success) {
      return failureResult(suwayomiChapterId, outputPath, cbz.error ?? 'Failed to create CBZ');
    }

    this.emitProgress(eventKey, fetch.pages.length, fetch.pages.length, 'completed');
    log.info('Suwayomi chapter download completed', {
      suwayomiChapterId, outputPath, pageCount: cbz.pageCount, fileSize: cbz.size,
    });
    return {
      success: true, suwayomiChapterId, outputPath,
      pageCount: cbz.pageCount, fileSize: cbz.size,
    };
  }

  private async fetchPageUrls(
    suwayomiChapterId: number,
    auth: SuwayomiBasicAuth | undefined,
  ): Promise<PageFetch> {
    try {
      const config = await suwayomiConfigService.loadConfig();
      const server = buildSuwayomiServerInfo(config, auth);
      const client = getSuwayomiGraphQLClient({
        httpUrl: `${server.baseUrl}/api/graphql`,
        wsUrl: `ws://localhost:${config.port}/api/graphql`,
        ...(auth ? { basicAuth: auth } : {}),
      });
      const pages = await client.getChapterPages(suwayomiChapterId);
      return { pages, server };
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      return { pages: [], server: { baseUrl: '', headers: {} }, error };
    }
  }

  private async downloadAllPages(args: {
    eventKey: string;
    pages: string[];
    server: SuwayomiServerInfo;
    tempDir: string;
    retries: number;
    retryDelay: number;
    signal: AbortSignal | undefined;
  }): Promise<DownloadedPage[]> {
    const { eventKey, pages, server, tempDir, retries, retryDelay, signal } = args;
    const results: DownloadedPage[] = [];

    for (let i = 0; i < pages.length; i += this.CONCURRENT_DOWNLOADS) {
      if (signal?.aborted) {
        throw signal.reason instanceof Error ? signal.reason : new Error('Aborted');
      }
      const batch = pages.slice(i, i + this.CONCURRENT_DOWNLOADS);
      // eslint-disable-next-line no-await-in-loop -- intentional batching for controlled concurrency
      const batchResults = await Promise.all(
        batch.map(async (rawUrl, batchIndex) => this.downloadOne({
          rawUrl, server,
          pageIndex: i + batchIndex, totalPages: pages.length,
          eventKey, tempDir, retries, retryDelay, signal,
        })),
      );
      results.push(...batchResults);
    }
    return results;
  }

  private async downloadOne(args: {
    rawUrl: string;
    server: SuwayomiServerInfo;
    pageIndex: number;
    totalPages: number;
    eventKey: string;
    tempDir: string;
    retries: number;
    retryDelay: number;
    signal: AbortSignal | undefined;
  }): Promise<DownloadedPage> {
    const { rawUrl, server, pageIndex, totalPages, eventKey, tempDir, retries, retryDelay, signal } = args;
    const url = resolvePageUrl(rawUrl, server.baseUrl);
    const archiveName = generatePageName(pageIndex, getImageExtension(url));
    const filePath = path.join(tempDir, archiveName);
    await this.downloadWithRetry(url, filePath, retries, retryDelay, server.headers, signal);
    this.emitProgress(eventKey, pageIndex + 1, totalPages, 'downloading');
    return { filePath, archiveName };
  }

  /** Wrap an attempt failure: log, optionally backoff, return the error. */
  // eslint-disable-next-line max-params -- Retry-failure handler needs error, url, attempt counter, retries cap, backoff base, and abort signal
  private async handleAttemptFailure(
    err: unknown, url: string, attempt: number, retries: number, delay: number,
    signal: AbortSignal | undefined,
  ): Promise<Error> {
    const error = err instanceof Error ? err : new Error(String(err));
    log.warn('Suwayomi page download attempt failed', {
      url, attempt, maxAttempts: retries, error: error.message,
    });
    if (attempt < retries) {
      const backoffDelay = delay * Math.pow(2, attempt - 1);
      await this.sleep(backoffDelay, signal);
    }
    return error;
  }

  // eslint-disable-next-line max-params -- Retry orchestration needs url, outputPath, retry config, headers, and signal
  private async downloadWithRetry(
    url: string,
    outputPath: string,
    retries: number,
    delay: number,
    headers: Record<string, string>,
    signal: AbortSignal | undefined,
  ): Promise<void> {
    let lastError: Error | null = null;
    for (let attempt = 1; attempt <= retries; attempt++) {
      if (signal?.aborted) throw signal.reason instanceof Error ? signal.reason : new Error('Aborted');
      try {
        // eslint-disable-next-line no-await-in-loop -- sequential retry attempts required
        await this.downloadFile(url, outputPath, headers, signal);
        return;
      } catch (err) {
        if (signal?.aborted) throw err instanceof Error ? err : new Error(String(err));
        // eslint-disable-next-line no-await-in-loop -- backoff intentionally serial
        lastError = await this.handleAttemptFailure(err, url, attempt, retries, delay, signal);
      }
    }
    throw lastError ?? new Error('Download failed after retries');
  }

  private async downloadFile(
    url: string,
    outputPath: string,
    headers: Record<string, string>,
    signal: AbortSignal | undefined,
  ): Promise<void> {
    const STREAM_IDLE_MS = 60_000;
    const response = await axios({
      method: 'GET',
      url,
      responseType: 'stream',
      timeout: this.REQUEST_TIMEOUT_MS,
      headers,
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

  private emitProgress(
    chapterId: string,
    currentPage: number,
    totalPages: number,
    status: DownloadProgress['status'],
    error?: string,
  ): void {
    const progress: DownloadProgress = {
      chapterId, currentPage, totalPages, status,
      percentage: totalPages > 0 ? Math.round((currentPage / totalPages) * 100) : 0,
      error,
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

/** Singleton */
export const suwayomiDownloader = new SuwayomiDownloader();

/** Convenience: download a chapter via the singleton. */
export async function downloadSuwayomiChapter(
  options: SuwayomiDownloadOptions,
): Promise<SuwayomiDownloadResult> {
  return suwayomiDownloader.downloadChapter(options);
}
