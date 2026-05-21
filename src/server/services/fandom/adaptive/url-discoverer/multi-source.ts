/**
 * Multi-Source URL Discovery for Fandom Wikis
 *
 * Discovers multiple candidate URLs for chapter/volume data, not just the best one.
 * Useful for trying multiple sources or merging data from several pages.
 *
 * @module url-discoverer/multi-source
 */

import { normalizeUrlForComparison } from '@/server/utils/url-normalization';
import { logger } from '@/utils/logger';

import { KNOWN_DOMAIN_REDIRECTS, URL_PROBE_PATTERNS, WIKI_SPECIFIC_URL_PATTERNS } from '../types';

import { fetchHtmlContent, scorePageContent } from './scoring';

import type { UrlContentScore, UrlProbeResult } from '../types';

// ============================================================================
// Shared Helpers (duplicated for module independence)
// ============================================================================

/**
 * Extracts the wiki prefix from a domain.
 */
function getWikiPrefix(domain: string): string {
  return domain.replace(/\.fandom\.com$/, '').replace(/\.wikia\.com$/, '');
}

/**
 * Resolves known domain redirects before probing.
 */
function resolveKnownRedirect(domain: string): string {
  return KNOWN_DOMAIN_REDIRECTS[domain] ?? domain;
}

/**
 * Configuration for URL discovery
 */
export interface UrlDiscoveryConfig {
  probeTimeoutMs: number;
  maxConcurrentProbes: number;
  followRedirects: boolean;
  userAgent: string;
}

const DEFAULT_URL_DISCOVERY_CONFIG: UrlDiscoveryConfig = {
  probeTimeoutMs: 5000,
  maxConcurrentProbes: 3,
  followRedirects: true,
  userAgent: 'Mozilla/5.0 (compatible; MuggiwaraBot/1.0)',
};

/**
 * Probes a single URL to check if it exists.
 */
async function probeUrl(url: string, config: UrlDiscoveryConfig): Promise<UrlProbeResult> {
  const startTime = Date.now();

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), config.probeTimeoutMs);

    const response = await fetch(url, {
      method: 'HEAD',
      redirect: config.followRedirects ? 'follow' : 'manual',
      signal: controller.signal,
      headers: { 'User-Agent': config.userAgent },
    });

    clearTimeout(timeoutId);

    const finalUrl = response.url;
    const originalDomain = new URL(url).hostname;
    const finalDomain = new URL(finalUrl).hostname;

    const result: UrlProbeResult = {
      url,
      exists: response.ok,
      statusCode: response.status,
      probeTimeMs: Date.now() - startTime,
    };

    if (finalUrl !== url) {
      result.redirectedTo = finalUrl;
    }
    if (finalDomain !== originalDomain) {
      result.redirectedDomain = finalDomain;
    }

    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const isTimeout = errorMessage.includes('abort');

    return {
      url,
      exists: false,
      statusCode: isTimeout ? 408 : 0,
      probeTimeMs: Date.now() - startTime,
    };
  }
}

// ============================================================================
// Multi-Source Discovery
// ============================================================================

/**
 * Result from multi-source discovery.
 * Contains all candidate URLs ranked by content quality.
 */
export interface MultiSourceDiscoveryResult {
  /** All discovered URLs with scores, sorted by score descending */
  candidates: Array<{
    url: string;
    score: UrlContentScore;
  }>;
  /** Time taken for discovery */
  durationMs: number;
  /** The canonical domain after resolving redirects */
  canonicalDomain: string;
  /** URLs that were tried but didn't exist */
  failedUrls: string[];
}

/**
 * Discovers ALL candidate URLs for chapter/volume data, not just the best one.
 * Returns a ranked list of URLs by content quality.
 *
 * Use this when you want to try multiple sources or merge data from several pages.
 *
 * @param domain - The wiki domain
 * @param config - Configuration options
 * @param maxCandidates - Maximum number of candidates to return (default: 5)
 * @returns All discovered URLs with their content scores
 */
export async function discoverAllChapterVolumeUrls(
  domain: string,
  config: Partial<UrlDiscoveryConfig> = {},
  maxCandidates = 5
): Promise<MultiSourceDiscoveryResult> {
  const mergedConfig = { ...DEFAULT_URL_DISCOVERY_CONFIG, ...config };
  const startTime = Date.now();

  const canonicalDomain = resolveKnownRedirect(domain);
  const baseUrl = `https://${canonicalDomain}`;
  const failedUrls: string[] = [];

  // Collect all candidate URLs
  const wikiPrefix = getWikiPrefix(canonicalDomain);
  const specificPatterns = WIKI_SPECIFIC_URL_PATTERNS[wikiPrefix] ?? [];
  const allPatterns = [...specificPatterns, ...URL_PROBE_PATTERNS];

  // Remove duplicates using normalized URL comparison
  const seenNormalized = new Set<string>();
  const candidateUrls: string[] = [];
  for (const pattern of allPatterns) {
    const url = `${baseUrl}${pattern}`;
    const normalized = normalizeUrlForComparison(url);
    if (!seenNormalized.has(normalized)) {
      seenNormalized.add(normalized);
      candidateUrls.push(url);
    }
  }

  // Probe all URLs to find existing ones (deduplicate after redirects)
  const existingUrls: string[] = [];
  const seenRedirectedUrls = new Set<string>();
  for (const url of candidateUrls) {
    // eslint-disable-next-line no-await-in-loop -- Sequential probing for rate limiting
    const result = await probeUrl(url, mergedConfig);

    if (result.exists) {
      const finalUrl = result.redirectedTo ?? result.url;
      const normalizedFinalUrl = normalizeUrlForComparison(finalUrl);
      // Deduplicate - multiple patterns can redirect to the same URL
      if (!seenRedirectedUrls.has(normalizedFinalUrl)) {
        seenRedirectedUrls.add(normalizedFinalUrl);
        existingUrls.push(finalUrl);
      }
    } else {
      failedUrls.push(url);
    }

    // Stop after finding enough candidates
    if (existingUrls.length >= maxCandidates + 2) break;
  }

  if (existingUrls.length === 0) {
    logger.warn(`No chapter/volume URLs found for ${domain}`);
    return {
      candidates: [],
      durationMs: Date.now() - startTime,
      canonicalDomain,
      failedUrls,
    };
  }

  // Score each URL's content
  const scoredCandidates: Array<{ url: string; score: UrlContentScore }> = [];

  for (const url of existingUrls) {
    // eslint-disable-next-line no-await-in-loop -- Sequential fetching for rate limiting
    const html = await fetchHtmlContent(url, mergedConfig.probeTimeoutMs * 2, mergedConfig.userAgent);
    if (html) {
      const score = scorePageContent(html, url);
      scoredCandidates.push({ url, score });
      logger.debug(
        `[multi-source] ${url}: score=${score.score}, chapters=${score.chapterIndicators}, volumes=${score.volumeIndicators}`
      );
    }
  }

  // Sort by score descending
  scoredCandidates.sort((a, b) => b.score.score - a.score.score);

  // Limit to maxCandidates
  const topCandidates = scoredCandidates.slice(0, maxCandidates);

  logger.info(
    `[multi-source] Found ${topCandidates.length} candidates for ${domain}: ` +
      topCandidates.map((c) => `${new URL(c.url).pathname}(${c.score.score})`).join(', ')
  );

  return {
    candidates: topCandidates,
    durationMs: Date.now() - startTime,
    canonicalDomain,
    failedUrls,
  };
}

// ============================================================================
// Supplementary URL Discovery
// ============================================================================

/**
 * Additional URL patterns for supplementary data (gaiden, side stories, etc.)
 */
export const SUPPLEMENTARY_URL_PATTERNS: readonly string[] = [
  '/wiki/Gaiden',
  '/wiki/Side_Stories',
  '/wiki/One-shots',
  '/wiki/Extras',
  '/wiki/Bonus_Chapters',
  '/wiki/Special_Chapters',
  '/wiki/Omake',
] as const;

/**
 * Discovers supplementary content URLs (gaiden, side stories, etc.).
 *
 * @param domain - The wiki domain
 * @param config - Configuration options
 * @returns Found supplementary URLs
 */
export async function discoverSupplementaryUrls(
  domain: string,
  config: Partial<UrlDiscoveryConfig> = {}
): Promise<string[]> {
  const mergedConfig = { ...DEFAULT_URL_DISCOVERY_CONFIG, ...config };
  const canonicalDomain = resolveKnownRedirect(domain);
  const baseUrl = `https://${canonicalDomain}`;

  const foundUrls: string[] = [];

  for (const pattern of SUPPLEMENTARY_URL_PATTERNS) {
    const url = `${baseUrl}${pattern}`;
    // eslint-disable-next-line no-await-in-loop -- Sequential probing for rate limiting
    const result = await probeUrl(url, mergedConfig);

    if (result.exists) {
      foundUrls.push(result.redirectedTo ?? result.url);
      logger.debug(`[supplementary] Found: ${url}`);
    }
  }

  return foundUrls;
}
