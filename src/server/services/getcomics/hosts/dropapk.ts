/**
 * DropAPK Download Handler
 *
 * Extracts direct download URLs from DropAPK pages and handles downloads.
 * Uses FlareSolverr for Cloudflare bypass when necessary.
 *
 * @module server/services/getcomics/hosts/dropapk
 */

import { createErrorResult, createSuccessResult } from '@/utils/async-result';
import type { AsyncResult } from '@/utils/async-result';
import { logger } from '@/utils/logger';

import { fetchHostPage, protectedDownload } from './download-utils';

import type { DownloadResult, ProgressCallback } from './download-utils';
import type { FileHostHandler } from './index';

/**
 * Extract direct download URL from DropAPK page HTML.
 * Exported for unit-testing.
 */
export function extractDropapkUrl(html: string): string | null {
  // DropAPK download link patterns
  // Pattern 1: Direct download link
  const directMatch = html.match(/href="(https?:\/\/[^"]*dropapk[^"]*\/d\/[^"]+)"/i);
  if (directMatch?.[1]) {
    return directMatch[1];
  }

  // Pattern 2: Download button link
  const buttonMatch = html.match(/class="[^"]*download[^"]*"[^>]*href="([^"]+)"/i);
  if (buttonMatch?.[1]) {
    return buttonMatch[1];
  }

  // Pattern 3: Link in onclick handler
  const onclickMatch = html.match(/onclick="[^"]*location\.href='([^']+)'/i);
  if (onclickMatch?.[1]) {
    return onclickMatch[1];
  }

  return null;
}

/**
 * DropAPK download handler
 */
export const dropapkHandler: FileHostHandler = {
  /**
   * Extract direct download URL from DropAPK page
   */
  async extractDirectUrl(pageUrl: string): Promise<AsyncResult<string, Error>> {
    logger.info('[DropAPK] Extracting download URL', { pageUrl });

    const htmlResult = await fetchHostPage(pageUrl);
    if (htmlResult.status === 'error') {
      return createErrorResult(htmlResult.error);
    }
    if (htmlResult.status !== 'success') {
      return createErrorResult(new Error('Failed to fetch DropAPK page: unexpected state'));
    }

    const directUrl = extractDropapkUrl(htmlResult.data);
    if (!directUrl) {
      logger.error('[DropAPK] Could not extract download URL from page', { pageUrl });
      return createErrorResult(new Error('Could not extract DropAPK download URL'));
    }

    logger.info('[DropAPK] Extracted download URL', { pageUrl, directUrl });
    return createSuccessResult(directUrl);
  },

  /**
   * Download file from DropAPK. iter-CDB-4: routed through
   * `protectedDownload` for cookie hand-off + Cloudflare bypass on the
   * binary endpoint (DropAPK occasionally puts CF in front of its CDN).
   */
  async download(
    url: string,
    destPath: string,
    onProgress?: ProgressCallback
  ): Promise<AsyncResult<DownloadResult, Error>> {
    return protectedDownload(url, destPath, onProgress);
  },
};
