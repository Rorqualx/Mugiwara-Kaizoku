/**
 * Interwiki Discovery via Catalog Wikis
 *
 * Discovers non-obvious Fandom wiki domains by searching catalog wikis
 * (animanga.fandom.com, manga.fandom.com) and following interwiki links.
 *
 * Example: "Monster" → animanga.fandom.com page → interwiki link `w:c:Obluda`
 *          → resolves to obluda.fandom.com
 */

import axios from 'axios';

import { logParseFailure } from '@/server/services/metadata/parse-failure-logger';
import { logger } from '@/utils/logger';

const log = logger.child('InterwikiDiscovery');

const USER_AGENT = 'MugiwaraKaizoku/1.0 (manga-metadata-fetcher)';
const REQUEST_TIMEOUT = 8000;
const CATALOG_WIKIS = ['animanga.fandom.com', 'manga.fandom.com'];
const EXCLUDED_WIKIS = new Set(['community', 'animanga', 'manga']);

interface MediaWikiSearchResult {
  title: string;
  pageid: number;
}

interface InterwikiLink {
  prefix: string;
  url: string;
  '*': string;
}

/**
 * Discover a Fandom wiki URL via interwiki links on catalog wikis.
 *
 * Searches animanga.fandom.com (and manga.fandom.com as fallback) for the
 * manga title, then parses interwiki links (`w:c:WikiName`) from the result
 * page to find dedicated wiki domains.
 */
export async function discoverViaInterwikiLinks(title: string): Promise<string | null> {
  for (const catalog of CATALOG_WIKIS) {
    // eslint-disable-next-line no-await-in-loop -- Sequential catalog fallback with early return
    const result = await searchCatalogWiki(catalog, title);
    if (result) return result;
  }
  return null;
}

/** Search a catalog wiki and extract interwiki links from the best match */
async function searchCatalogWiki(catalog: string, title: string): Promise<string | null> {
  try {
    const searchResults = await searchMediaWiki(catalog, title);
    if (searchResults.length === 0) return null;

    // Try up to 3 search results. Note: animanga's full-text search is fuzzy
    // and sometimes returns loosely-related pages (e.g. "Dragon Ball Super"
    // can match "Cartoon Network"), but it also legitimately returns alternate
    // English titles (e.g. "Hajime no Ippo" matches "Fighting Spirit"). We
    // can't distinguish these via token-overlap alone, so we let all 3 through
    // and rely on the downstream page-existence + sitename validators.
    for (const sr of searchResults.slice(0, 3)) {
      // eslint-disable-next-line no-await-in-loop -- Sequential with early return
      const wikiUrl = await extractInterwikiTarget(catalog, sr.title);
      if (wikiUrl) return wikiUrl;
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log.warn(`Catalog search failed on ${catalog}: ${msg}`);
    void logParseFailure({
      source: 'fandom',
      stage: 'interwiki-discovery.searchCatalogWiki',
      url: `https://${catalog}/api.php`,
      reason: msg,
      context: { catalog, title },
    });
  }
  return null;
}

/** Search MediaWiki API for pages matching a title */
async function searchMediaWiki(wiki: string, query: string): Promise<MediaWikiSearchResult[]> {
  const response = await axios.get<{
    query?: { search?: MediaWikiSearchResult[] };
  }>(`https://${wiki}/api.php`, {
    params: {
      action: 'query',
      list: 'search',
      srsearch: query,
      srlimit: 3,
      format: 'json',
    },
    headers: { 'User-Agent': USER_AGENT },
    timeout: REQUEST_TIMEOUT,
  });
  return response.data.query?.search ?? [];
}

/** Fetch interwiki links from a page and find the first valid Fandom wiki */
async function extractInterwikiTarget(catalog: string, pageTitle: string): Promise<string | null> {
  const response = await axios.get<{
    parse?: { iwlinks?: InterwikiLink[] };
  }>(`https://${catalog}/api.php`, {
    params: {
      action: 'parse',
      page: pageTitle,
      prop: 'iwlinks',
      format: 'json',
    },
    headers: { 'User-Agent': USER_AGENT },
    timeout: REQUEST_TIMEOUT,
  });

  const iwlinks = response.data.parse?.iwlinks;
  if (!iwlinks?.length) return null;

  // Filter for fandom.com interwiki links, excluding catalog/community wikis
  const candidates = iwlinks
    .filter(link => link.url.includes('.fandom.com'))
    .map(link => extractWikiDomain(link.url))
    .filter((domain): domain is string => domain !== null && !EXCLUDED_WIKIS.has(domain));

  // Probe the first candidate to confirm it exists
  for (const domain of candidates.slice(0, 3)) {
    // eslint-disable-next-line no-await-in-loop -- Sequential probing with early return
    const confirmed = await probeWikiExists(domain);
    if (confirmed) {
      log.info(`Interwiki discovery: ${catalog} → "${pageTitle}" → ${domain}.fandom.com`);
      return `https://${domain}.fandom.com`;
    }
  }

  return null;
}

/** Extract the subdomain from a fandom.com URL */
function extractWikiDomain(url: string): string | null {
  try {
    const parsed = new URL(url);
    const match = parsed.hostname.match(/^([^.]+)\.fandom\.com$/);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}

/** Probe a wiki's API to confirm it exists and responds */
async function probeWikiExists(domain: string): Promise<boolean> {
  try {
    const response = await axios.get(`https://${domain}.fandom.com/api.php`, {
      params: { action: 'query', meta: 'siteinfo', format: 'json' },
      headers: { 'User-Agent': USER_AGENT },
      timeout: 5000,
    });
    return response.status === 200;
  } catch {
    return false;
  }
}
