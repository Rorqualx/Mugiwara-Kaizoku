/**
 * GoFile Download Handler
 *
 * GoFile.io is a public file-host frequently linked from GetComics. Its
 * public API exposes content metadata via:
 *   - `GET https://api.gofile.io/createAccount`          → guest token
 *   - `GET https://api.gofile.io/getContent?contentId=X&token=Y`
 *     → JSON with each file's direct CDN url.
 *
 * SSRF safety: every fetch target is constructed against the pinned
 * `GOFILE_API` constant or a `gofile.io` / `*.gofile.io` host check (see
 * `isGofileHost`). User-supplied input is encoded as a query parameter
 * via `URL.searchParams.set(...)`, never spliced into the path.
 *
 * @module server/services/getcomics/hosts/gofile
 */

import { createErrorResult, createSuccessResult } from '@/utils/async-result';
import type { AsyncResult } from '@/utils/async-result';
import { logger } from '@/utils/logger';

import { protectedDownload } from './download-utils';

import type { DownloadResult, ProgressCallback } from './download-utils';
import type { FileHostHandler } from './index';

const GOFILE_API_ORIGIN = 'https://api.gofile.io';

function isGofileHost(hostname: string): boolean {
  return hostname === 'gofile.io' || hostname.endsWith('.gofile.io');
}

/**
 * Parse the contentId from a GoFile share URL.
 *
 *   https://gofile.io/d/<id>           → <id>
 *   https://gofile.io/?c=<id>          → <id>  (legacy)
 *
 * Exported for unit-testing.
 */
export function parseGoFileContentId(url: string): string | null {
  const slashMatch = url.match(/gofile\.io\/d\/([A-Za-z0-9]+)/i);
  if (slashMatch?.[1]) return slashMatch[1];
  const queryMatch = url.match(/gofile\.io\/\?c=([A-Za-z0-9]+)/i);
  if (queryMatch?.[1]) return queryMatch[1];
  return null;
}

interface GoFileContentResponse {
  status: string;
  data?: {
    contents?: Record<string, { name?: string; link?: string; directLink?: string; size?: number }>;
  };
}

interface GoFileAccountResponse {
  status: string;
  data?: { token?: string };
}

async function fetchGuestToken(): Promise<string | null> {
  try {
    const url = new URL('/createAccount', GOFILE_API_ORIGIN);
    const res = await fetch(url.toString(), { headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (!res.ok) return null;
    const json = await res.json() as GoFileAccountResponse;
    return json.status === 'ok' ? json.data?.token ?? null : null;
  } catch (err: unknown) {
    logger.warn('[GoFile] guest-token fetch failed', { err });
    return null;
  }
}

async function fetchContentDirectLink(contentId: string, token: string): Promise<string | null> {
  try {
    const url = new URL('/getContent', GOFILE_API_ORIGIN);
    url.searchParams.set('contentId', contentId);
    url.searchParams.set('token', token);
    const res = await fetch(url.toString(), { headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (!res.ok) return null;
    const json = await res.json() as GoFileContentResponse;
    if (json.status !== 'ok' || !json.data?.contents) return null;
    const items = Object.values(json.data.contents);
    if (items.length === 0) return null;
    const first = items[0];
    return first?.directLink ?? first?.link ?? null;
  } catch (err: unknown) {
    logger.warn('[GoFile] getContent fetch failed', { contentId, err });
    return null;
  }
}

export const gofileHandler: FileHostHandler = {
  async extractDirectUrl(pageUrl: string): Promise<AsyncResult<string, Error>> {
    const contentId = parseGoFileContentId(pageUrl);
    if (!contentId) {
      return createErrorResult(new Error(`Invalid GoFile URL: ${pageUrl}`));
    }
    logger.info('[GoFile] Extracting direct URL', { pageUrl, contentId });
    const token = await fetchGuestToken();
    if (!token) {
      return createErrorResult(new Error('GoFile parse_failed: could not acquire guest token'));
    }
    const directLink = await fetchContentDirectLink(contentId, token);
    if (!directLink) {
      return createErrorResult(new Error('GoFile parse_failed: no usable link in getContent response (expired or empty share)'));
    }
    // Confirm the host belongs to GoFile before appending the token —
    // pinning prevents an attacker-controlled API response from steering
    // us at a third-party origin.
    let parsed: URL;
    try { parsed = new URL(directLink); } catch { return createErrorResult(new Error('GoFile parse_failed: invalid directLink')); }
    if (!isGofileHost(parsed.hostname)) {
      return createErrorResult(new Error(`GoFile parse_failed: directLink host outside gofile.io (${parsed.hostname})`));
    }
    parsed.searchParams.set('accountToken', token);
    return createSuccessResult(parsed.toString());
  },

  async download(
    url: string,
    destPath: string,
    onProgress?: ProgressCallback,
  ): Promise<AsyncResult<DownloadResult, Error>> {
    return protectedDownload(url, destPath, onProgress);
  },
};
