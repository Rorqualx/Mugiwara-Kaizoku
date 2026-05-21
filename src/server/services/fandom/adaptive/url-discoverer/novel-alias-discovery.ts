/**
 * Novel Alias Discovery — MediaWiki API-based page name discovery
 *
 * Automatically discovers chapter/volume listing pages that use non-standard
 * terminology (e.g., "Lessons_and_Volumes" for Gintama, "Rounds" for Ippo).
 *
 * Strategy:
 * 1. Title-focused search using naming convention terms from naming-conventions.ts
 * 2. Series-specific search using title derived from wiki domain
 * 3. Allpages prefix scan for "List_of_" pages (optional fallback)
 *
 * Called as fallback in discoverBestChapterVolumeUrl when generic URL_PROBE_PATTERNS
 * don't find existing pages. Results feed into the existing scoring pipeline.
 *
 * @module url-discoverer/novel-alias-discovery
 */

import { NAMING_CONVENTIONS, CHAPTER_CONVENTION } from '@/server/parsers/patterns/naming-conventions';
import { logger } from '@/utils/logger';

const USER_AGENT = 'MugiwaraKaizoku/1.0 (manga-metadata-fetcher)';
const FANDOM_DOMAIN_RE = /^[\w-]+\.fandom\.com$/;

/** Result from novel alias discovery */
export interface NovelAliasDiscoveryResult {
  candidateUrls: string[];
  apiCallCount: number;
  durationMs: number;
}

interface MediaWikiSearchResult {
  title: string;
  size: number;
}

interface MediaWikiSearchResponse {
  query?: {
    search?: MediaWikiSearchResult[];
  };
}

interface MediaWikiAllpagesResponse {
  query?: {
    allpages?: Array<{ title: string }>;
  };
}

// Page names that are clearly NOT chapter/volume listing pages
const NON_LISTING_RE = /^(Chapter|Lesson|Round|Mission|Episode|Act|File|Case|Stage)\s+\d/i;
const EXCLUDED_PAGE_RE = /(Gallery|Trivia|Character|Image|Template|User|Talk|Forum|Blog|Quiz)/i;

// Keywords that indicate a page is a chapter/volume listing
const LISTING_KEYWORDS_RE = /(?:chapter|volume|lesson|round|mission|episode|act|stage|track|night|curse|spell|log|record|tale|manga[_ ]guide|release|tanko|media|publication)/i;

/**
 * Build the MediaWiki intitle: search query from naming conventions.
 * Returns terms like "intitle:chapters OR intitle:volumes OR intitle:lessons OR ..."
 */
function buildTitleSearchTerms(): string[] {
  const terms = new Set<string>();

  // Standard terms
  terms.add('chapters');
  terms.add('volumes');

  // From naming conventions — plural form of each display name
  for (const conv of NAMING_CONVENTIONS) {
    const name = conv.displayName.toLowerCase();
    if (name === 'numberedtitle') continue; // Skip — not a useful search term
    terms.add(name + 's'); // Plural: Lesson → Lessons, Round → Rounds
  }
  // From CHAPTER_CONVENTION
  terms.add(CHAPTER_CONVENTION.displayName.toLowerCase() + 's');

  // Extra terms from URL_PROBE_PATTERNS not covered by naming conventions
  terms.add('manga');
  terms.add('releases');

  return [...terms];
}

/** Cached search terms (built once at module load) */
const SEARCH_TERMS = buildTitleSearchTerms();

/**
 * Infer the manga series title from the wiki domain.
 * e.g., "gintama.fandom.com" → "Gintama"
 *       "mob-psycho-100.fandom.com" → "Mob Psycho 100"
 */
function inferTitleFromDomain(domain: string): string {
  const subdomain = domain.replace(/\.fandom\.com$/, '').replace(/\.wikia\.com$/, '');
  return subdomain
    .split('-')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

/**
 * Fetch search results from MediaWiki API.
 */
async function fetchSearchResults(
  domain: string,
  query: string,
  limit: number,
  timeoutMs: number,
): Promise<MediaWikiSearchResult[]> {
  if (!FANDOM_DOMAIN_RE.test(domain)) return [];

  const apiUrl = `https://${domain}/api.php?action=query&list=search` +
    `&srsearch=${encodeURIComponent(query)}` +
    `&srnamespace=0&srlimit=${limit}&format=json`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    const resp = await fetch(apiUrl, {
      signal: controller.signal,
      headers: { 'User-Agent': USER_AGENT },
    });
    clearTimeout(timeout);
    if (!resp.ok) return [];
    const data = (await resp.json()) as MediaWikiSearchResponse;
    return data.query?.search ?? [];
  } catch {
    return [];
  }
}

/**
 * Fetch allpages results with a prefix from MediaWiki API.
 */
async function fetchAllpagesWithPrefix(
  domain: string,
  prefix: string,
  timeoutMs: number,
): Promise<string[]> {
  if (!FANDOM_DOMAIN_RE.test(domain)) return [];

  const apiUrl = `https://${domain}/api.php?action=query&list=allpages` +
    `&apprefix=${encodeURIComponent(prefix)}` +
    `&aplimit=30&apnamespace=0&format=json`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    const resp = await fetch(apiUrl, {
      signal: controller.signal,
      headers: { 'User-Agent': USER_AGENT },
    });
    clearTimeout(timeout);
    if (!resp.ok) return [];
    const data = (await resp.json()) as MediaWikiAllpagesResponse;
    return (data.query?.allpages ?? []).map(p => p.title);
  } catch {
    return [];
  }
}

/**
 * Filter search results to only listing-level pages (not individual chapters).
 */
function filterToListingPages(results: MediaWikiSearchResult[]): string[] {
  return results
    .filter(r => {
      const title = r.title;
      // Exclude individual chapter pages ("Chapter 1", "Lesson 42")
      if (NON_LISTING_RE.test(title)) return false;
      // Exclude non-content pages
      if (EXCLUDED_PAGE_RE.test(title)) return false;
      // Must contain a listing keyword
      if (!LISTING_KEYWORDS_RE.test(title)) return false;
      // Must be reasonably sized (> 5KB suggests actual content, not stubs)
      if (r.size < 5000) return false;
      return true;
    })
    .map(r => r.title);
}

/**
 * Discover novel chapter/volume listing page names using MediaWiki APIs.
 *
 * Uses 2-3 API calls to find pages that use non-standard terminology
 * for chapter listings (e.g., "Lessons_and_Volumes" instead of "Chapters").
 *
 * @param domain - Fandom wiki domain (e.g., "gintama.fandom.com")
 * @param timeoutMs - Per-request timeout in milliseconds
 * @param alreadyTriedUrls - URLs already probed (for deduplication)
 * @returns Candidate URLs to feed into the existing scoring pipeline
 */
export async function discoverNovelPageNames(
  domain: string,
  timeoutMs: number,
  alreadyTriedUrls: string[] = [],
): Promise<NovelAliasDiscoveryResult> {
  const startTime = Date.now();
  let apiCallCount = 0;
  const candidates = new Set<string>();
  const baseUrl = `https://${domain}`;

  // Build dedup set from already-tried URLs
  const triedPaths = new Set(
    alreadyTriedUrls.map(u => {
      try { return new URL(u).pathname; } catch { return u; }
    })
  );

  const addCandidate = (title: string): void => {
    const path = `/wiki/${title.replace(/ /g, '_')}`;
    if (!triedPaths.has(path)) {
      candidates.add(`${baseUrl}${path}`);
    }
  };

  // Call 1: Title-focused search — find pages with listing keywords in title
  const intitleQuery = SEARCH_TERMS.map(t => `intitle:${t}`).join(' OR ');
  const searchResults1 = await fetchSearchResults(domain, intitleQuery, 10, timeoutMs);
  apiCallCount++;
  for (const title of filterToListingPages(searchResults1)) {
    addCandidate(title);
  }

  // Call 2: Series-specific search — find "List_of_{Title}_chapters" style pages
  const seriesTitle = inferTitleFromDomain(domain);
  const seriesQuery = `"${seriesTitle}" chapters OR volumes OR manga`;
  const searchResults2 = await fetchSearchResults(domain, seriesQuery, 5, timeoutMs);
  apiCallCount++;
  for (const title of filterToListingPages(searchResults2)) {
    addCandidate(title);
  }

  // Call 3 (optional): Allpages with "List of " prefix — catches "List_of_X_Lessons"
  if (candidates.size < 2) {
    const allpagesResults = await fetchAllpagesWithPrefix(domain, 'List of ', timeoutMs);
    apiCallCount++;
    for (const title of allpagesResults) {
      if (LISTING_KEYWORDS_RE.test(title) && !EXCLUDED_PAGE_RE.test(title)) {
        addCandidate(title);
      }
    }
  }

  const result = {
    candidateUrls: [...candidates],
    apiCallCount,
    durationMs: Date.now() - startTime,
  };

  if (result.candidateUrls.length > 0) {
    logger.info(`[novelAliasDiscovery] Found ${result.candidateUrls.length} novel candidates for ${domain}`, {
      candidates: result.candidateUrls,
      apiCalls: apiCallCount,
      durationMs: result.durationMs,
    });
  }

  return result;
}
