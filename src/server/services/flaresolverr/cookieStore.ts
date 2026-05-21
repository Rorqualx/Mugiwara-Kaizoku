/**
 * Cloudflare Cookie Store
 *
 * Manages Cloudflare bypass cookies for protected domains.
 * Cookies are stored in PostgreSQL UNLOGGED table via UnifiedCacheProvider.
 *
 * Flow:
 * 1. First request → FlareSolverr solves Cloudflare challenge (~30s)
 * 2. Cookies auto-stored in database
 * 3. Subsequent requests use cached cookies (instant)
 * 4. Falls back to FlareSolverr if cookies expired (30 min TTL)
 *
 * @module flaresolverr/cookieStore
 */

import { cacheProvider } from '@/server/cache/UnifiedCacheProvider';
import { logger } from '@/utils/logger';

import type { CloudflareCookies, StoredCloudflareCookies } from './types';

/**
 * Cache namespace for Cloudflare cookies
 */
const COOKIE_NAMESPACE = 'cloudflare';

/**
 * Default cookie TTL in seconds (30 minutes)
 * Cloudflare cookies typically last 15-30 minutes
 */
const DEFAULT_TTL_SECONDS = 30 * 60;

/**
 * Generate a unique ID for stored cookies
 */
function generateId(): string {
  return `cf_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Extract domain from URL
 */
function extractDomain(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.hostname;
  } catch {
    return url;
  }
}

/**
 * Store Cloudflare cookies for a domain
 *
 * @param cookies - Cloudflare cookies to store
 * @returns Stored cookie entry with ID
 */
export async function storeCloudflareCookies(
  cookies: CloudflareCookies
): Promise<StoredCloudflareCookies> {
  const domain = extractDomain(cookies.domain);
  const id = generateId();
  const key = `cookies:${domain}`;

  const stored: StoredCloudflareCookies = {
    ...cookies,
    domain,
    id,
    isValid: true,
    capturedAt: cookies.capturedAt,
  };

  await cacheProvider.set(key, stored, {
    namespace: COOKIE_NAMESPACE,
    ttl: DEFAULT_TTL_SECONDS,
  });

  logger.info('[CookieStore] Stored Cloudflare cookies in database', {
    domain,
    id,
    hasCfClearance: !!cookies.cf_clearance,
    hasCfBm: !!cookies.__cf_bm,
    userAgent: cookies.userAgent.substring(0, 50) + '...',
  });

  return stored;
}

/**
 * Get stored Cloudflare cookies for a domain/URL
 *
 * @param urlOrDomain - URL or domain to get cookies for
 * @returns Stored cookies if valid, null otherwise
 */
export async function getCloudflareCookies(
  urlOrDomain: string
): Promise<StoredCloudflareCookies | null> {
  const domain = extractDomain(urlOrDomain);
  const key = `cookies:${domain}`;

  const stored = await cacheProvider.get<StoredCloudflareCookies>(key, COOKIE_NAMESPACE);

  if (!stored) {
    return null;
  }

  // Must have at least cf_clearance
  if (!stored.cf_clearance) {
    logger.debug('[CookieStore] Cookies missing cf_clearance', { domain });
    return null;
  }

  logger.debug('[CookieStore] Retrieved valid cookies from database', {
    domain,
    id: stored.id,
  });

  return stored;
}

/**
 * Clear all stored cookies
 */
export async function clearAllCookies(): Promise<void> {
  const count = await cacheProvider.clear({ namespace: COOKIE_NAMESPACE });
  logger.info('[CookieStore] Cleared all cookies from database', { count });
}

/**
 * Build Cookie header string from stored cookies
 *
 * @param cookies - Stored Cloudflare cookies
 * @returns Cookie header value
 */
export function buildCookieHeader(cookies: StoredCloudflareCookies): string {
  const parts: string[] = [];

  if (cookies.cf_clearance) {
    parts.push(`cf_clearance=${cookies.cf_clearance}`);
  }

  if (cookies.__cf_bm) {
    parts.push(`__cf_bm=${cookies.__cf_bm}`);
  }

  return parts.join('; ');
}
