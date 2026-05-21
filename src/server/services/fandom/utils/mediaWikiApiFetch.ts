/**
 * MediaWiki API Fetch Utilities
 *
 * Provides a shared utility for fetching Fandom wiki pages via the MediaWiki API.
 * This bypasses Cloudflare protection that blocks direct page requests.
 *
 * @module fandom/utils/mediaWikiApiFetch
 */

import axios from 'axios';

import { logger } from '@/utils/logger';

/**
 * Response structure from MediaWiki API parse action
 */
interface MediaWikiParseResponse {
  parse?: {
    title?: string;
    pageid?: number;
    text?: {
      '*'?: string;
    };
    images?: string[];
    redirects?: Array<{
      from: string;
      to: string;
      tofragment?: string;
    }>;
  };
  error?: {
    code?: string;
    info?: string;
  };
}

/**
 * Result from fetchPageWithRedirectInfo — includes HTML and redirect metadata
 */
export interface PageFetchResult {
  html: string;
  /** Anchor fragment from redirect target (e.g., "001._Death_&_Strawberry") */
  redirectFragment?: string | undefined;
}

/**
 * Parse MediaWiki API response and extract HTML + redirect info
 */
function parseApiResponse(
  data: MediaWikiParseResponse,
  pageTitle: string,
  wikiUrl: string,
): PageFetchResult | null {
  if (data.error) {
    const errorInfo = data.error.info ?? data.error.code ?? 'Unknown error';
    logger.error(`[MediaWiki API] Error for ${pageTitle}: ${errorInfo}`);
    return null;
  }

  const html = data.parse?.text?.['*'];
  if (!html) {
    logger.warn(`[MediaWiki API] No HTML content returned for: ${wikiUrl}`);
    return null;
  }

  const redirect = data.parse?.redirects?.[0];
  if (redirect?.tofragment) {
    const targetTitle = data.parse?.title ?? 'unknown';
    logger.info(`[MediaWiki API] Redirect detected: "${pageTitle}" → "${targetTitle}#${redirect.tofragment}"`);
  }

  return {
    html,
    redirectFragment: redirect?.tofragment,
  };
}

/**
 * Parse Fandom URL to extract wiki subdomain and page title
 *
 * @param url - Full Fandom wiki URL
 * @returns Object with subdomain and pageTitle, or null if invalid
 */
export function parseFandomUrl(url: string): { subdomain: string; pageTitle: string } | null {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname;

    // Extract subdomain from hostname (e.g., "fire-force.fandom.com" -> "fire-force")
    const subdomainMatch = hostname.match(/^([^.]+)\.fandom\.com$/);
    if (!subdomainMatch?.[1]) {
      return null;
    }
    const subdomain = subdomainMatch[1];

    // Extract page title from path (e.g., "/wiki/Chapter_0" -> "Chapter_0")
    const pathMatch = urlObj.pathname.match(/^\/wiki\/(.+)$/);
    if (!pathMatch?.[1]) {
      return null;
    }
    const pageTitle = decodeURIComponent(pathMatch[1]);

    return { subdomain, pageTitle };
  } catch {
    return null;
  }
}

/**
 * Fetch HTML content from a Fandom wiki page using MediaWiki API
 *
 * Uses the MediaWiki API's parse action which returns rendered HTML.
 * This method bypasses Cloudflare protection that blocks direct page requests.
 *
 * @param wikiUrl - Full URL to the Fandom wiki page
 * @param options - Optional configuration
 * @returns Rendered HTML content or null if fetch fails
 *
 * @example
 * ```typescript
 * const html = await fetchPageHtmlViaApi('https://fire-force.fandom.com/wiki/Chapter_0');
 * if (html) {
 *   const $ = cheerio.load(html);
 *   // Parse HTML...
 * }
 * ```
 */
export async function fetchPageHtmlViaApi(
  wikiUrl: string,
  options: {
    timeout?: number;
    includeImages?: boolean;
  } = {}
): Promise<string | null> {
  const result = await fetchPageWithRedirectInfo(wikiUrl, options);
  return result?.html ?? null;
}

/**
 * Fetch HTML content with redirect metadata from MediaWiki API
 *
 * Like fetchPageHtmlViaApi, but also returns redirect fragment info.
 * When a chapter page (e.g., Chapter_1) redirects to a volume page with an anchor
 * (e.g., Volume_1#001._Death_&_Strawberry), the tofragment is returned so callers
 * can extract chapter-specific content from the correct section.
 *
 * @param wikiUrl - Full URL to the Fandom wiki page
 * @param options - Optional configuration
 * @returns PageFetchResult with html and optional redirectFragment, or null on failure
 */
export async function fetchPageWithRedirectInfo(
  wikiUrl: string,
  options: {
    timeout?: number;
    includeImages?: boolean;
  } = {}
): Promise<PageFetchResult | null> {
  const { timeout = 30000, includeImages = false } = options;

  const parsed = parseFandomUrl(wikiUrl);
  if (!parsed) {
    logger.warn(`[MediaWiki API] Invalid Fandom URL format: ${wikiUrl}`);
    return null;
  }

  const { subdomain, pageTitle } = parsed;
  const apiUrl = `https://${subdomain}.fandom.com/api.php`;
  const props = includeImages ? 'text|images' : 'text';

  try {
    // Use axios params (not URLSearchParams) to avoid double-encoding special chars like apostrophes
    const response = await axios.get<MediaWikiParseResponse>(apiUrl, {
      params: { action: 'parse', page: pageTitle, prop: props, format: 'json', redirects: '1' },
      headers: { 'User-Agent': 'MugiwaraKaizoku/1.0 (manga-metadata-fetcher)' },
      timeout,
    });
    return parseApiResponse(response.data, pageTitle, wikiUrl);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`[MediaWiki API] Failed to fetch ${wikiUrl}: ${errorMessage}`);
    return null;
  }
}

/**
 * Get list of images on a page via MediaWiki API
 *
 * @param wikiUrl - Full URL to the Fandom wiki page
 * @returns Array of image filenames or empty array
 */
export async function getPageImages(wikiUrl: string): Promise<string[]> {
  const parsed = parseFandomUrl(wikiUrl);
  if (!parsed) return [];

  const { subdomain, pageTitle } = parsed;
  const apiUrl = `https://${subdomain}.fandom.com/api.php`;

  try {
    const response = await axios.get<MediaWikiParseResponse>(apiUrl, {
      params: {
        action: 'parse',
        page: pageTitle,
        prop: 'images',
        format: 'json'
      },
      headers: {
        'User-Agent': 'MugiwaraKaizoku/1.0 (manga-metadata-fetcher)'
      },
      timeout: 15000
    });

    return response.data.parse?.images ?? [];
  } catch {
    return [];
  }
}

/**
 * Get full URL for an image file via MediaWiki API
 *
 * @param subdomain - Wiki subdomain (e.g., "fire-force")
 * @param imageName - Image filename (e.g., "Chapter_0.png")
 * @returns Full image URL or null
 */
export async function getImageUrl(
  subdomain: string,
  imageName: string
): Promise<string | null> {
  const apiUrl = `https://${subdomain}.fandom.com/api.php`;

  // Ensure image name has File: prefix
  const fileTitle = imageName.startsWith('File:') ? imageName : `File:${imageName}`;

  try {
    const response = await axios.get<{
      query?: {
        pages?: Record<string, {
          imageinfo?: Array<{ url?: string }>;
        }>;
      };
    }>(apiUrl, {
      params: {
        action: 'query',
        titles: fileTitle,
        prop: 'imageinfo',
        iiprop: 'url',
        format: 'json'
      },
      headers: {
        'User-Agent': 'MugiwaraKaizoku/1.0 (manga-metadata-fetcher)'
      },
      timeout: 10000
    });

    const pages = response.data.query?.pages;
    if (!pages) return null;

    // Get the first page result
    const pageId = Object.keys(pages)[0];
    if (!pageId) return null;

    const page = pages[pageId];
    return page?.imageinfo?.[0]?.url ?? null;
  } catch {
    return null;
  }
}

/**
 * MediaWiki API page-images response (formatversion=2, generator=images, prop=imageinfo).
 */
interface MediaWikiImagesQueryResponse {
  query?: {
    pages?: Array<{
      title?: string;
      imageinfo?: Array<{ url?: string }>;
    }>;
  };
  continue?: Record<string, string>;
  error?: { code?: string; info?: string };
}

/**
 * List the URLs of every image used on a Fandom wiki page via the MediaWiki API.
 *
 * Uses `generator=images&prop=imageinfo&iiprop=url` which is the authoritative
 * source — every `[[File:...]]` reference on the page resolves to a canonical
 * URL, regardless of whether the rendered HTML embeds it as a thumbnail. Far
 * more complete than scraping `<img>` tags from the rendered output.
 *
 * Handles continuation, applies a User-Agent, and returns the raw URL list.
 * Caller is responsible for filtering logos/wordmarks/icons.
 *
 * @param wikiUrl - Full URL to the Fandom wiki page (e.g., `https://naruto.fandom.com/wiki/Naruto`)
 * @returns Array of image URLs (`https://static.wikia.nocookie.net/...`)
 */
export async function listPageImageUrlsViaApi(wikiUrl: string): Promise<string[]> {
  const parsed = parseFandomUrl(wikiUrl);
  if (!parsed) return [];

  const { subdomain, pageTitle } = parsed;
  const apiUrl = `https://${subdomain}.fandom.com/api.php`;
  const out: string[] = [];
  let cont: Record<string, string> | undefined;

  // Cap continuation pages to avoid runaway loops on extreme cases
  for (let page = 0; page < 10; page++) {
    const params: Record<string, string> = {
      action: 'query',
      titles: pageTitle,
      generator: 'images',
      prop: 'imageinfo',
      iiprop: 'url',
      gimlimit: '500',
      format: 'json',
      formatversion: '2',
      redirects: '1',
      ...(cont ?? {}),
    };
    let resp;
    try {
      // eslint-disable-next-line no-await-in-loop -- pagination requires sequential calls
      resp = await axios.get<MediaWikiImagesQueryResponse>(apiUrl, {
        params,
        headers: { 'User-Agent': 'MugiwaraKaizoku/1.0 (manga-metadata-fetcher)' },
        timeout: 30_000,
      });
    } catch (err: unknown) {
      logger.warn(`[MediaWiki API] listPageImageUrlsViaApi failed for ${wikiUrl}: ${err instanceof Error ? err.message : String(err)}`);
      return out;
    }
    const pages = resp.data.query?.pages ?? [];
    for (const p of pages) {
      const url = p.imageinfo?.[0]?.url;
      if (typeof url === 'string' && url.length > 0) out.push(url);
    }
    if (!resp.data.continue) break;
    cont = resp.data.continue;
  }
  return out;
}
