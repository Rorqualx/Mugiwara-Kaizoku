/**
 * GetComics File Host Handlers
 *
 * Factory and registry for file host download handlers.
 * Each handler knows how to extract direct download URLs and download files
 * from its respective hosting service.
 *
 * @module server/services/getcomics/hosts
 */

import { createErrorResult, isError, isSuccess } from '@/utils/async-result';
import type { AsyncResult } from '@/utils/async-result';
import { logger } from '@/utils/logger';

import type { DownloadResult, ProgressCallback } from './download-utils';

/**
 * Supported file host types
 */
export type FileHostType = 'mediafire' | 'mega' | 'direct' | 'dropapk' | 'userscloud' | 'zippyshare' | 'gofile';

/**
 * File host handler interface
 */
export interface FileHostHandler {
  /** Extract the direct download URL from a host page URL */
  extractDirectUrl(pageUrl: string): Promise<AsyncResult<string, Error>>;
  /** Download a file from the host */
  download(
    url: string,
    destPath: string,
    onProgress?: ProgressCallback
  ): Promise<AsyncResult<DownloadResult, Error>>;
}

/**
 * Detect file host type from URL
 */
export function detectHostType(url: string): FileHostType | null {
  const lowercaseUrl = url.toLowerCase();

  if (lowercaseUrl.includes('mediafire.com')) return 'mediafire';
  if (lowercaseUrl.includes('mega.nz') || lowercaseUrl.includes('mega.co.nz')) return 'mega';
  if (lowercaseUrl.includes('dropapk.to') || lowercaseUrl.includes('dropapk.com')) return 'dropapk';
  if (lowercaseUrl.includes('gofile.io')) return 'gofile';
  if (lowercaseUrl.includes('userscloud.com')) return 'userscloud';
  if (lowercaseUrl.includes('zippyshare.com')) return 'zippyshare';

  // If no specific host detected, treat as direct download
  return 'direct';
}

/**
 * Get file host handler for a given host type
 */
export async function getHostHandler(host: FileHostType): Promise<FileHostHandler> {
  switch (host) {
    case 'mediafire':
      return (await import('./mediafire')).mediafireHandler;
    case 'mega':
      return (await import('./mega')).megaHandler;
    case 'direct':
      return (await import('./direct')).directHandler;
    case 'dropapk':
      return (await import('./dropapk')).dropapkHandler;
    case 'gofile':
      return (await import('./gofile')).gofileHandler;
    case 'userscloud':
    case 'zippyshare':
      // These use the same direct download approach
      return (await import('./direct')).directHandler;
    default:
      return (await import('./direct')).directHandler;
  }
}

/**
 * Download from a GetComics link, automatically detecting the host
 */
export async function downloadFromHost(
  url: string,
  destPath: string,
  onProgress?: ProgressCallback
): Promise<AsyncResult<DownloadResult, Error>> {
  const hostType = detectHostType(url);
  if (!hostType) {
    return createErrorResult(new Error(`Unable to detect host type for URL: ${url}`));
  }

  logger.info('[GetComics] Downloading from host', { url, hostType, destPath });

  try {
    const handler = await getHostHandler(hostType);

    // Extract direct URL if needed
    const directUrlResult = await handler.extractDirectUrl(url);
    if (!isSuccess(directUrlResult)) {
      if (isError(directUrlResult)) {
        return createErrorResult(directUrlResult.error);
      }
      return createErrorResult(new Error('Failed to extract direct URL: unexpected result state'));
    }

    // Download the file
    return await handler.download(directUrlResult.data, destPath, onProgress);
  } catch (error) {
    logger.error('[GetComics] Download from host failed', { url, hostType, error });
    return createErrorResult(error instanceof Error ? error : new Error(String(error)));
  }
}

// Re-export utilities
export { downloadWithProgress, fetchHostPage, extractFilename, generateDestPath } from './download-utils';
export type { DownloadResult, ProgressCallback } from './download-utils';
