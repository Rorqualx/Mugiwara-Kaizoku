/**
 * Fandom Cover Image Resolution
 *
 * Resolves cover images from Fandom wiki pages using MediaWiki API.
 * Handles case-insensitive title resolution and multiple page variants.
 */

import { logger } from '@/utils/logger';

const log = logger.child('FandomCoverResolver');

/**
 * Check if an image URL is likely a volume cover (better quality for manga)
 */
export function isVolumeCoverUrl(url: string): boolean {
  const urlLower = url.toLowerCase();
  return (
    urlLower.includes('volume') ||
    urlLower.includes('vol_') ||
    urlLower.includes('vol.') ||
    urlLower.includes('cover') ||
    /vol(?:ume)?[\s_.-]?\d/i.test(url)
  );
}

/**
 * Extract cover URL from parsed HTML using Cheerio (infobox images)
 */
export function extractCoverFromHtml(
  $: ReturnType<typeof import('cheerio').load>
): string | undefined {
  // Extended selectors to cover more Fandom wiki layouts
  const infoboxImages = $(
    '.portable-infobox .pi-image img, .portable-infobox img, ' +
    '.infobox img, .pi-image-thumbnail img, ' +
    '.mw-parser-output .pi-image img'
  );

  // First pass: prefer images with volume/cover in URL
  for (const elem of infoboxImages.toArray()) {
    const src = $(elem).attr('data-src') ?? $(elem).attr('src');
    if (src && isVolumeCoverUrl(src)) {
      return src.split('/revision')[0];
    }
  }

  // Second pass: take ANY infobox image as fallback (some wikis use generic filenames)
  for (const elem of infoboxImages.toArray()) {
    const src = $(elem).attr('data-src') ?? $(elem).attr('src');
    if (src && src.startsWith('http') && !src.includes('data:image')) {
      return src.split('/revision')[0];
    }
  }

  return undefined;
}

/**
 * Extract cover URL from page body content (fallback when infobox has no image)
 * Looks for volume cover images in disambiguation pages or content sections
 */
export function extractCoverFromBody(
  $: ReturnType<typeof import('cheerio').load>
): string | undefined {
  const bodyImages = $('img[src*="Volume"], img[src*="Cover"], img[data-src*="Volume"], img[data-src*="Cover"]');
  for (const elem of bodyImages.toArray()) {
    const src = $(elem).attr('data-src') ?? $(elem).attr('src');
    if (src && src.startsWith('http') && isVolumeCoverUrl(src)) {
      return src.split('/revision')[0];
    }
  }
  return undefined;
}

/**
 * Check if a page exists on the wiki via direct title query
 */
async function queryPageExists(
  apiUrl: string,
  title: string,
  axios: { get: (url: string, config: Record<string, unknown>) => Promise<{ data: unknown }> }
): Promise<string | null> {
  const params = new URLSearchParams({
    action: 'query',
    titles: title,
    redirects: '',
    format: 'json'
  });

  const resp = await axios.get(`${apiUrl}?${params}`, {
    headers: { 'User-Agent': 'MugiwaraKaizoku/1.0' },
    timeout: 3000
  });

  const data = resp.data as { query?: { pages?: Record<string, { title?: string; pageid?: number; missing?: string }> } };
  const pages = data.query?.pages ?? {};
  const firstPage = Object.values(pages)[0];

  if (firstPage?.pageid && firstPage.pageid > 0 && !('missing' in firstPage)) {
    return firstPage.title ?? null;
  }
  return null;
}

/**
 * Resolve a page title to its canonical form.
 *
 * MediaWiki is case-sensitive for all characters after the first letter.
 * Strategy:
 * 1. Direct query with redirects (exact match)
 * 2. Try common title-case variants
 * 3. Use allpages prefix search with truncated prefix (first 2 words)
 */
export async function resolvePageTitle(
  title: string,
  wikiSubdomain: string
): Promise<string> {
  try {
    const axios = (await import('axios')).default;
    const apiUrl = `https://${wikiSubdomain}.fandom.com/api.php`;

    // 1. Direct query (works if title has correct casing)
    const directResult = await queryPageExists(apiUrl, title, axios);
    if (directResult) return directResult;

    // 2. Build case variants to try
    const baseTitle = title.replace(/\s*\(Manga\)\s*$/i, '').trim();
    const hasMangaSuffix = title.toLowerCase().includes('(manga)');

    // Title-case each word (handles "attack on titan" → "Attack On Titan")
    const titleCased = baseTitle.replace(/\b\w/g, c => c.toUpperCase());

    // Try common patterns: Title Case, Title Case (Manga)
    const candidates = [
      titleCased,
      `${titleCased} (Manga)`,
      baseTitle,
      `${baseTitle} (Manga)`
    ].filter((c, i, arr) =>
      c !== title && arr.indexOf(c) === i // unique and different from original
    );

    for (const candidate of candidates) {
      // eslint-disable-next-line no-await-in-loop -- sequential candidate resolution with early return
      const result = await queryPageExists(apiUrl, candidate, axios);
      if (result) return result;
    }

    // 3. Last resort: use allpages prefix search with first 2 words
    // This finds the correct case from the wiki's page index
    const words = baseTitle.split(/\s+/);
    const prefix = words.length >= 2
      ? `${words[0]} ${words[1]}`
      : words[0] ?? baseTitle;

    // Capitalize first letter of prefix (MediaWiki normalizes first letter)
    const normalizedPrefix = prefix.charAt(0).toUpperCase() + prefix.slice(1);

    const apParams = new URLSearchParams({
      action: 'query',
      list: 'allpages',
      apprefix: normalizedPrefix,
      aplimit: '20',
      format: 'json'
    });

    const apResp = await axios.get(`${apiUrl}?${apParams}`, {
      headers: { 'User-Agent': 'MugiwaraKaizoku/1.0' },
      timeout: 3000
    });

    const apData = apResp.data as { query?: { allpages?: Array<{ title: string }> } };
    const allPages = apData.query?.allpages ?? [];
    const baseLower = baseTitle.toLowerCase();

    // Look for (Manga) variant first, then exact base title
    const mangaMatch = allPages.find(p => p.title.toLowerCase() === `${baseLower} (manga)`);
    if (mangaMatch) return mangaMatch.title;

    const exactMatch = allPages.find(p => p.title.toLowerCase() === baseLower);
    if (exactMatch) {
      if (hasMangaSuffix) {
        // Try the correctly-cased title + (Manga)
        const mangaTitle = `${exactMatch.title} (Manga)`;
        const mangaResult = await queryPageExists(apiUrl, mangaTitle, axios);
        if (mangaResult) return mangaResult;
      }
      return exactMatch.title;
    }

    return title;
  } catch {
    return title;
  }
}

/**
 * Fetch the actual cover image from a page's infobox using MediaWiki API
 */
export async function fetchInfoboxCover(
  title: string,
  wikiSubdomain: string
): Promise<string | undefined> {
  try {
    const axios = (await import('axios')).default;
    const cheerioModule = await import('cheerio');

    // Resolve the actual page title (handles case mismatches)
    const resolvedTitle = await resolvePageTitle(title, wikiSubdomain);

    const apiUrl = `https://${wikiSubdomain}.fandom.com/api.php`;
    const params = new URLSearchParams({
      action: 'parse',
      page: resolvedTitle,
      prop: 'text',
      redirects: '',
      format: 'json'
    });

    log.info('Fetching infobox cover', { title, resolvedTitle, wikiSubdomain });

    const response = await axios.get(`${apiUrl}?${params}`, {
      headers: { 'User-Agent': 'MugiwaraKaizoku/1.0' },
      timeout: 5000
    });

    const data = response.data as { parse?: { title?: string; text?: { '*'?: string } } };
    const html = data.parse?.text?.['*'];
    if (!html) {
      log.info('No HTML from parse API', { title, resolvedTitle });
      return undefined;
    }

    const $ = cheerioModule.load(html);
    const cover = extractCoverFromHtml($);

    // If no infobox cover found, try finding volume cover in page body
    if (!cover) {
      const bodyCover = extractCoverFromBody($);
      if (bodyCover) {
        log.info('Found cover in page body', { title, cover: bodyCover.substring(0, 100) });
        return bodyCover;
      }
    }

    log.info('Cover result', { title, resolvedTitle, hasCover: !!cover });
    return cover;
  } catch (error: unknown) {
    log.warn('Failed to fetch infobox cover', {
      title,
      wikiSubdomain,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    return undefined;
  }
}

/**
 * Try multiple page variants to find a volume cover
 * Some wikis have main page as disambiguation, with actual manga at "Title (Manga)"
 */
export async function findBestCover(
  title: string,
  wikiSubdomain: string
): Promise<string | undefined> {
  // resolvePageTitle inside fetchInfoboxCover handles case-insensitive resolution,
  // so we mainly need different semantic variants (e.g., with/without "(Manga)" suffix)
  const variants = [title];

  if (!title.toLowerCase().endsWith('(manga)')) {
    variants.push(`${title} (Manga)`);
  }

  log.info('Finding best cover', { title, wikiSubdomain, variants });

  let fallbackCover: string | undefined;

  for (const variant of variants) {
    // eslint-disable-next-line no-await-in-loop -- sequential variant resolution, early return on match
    const cover = await fetchInfoboxCover(variant, wikiSubdomain);
    if (!cover) continue;

    if (isVolumeCoverUrl(cover)) {
      log.info('Found volume cover', { variant, cover: cover.substring(0, 100) });
      return cover;
    }

    if (!fallbackCover) {
      fallbackCover = cover;
    }
  }

  if (fallbackCover) {
    log.info('Using fallback cover', { title, cover: fallbackCover.substring(0, 100) });
  }
  return fallbackCover;
}
