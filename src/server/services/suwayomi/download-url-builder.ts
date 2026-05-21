/**
 * Suwayomi Download URL Builder
 *
 * Centralizes the rules for turning a page URL returned by the Suwayomi
 * `getChapterPages` GraphQL query into something axios can fetch directly,
 * including any auth headers the configured server needs.
 *
 * Suwayomi's GraphQL `fetchChapterPages.pages` returns paths that may be:
 *   - Absolute (e.g., `http://host:port/api/v1/manga/.../page/0`)
 *   - Relative (e.g., `/api/v1/manga/123/chapter/4/page/0`)
 *
 * This module normalizes them against the configured server base URL.
 */

import { suwayomiConfigService, type SuwayomiConfig } from './configService';

/**
 * Optional Basic Auth credentials. Suwayomi supports basic auth via JVM
 * config; we don't read it from SuwayomiConfig today because no field exists
 * for it, but the helper accepts it so a caller (e.g., a future config
 * surface) can plumb it through without changing the downloader.
 */
export interface SuwayomiBasicAuth {
  username: string;
  password: string;
}

/**
 * Resolved server connection info for fetching pages.
 */
export interface SuwayomiServerInfo {
  /** e.g., `http://localhost:4567` (no trailing slash) */
  baseUrl: string;
  /** Headers axios should send. Empty record when no auth configured. */
  headers: Record<string, string>;
}

/**
 * Build server connection info from a loaded SuwayomiConfig. Defaults to
 * `localhost` since SuwayomiConfig has no host field — the server is always
 * spawned locally.
 */
export function buildSuwayomiServerInfo(
  config: Pick<SuwayomiConfig, 'port'>,
  auth?: SuwayomiBasicAuth,
): SuwayomiServerInfo {
  const baseUrl = `http://localhost:${config.port}`;
  const headers: Record<string, string> = {
    'User-Agent': 'MugiwaraKaizoku/1.0 (Suwayomi Bridge)',
  };
  if (auth) {
    const token = Buffer.from(`${auth.username}:${auth.password}`).toString('base64');
    headers['Authorization'] = `Basic ${token}`;
  }
  return { baseUrl, headers };
}

/**
 * Convenience that loads the live config and returns server info. Use this
 * from request-time code paths; use {@link buildSuwayomiServerInfo} from
 * tests or when caller already holds a config object.
 */
export async function loadSuwayomiServerInfo(
  auth?: SuwayomiBasicAuth,
): Promise<SuwayomiServerInfo> {
  const config = await suwayomiConfigService.loadConfig();
  return buildSuwayomiServerInfo(config, auth);
}

/**
 * Resolve a page URL against the server base. Absolute URLs pass through
 * unchanged; relative URLs are joined to the base.
 */
export function resolvePageUrl(pageUrl: string, baseUrl: string): string {
  if (/^https?:\/\//i.test(pageUrl)) return pageUrl;
  const trimmedBase = baseUrl.replace(/\/+$/, '');
  const trimmedPath = pageUrl.startsWith('/') ? pageUrl : `/${pageUrl}`;
  return `${trimmedBase}${trimmedPath}`;
}
