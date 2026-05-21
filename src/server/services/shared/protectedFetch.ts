/**
 * Protected Fetch
 *
 * HTTP client for Cloudflare-protected sites using FlareSolverr bypass.
 *
 * Bypass Strategy (in order):
 * 1. Request with cached Cloudflare cookies from previous FlareSolverr (instant, if available)
 * 2. FlareSolverr bypass (slow, ~60s, but reliable)
 *
 * Note: Direct requests are not attempted as they no longer work for Cloudflare-protected sites.
 *
 * @module shared/protectedFetch
 *
 * @example
 * ```typescript
 * import { protectedFetch } from '@/server/services/shared/protectedFetch';
 *
 * const result = await protectedFetch('https://comicvine.gamespot.com/...');
 *
 * // With session for cookie persistence
 * const result = await protectedFetch('https://comicvine.gamespot.com/...', {
 *   sessionName: 'comicvine',
 * });
 * ```
 */

import axios from 'axios';

import { prisma } from '@/server/db';
import { flareSolverr } from '@/server/services/flaresolverr';
import {
  buildCookieHeader,
  getCloudflareCookies,
  storeCloudflareCookies,
} from '@/server/services/flaresolverr/cookieStore';
import type {
  CloudflareCookies,
  FlareSolverrCookie,
  ProtectedFetchOptions,
  ProtectedFetchResult,
} from '@/server/services/flaresolverr/types';
import { logger } from '@/utils/logger';

/**
 * Sync FlareSolverr singleton config with database
 * This ensures the singleton uses the latest config after direct DB updates
 */
async function syncFlareSolverrConfig(): Promise<void> {
  try {
    const config = await prisma.flareSolverrConfig.findUnique({
      where: { id: 'default' },
    });
    if (config) {
      flareSolverr.updateConfig({
        enabled: config.enabled,
        url: config.url,
        timeout: config.timeout,
        sessionTTL: config.sessionTTL,
        disableMedia: config.disableMedia,
        defaultWaitSeconds: config.defaultWaitSecs,
      });
    }
  } catch {
    // Ignore errors - use existing config
  }
}

/**
 * Default headers for direct requests
 */
const DEFAULT_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Accept:
    'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Accept-Encoding': 'gzip, deflate, br',
  'Cache-Control': 'max-age=0',
  Connection: 'keep-alive',
  'Sec-Ch-Ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
  'Sec-Ch-Ua-Mobile': '?0',
  'Sec-Ch-Ua-Platform': '"Windows"',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'none',
  'Sec-Fetch-User': '?1',
  'Upgrade-Insecure-Requests': '1',
};


/**
 * Check if response HTML indicates Cloudflare challenge
 */
function isCloudflareChallenge(html: string): boolean {
  return (
    html.includes('cf-browser-verification') ||
    html.includes('challenge-platform') ||
    html.includes('cf_chl_') ||
    html.includes('Just a moment...')
  );
}

/**
 * Try to fetch using cached Cloudflare cookies from previous FlareSolverr bypass
 */
async function tryWithCachedCookies(
  url: string,
  cookies: CloudflareCookies,
  timeout: number
): Promise<ProtectedFetchResult | null> {
  try {
    const cookieHeader = buildCookieHeader(cookies as Parameters<typeof buildCookieHeader>[0]);

    if (!cookieHeader) {
      logger.debug('[protectedFetch] No valid cached cookies to use');
      return null;
    }

    logger.info('[protectedFetch] Trying with cached cookies', {
      url,
      cookieLength: cookieHeader.length,
      userAgent: cookies.userAgent.substring(0, 50) + '...',
    });

    const response = await axios.get<string>(url, {
      headers: {
        ...DEFAULT_HEADERS,
        'User-Agent': cookies.userAgent, // Must match the UA used when cookies were obtained
        Cookie: cookieHeader,
      },
      timeout,
      responseType: 'text',
    });

    const html = response.data;

    // Check if we still got a Cloudflare challenge
    if (isCloudflareChallenge(html)) {
      logger.info('[protectedFetch] Cached cookies failed - got Cloudflare challenge', { url });
      return null;
    }

    logger.info('[protectedFetch] Cached cookie bypass successful!', {
      url,
      status: response.status,
      length: html.length,
    });

    return {
      success: true,
      html,
      status: response.status,
      cookies: [],
      userAgent: cookies.userAgent,
      usedFlareSolverr: false,
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.debug('[protectedFetch] Cached cookie request failed', {
      url,
      error: errorMessage,
    });
    return null;
  }
}

/**
 * Try FlareSolverr bypass
 */
async function tryFlareSolverr(
  url: string,
  timeout: number,
  sessionName?: string,
  waitInSeconds?: number
): Promise<ProtectedFetchResult> {
  // Sync config from database before health check
  // This fixes stale cache issues after direct DB updates
  await syncFlareSolverrConfig();

  const isHealthy = await flareSolverr.isHealthy();
  if (!isHealthy) {
    logger.warn('[protectedFetch] FlareSolverr unavailable, cannot bypass Cloudflare', { url });

    return {
      success: false,
      html: null,
      status: 403,
      cookies: [],
      userAgent: '',
      usedFlareSolverr: false,
      error: 'Cloudflare blocked and no bypass method available',
    };
  }

  logger.info('[protectedFetch] Using FlareSolverr for Cloudflare bypass', { url });

  // Create or reuse session if specified
  if (sessionName) {
    await flareSolverr.createSession(sessionName);
  }

  const fetchOptions: { maxTimeout: number; session?: string; waitInSeconds?: number } = {
    maxTimeout: timeout,
  };
  if (sessionName) {
    fetchOptions.session = sessionName;
  }
  if (waitInSeconds !== undefined && waitInSeconds > 0) {
    fetchOptions.waitInSeconds = waitInSeconds;
  }

  const result = await flareSolverr.fetch(url, fetchOptions);

  if (!result.html) {
    logger.error('[protectedFetch] FlareSolverr failed to fetch', { url });

    return {
      success: false,
      html: null,
      status: result.status,
      cookies: result.cookies,
      userAgent: result.userAgent,
      usedFlareSolverr: true,
      error: 'FlareSolverr failed to fetch URL',
    };
  }

  logger.info('[protectedFetch] FlareSolverr fetch successful', {
    url,
    status: result.status,
    length: result.html.length,
    cookies: result.cookies.length,
  });

  // Auto-store cookies from FlareSolverr for future requests (instant bypass)
  if (result.cookies.length > 0) {
    const cfClearance = result.cookies.find((c) => c.name === 'cf_clearance');
    const cfBm = result.cookies.find((c) => c.name === '__cf_bm');

    if (cfClearance ?? cfBm) {
      const domain = new URL(url).hostname;
      const cookiesToStore: CloudflareCookies = {
        userAgent: result.userAgent,
        domain,
        capturedAt: Date.now(),
      };

      // Only add cookie values if they exist (exactOptionalPropertyTypes compliance)
      if (cfClearance?.value) {
        cookiesToStore.cf_clearance = cfClearance.value;
      }
      if (cfBm?.value) {
        cookiesToStore.__cf_bm = cfBm.value;
      }

      await storeCloudflareCookies(cookiesToStore);
      logger.info('[protectedFetch] Auto-stored Cloudflare cookies for future requests', {
        url,
        domain,
        hasCfClearance: Boolean(cfClearance),
        hasCfBm: Boolean(cfBm),
      });
    }
  }

  return {
    success: true,
    html: result.html,
    status: result.status,
    cookies: result.cookies,
    userAgent: result.userAgent,
    usedFlareSolverr: true,
  };
}

/**
 * Fetch a URL with automatic Cloudflare bypass
 *
 * Flow:
 * 1. Try cached cookies from previous FlareSolverr (instant, if available)
 * 2. Fall back to FlareSolverr bypass (slow, ~60s, but reliable)
 *
 * @param url - URL to fetch
 * @param options - Fetch options
 * @returns Fetch result with HTML content
 */
export async function protectedFetch(
  url: string,
  options: ProtectedFetchOptions = {}
): Promise<ProtectedFetchResult> {
  const { timeout = 30000, sessionName, waitInSeconds } = options;

  logger.debug('[protectedFetch] Starting fetch', { url, waitInSeconds });

  // === Step 1: Try cached cookies from previous FlareSolverr (instant) ===
  const storedCookies = await getCloudflareCookies(url);
  if (storedCookies) {
    const cookieResult = await tryWithCachedCookies(url, storedCookies, timeout);
    if (cookieResult) {
      return cookieResult;
    }
    logger.info('[protectedFetch] Cached cookies failed, falling back to FlareSolverr', { url });
  }

  // === Step 2: Use FlareSolverr (slow but reliable) ===
  return tryFlareSolverr(url, timeout, sessionName, waitInSeconds);
}

/**
 * Check if FlareSolverr is available
 */
export async function isFlareSolverrAvailable(): Promise<boolean> {
  return flareSolverr.isHealthy();
}

/**
 * Get FlareSolverr status for health checks
 */
export async function getFlareSolverrStatus(): Promise<{
  enabled: boolean;
  healthy: boolean;
  url: string;
  version: string | null;
}> {
  const config = flareSolverr.getConfig();
  const healthy = await flareSolverr.isHealthy();
  const version = healthy ? await flareSolverr.getVersion() : null;

  return {
    enabled: config.enabled,
    healthy,
    url: config.url,
    version,
  };
}

/**
 * Get cached cookies for a domain
 */
export function getCachedCookies(domain: string): FlareSolverrCookie[] {
  return flareSolverr.getCookiesForDomain(domain);
}

/**
 * Check if we have valid Cloudflare cookies for a URL
 */
export async function hasValidCloudflareCookies(url: string): Promise<boolean> {
  const cookies = await getCloudflareCookies(url);
  return cookies?.isValid ?? false;
}
