/**
 * GetComics Download Utilities
 *
 * Shared utilities for downloading files from various hosts.
 * Provides progress tracking, FlareSolverr integration, and error handling.
 *
 * @module server/services/getcomics/hosts/download-utils
 */

import { mkdir, writeFile } from 'fs/promises';
import path from 'path';

import { buildCookieHeader, getCloudflareCookies } from '@/server/services/flaresolverr/cookieStore';
import { protectedFetch } from '@/server/services/shared/protectedFetch';
import { createErrorResult, createSuccessResult } from '@/utils/async-result';
import type { AsyncResult } from '@/utils/async-result';
import { logger } from '@/utils/logger';


/**
 * Progress callback type
 */
export type ProgressCallback = (downloaded: number, total: number, speed: number) => void;

/**
 * Download result
 */
export interface DownloadResult {
  filePath: string;
  fileSize: number;
  duration: number;
}

/**
 * Fetch a page using FlareSolverr for Cloudflare bypass
 */
export async function fetchHostPage(url: string): Promise<AsyncResult<string, Error>> {
  try {
    logger.info('[GetComics] Fetching host page', { url });
    const response = await protectedFetch(url, { timeout: 30000 });

    if (!response.success || !response.html) {
      const errorMessage = response.error ?? `Failed to fetch page: status ${response.status}`;
      return createErrorResult(new Error(errorMessage));
    }

    return createSuccessResult(response.html);
  } catch (error) {
    logger.error('[GetComics] Error fetching host page', { url, error });
    return createErrorResult(error instanceof Error ? error : new Error(String(error)));
  }
}

/**
 * Read response body with progress tracking
 */
async function readBodyWithProgress(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  totalBytes: number,
  onProgress?: ProgressCallback
): Promise<Buffer> {
  const chunks: Uint8Array[] = [];
  let downloadedBytes = 0;
  let lastProgressUpdate = Date.now();
  let lastDownloadedBytes = 0;

  while (true) {
    // eslint-disable-next-line no-await-in-loop -- Sequential stream reading is required
    const { done, value } = await reader.read();
    if (done) break;

    chunks.push(value);
    downloadedBytes += value.length;

    // Report progress every 500ms
    const now = Date.now();
    const shouldReportProgress = now - lastProgressUpdate >= 500 || downloadedBytes === totalBytes;
    if (onProgress && shouldReportProgress) {
      const elapsed = (now - lastProgressUpdate) / 1000;
      const speed = elapsed > 0 ? (downloadedBytes - lastDownloadedBytes) / elapsed : 0;
      onProgress(downloadedBytes, totalBytes, speed);
      lastProgressUpdate = now;
      lastDownloadedBytes = downloadedBytes;
    }
  }

  return Buffer.concat(chunks);
}

/**
 * Download a file with progress tracking
 */
export async function downloadWithProgress(
  url: string,
  destPath: string,
  onProgress?: ProgressCallback
): Promise<AsyncResult<DownloadResult, Error>> {
  const startTime = Date.now();

  try {
    logger.info('[GetComics] Starting download', { url, destPath });

    // Ensure destination directory exists
    await mkdir(path.dirname(destPath), { recursive: true });

    // Start the download
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
    });

    if (!response.ok) {
      return createErrorResult(new Error(`Download failed: ${response.status} ${response.statusText}`));
    }

    const body = response.body;
    if (!body) {
      return createErrorResult(new Error('Response body is null'));
    }

    const contentLength = response.headers.get('content-length');
    const totalBytes = contentLength ? parseInt(contentLength, 10) : 0;

    // Read body with progress tracking
    const buffer = await readBodyWithProgress(body.getReader(), totalBytes, onProgress);

    // Write to file
    await writeFile(destPath, buffer);

    const duration = (Date.now() - startTime) / 1000;
    logger.info('[GetComics] Download complete', { destPath, fileSize: buffer.length, duration });

    return createSuccessResult({ filePath: destPath, fileSize: buffer.length, duration });
  } catch (error) {
    logger.error('[GetComics] Download error', { url, destPath, error });
    return createErrorResult(error instanceof Error ? error : new Error(String(error)));
  }
}

const DEFAULT_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

function looksLikeChallenge(contentType: string | null, status: number, snippet: string): boolean {
  if (status === 403 || status === 503) return true;
  if (contentType?.includes('text/html')) {
    const lower = snippet.toLowerCase();
    if (lower.includes('just a moment') || lower.includes('cf-mitigated') ||
        lower.includes('challenge-platform') || lower.includes('cloudflare')) return true;
  }
  return false;
}

interface BinaryFetchAttempt {
  response: Response;
  challenge: boolean;
}

async function attemptBinaryFetch(url: string, cookieHeader: string | null, userAgent: string): Promise<BinaryFetchAttempt | { error: Error }> {
  try {
    const headers: Record<string, string> = { 'User-Agent': userAgent };
    if (cookieHeader) headers['Cookie'] = cookieHeader;
    const response = await fetch(url, { headers });
    const contentType = response.headers.get('content-type');
    const status = response.status;
    if (!response.ok && !looksLikeChallenge(contentType, status, '')) {
      return { error: new Error(`Download failed: ${status} ${response.statusText}`) };
    }
    // Peek at first bytes to detect HTML challenge served with 200 OK
    if (contentType?.includes('text/html')) {
      const sniff = await response.clone().text().catch(() => '');
      if (looksLikeChallenge(contentType, status, sniff.slice(0, 1024))) {
        return { response, challenge: true };
      }
    }
    return { response, challenge: looksLikeChallenge(contentType, status, '') };
  } catch (err: unknown) {
    return { error: err instanceof Error ? err : new Error(String(err)) };
  }
}

/**
 * iter-CDB-0.1: Cookie-aware binary downloader.
 *
 * Mirrors `protectedFetch`'s 2-step pattern but for binary streams:
 *   1. Try cached Cloudflare cookies + their UA → stream the file.
 *   2. On Cloudflare-challenge / 403 / 503 → land fresh cookies via
 *      `protectedFetch` (HTML challenge solver), then retry once.
 *
 * Falls through to the legacy plain-fetch behaviour when no cookies are
 * cached AND no challenge is detected — most hosts (MediaFire direct
 * URL, MEGA SDK) don't need any of this.
 */
export async function protectedDownload(
  url: string,
  destPath: string,
  onProgress?: ProgressCallback,
): Promise<AsyncResult<DownloadResult, Error>> {
  const startTime = Date.now();
  try {
    logger.info('[GetComics] protectedDownload starting', { url, destPath });
    await mkdir(path.dirname(destPath), { recursive: true });

    const cached = await getCloudflareCookies(url);
    const cookieHeader = cached ? buildCookieHeader(cached) : null;
    const userAgent = cached?.userAgent ?? DEFAULT_UA;

    let attempt = await attemptBinaryFetch(url, cookieHeader, userAgent);
    if ('error' in attempt) return createErrorResult(attempt.error);

    if (attempt.challenge) {
      logger.info('[GetComics] Binary fetch hit Cloudflare challenge, landing fresh cookies via FlareSolverr', { url });
      await protectedFetch(url, { timeout: 60000 });
      const refreshed = await getCloudflareCookies(url);
      const refreshedHeader = refreshed ? buildCookieHeader(refreshed) : null;
      const refreshedUA = refreshed?.userAgent ?? userAgent;
      attempt = await attemptBinaryFetch(url, refreshedHeader, refreshedUA);
      if ('error' in attempt) return createErrorResult(attempt.error);
      if (attempt.challenge) {
        return createErrorResult(new Error('Cloudflare challenge persists after FlareSolverr cookie refresh'));
      }
    }

    const { response } = attempt;
    const body = response.body;
    if (!body) return createErrorResult(new Error('Response body is null'));
    const contentLength = response.headers.get('content-length');
    const totalBytes = contentLength ? parseInt(contentLength, 10) : 0;
    const buffer = await readBodyWithProgress(body.getReader(), totalBytes, onProgress);
    await writeFile(destPath, buffer);
    const duration = (Date.now() - startTime) / 1000;
    logger.info('[GetComics] protectedDownload complete', { destPath, fileSize: buffer.length, duration });
    return createSuccessResult({ filePath: destPath, fileSize: buffer.length, duration });
  } catch (error: unknown) {
    logger.error('[GetComics] protectedDownload error', { url, destPath, error });
    return createErrorResult(error instanceof Error ? error : new Error(String(error)));
  }
}

/**
 * Extract filename from URL or Content-Disposition header
 */
export function extractFilename(url: string, contentDisposition?: string | null): string {
  if (contentDisposition) {
    const match = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
    if (match?.[1]) return match[1].replace(/['"]/g, '');
  }

  try {
    const filename = new URL(url).pathname.split('/').pop();
    if (filename) return decodeURIComponent(filename);
  } catch {
    // Invalid URL, use fallback
  }

  return `download_${Date.now()}.cbz`;
}

/**
 * Generate a unique destination path for a download
 */
/**
 * Media-type discriminator for path generation. `COMICBOOK` produces
 * issue-numbered filenames (`Title #001.cbz`); manga / unspecified produces
 * the legacy `Title - Vol XX.cbz` / `Title - Ch 001.cbz` format.
 */
export type DestPathMediaType = 'MANGA' | 'COMICBOOK';

export interface GenerateDestPathOptions {
  volumeNumber?: number;
  chapterNumber?: number;
  extension?: string;
  mediaType?: DestPathMediaType;
}

function buildFilename(
  sanitizedTitle: string,
  options: GenerateDestPathOptions,
): string {
  const { volumeNumber, chapterNumber, mediaType = 'MANGA' } = options;
  if (mediaType === 'COMICBOOK') {
    if (chapterNumber !== undefined) {
      return `${sanitizedTitle} #${chapterNumber.toString().padStart(3, '0')}`;
    }
    if (volumeNumber !== undefined) {
      return `${sanitizedTitle} - Vol ${volumeNumber.toString().padStart(2, '0')}`;
    }
    return `${sanitizedTitle} - ${Date.now()}`;
  }
  if (volumeNumber !== undefined) {
    return `${sanitizedTitle} - Vol ${volumeNumber.toString().padStart(2, '0')}`;
  }
  if (chapterNumber !== undefined) {
    return `${sanitizedTitle} - Ch ${chapterNumber.toString().padStart(3, '0')}`;
  }
  return `${sanitizedTitle} - ${Date.now()}`;
}

/**
 * Backwards-compatible signature: positional args are still supported so
 * existing call sites don't break, but new code should pass an options
 * object as the third argument.
 */
// eslint-disable-next-line max-params -- intentional dual signature documented above: positional args kept for backward compatibility; new callers pass an options object as the third arg
export function generateDestPath(
  baseDir: string,
  mangaTitle: string,
  volumeNumberOrOptions?: number | GenerateDestPathOptions,
  chapterNumber?: number,
  extension: string = 'cbz',
  mediaType: DestPathMediaType = 'MANGA',
): string {
  const sanitizedTitle = mangaTitle.replace(/[<>:"/\\|?*]/g, '_').trim();
  const options: GenerateDestPathOptions = typeof volumeNumberOrOptions === 'object'
    ? volumeNumberOrOptions
    : {
      ...(volumeNumberOrOptions !== undefined ? { volumeNumber: volumeNumberOrOptions } : {}),
      ...(chapterNumber !== undefined ? { chapterNumber } : {}),
      extension,
      mediaType,
    };
  const ext = options.extension ?? 'cbz';
  return path.join(baseDir, sanitizedTitle, `${buildFilename(sanitizedTitle, options)}.${ext}`);
}
