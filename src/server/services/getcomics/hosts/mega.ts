/**
 * MEGA Download Handler
 *
 * Handles downloads from MEGA.nz using the megajs library.
 * MEGA uses end-to-end encryption, requiring special handling.
 *
 * Note: Requires `megajs` package to be installed:
 * `bun add megajs`
 *
 * @module server/services/getcomics/hosts/mega
 */

import { mkdir, writeFile } from 'fs/promises';
import path from 'path';

import { realtimeEmitter } from '@/server/services/realtime/RealtimeEventEmitter';
import { createErrorResult, createSuccessResult } from '@/utils/async-result';
import type { AsyncResult } from '@/utils/async-result';
import { logger } from '@/utils/logger';

import type { DownloadResult, ProgressCallback } from './download-utils';
import type { FileHostHandler } from './index';

/**
 * iter-CDB-2: MEGA error classifier. Maps the megajs SDK's error messages
 * to the telemetry outcome enum (`quota` / `expired` / `parse_failed` /
 * `failed`). Tested directly via mega.test.ts.
 */
export type MegaErrorClass = 'quota' | 'expired' | 'parse_failed' | 'failed';

export function classifyMegaError(err: unknown): MegaErrorClass {
  const raw = err instanceof Error ? err.message : String(err);
  const lower = raw.toLowerCase();
  if (lower.includes('eoverquota') || lower.includes('quota') || lower.includes('bandwidth')) return 'quota';
  if (lower.includes('eexpired') || lower.includes('expired') || lower.includes('enoent')) return 'expired';
  if (lower.includes('invalid') && lower.includes('key')) return 'parse_failed';
  if (lower.includes('decrypt')) return 'parse_failed';
  return 'failed';
}

const MAX_TRANSPORT_RETRIES = 3;
const BACKOFF_MS = [2_000, 4_000, 8_000];

function isTransientTransportError(err: unknown): boolean {
  const raw = err instanceof Error ? err.message : String(err);
  const lower = raw.toLowerCase();
  if (lower.includes('econnreset') || lower.includes('etimedout')) return true;
  if (lower.includes('socket hang up') || lower.includes('network')) return true;
  if (lower.includes('eagain')) return true;
  return false;
}

/**
 * Parse MEGA URL to extract file ID and key.
 * Exported for unit-testing — production code uses `extractDirectUrl` /
 * `download` which call this internally.
 */
export function parseMegaUrl(url: string): { fileId: string; key: string } | null {
  // MEGA URL formats:
  // https://mega.nz/file/FILEID#KEY
  // https://mega.nz/#!FILEID!KEY
  // https://mega.co.nz/#!FILEID!KEY

  const newFormatMatch = url.match(/mega\.nz\/file\/([^#]+)#(.+)/);
  if (newFormatMatch) {
    return { fileId: newFormatMatch[1] ?? '', key: newFormatMatch[2] ?? '' };
  }

  const oldFormatMatch = url.match(/mega\.(?:nz|co\.nz)\/#!([^!]+)!(.+)/);
  if (oldFormatMatch) {
    return { fileId: oldFormatMatch[1] ?? '', key: oldFormatMatch[2] ?? '' };
  }

  return null;
}

/**
 * Progress tracker state for stream downloads
 */
interface ProgressTracker {
  downloadedBytes: number;
  lastProgressUpdate: number;
  lastDownloadedBytes: number;
}

/**
 * Report download progress if enough time has passed
 */
function reportProgress(
  tracker: ProgressTracker,
  totalSize: number,
  onProgress: ProgressCallback | undefined
): void {
  if (!onProgress) return;

  const now = Date.now();
  const shouldReportProgress = now - tracker.lastProgressUpdate >= 500;
  if (!shouldReportProgress) return;

  const elapsed = (now - tracker.lastProgressUpdate) / 1000;
  const speed = elapsed > 0 ? (tracker.downloadedBytes - tracker.lastDownloadedBytes) / elapsed : 0;
  onProgress(tracker.downloadedBytes, totalSize, speed);
  Object.assign(tracker, {
    lastProgressUpdate: now,
    lastDownloadedBytes: tracker.downloadedBytes,
  });
}

/**
 * Stream file data to chunks array with progress tracking
 */
function streamToChunks(
  downloadStream: NodeJS.ReadableStream,
  totalSize: number,
  onProgress?: ProgressCallback
): Promise<Buffer[]> {
  const chunks: Buffer[] = [];
  const tracker: ProgressTracker = {
    downloadedBytes: 0,
    lastProgressUpdate: Date.now(),
    lastDownloadedBytes: 0,
  };

  return new Promise((resolve, reject) => {
    downloadStream.on('data', (chunk: Buffer) => {
      chunks.push(chunk);
      tracker.downloadedBytes += chunk.length;
      reportProgress(tracker, totalSize, onProgress);
    });

    downloadStream.on('end', () => {
      reportProgress(tracker, totalSize, onProgress);
      resolve(chunks);
    });

    downloadStream.on('error', (err: Error) => {
      reject(err);
    });
  });
}

/**
 * MEGA download handler
 */
export const megaHandler: FileHostHandler = {
  /**
   * For MEGA, the URL already contains the encrypted file info
   * Return as-is since megajs handles the decryption
   */
  extractDirectUrl(pageUrl: string): Promise<AsyncResult<string, Error>> {
    const parsed = parseMegaUrl(pageUrl);
    if (!parsed) {
      return Promise.resolve(createErrorResult(new Error(`Invalid MEGA URL format: ${pageUrl}`)));
    }
    return Promise.resolve(createSuccessResult(pageUrl));
  },

  /**
   * Download file from MEGA using megajs. iter-CDB-2: wraps SDK in
   * retry-with-backoff + error classification. Per-attempt logic
   * extracted to helpers to keep nesting under the project's depth budget.
   */
  async download(
    url: string,
    destPath: string,
    onProgress?: ProgressCallback
  ): Promise<AsyncResult<DownloadResult, Error>> {
    const startTime = Date.now();
    await mkdir(path.dirname(destPath), { recursive: true });
    let lastErr: unknown;
    for (let attempt = 0; attempt < MAX_TRANSPORT_RETRIES; attempt++) {
      // eslint-disable-next-line no-await-in-loop -- serial retry by design
      const result = await tryOneMegaDownload(url, destPath, onProgress, startTime, attempt);
      if (result.kind === 'success') return result.value;
      if (result.kind === 'classified') return result.value; // non-transient — bail
      lastErr = result.error;
      if (!isTransientTransportError(result.error) || attempt === MAX_TRANSPORT_RETRIES - 1) {
        logger.error('[MEGA] Download failed (unretryable)', { url, destPath, error: result.error });
        return createErrorResult(result.error instanceof Error ? result.error : new Error(String(result.error)));
      }
      const wait = BACKOFF_MS[attempt] ?? 8_000;
      logger.warn('[MEGA] Transient error, backing off', { url, attempt: attempt + 1, wait });
      // eslint-disable-next-line no-await-in-loop -- backoff sleep
      await new Promise<void>(resolve => { setTimeout(resolve, wait); });
    }
    return createErrorResult(lastErr instanceof Error ? lastErr : new Error(String(lastErr)));
  },
};

type MegaAttemptResult =
  | { kind: 'success'; value: AsyncResult<DownloadResult, Error> }
  | { kind: 'classified'; value: AsyncResult<DownloadResult, Error> }
  | { kind: 'transient'; error: unknown };

async function tryOneMegaDownload(
  url: string, destPath: string, onProgress: ProgressCallback | undefined,
  startTime: number, attempt: number,
): Promise<MegaAttemptResult> {
  try {
    const { File } = await import('megajs');
    logger.info('[MEGA] Starting download', { url, destPath, attempt: attempt + 1 });
    const file = File.fromURL(url);
    await file.loadAttributes();
    const totalSize = file.size ?? 0;
    const downloadStream = file.download({}) as NodeJS.ReadableStream;
    const chunks = await streamToChunks(downloadStream, totalSize, onProgress);
    const buffer = Buffer.concat(chunks);
    await writeFile(destPath, buffer);
    const duration = (Date.now() - startTime) / 1000;
    logger.info('[MEGA] Download complete', { destPath, fileSize: buffer.length, duration });
    return { kind: 'success', value: createSuccessResult({ filePath: destPath, fileSize: buffer.length, duration }) };
  } catch (error) {
    const klass = classifyMegaError(error);
    if (klass !== 'failed') {
      const tagged = new Error(`MEGA ${klass}: ${error instanceof Error ? error.message : String(error)}`);
      logger.error('[MEGA] Download failed (non-transient)', { url, klass, error });
      if (klass === 'quota') {
        void realtimeEmitter.emitSystemEvent({
          eventType: 'download:host:quota_exhausted',
          source: 'megaHost',
          message: 'MEGA bandwidth quota exhausted',
          data: { url },
        });
      }
      return { kind: 'classified', value: createErrorResult(tagged) };
    }
    return { kind: 'transient', error };
  }
}
