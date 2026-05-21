/**
 * Fandom Discovery Provider Wrapper
 *
 * Wraps the project's Fandom URL discoverer for use in the CSV discovery tool.
 * Uses domain lookup from existing CSV data when available.
 *
 * @module url-discovery/discover-fandom
 */

import {
  discoverBestChapterVolumeUrl,
  extractDomainFromUrl,
  isFandomDomain,
} from '../../src/server/services/fandom/adaptive/url-discoverer';
import { FandomProvider } from '../../src/server/services/search/providers/FandomProvider';

/**
 * Result of Fandom URL discovery.
 */
export interface FandomDiscoveryResult {
  /** The discovered URL (chapter/volume page) */
  url: string | null;
  /** The Fandom domain used */
  domain: string | null;
  /** Time taken for discovery in milliseconds */
  timing: number;
  /** Error message if discovery failed */
  error?: string;
  /** Content score if scoring was performed */
  contentScore?: number;
}

/**
 * Normalize a title for Fandom subdomain generation.
 */
function titleToSubdomain(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/['']/g, '')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Generate potential Fandom domains for a title.
 */
function generateFandomDomains(title: string): string[] {
  const domains: string[] = [];

  // Full title as subdomain
  const fullSubdomain = titleToSubdomain(title);
  if (fullSubdomain) {
    domains.push(`${fullSubdomain}.fandom.com`);
  }

  // First word as subdomain (for titles like "One Piece")
  const firstWord = title.split(/\s+/)[0];
  if (firstWord) {
    const firstWordSubdomain = titleToSubdomain(firstWord);
    if (firstWordSubdomain && firstWordSubdomain !== fullSubdomain) {
      domains.push(`${firstWordSubdomain}.fandom.com`);
    }
  }

  // Common wiki domains for manga
  domains.push('manga.fandom.com', 'webtoon.fandom.com');

  return domains;
}

/**
 * Normalize title for lookup.
 */
function normalizeTitleForLookup(title: string): string {
  return title.toLowerCase().trim().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ');
}

/**
 * Discover URL from a known domain.
 */
async function discoverFromKnownDomain(
  domain: string,
  start: number,
  timeoutMs: number
): Promise<FandomDiscoveryResult> {
  const result = await discoverBestChapterVolumeUrl(domain, { probeTimeoutMs: timeoutMs });
  return {
    url: result.foundUrl,
    domain,
    timing: Date.now() - start,
    contentScore: result.contentScore?.score,
  };
}

/**
 * Process search result and discover chapter/volume URL.
 */
async function processSearchResult(url: string, start: number): Promise<FandomDiscoveryResult> {
  const domain = extractDomainFromUrl(url);

  if (!domain || !isFandomDomain(domain)) {
    return { url, domain, timing: Date.now() - start };
  }

  const discovery = await discoverBestChapterVolumeUrl(domain, { probeTimeoutMs: 5000 });
  return {
    url: discovery.foundUrl ?? url,
    domain,
    timing: Date.now() - start,
    contentScore: discovery.contentScore?.score,
  };
}

/**
 * Discover URL via FandomProvider.search().
 */
async function discoverViaSearch(title: string, start: number): Promise<FandomDiscoveryResult> {
  try {
    const provider = new FandomProvider();
    const results = await provider.search(title, { limit: 1 });
    const firstResult = results[0];

    if (firstResult?.url) {
      return processSearchResult(firstResult.url, start);
    }
  } catch {
    // Search failed, will try domain probing
  }

  return { url: null, domain: null, timing: Date.now() - start };
}

/**
 * Try a single domain for chapter/volume URL.
 */
async function tryDomainDiscovery(
  domain: string,
  timeoutMs: number
): Promise<FandomDiscoveryResult | null> {
  try {
    const result = await discoverBestChapterVolumeUrl(domain, { probeTimeoutMs: timeoutMs });
    if (result.foundUrl) {
      return {
        url: result.foundUrl,
        domain: result.canonicalDomain,
        timing: 0, // Will be set by caller
        contentScore: result.contentScore?.score,
      };
    }
  } catch {
    // Domain probe failed
  }
  return null;
}

/**
 * Discover URL by probing potential domains.
 */
async function discoverViaDomainProbing(
  title: string,
  start: number,
  timeoutMs: number
): Promise<FandomDiscoveryResult> {
  const domains = generateFandomDomains(title);

  for (const domain of domains) {
    const result = await tryDomainDiscovery(domain, timeoutMs);
    if (result) {
      return { ...result, timing: Date.now() - start };
    }
  }

  return { url: null, domain: null, timing: Date.now() - start };
}

/**
 * Discover Fandom URL for a manga title.
 *
 * Strategy:
 * 1. If domain is provided (from lookup), use it directly
 * 2. Otherwise, try the FandomProvider.search() method
 * 3. Fall back to generating potential domains and probing
 *
 * @param title - The manga title to search for
 * @param domainLookup - Optional map of title -> domain from existing data
 * @param timeoutMs - Optional timeout in milliseconds (default: 10000)
 * @returns Discovery result with URL, domain, and timing
 */
export async function discoverFandom(
  title: string,
  domainLookup?: Map<string, string>,
  timeoutMs = 10000
): Promise<FandomDiscoveryResult> {
  const start = Date.now();

  try {
    // Check lookup first (from authoritative CSV)
    const normalizedTitle = normalizeTitleForLookup(title);
    const knownDomain = domainLookup?.get(normalizedTitle);

    if (knownDomain) {
      return discoverFromKnownDomain(knownDomain, start, timeoutMs);
    }

    // Try FandomProvider.search() for auto-discovery
    const searchResult = await discoverViaSearch(title, start);
    if (searchResult.url) {
      return searchResult;
    }

    // Fall back to domain probing
    return discoverViaDomainProbing(title, start, timeoutMs);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return { url: null, domain: null, timing: Date.now() - start, error: errorMessage };
  }
}

/**
 * Check if a URL is a valid Fandom URL.
 */
export function isValidFandomUrl(url: string): boolean {
  return url.includes('.fandom.com/') || url.includes('.wikia.com/');
}

export { extractDomainFromUrl };
