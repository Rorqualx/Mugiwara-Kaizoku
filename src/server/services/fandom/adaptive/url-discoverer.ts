/**
 * URL Discoverer for Fandom Wikis
 *
 * Probes multiple URL patterns to find the correct chapter/volume listing page
 * for a given wiki domain. Handles domain redirects and returns the first working URL.
 *
 * @module url-discoverer
 */

import { normalizeUrlForComparison } from '@/server/utils/url-normalization';
import { logger } from '@/utils/logger';

import { KNOWN_DOMAIN_REDIRECTS, URL_PROBE_PATTERNS, WIKI_SPECIFIC_URL_PATTERNS } from './types';
import { fetchHtmlContent, scoreByExtraction, scorePageContent } from './url-discoverer/scoring';

import type { UrlContentScore, UrlDiscoveryResult, UrlProbeResult } from './types';

// Re-export scoring and multi-source functions for external use
export { scorePageContent, scoreByExtraction, type ExtractionScore } from './url-discoverer/scoring';
export {
  discoverAllChapterVolumeUrls,
  discoverSupplementaryUrls,
  SUPPLEMENTARY_URL_PATTERNS,
  type MultiSourceDiscoveryResult,
} from './url-discoverer/multi-source';

/**
 * Reject hub/disambiguation pages that score high on patterns but have very few
 * extractable chapters. If the best candidate has < 5 chapters and another has
 * dramatically more, prefer the other.
 */
function selectBestExtraction(
  extractionScores: Array<{ url: string; chapterCount: number; completenessScore: number }>,
): { url: string; chapterCount: number; completenessScore: number } {
  const best = extractionScores[0];
  if (!best) return { url: '', chapterCount: 0, completenessScore: 0 };
  if (best.chapterCount >= 5 || extractionScores.length < 2) return best;

  const second = extractionScores[1];
  if (second && second.chapterCount > best.chapterCount * 5) {
    logger.info(`[discoverBestChapterVolumeUrl] Rejecting hub page`, {
      rejected: best.url,
      rejectedChapters: best.chapterCount,
      selected: second.url,
      selectedChapters: second.chapterCount,
    });
    return second;
  }
  return best;
}

/**
 * Extracts the wiki prefix from a domain (e.g., "mob-psycho-100" from "mob-psycho-100.fandom.com").
 */
function getWikiPrefix(domain: string): string {
  return domain.replace(/\.fandom\.com$/, '').replace(/\.wikia\.com$/, '');
}

/** Probe wiki-specific URL patterns using MediaWiki API (bypasses Cloudflare HEAD blocks) */
// eslint-disable-next-line max-params -- 4 inputs (domain/baseUrl/patterns/userAgent) + 2 mutable output collectors (triedUrls/statusCodes) shared with the caller
async function probeSpecificPatternsViaApi(
  domain: string, baseUrl: string, patterns: string[],
  userAgent: string, triedUrls: string[], statusCodes: Map<string, number>,
): Promise<UrlProbeResult | null> {
  for (const pattern of patterns) {
    const url = `${baseUrl}${pattern}`;
    triedUrls.push(url);
    const pageTitle = decodeURIComponent(pattern.replace('/wiki/', ''));
    try {
      const apiUrl = `https://${domain}/api.php?action=query&titles=${encodeURIComponent(pageTitle)}&format=json`;
      // eslint-disable-next-line no-await-in-loop -- Sequential probing with early return
      const resp = await fetch(apiUrl, { headers: { 'User-Agent': userAgent } });
      if (!resp.ok) { statusCodes.set(url, resp.status); continue; }
      // eslint-disable-next-line no-await-in-loop -- needs json parse
      const data = (await resp.json()) as { query?: { pages?: Record<string, unknown> } };
      const exists = !Object.keys(data.query?.pages ?? {}).includes('-1');
      statusCodes.set(url, exists ? 200 : 404);
      if (exists) return { url, exists: true, statusCode: 200, probeTimeMs: 0 };
    } catch {
      statusCodes.set(url, 0);
    }
  }
  return null;
}

/**
 * Configuration for URL discovery
 */
export interface UrlDiscoveryConfig {
  /** Timeout for each probe request in milliseconds */
  probeTimeoutMs: number;
  /** Maximum number of concurrent probes */
  maxConcurrentProbes: number;
  /** Whether to follow redirects */
  followRedirects: boolean;
  /** User agent string for requests */
  userAgent: string;
}

/**
 * Default configuration for URL discovery
 */
export const DEFAULT_URL_DISCOVERY_CONFIG: UrlDiscoveryConfig = {
  probeTimeoutMs: 5000,
  maxConcurrentProbes: 3,
  followRedirects: true,
  userAgent: 'Mozilla/5.0 (compatible; MuggiwaraBot/1.0)',
};

/**
 * Resolves known domain redirects before probing.
 * Some Fandom wikis have been renamed and 301 redirect to new domains.
 *
 * @param domain - The original domain to check
 * @returns The canonical domain (same if no redirect known)
 */
export function resolveKnownRedirect(domain: string): string {
  return KNOWN_DOMAIN_REDIRECTS[domain] ?? domain;
}

/**
 * Probes a single URL to check if it exists and returns metadata.
 *
 * @param url - The URL to probe
 * @param config - Configuration options
 * @returns Probe result with status and redirect info
 */
export async function probeUrl(
  url: string,
  config: Partial<UrlDiscoveryConfig> = {}
): Promise<UrlProbeResult> {
  const mergedConfig = { ...DEFAULT_URL_DISCOVERY_CONFIG, ...config };
  const startTime = Date.now();

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), mergedConfig.probeTimeoutMs);

    const response = await fetch(url, {
      method: 'HEAD', // Use HEAD to minimize bandwidth
      redirect: mergedConfig.followRedirects ? 'follow' : 'manual',
      signal: controller.signal,
      headers: {
        'User-Agent': mergedConfig.userAgent,
      },
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
      statusCode: isTimeout ? 408 : 0, // 408 = timeout, 0 = network error
      probeTimeMs: Date.now() - startTime,
    };
  }
}

/**
 * Probes a batch of URLs concurrently and tracks results.
 */
async function probeBatch(
  urls: string[],
  config: UrlDiscoveryConfig,
  triedUrls: string[],
  statusCodes: Map<string, number>
): Promise<UrlProbeResult | null> {
  const probePromises = urls.map(async (url) => {
    const result = await probeUrl(url, config);
    triedUrls.push(url);
    statusCodes.set(url, result.statusCode);
    return result;
  });

  const results = await Promise.all(probePromises);
  return results.find((r) => r.exists) ?? null;
}

/**
 * Builds discovery result from a successful probe.
 */
function buildSuccessResult(
  result: UrlProbeResult,
  canonicalDomain: string,
  triedUrls: string[],
  statusCodes: Map<string, number>,
  startTime: number
): UrlDiscoveryResult {
  const finalDomain = result.redirectedDomain ?? canonicalDomain;
  return {
    foundUrl: result.redirectedTo ?? result.url,
    triedUrls,
    statusCodes,
    canonicalDomain: finalDomain,
    durationMs: Date.now() - startTime,
  };
}

/**
 * Discovers the correct URL for chapter/volume data on a Fandom wiki.
 * Probes multiple URL patterns and returns the first working one.
 * Wiki-specific patterns are checked first for wikis with non-standard naming.
 *
 * @param domain - The wiki domain (e.g., "mob-psycho-100.fandom.com")
 * @param config - Configuration options
 * @returns Discovery result with found URL and metadata
 */
export async function discoverChapterVolumeUrl(
  domain: string,
  config: Partial<UrlDiscoveryConfig> = {}
): Promise<UrlDiscoveryResult> {
  const mergedConfig = { ...DEFAULT_URL_DISCOVERY_CONFIG, ...config };
  const startTime = Date.now();

  // Resolve known redirects first
  const canonicalDomain = resolveKnownRedirect(domain);
  if (canonicalDomain !== domain) {
    logger.info(`Resolved known redirect: ${domain} -> ${canonicalDomain}`);
  }

  const baseUrl = `https://${canonicalDomain}`;
  const triedUrls: string[] = [];
  const statusCodes = new Map<string, number>();

  // Check for wiki-specific patterns first
  const wikiPrefix = getWikiPrefix(canonicalDomain);
  const specificPatterns = WIKI_SPECIFIC_URL_PATTERNS[wikiPrefix];

  if (specificPatterns && specificPatterns.length > 0) {
    logger.debug(`Trying wiki-specific patterns for ${wikiPrefix}: ${specificPatterns.join(', ')}`);
    const specificResult = await probeSpecificPatternsViaApi(canonicalDomain, baseUrl, specificPatterns, mergedConfig.userAgent, triedUrls, statusCodes);
    if (specificResult) {
      logger.info(`Found chapter/volume URL via wiki-specific pattern (API) for ${domain}: ${specificResult.url}`);
      return buildSuccessResult(specificResult, canonicalDomain, triedUrls, statusCodes, startTime);
    }
  }

  // Build list of generic URLs to probe
  const urlsToProbe = URL_PROBE_PATTERNS.map((pattern) => `${baseUrl}${pattern}`);

  // Probe URLs in batches for efficiency - early return on first success
  for (let i = 0; i < urlsToProbe.length; i += mergedConfig.maxConcurrentProbes) {
    const batch = urlsToProbe.slice(i, i + mergedConfig.maxConcurrentProbes);
    // eslint-disable-next-line no-await-in-loop -- Intentional: rate-limited sequential batches with early return
    const successResult = await probeBatch(batch, mergedConfig, triedUrls, statusCodes);

    if (successResult) {
      logger.info(`Found chapter/volume URL for ${domain}: ${successResult.redirectedTo ?? successResult.url}`);
      return buildSuccessResult(successResult, canonicalDomain, triedUrls, statusCodes, startTime);
    }
  }

  // No URL found
  logger.warn(`No chapter/volume URL found for ${domain} after probing ${triedUrls.length} URLs`);

  return {
    foundUrl: null,
    triedUrls,
    statusCodes,
    canonicalDomain,
    durationMs: Date.now() - startTime,
  };
}

/**
 * Discovers URL for a specific wiki page pattern (not just chapters/volumes).
 * Useful for finding alternative page structures.
 *
 * @param domain - The wiki domain
 * @param patterns - Custom URL patterns to probe
 * @param config - Configuration options
 * @returns Discovery result
 */
export async function discoverCustomUrl(
  domain: string,
  patterns: readonly string[],
  config: Partial<UrlDiscoveryConfig> = {}
): Promise<UrlDiscoveryResult> {
  const mergedConfig = { ...DEFAULT_URL_DISCOVERY_CONFIG, ...config };
  const startTime = Date.now();

  const canonicalDomain = resolveKnownRedirect(domain);
  const baseUrl = `https://${canonicalDomain}`;
  const triedUrls: string[] = [];
  const statusCodes = new Map<string, number>();

  for (const pattern of patterns) {
    const url = `${baseUrl}${pattern}`;
    // eslint-disable-next-line no-await-in-loop -- Intentional: sequential probing with early return on success
    const result = await probeUrl(url, mergedConfig);
    triedUrls.push(url);
    statusCodes.set(url, result.statusCode);

    if (result.exists) {
      return buildSuccessResult(result, canonicalDomain, triedUrls, statusCodes, startTime);
    }
  }

  return {
    foundUrl: null,
    triedUrls,
    statusCodes,
    canonicalDomain,
    durationMs: Date.now() - startTime,
  };
}

/**
 * Extracts domain from a full Fandom URL.
 *
 * @param url - Full URL (e.g., "https://mob-psycho-100.fandom.com/wiki/Chapters")
 * @returns Domain (e.g., "mob-psycho-100.fandom.com")
 */
export function extractDomainFromUrl(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.hostname;
  } catch {
    // Try to extract domain from malformed URL
    const match = url.match(/https?:\/\/([^/]+)/);
    return match?.[1] ?? '';
  }
}

/**
 * Checks if a domain is a known Fandom wiki.
 *
 * @param domain - Domain to check
 * @returns true if it's a Fandom wiki
 */
export function isFandomDomain(domain: string): boolean {
  return domain.endsWith('.fandom.com') || domain.endsWith('.wikia.com');
}

// ============================================================================
// Best-Scoring Discovery with Extraction
// ============================================================================

/**
 * Enhanced URL discovery that scores content quality.
 * Probes multiple URLs and returns the one with the highest content score.
 *
 * @param domain - The wiki domain
 * @param config - Configuration options
 * @returns Discovery result with the best-scoring URL
 */
// eslint-disable-next-line complexity, max-statements -- URL discovery orchestration with multiple stages: probe candidates, score content, select best; sequential API calls required for rate limiting
export async function discoverBestChapterVolumeUrl(
  domain: string,
  config: Partial<UrlDiscoveryConfig> = {}
): Promise<UrlDiscoveryResult & { contentScore?: UrlContentScore }> {
  const mergedConfig = { ...DEFAULT_URL_DISCOVERY_CONFIG, ...config };
  const startTime = Date.now();

  const canonicalDomain = resolveKnownRedirect(domain);
  const baseUrl = `https://${canonicalDomain}`;
  const triedUrls: string[] = [];
  const statusCodes = new Map<string, number>();

  // Collect all candidate URLs
  const wikiPrefix = getWikiPrefix(canonicalDomain);
  const specificPatterns = WIKI_SPECIFIC_URL_PATTERNS[wikiPrefix] ?? [];
  const allPatterns = [...specificPatterns, ...URL_PROBE_PATTERNS];

  // Remove duplicates using normalized URL comparison (handles trailing slashes, case, etc.)
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

  // Probe all URLs to find existing ones (HEAD requests for efficiency)
  const existingUrls: string[] = [];
  for (const url of candidateUrls) {
    // eslint-disable-next-line no-await-in-loop -- Sequential probing for rate limiting
    const result = await probeUrl(url, mergedConfig);
    triedUrls.push(url);
    statusCodes.set(url, result.statusCode);

    if (result.exists) {
      existingUrls.push(result.redirectedTo ?? result.url);
    }

    // Early exit if we found several candidates (limit API calls)
    // Increased from 5 to 8 to catch better candidates that might be later in pattern list
    if (existingUrls.length >= 8) break;
  }

  // API fallback: HEAD probes often fail on Fandom due to Cloudflare blocking.
  // Re-check wiki-specific patterns via MediaWiki API if HEAD found nothing.
  if (existingUrls.length === 0) {
    for (const pattern of specificPatterns.slice(0, 3)) {
      const pageTitle = decodeURIComponent(pattern.replace('/wiki/', ''));
      try {
        const apiUrl = `https://${canonicalDomain}/api.php?action=query&titles=${encodeURIComponent(pageTitle)}&format=json`;
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);
        // eslint-disable-next-line no-await-in-loop -- Sequential API probing with early return
        const resp = await fetch(apiUrl, {
          signal: controller.signal,
          headers: { 'User-Agent': 'MugiwaraKaizoku/1.0 (manga-metadata-fetcher)' },
        });
        clearTimeout(timeout);
        if (!resp.ok) continue;
        // eslint-disable-next-line no-await-in-loop -- paired with the fetch on line 426 inside the same probe; both are part of one sequential API check
        const data = (await resp.json()) as { query?: { pages?: Record<string, { missing?: string }> } };
        const pages = data.query?.pages ?? {};
        const pageExists = !Object.values(pages).some(p => p.missing !== undefined);
        if (pageExists) {
          const url = `${baseUrl}${pattern}`;
          existingUrls.push(url);
          statusCodes.set(url, 200);
          logger.info(`[discoverBestChapterVolumeUrl] API fallback found: ${url}`);
          break;
        }
      } catch { /* skip */ }
    }
  }

  // Novel alias discovery: when standard patterns find nothing, use MediaWiki search
  // to discover pages with non-standard terminology (e.g., "Lessons_and_Volumes")
  if (existingUrls.length === 0) {
    const { discoverNovelPageNames } = await import('./url-discoverer/novel-alias-discovery');
    const novelResult = await discoverNovelPageNames(canonicalDomain, mergedConfig.probeTimeoutMs, triedUrls);
    for (const url of novelResult.candidateUrls) {
      existingUrls.push(url);
      statusCodes.set(url, 200); // API-validated pages exist
    }
    if (novelResult.candidateUrls.length > 0) {
      logger.info(`[discoverBestChapterVolumeUrl] Novel alias discovery found ${novelResult.candidateUrls.length} candidates`, {
        domain,
        apiCalls: novelResult.apiCallCount,
        durationMs: novelResult.durationMs,
      });
    }
  }

  if (existingUrls.length === 0) {
    logger.warn(`No chapter/volume URL found for ${domain}`);
    return {
      foundUrl: null,
      triedUrls,
      statusCodes,
      canonicalDomain,
      durationMs: Date.now() - startTime,
    };
  }

  // If only one URL exists, use it without scoring
  if (existingUrls.length === 1) {
    logger.info(`Found single chapter/volume URL for ${domain}: ${existingUrls[0]}`);
    return {
      foundUrl: existingUrls[0] ?? null,
      triedUrls,
      statusCodes,
      canonicalDomain,
      durationMs: Date.now() - startTime,
    };
  }

  // Score multiple URLs to find the best one
  logger.debug(`Scoring ${existingUrls.length} candidate URLs for ${domain}`);
  const scores: UrlContentScore[] = [];

  for (const url of existingUrls) {
    // eslint-disable-next-line no-await-in-loop -- Sequential fetching for rate limiting
    const html = await fetchHtmlContent(url, mergedConfig.probeTimeoutMs * 2, mergedConfig.userAgent);
    if (html) {
      const score = scorePageContent(html, url);
      scores.push(score);
      logger.debug(`[url-scorer] ${url}: score=${score.score}, chapters=${score.chapterIndicators}, volumes=${score.volumeIndicators}`);
    }
  }

  if (scores.length === 0) {
    // Fall back to first existing URL if scoring failed
    return {
      foundUrl: existingUrls[0] ?? null,
      triedUrls,
      statusCodes,
      canonicalDomain,
      durationMs: Date.now() - startTime,
    };
  }

  // Sort by pattern score descending
  const sortedScores = [...scores].sort((a, b) => b.score - a.score);
  const topByPattern = sortedScores.slice(0, 5);

  // Always run extraction scoring when multiple candidates exist.
  // Pattern scoring can be fooled by hub/disambiguation pages that mention
  // chapters without actually listing them (e.g., bleach.fandom.com/wiki/Chapters).
  const needsExtraction = topByPattern.length > 1;

  if (needsExtraction) {
    logger.debug(`[discoverBestChapterVolumeUrl] Running extraction scoring`, {
      domain,
      topScores: topByPattern.slice(0, 3).map((s) => ({ url: s.url, score: s.score })),
    });

    const extractionScores = await scoreByExtraction(
      topByPattern.map((s) => s.url),
      { probeTimeoutMs: mergedConfig.probeTimeoutMs, userAgent: mergedConfig.userAgent },
      baseUrl
    );

    // Boost wiki-specific URLs in extraction scoring — these are manually curated patterns
    // that should be preferred over generic pages (e.g., Tokyo_Ghoul_(manga) over Story_Arcs)
    for (const score of extractionScores) {
      const urlPath = score.url.replace(`https://${canonicalDomain}`, '');
      if (specificPatterns.includes(urlPath)) {
        score.completenessScore += 200;
        logger.debug(`[discoverBestChapterVolumeUrl] Boosted wiki-specific URL: ${urlPath} (+200)`);
      }
    }
    extractionScores.sort((a, b) => b.completenessScore - a.completenessScore);

    // Use extraction score winner if it found substantial data
    if (extractionScores.length > 0 && extractionScores[0] && extractionScores[0].completenessScore > 0) {
      const bestExtraction = selectBestExtraction(extractionScores);
      const bestPatternScore = sortedScores.find((s) => s.url === bestExtraction.url);

      logger.info(`[discoverBestChapterVolumeUrl] Selected URL by extraction score`, {
        url: bestExtraction.url,
        completenessScore: bestExtraction.completenessScore,
        chapterCount: bestExtraction.chapterCount,
      });

      const result: UrlDiscoveryResult & { contentScore?: UrlContentScore } = {
        foundUrl: bestExtraction.url,
        triedUrls,
        statusCodes,
        canonicalDomain,
        durationMs: Date.now() - startTime,
      };
      if (bestPatternScore) {
        result.contentScore = bestPatternScore;
      }
      return result;
    }
  }

  // Return the highest pattern-scoring URL (fallback or when no extraction needed)
  const bestScore = sortedScores[0];
  if (!bestScore) {
    return {
      foundUrl: existingUrls[0] ?? null,
      triedUrls,
      statusCodes,
      canonicalDomain,
      durationMs: Date.now() - startTime,
    };
  }

  logger.info(`Best URL for ${domain}: ${bestScore.url} (score: ${bestScore.score})`);

  return {
    foundUrl: bestScore.url,
    triedUrls,
    statusCodes,
    canonicalDomain,
    durationMs: Date.now() - startTime,
    contentScore: bestScore,
  };
}
