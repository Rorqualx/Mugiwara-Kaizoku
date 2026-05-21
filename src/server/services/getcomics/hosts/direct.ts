/**
 * Direct Download Handler
 *
 * Handles direct file downloads (no intermediary page parsing needed).
 * Uses FlareSolverr for Cloudflare bypass when necessary.
 *
 * @module server/services/getcomics/hosts/direct
 */

import { createSuccessResult } from '@/utils/async-result';
import type { AsyncResult } from '@/utils/async-result';

import { downloadWithProgress } from './download-utils';

import type { DownloadResult, ProgressCallback } from './download-utils';
import type { FileHostHandler } from './index';

/**
 * Direct download handler
 */
export const directHandler: FileHostHandler = {
  /**
   * For direct downloads, the URL is already the direct download URL
   */
  extractDirectUrl(pageUrl: string): Promise<AsyncResult<string, Error>> {
    return Promise.resolve(createSuccessResult(pageUrl));
  },

  /**
   * Download file directly
   */
  async download(
    url: string,
    destPath: string,
    onProgress?: ProgressCallback
  ): Promise<AsyncResult<DownloadResult, Error>> {
    return downloadWithProgress(url, destPath, onProgress);
  },
};
