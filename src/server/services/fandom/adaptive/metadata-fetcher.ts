/**
 * Metadata Fetcher for Fandom Wikis
 *
 * Fetches metadata (author, synopsis, genres, status, cover, etc.) from the
 * main manga page using existing infobox parsing and MediaWiki API.
 *
 * This module is a thin wrapper around existing parsers:
 * - parseInfoboxMetadata() for infobox data
 * - MediaWikiAPI for page fetching and wikitext parsing
 *
 * @module metadata-fetcher
 */

import { logger } from '@/utils/logger';

import { parseInfoboxMetadata } from '../fandom/metadata/infobox-parser';
import { MediaWikiAPI } from '../MediaWikiAPI';

import { DEFAULT_METADATA_OPTIONS, KNOWN_DOMAIN_REDIRECTS } from './types';

import type { MediaWikiPage } from '../types';
import type { FetchedMetadata, MetadataFetchOptions, MetadataFetchResult } from './types';

const log = logger.child('MetadataFetcher');

/**
 * Known main page patterns for different wiki types.
 */
const MAIN_PAGE_PATTERNS = ['', '_(Manga)', '_(manga)', '_Manga', '_(Series)', '_(series)'];

/**
 * Special case mappings for subdomain to manga title.
 */
const SUBDOMAIN_TITLE_MAP: Record<string, string> = {
  'onepiece': 'One Piece',
  'myheroacademia': 'My Hero Academia',
  'jujutsu-kaisen': 'Jujutsu Kaisen',
  'chainsaw-man': 'Chainsaw Man',
  'mob-psycho-100': 'Mob Psycho 100',
  'spy-x-family': 'Spy x Family',
  'dr-stone': 'Dr. Stone',
  'kimetsu-no-yaiba': 'Kimetsu no Yaiba',
  'fire-force': 'Fire Force',
  'tokyo-revengers': 'Tokyo Revengers',
  'black-clover': 'Black Clover',
  'solo-leveling': 'Solo Leveling',
  'blue-lock': 'Blue Lock',
  'kaiju-no-8': 'Kaiju No. 8',
  'vinland-saga': 'Vinland Saga',
  'attack-on-titan': 'Attack on Titan',
  'attackontitan': 'Attack on Titan',
  'tokyoghoul': 'Tokyo Ghoul',
  'naruto': 'Naruto',
  'bleach': 'Bleach',
  'haikyuu': 'Haikyuu!!',
  'frieren': 'Frieren',
  'fma': 'Fullmetal Alchemist',
  'dragonball': 'Dragon Ball',
  'hunterxhunter': 'Hunter × Hunter',
  'jojo': "JoJo's Bizarre Adventure",
  'onepunchman': 'One-Punch Man',
  'berserk': 'Berserk',
  'vagabond': 'Vagabond',
  'deathnote': 'Death Note',
  'evangelion': 'Neon Genesis Evangelion',
  'rezero': 'Re:Zero',
  'mushokutensei': 'Mushoku Tensei',
  'horimiya': 'Horimiya',
};

/**
 * Extracts wiki subdomain from domain.
 */
function extractSubdomain(domain: string): string {
  return domain.replace('.fandom.com', '');
}

/**
 * Infers the manga title from the wiki subdomain.
 */
function inferMangaTitle(subdomain: string): string {
  if (SUBDOMAIN_TITLE_MAP[subdomain]) {
    return SUBDOMAIN_TITLE_MAP[subdomain];
  }
  // Convert kebab-case to Title Case
  return subdomain.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

/**
 * Cleans wikitext by removing markup.
 */
function cleanWikitext(text: string): string {
  return text
    .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, '$2')
    .replace(/\[\[([^\]]+)\]\]/g, '$1')
    .replace(/'''([^']+)'''/g, '$1')
    .replace(/''([^']+)''/g, '$1')
    .replace(/{{[^}]+}}/g, '')
    .replace(/<ref[^>]*>.*?<\/ref>/gi, '')
    .replace(/<ref[^>]*\/>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Tries to fetch a page by title with timeout.
 */
async function tryFetchPage(
  api: MediaWikiAPI,
  title: string,
  timeoutMs: number
): Promise<MediaWikiPage | null> {
  try {
    const page = await Promise.race([
      api.getPageByTitle(title),
      new Promise<null>((resolve) => {
        setTimeout(() => { resolve(null); }, timeoutMs);
      }),
    ]);
    return page?.pageid !== undefined && page.pageid !== -1 ? page : null;
  } catch {
    return null;
  }
}

/**
 * Tries to find the main page via search fallback.
 */
async function trySearchFallback(
  api: MediaWikiAPI,
  baseTitle: string
): Promise<{ page: MediaWikiPage; title: string } | null> {
  try {
    const searchResults = await api.search(baseTitle, { limit: 5 });
    for (const result of searchResults) {
      if (result.title.includes(':') || result.title.includes('/')) continue;
      // eslint-disable-next-line no-await-in-loop -- Sequential probing with early return on success
      const page = await api.getPageByTitle(result.title);
      if (page?.pageprops?.infoboxes) {
        log.info(`Found main page via search: "${result.title}"`);
        return { page, title: result.title };
      }
    }
  } catch {
    log.debug('Search fallback failed');
  }
  return null;
}

/**
 * Discovers the main manga page by probing different title patterns.
 */
async function discoverMainPage(
  api: MediaWikiAPI,
  subdomain: string,
  timeoutMs: number
): Promise<{ page: MediaWikiPage; title: string } | null> {
  const baseTitle = inferMangaTitle(subdomain);

  for (const pattern of MAIN_PAGE_PATTERNS) {
    const title = pattern === '' ? baseTitle : `${baseTitle}${pattern}`;
    log.debug(`Trying main page title: "${title}"`);
    // eslint-disable-next-line no-await-in-loop -- Sequential probing with early return on success
    const page = await tryFetchPage(api, title, timeoutMs);
    if (page) {
      log.info(`Found main page: "${title}"`);
      return { page, title };
    }
  }

  return trySearchFallback(api, baseTitle);
}

/**
 * Extracts synopsis from wikitext sections.
 */
function extractSynopsisFromPage(page: MediaWikiPage, api: MediaWikiAPI): string | undefined {
  const wikitext = page.revisions?.[0]?.slots?.main?.['*'];
  if (!wikitext) return undefined;

  const sections = api.parseWikitext(wikitext);
  const synopsisSection = sections.find(s => {
    const lower = s.title.toLowerCase();
    return lower.includes('synopsis') || lower.includes('plot') || lower.includes('story');
  });

  if (synopsisSection) return cleanWikitext(synopsisSection.content);

  // Try lead paragraph
  const leadMatch = wikitext.match(/^([\s\S]*?)(?==)/);
  const leadText = leadMatch?.[1] ? cleanWikitext(leadMatch[1]) : '';
  return leadText.length > 100 ? leadText : undefined;
}

/**
 * Genre keywords for category filtering.
 */
const GENRE_KEYWORDS = [
  'genre', 'action', 'adventure', 'comedy', 'drama', 'fantasy',
  'horror', 'mystery', 'romance', 'sci-fi', 'slice of life',
  'sports', 'supernatural', 'thriller', 'psychological',
];

/**
 * Extracts genres from page categories.
 */
function extractGenresFromPage(page: MediaWikiPage): string[] | undefined {
  if (!page.categories) return undefined;

  const genres = page.categories
    .map(cat => cat.title.replace('Category:', ''))
    .filter(cat => GENRE_KEYWORDS.some(kw => cat.toLowerCase().includes(kw)))
    .map(cat => cat.replace(/\s*(manga|anime|series)\s*/gi, '').trim())
    .filter(cat => cat.length > 0 && cat.length < 30);

  return genres.length > 0 ? [...new Set(genres)] : undefined;
}

/**
 * Builds metadata from page and infobox data.
 */
function buildMetadataFromPage(
  page: MediaWikiPage,
  api: MediaWikiAPI,
  subdomain: string,
  title: string
): FetchedMetadata {
  const infoboxData = parseInfoboxMetadata(
    page,
    (json: string) => api.parseInfobox(json) as Record<string, unknown>[] | null,
    (infobox: Record<string, unknown>) => api.extractInfoboxData(infobox as unknown as Parameters<typeof api.extractInfoboxData>[0]),
    subdomain,
    title
  );

  const synopsis = extractSynopsisFromPage(page, api);
  const categoryGenres = extractGenresFromPage(page);

  // Build result with only defined values (exactOptionalPropertyTypes)
  const result: FetchedMetadata = { ...infoboxData };
  // Add the discovered title (this is the series title, not the page title)
  result.title = title;
  if (synopsis) result.synopsis = synopsis;

  // Prioritize infobox genres, then category genres, then demographic
  if (!result.genres && categoryGenres) {
    result.genres = categoryGenres;
  }
  if (!result.genres && infoboxData.demographic) {
    result.genres = [infoboxData.demographic];
  }

  return result;
}

/**
 * Manga-specific infobox field indicators.
 * Used to verify a page is a manga/series page (not episode/character page).
 */
const MANGA_INFOBOX_INDICATORS = ['author', 'artist', 'volumes', 'chapters', 'publisher', 'magazine', 'demographic', 'genre'];

/**
 * Checks if an infobox contains manga-specific fields.
 */
function hasMangaInfoboxFields(infoboxJson: string): boolean {
  const lowerJson = infoboxJson.toLowerCase();
  // Require at least 2 manga-specific fields
  let count = 0;
  for (const indicator of MANGA_INFOBOX_INDICATORS) {
    if (lowerJson.includes(`"label":"${indicator}"`) || lowerJson.includes(`"source":"${indicator}"`)) {
      count++;
      if (count >= 2) return true;
    }
  }
  return false;
}

/**
 * Extracts the series title from fandomdescription or page content.
 * The fandomdescription often contains the full title like "The Titan's Bride (Japanese: ...)"
 */
function extractSeriesTitleFromDescription(page: MediaWikiPage): string | undefined {
  const description = page.pageprops?.['fandomdescription'];
  if (!description || typeof description !== 'string') return undefined;

  // Try to extract title before " is a " or " (Japanese:"
  // e.g., "The Titan's Bride (Japanese: 巨人族の花嫁, ...) is a Japanese manga..."
  const match = description.match(/^([^(]+?)(?:\s*\(|\s+is\s+a)/i);
  if (match?.[1]) {
    const title = match[1].trim();
    if (title.length > 2 && title.length < 100) {
      return title;
    }
  }

  return undefined;
}

/**
 * Fetches metadata from a specific page URL.
 * Unlike fetchMainPageMetadata, this doesn't search for a "main page" -
 * it extracts metadata directly from the given page's infobox.
 */
export async function fetchPageMetadata(
  pageUrl: string,
  options: Partial<MetadataFetchOptions> = {}
): Promise<MetadataFetchResult> {
  const startTime = Date.now();
  const mergedOptions = { ...DEFAULT_METADATA_OPTIONS, ...options };

  try {
    const urlObj = new URL(pageUrl);
    const domain = urlObj.hostname;
    const pathMatch = urlObj.pathname.match(/\/wiki\/(.+)/);
    if (!pathMatch?.[1]) {
      return { success: false, error: 'Invalid wiki URL', durationMs: Date.now() - startTime };
    }

    const pageTitle = decodeURIComponent(pathMatch[1]);
    const resolvedDomain = KNOWN_DOMAIN_REDIRECTS[domain] ?? domain;
    const subdomain = extractSubdomain(resolvedDomain);
    const baseUrl = `https://${resolvedDomain}`;
    const api = new MediaWikiAPI({ wiki: subdomain, baseUrl });

    const page = await tryFetchPage(api, pageTitle, mergedOptions.timeoutMs);
    if (!page) {
      return { success: false, error: `Page not found: ${pageTitle}`, durationMs: Date.now() - startTime };
    }

    // Check if page has a manga-type infobox
    if (!page.pageprops?.infoboxes || !hasMangaInfoboxFields(page.pageprops.infoboxes)) {
      log.debug(`Page ${pageTitle} does not have manga infobox fields`);
      return { success: false, error: 'No manga infobox found', durationMs: Date.now() - startTime };
    }

    // Extract series title from fandomdescription or use page title
    const seriesTitle = extractSeriesTitleFromDescription(page) ?? pageTitle;

    const metadata = buildMetadataFromPage(page, api, subdomain, seriesTitle);

    log.info(`Page metadata fetched for ${pageTitle}`, {
      hasTitle: !!metadata.title,
      hasAuthor: !!metadata.author,
      hasSynopsis: !!metadata.synopsis,
    });

    return { success: true, metadata, mainPageUrl: pageUrl, durationMs: Date.now() - startTime };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log.error(`Failed to fetch page metadata: ${message}`);
    return { success: false, error: message, durationMs: Date.now() - startTime };
  }
}

/**
 * Fetches metadata from the main manga page.
 */
export async function fetchMainPageMetadata(
  domain: string,
  options: Partial<MetadataFetchOptions> = {}
): Promise<MetadataFetchResult> {
  const startTime = Date.now();
  const mergedOptions = { ...DEFAULT_METADATA_OPTIONS, ...options };

  try {
    const resolvedDomain = KNOWN_DOMAIN_REDIRECTS[domain] ?? domain;
    const subdomain = extractSubdomain(resolvedDomain);
    const baseUrl = `https://${resolvedDomain}`;
    const api = new MediaWikiAPI({ wiki: subdomain, baseUrl });

    const pageResult = await discoverMainPage(api, subdomain, mergedOptions.timeoutMs);
    if (!pageResult) {
      return { success: false, error: `Could not find main page`, durationMs: Date.now() - startTime };
    }

    const { page, title } = pageResult;
    const mainPageUrl = `https://${resolvedDomain}/wiki/${encodeURIComponent(title)}`;
    const metadata = buildMetadataFromPage(page, api, subdomain, title);

    log.info(`Metadata fetched for ${subdomain}`, {
      hasAuthor: !!metadata.author,
      hasSynopsis: !!metadata.synopsis,
      hasCover: !!metadata.coverImage,
    });

    return { success: true, metadata, mainPageUrl, durationMs: Date.now() - startTime };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log.error(`Failed to fetch metadata for ${domain}: ${message}`);
    return { success: false, error: message, durationMs: Date.now() - startTime };
  }
}
