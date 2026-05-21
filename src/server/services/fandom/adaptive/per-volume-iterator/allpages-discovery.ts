/**
 * MediaWiki allpages Volume Discovery
 *
 * Uses the MediaWiki API `allpages` endpoint to discover volume pages that
 * use subtitle-style naming (e.g., "Volume 1: Herr Doktor Tenma") which
 * cannot be found by probing static URL patterns.
 *
 * @module per-volume-iterator/allpages-discovery
 */

import { logger } from '@/utils/logger';

/** MediaWiki allpages API response structure */
interface AllpagesResponse {
  query?: {
    allpages?: Array<{ title: string }>;
  };
}

/** Allowlisted Fandom domain pattern */
const FANDOM_DOMAIN_RE = /^[\w-]+\.fandom\.com$/;

/** Validate that a domain is a legitimate Fandom wiki domain */
function isValidFandomDomain(domain: string): boolean {
  return FANDOM_DOMAIN_RE.test(domain);
}

/** Sort volume pages by extracted volume number */
function sortByVolumeNumber(pages: Array<{ title: string }>): Array<{ title: string }> {
  return [...pages].sort((a, b) => {
    const numA = parseInt(a.title.match(/^Volume[_ ](\d+)/i)?.[1] ?? '0', 10);
    const numB = parseInt(b.title.match(/^Volume[_ ](\d+)/i)?.[1] ?? '0', 10);
    return numA - numB;
  });
}

/** Fetch allpages results from the MediaWiki API */
async function fetchAllpages(
  domain: string,
  timeoutMs: number,
): Promise<AllpagesResponse | null> {
  // SSRF protection: only allow *.fandom.com domains
  if (!isValidFandomDomain(domain)) return null;

  const url = new URL(`https://${domain}/api.php`);
  url.searchParams.set('action', 'query');
  url.searchParams.set('list', 'allpages');
  url.searchParams.set('apprefix', 'Volume ');
  url.searchParams.set('aplimit', '500');
  url.searchParams.set('format', 'json');

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url.toString(), {
      headers: { 'User-Agent': 'MugiwaraKaizoku/1.0 (manga-metadata-fetcher)' },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    if (!response.ok) return null;

    return (await response.json()) as AllpagesResponse;
  } catch {
    clearTimeout(timeoutId);
    return null;
  }
}

/**
 * Discover volume pages via the MediaWiki allpages API.
 *
 * Queries pages with "Volume " prefix and filters to those matching
 * `/^Volume[_ ]\d+/i`. Handles subtitle patterns like "Volume 1: Herr Doktor Tenma".
 *
 * @param domain - Fandom wiki domain (e.g., "monster.fandom.com")
 * @param timeoutMs - Request timeout in milliseconds
 * @returns Sorted array of page titles, or null if fewer than 2 found
 */
export async function discoverVolumePagesViaApi(
  domain: string,
  timeoutMs: number,
): Promise<string[] | null> {
  const data = await fetchAllpages(domain, timeoutMs);
  if (!data) return null;

  const allPages = data.query?.allpages ?? [];

  const matchingPages = allPages.filter((p) => /^Volume[_ ]\d+/i.test(p.title));

  // Deduplicate by volume number — when multiple pages map to the same volume
  // (e.g., "Volume 01" and "Volume 1" both → volume 1), keep only one per number.
  // Prefer the longer title (zero-padded names like "Volume 01" tend to be the canonical page).
  const byVolNum = new Map<number, { title: string }>();
  for (const page of matchingPages) {
    const num = parseInt(page.title.match(/^Volume[_ ](\d+)/i)?.[1] ?? '0', 10);
    const existing = byVolNum.get(num);
    if (!existing || page.title.length > existing.title.length) {
      byVolNum.set(num, page);
    }
  }

  const volumePages = sortByVolumeNumber([...byVolNum.values()]);

  if (volumePages.length < 2) return null;

  logger.info(
    `[perVolumeIterator] allpages discovery: found ${volumePages.length} volume pages for ${domain}`,
  );

  return volumePages.map((p) => p.title);
}

/**
 * Extract volume number from a page title like "Volume 1: Herr Doktor Tenma"
 * or "THE_DEATH_AND_THE_STRAWBERRY_(Volume_1)".
 */
export function extractVolumeNumberFromTitle(title: string): number | null {
  // Standard prefix: "Volume 1", "Volume_1: Title"
  const prefixMatch = title.match(/^Volume[_ ](\d+)/i);
  if (prefixMatch?.[1]) return parseInt(prefixMatch[1], 10);

  // Parenthesized suffix: "TITLE_(Volume_1)", "TITLE (Volume 1)"
  const suffixMatch = title.match(/\(Volume[_ ](\d+)\)/i);
  if (suffixMatch?.[1]) return parseInt(suffixMatch[1], 10);

  return null;
}

// ============================================================================
// Embeddedin API Discovery (Template Transclusion)
// ============================================================================

/** Template names commonly used on Fandom volume pages */
const VOLUME_TEMPLATE_NAMES = [
  'Template:Volume',
  'Template:Infobox volume',
  'Template:Volume Infobox',
  'Template:Volumes',
  'Template:MangaVolume',
];

/** MediaWiki embeddedin API response structure */
interface EmbeddedinResponse {
  query?: {
    embeddedin?: Array<{ title: string; pageid: number }>;
  };
  continue?: { eicontinue: string };
}

/**
 * Discover volume pages via the MediaWiki embeddedin API.
 *
 * Queries which pages transclude volume-related templates (e.g., {{Volume}}).
 * This catches volume pages regardless of naming convention — the only
 * requirement is that they use a standard volume infobox template.
 *
 * @param domain - Fandom wiki domain
 * @param timeoutMs - Request timeout in milliseconds
 * @returns Sorted array of { title, volumeNumber } or null if < 2 found
 */
export async function discoverVolumePagesViaEmbeddedin(
  domain: string,
  timeoutMs: number,
): Promise<Array<{ title: string; volumeNumber: number }> | null> {
  if (!isValidFandomDomain(domain)) return null;

  let allPages: Array<{ title: string; pageid: number }> = [];

  for (const template of VOLUME_TEMPLATE_NAMES) {
    // eslint-disable-next-line no-await-in-loop -- Sequential probing of template names
    const pages = await fetchEmbeddedinPages(domain, template, timeoutMs);
    if (pages.length > allPages.length) allPages = pages;
    if (allPages.length >= 5) break;
  }

  if (allPages.length < 2) return null;

  const volumePages: Array<{ title: string; volumeNumber: number }> = [];
  for (const page of allPages) {
    const volNum = extractVolumeNumberFromTitle(page.title);
    if (volNum !== null && volNum > 0) {
      volumePages.push({ title: page.title, volumeNumber: volNum });
    }
  }

  if (volumePages.length < 2) return null;

  volumePages.sort((a, b) => a.volumeNumber - b.volumeNumber);

  logger.info(
    `[perVolumeIterator] Embeddedin discovery: found ${volumePages.length} volume pages for ${domain}`,
  );

  return volumePages;
}

/** Fetch all pages that transclude a given template, with pagination */
async function fetchEmbeddedinPages(
  domain: string,
  template: string,
  timeoutMs: number,
): Promise<Array<{ title: string; pageid: number }>> {
  const pages: Array<{ title: string; pageid: number }> = [];
  let eicontinue: string | undefined;

  /* eslint-disable no-await-in-loop -- inherently sequential: each page request needs the previous response's `eicontinue` token */
  for (let page = 0; page < 5; page++) {
    const url = new URL(`https://${domain}/api.php`);
    url.searchParams.set('action', 'query');
    url.searchParams.set('list', 'embeddedin');
    url.searchParams.set('eititle', template);
    url.searchParams.set('eilimit', '500');
    url.searchParams.set('einamespace', '0'); // Main namespace only
    url.searchParams.set('format', 'json');
    if (eicontinue) url.searchParams.set('eicontinue', eicontinue);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url.toString(), {
        headers: { 'User-Agent': 'MugiwaraKaizoku/1.0 (manga-metadata-fetcher)' },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      if (!response.ok) break;

      const data = (await response.json()) as EmbeddedinResponse;
      const members = data.query?.embeddedin ?? [];
      pages.push(...members);

      eicontinue = data.continue?.eicontinue;
      if (!eicontinue) break;
    } catch {
      clearTimeout(timeoutId);
      break;
    }
  }
  /* eslint-enable no-await-in-loop */

  return pages;
}

// ============================================================================
// Category Members API Discovery
// ============================================================================

/** MediaWiki categorymembers API response structure */
interface CategoryMembersResponse {
  query?: {
    categorymembers?: Array<{ title: string; pageid: number }>;
  };
  continue?: { cmcontinue: string };
}

/**
 * Discover volume pages via the MediaWiki categorymembers API.
 *
 * Queries Category:Volumes to find ALL volume pages regardless of naming convention.
 * This handles wikis like Bleach where volumes use title-based names
 * (e.g., "THE_DEATH_AND_THE_STRAWBERRY_(Volume_1)").
 *
 * @param domain - Fandom wiki domain (e.g., "bleach.fandom.com")
 * @param timeoutMs - Request timeout in milliseconds
 * @returns Sorted array of { title, volumeNumber } or null if < 2 found
 */
export async function discoverVolumePagesViaCategory(
  domain: string,
  timeoutMs: number,
): Promise<Array<{ title: string; volumeNumber: number }> | null> {
  if (!isValidFandomDomain(domain)) return null;

  const categoryNames = ['Category:Volumes', 'Category:Volume'];
  let allPages: Array<{ title: string; pageid: number }> = [];

  for (const category of categoryNames) {
    // eslint-disable-next-line no-await-in-loop -- only 2 categories tried in priority order; sequential keeps log output ordered and avoids duplicate work when first succeeds
    const pages = await fetchCategoryMembers(domain, category, timeoutMs);
    if (pages.length > allPages.length) allPages = pages;
  }

  if (allPages.length < 2) return null;

  // Extract volume numbers from titles and filter to valid volume pages
  const volumePages: Array<{ title: string; volumeNumber: number }> = [];
  for (const page of allPages) {
    const volNum = extractVolumeNumberFromTitle(page.title);
    if (volNum !== null && volNum > 0) {
      volumePages.push({ title: page.title, volumeNumber: volNum });
    }
  }

  if (volumePages.length < 2) return null;

  // Sort by volume number
  volumePages.sort((a, b) => a.volumeNumber - b.volumeNumber);

  logger.info(
    `[perVolumeIterator] Category discovery: found ${volumePages.length} volume pages for ${domain}`,
  );

  return volumePages;
}

/** Fetch all category members with pagination */
async function fetchCategoryMembers(
  domain: string,
  category: string,
  timeoutMs: number,
): Promise<Array<{ title: string; pageid: number }>> {
  const pages: Array<{ title: string; pageid: number }> = [];
  let cmcontinue: string | undefined;

  // Paginate through all results (max 5 pages to avoid infinite loops)
  /* eslint-disable no-await-in-loop -- inherently sequential: each page request needs the previous response's `cmcontinue` token */
  for (let page = 0; page < 5; page++) {
    const url = new URL(`https://${domain}/api.php`);
    url.searchParams.set('action', 'query');
    url.searchParams.set('list', 'categorymembers');
    url.searchParams.set('cmtitle', category);
    url.searchParams.set('cmlimit', '500');
    url.searchParams.set('cmtype', 'page');
    url.searchParams.set('format', 'json');
    if (cmcontinue) url.searchParams.set('cmcontinue', cmcontinue);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url.toString(), {
        headers: { 'User-Agent': 'MugiwaraKaizoku/1.0 (manga-metadata-fetcher)' },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      if (!response.ok) break;

      const data = (await response.json()) as CategoryMembersResponse;
      const members = data.query?.categorymembers ?? [];
      pages.push(...members);

      // Check for more pages
      cmcontinue = data.continue?.cmcontinue;
      if (!cmcontinue) break;
    } catch {
      clearTimeout(timeoutId);
      break;
    }
  }
  /* eslint-enable no-await-in-loop */

  return pages;
}
