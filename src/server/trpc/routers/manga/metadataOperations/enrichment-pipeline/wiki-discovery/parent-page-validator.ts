/**
 * Tier 5 parent-tier validator. Accepts a Fandom URL if the wiki has a page
 * named after any of the given parent variants — even when the wiki's
 * sitename doesn't fuzzy-match the manga title.
 *
 * Used when sub-series fallback finds a franchise wiki via animanga's
 * curated interwiki links (e.g. "Strike Witches" → worldwitches.fandom.com,
 * "JoJo's Bizarre Adventure" → jojo.fandom.com). Title-token validation
 * rejects franchise wikis whose names don't share enough tokens with the
 * manga. Page existence is the more authoritative signal here — animanga
 * editors curate the interwiki links explicitly, so trusting "the wiki
 * hosts a page for the parent" matches their intent.
 */

const TIMEOUT_MS = 5000;
const MAX_VARIANTS = 24;

interface MediaWikiPageQuery {
  query?: {
    pages?: Record<string, { pageid?: number; missing?: string | boolean; title?: string }>;
  };
}

/** Build candidate page titles from parent variants, with disambiguation suffixes. */
function buildCandidates(parentVariants: string[]): string[] {
  // Generate macron/diacritic-folded variants alongside the originals so the
  // batch query catches pages titled "Haikyū!!" when given "Haikyuu!!" (the
  // "ū" macron can appear on either side). NFKD normalize then strip combining
  // marks; only emit the folded variant if it differs from the original.
  const expanded = parentVariants.flatMap(v => {
    const folded = v.normalize('NFKD').replace(/[̀-ͯ]/g, '');
    return folded !== v ? [v, folded] : [v];
  });
  return expanded.flatMap(v => [v, `${v} (manga)`, `${v} (series)`, `${v} (anime)`]).slice(0, MAX_VARIANTS);
}

function findExistingPage(
  pages: NonNullable<NonNullable<MediaWikiPageQuery['query']>['pages']>,
): { title: string } | null {
  for (const page of Object.values(pages)) {
    if (page.pageid !== undefined && page.missing === undefined && typeof page.title === 'string') {
      return { title: page.title };
    }
  }
  return null;
}

async function probeParentPage(
  subdomain: string,
  parentVariants: string[],
): Promise<{ valid: boolean; reason: string }> {
  const titles = buildCandidates(parentVariants);
  const params = new URLSearchParams({
    action: 'query',
    format: 'json',
    titles: titles.join('|'),
    redirects: '1',
    origin: '*',
  });
  const controller = new AbortController();
  const timeoutId = setTimeout(() => { controller.abort(); }, TIMEOUT_MS);
  try {
    const response = await fetch(`https://${subdomain}.fandom.com/api.php?${params.toString()}`, {
      signal: controller.signal,
    });
    if (!response.ok) return { valid: false, reason: `wiki API ${response.status}` };
    const data = await response.json() as MediaWikiPageQuery;
    const hit = findExistingPage(data.query?.pages ?? {});
    if (hit) return { valid: true, reason: `parent page "${hit.title}" exists on ${subdomain}` };
    // Title-batch missed — fall back to MediaWiki title search. Catches pages
    // whose canonical name uses diacritics the input title lacks (e.g. wiki
    // page "Haikyū!!" with macron when synthetic input is "Haikyuu!!").
    const fuzzyHit = await searchTitleFuzzy(subdomain, parentVariants[0] ?? '', controller.signal);
    if (fuzzyHit !== null) return { valid: true, reason: `parent page "${fuzzyHit}" found via title search on ${subdomain}` };
    return { valid: false, reason: `no parent variant page found on ${subdomain}` };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { valid: false, reason: `wiki probe error: ${msg}` };
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Build a validator that accepts a Fandom URL if the wiki has a page named
 * after any of the given parent variants.
 */
export function buildPageExistenceValidator(
  parentVariants: string[],
): (url: string) => Promise<{ valid: boolean; reason: string }> {
  return async (url: string) => {
    const m = /^https?:\/\/([a-z0-9-]+)\.fandom\.com/i.exec(url);
    if (!m?.[1]) return { valid: false, reason: 'unparseable URL' };
    const subdomain = m[1].toLowerCase();
    // Reject generic catalog wikis (webtoon, tropedia, etc.) — they host stub
    // pages for many series and would always pass page-existence on title.
    if (GENERIC_PAGE_EXISTENCE_BLOCKLIST.has(subdomain)) {
      return { valid: false, reason: `generic domain blocked from page-existence (${subdomain})` };
    }
    return probeParentPage(subdomain, parentVariants);
  };
}

/** Subdomains that should never be accepted via the page-existence fallback —
 *  catalog/aggregator wikis with stub pages for many works. Mirrors
 *  GENERIC_DOMAINS in fandom-wiki-validator.ts but kept here to avoid the
 *  coupling. */
const GENERIC_PAGE_EXISTENCE_BLOCKLIST = new Set([
  'anime', 'manga', 'animanga', 'community', 'central', 'fandom', 'wikia',
  'tv', 'movies', 'film', 'gaming', 'games', 'videogames', 'music', 'books',
  'webtoon', 'isekai', 'yaoi', 'koreanwebtoons', 'yuripedia',
  'kodansha-comics', 'shonen-magazine', 'tropedia', 'jpop', 'toonami',
]);

/** Fuzzy title-match search on a wiki — catches pages whose canonical name
 *  uses diacritics the input lacks. Accepts only when the matched page's
 *  diacritic-stripped title equals the query's diacritic-stripped form
 *  (so we don't accept loose substring matches). */
async function searchTitleFuzzy(
  subdomain: string,
  query: string,
  signal: AbortSignal,
): Promise<string | null> {
  if (query.length < 3) return null;
  const params = new URLSearchParams({
    action: 'query',
    list: 'search',
    srsearch: query,
    srwhat: 'title',
    srlimit: '5',
    format: 'json',
    origin: '*',
  });
  try {
    const response = await fetch(`https://${subdomain}.fandom.com/api.php?${params.toString()}`, { signal });
    if (!response.ok) return null;
    const data = await response.json() as { query?: { search?: Array<{ title: string }> } };
    const results = data.query?.search ?? [];
    const fold = (s: string): string => s.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase();
    const queryFolded = fold(query);
    for (const r of results) {
      if (fold(r.title) === queryFolded) return r.title;
    }
    return null;
  } catch {
    return null;
  }
}
