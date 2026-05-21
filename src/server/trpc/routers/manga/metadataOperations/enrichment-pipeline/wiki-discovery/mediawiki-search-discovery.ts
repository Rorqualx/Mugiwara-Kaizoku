/**
 * MediaWiki API Search Discovery
 *
 * Searches multiple Fandom catalog wikis via MediaWiki API to discover
 * the correct Fandom domain for a manga title. This bypasses Cloudflare
 * (which blocks the CrossWiki REST API) by using the MediaWiki API endpoint.
 *
 * Strategy:
 * 1. Search catalog wikis (animanga.fandom.com, manga.fandom.com) for the title
 * 2. For each search result, check if the page links to a dedicated wiki
 * 3. Also try direct domain probing of slugs derived from search result titles
 */

import { logParseFailure } from '@/server/services/metadata/parse-failure-logger';
import { logger } from '@/utils/logger';

const log = logger.child('MediaWikiSearchDiscovery');

const USER_AGENT = 'MugiwaraKaizoku/1.0 (manga-metadata-fetcher)';
const REQUEST_TIMEOUT = 8000;

/** Catalog wikis to search for manga entries */
const CATALOG_WIKIS = ['animanga.fandom.com', 'manga.fandom.com'];

/** Domains to skip — catalog/community wikis, not individual manga wikis */
const SKIP_DOMAINS = new Set(['community', 'animanga', 'manga', 'anime']);

interface SearchResult {
  title: string;
  pageid: number;
  snippet?: string;
}

/**
 * Search Fandom catalog wikis via MediaWiki API for a manga title.
 * Returns the discovered Fandom domain URL or null.
 */
export async function discoverViaMediaWikiSearch(
  title: string,
  englishTitle?: string,
): Promise<string | null> {
  const queries = [title];
  if (englishTitle && englishTitle !== title) {
    queries.push(englishTitle);
  }

  for (const query of queries) {
    for (const wiki of CATALOG_WIKIS) {
      try {
        // eslint-disable-next-line no-await-in-loop -- Sequential with early return
        const result = await searchAndExtractDomain(wiki, query);
        if (result) return result;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        log.debug(`MediaWiki search failed on ${wiki}`, { error: msg });
        void logParseFailure({
          source: 'fandom',
          stage: 'mediawiki-search-discovery.searchAndExtractDomain',
          url: `https://${wiki}/api.php`,
          reason: msg,
          context: { wiki, query },
        });
      }
    }
  }

  return null;
}

/** Search a wiki and try to extract a Fandom domain from linked pages or derived slugs */
async function searchAndExtractDomain(
  wiki: string,
  query: string,
): Promise<string | null> {
  const results = await fetchSearchResults(wiki, query);
  if (results.length === 0) return null;

  // For each result, try to extract linked Fandom domains. Note: animanga's
  // search is fuzzy — sometimes returns alt-title pages (legit) and sometimes
  // returns loosely-related pages (false). We can't gate via token-overlap
  // alone (would block "Fighting Spirit" → Hajime no Ippo binding), so we
  // rely on downstream sitename + page-existence validators to filter.
  for (const sr of results.slice(0, 3)) {
    // eslint-disable-next-line no-await-in-loop -- Sequential with early return
    const domain = await extractLinkedFandomDomain(wiki, sr.title);
    if (domain) {
      log.info(`MediaWiki search: ${wiki} → "${sr.title}" → ${domain}`);
      return `https://${domain}.fandom.com`;
    }
  }

  // Fallback: derive slug from best search result and probe
  return tryDerivedSlug(results[0]?.title, wiki);
}

/** Fetch MediaWiki search results from a catalog wiki */
async function fetchSearchResults(wiki: string, query: string): Promise<SearchResult[]> {
  const searchUrl = `https://${wiki}/api.php?action=query&list=search` +
    `&srsearch=${encodeURIComponent(query)}&srlimit=5&format=json`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

  const response = await fetch(searchUrl, {
    signal: controller.signal,
    headers: { 'User-Agent': USER_AGENT },
  });
  clearTimeout(timeout);

  if (!response.ok) return [];

  const data = await response.json() as {
    query?: { search?: SearchResult[] };
  };
  return data.query?.search ?? [];
}

/** Extract Fandom domains from interwiki and external links on a wiki page */
async function extractLinkedFandomDomain(
  wiki: string,
  pageTitle: string,
): Promise<string | null> {
  const { iwlinks, externallinks } = await fetchPageLinks(wiki, pageTitle);

  const iwDomain = await findConfirmedDomainInLinks(
    iwlinks.map(link => link.url),
  );
  if (iwDomain) return iwDomain;

  return findConfirmedDomainInLinks(externallinks);
}

/** Fetch interwiki + external links from a wiki page */
async function fetchPageLinks(
  wiki: string,
  pageTitle: string,
): Promise<{ iwlinks: Array<{ url: string }>; externallinks: string[] }> {
  const url = `https://${wiki}/api.php?action=parse&page=${encodeURIComponent(pageTitle)}` +
    `&prop=iwlinks|externallinks&format=json`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

  const response = await fetch(url, {
    signal: controller.signal,
    headers: { 'User-Agent': USER_AGENT },
  });
  clearTimeout(timeout);

  if (!response.ok) return { iwlinks: [], externallinks: [] };

  const data = await response.json() as {
    parse?: {
      iwlinks?: Array<{ url: string }>;
      externallinks?: string[];
    };
  };

  return {
    iwlinks: data.parse?.iwlinks ?? [],
    externallinks: data.parse?.externallinks ?? [],
  };
}

/** Find the first confirmed Fandom domain in a list of URLs */
async function findConfirmedDomainInLinks(urls: string[]): Promise<string | null> {
  for (const url of urls) {
    const domain = extractFandomSubdomain(url);
    if (!domain || SKIP_DOMAINS.has(domain)) continue;
    // eslint-disable-next-line no-await-in-loop -- Sequential probing with early return
    const confirmed = await probeDomainExists(domain);
    if (confirmed) return domain;
  }
  return null;
}

/** Try deriving a domain slug from a search result title and probing it */
async function tryDerivedSlug(
  pageTitle: string | undefined,
  wiki: string,
): Promise<string | null> {
  if (!pageTitle) return null;

  const slug = deriveDomainSlug(pageTitle);
  if (!slug || SKIP_DOMAINS.has(slug)) return null;

  const exists = await probeDomainExists(slug);
  if (!exists) return null;

  const hasContent = await probeHasChapterContent(slug);
  if (!hasContent) return null;

  log.info(`MediaWiki search: derived slug "${slug}" from "${pageTitle}" on ${wiki}`);
  return `https://${slug}.fandom.com`;
}

/** Extract the subdomain from a Fandom URL */
function extractFandomSubdomain(url: string): string | null {
  const match = url.match(/https?:\/\/([^.]+)\.fandom\.com/);
  return match?.[1] ?? null;
}

/** Derive a likely Fandom domain slug from a wiki page title */
function deriveDomainSlug(pageTitle: string): string | null {
  const cleaned = pageTitle
    .replace(/\s*\((?:manga|anime|series|franchise)\)/i, '')
    .trim();

  if (!cleaned) return null;

  return cleaned
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

/** Probe whether a Fandom domain exists via siteinfo API */
async function probeDomainExists(slug: string): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const response = await fetch(
      `https://${slug}.fandom.com/api.php?action=query&meta=siteinfo&format=json`,
      { signal: controller.signal, headers: { 'User-Agent': USER_AGENT } },
    );
    clearTimeout(timeout);
    return response.ok;
  } catch {
    return false;
  }
}

/** Check if a wiki has chapter/volume content */
async function probeHasChapterContent(slug: string): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const response = await fetch(
      `https://${slug}.fandom.com/api.php?action=query&list=search&srsearch=Chapter&srlimit=3&format=json`,
      { signal: controller.signal, headers: { 'User-Agent': USER_AGENT } },
    );
    clearTimeout(timeout);

    if (!response.ok) return false;
    const data = await response.json() as { query?: { search?: Array<{ title: string }> } };
    const results = data.query?.search ?? [];
    return results.some(r => /chapter|volume|episode/i.test(r.title));
  } catch {
    return false;
  }
}

