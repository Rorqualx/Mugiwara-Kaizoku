/**
 * MediaFire Download Handler
 *
 * Extracts direct download URLs from MediaFire pages and handles downloads.
 * Uses FlareSolverr for Cloudflare bypass when necessary.
 *
 * @module server/services/getcomics/hosts/mediafire
 */

import { createErrorResult, createSuccessResult } from '@/utils/async-result';
import type { AsyncResult } from '@/utils/async-result';
import { logger } from '@/utils/logger';

import { fetchHostPage, protectedDownload } from './download-utils';

import type { DownloadResult, ProgressCallback } from './download-utils';
import type { FileHostHandler } from './index';

/**
 * Extract direct download URL from MediaFire page HTML.
 * Exported for unit-testing — production code uses `extractDirectUrl`.
 */
export function extractMediafireUrl(html: string): string | null {
  // MediaFire download button pattern - look for the download link
  // Pattern 1: aria-label="Download file"
  const downloadButtonMatch = html.match(/href="(https:\/\/download\d*\.mediafire\.com\/[^"]+)"/i);
  if (downloadButtonMatch?.[1]) {
    return downloadButtonMatch[1];
  }

  // Pattern 2: Direct link in script data
  const scriptMatch = html.match(/downloadUrl\s*=\s*['"]([^'"]+)['"]/i);
  if (scriptMatch?.[1]) {
    return scriptMatch[1];
  }

  // Pattern 3: Look for input with download URL
  const inputMatch = html.match(/id="downloadButton"[^>]*href="([^"]+)"/i);
  if (inputMatch?.[1]) {
    return inputMatch[1];
  }

  return null;
}

/**
 * MediaFire download handler
 */
export const mediafireHandler: FileHostHandler = {
  /**
   * Extract direct download URL from MediaFire page
   */
  async extractDirectUrl(pageUrl: string): Promise<AsyncResult<string, Error>> {
    logger.info('[MediaFire] Extracting download URL', { pageUrl });

    const htmlResult = await fetchHostPage(pageUrl);
    if (htmlResult.status === 'error') {
      return createErrorResult(htmlResult.error);
    }
    if (htmlResult.status !== 'success') {
      return createErrorResult(new Error('Failed to fetch MediaFire page: unexpected state'));
    }

    const directUrl = extractMediafireUrl(htmlResult.data);
    if (!directUrl) {
      logger.error('[MediaFire] Could not extract download URL from page', { pageUrl });
      return createErrorResult(new Error('Could not extract MediaFire download URL'));
    }

    logger.info('[MediaFire] Extracted download URL', { pageUrl, directUrl });
    return createSuccessResult(directUrl);
  },

  /**
   * Download file from MediaFire. iter-CDB-1: routed through
   * `protectedDownload` so the binary fetch reuses Cloudflare cookies
   * landed by `fetchHostPage` (above) and re-runs FlareSolverr when the
   * `download*.mediafire.com` endpoint itself is gated.
   */
  async download(
    url: string,
    destPath: string,
    onProgress?: ProgressCallback
  ): Promise<AsyncResult<DownloadResult, Error>> {
    return protectedDownload(url, destPath, onProgress);
  },
};
