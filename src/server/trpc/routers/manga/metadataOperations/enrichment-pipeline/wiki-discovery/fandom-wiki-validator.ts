/**
 * Fandom Wiki Relevance Validator
 *
 * After discovery finds a candidate wiki URL, verifies the wiki is actually
 * about the manga being enriched. Prevents false-positive matches like
 * "Break Cafe" → paralympics.fandom.com or "Over Steam" → steampunk.fandom.com.
 *
 * Validation pipeline (short-circuits on reject):
 *  1. Blocklist check — reject known generic/catalog domains
 *  2. Shared wiki path check — for catalog-style URLs (webtoon.fandom.com/wiki/X),
 *     validate the page title rather than the domain
 *  3. Sitename scoring — fetch MediaWiki siteinfo, compare sitename against
 *     manga title (and alt titles) via dice coefficient + containment
 */

import { logger } from '@/utils/logger';

import { diceCoefficient, normalizeTitle } from '../utils';

const log = logger.child('FandomWikiValidator');

/**
 * Domains that are too generic/broad to be valid dedicated manga wikis.
 * A URL with one of these subdomains is rejected unless the path names a specific page
 * (e.g. webtoon.fandom.com/wiki/Solo_Leveling — the page-title is validated instead).
 */
const GENERIC_DOMAINS = new Set([
  'anime', 'manga', 'animanga', 'community', 'central', 'fandom', 'wikia',
  'steampunk', 'paralympics', 'television', 'tv', 'movies', 'film',
  'gaming', 'games', 'videogames', 'music', 'books',
  'marvel', 'dc', 'starwars', 'disney', 'recipes',
  'heroes', 'villains', 'superheroes', 'sp', 'lost',
  'yaoi', 'webtoon', 'isekai',
  // Catalog wikis that host loosely-validated per-series pages — false-matched
  // unrelated titles (e.g. koreanwebtoons.fandom.com/wiki/JoJo's_Bizarre_Adventure
  // bound JoJo Parts 2-4 after the webtoon fix). yuripedia added after the
  // Class A cleanup pass rebound ~10 non-yuri titles to yuripedia via the
  // same fuzzy-match path. kodansha-comics + shonen-magazine added after the
  // yuripedia strip, because Ichinichi Goto rebound from yuripedia →
  // kodansha-comics via the same fuzzy path.
  'koreanwebtoons', 'yuripedia', 'kodansha-comics', 'shonen-magazine',
  // tropedia is a TVTropes-style catalog that hosts stub pages for many
  // series; "Boku no Pico" → tropedia bound here in v13 via fuzzy interwiki.
  'tropedia',
]);

/**
 * Subset of GENERIC_DOMAINS that are valid shared-catalog wikis when the URL
 * includes a specific page path. Empty after extensive cleanup:
 *
 *   webtoon, yaoi, koreanwebtoons removed first (Asshou → Ao Ashi, JoJo
 *   Parts 2-4 hopping between catalog wikis). Then `manga`, `animanga`,
 *   `anime`, `isekai` removed (JoJo Part 2/4 binding to manga.fandom.com
 *   was bringing in cross-series chapters from the catalog page).
 *
 * Page-title validation alone is too weak to safely accept any of these —
 * any sufficiently-popular manga has a page on every catalog wiki, and
 * dice-similarity on page titles produces false matches. If a manga truly
 * needs a catalog-wiki binding, prefer a manual entry over auto-discovery.
 */
const SHARED_CATALOG_DOMAINS = new Set<string>();

const MIN_ACCEPT_SCORE = 0.45;
const REJECT_SCORE_CEILING = 0.25;
/** Sitename matches at or above this score skip the page-existence probe.
 *  Threshold tuned so an exact-or-near-exact sitename hit (e.g. "Yuusha ga
 *  Shinda! Wikia" matching the manga's synonym "Yuusha ga Shinda!") trusts
 *  itself, while borderline fuzzy matches (e.g. "Minami-ke Wikia" matching
 *  "Minami no Teiou") still get the content probe. */
const HIGH_CONFIDENCE_SCORE = 0.7;
/** Containment only counts when the shorter string is at least this many chars AND
 *  accounts for >=40% of the longer string's length. Prevents short common words
 *  like "shy" or "abyss" from spuriously matching unrelated titles. */
const MIN_CONTAINMENT_LEN = 5;
const MIN_CONTAINMENT_RATIO = 0.4;
/** Token-overlap gate: after dice passes, require that significant words overlap.
 *  Prevents cases like "Hakuryuu Legend" vs "Legend of the Legendary Heroes" where
 *  the shared word "legend" alone isn't enough — "hakuryuu" must also match. */
const MIN_TOKEN_LEN = 4;
const MAX_UNEXPLAINED_FRACTION = 0.5;
const WIKI_SUFFIX_TOKENS = new Set(['wiki', 'wikia', 'pedia', 'fandom', 'encyclopedia']);

export interface WikiValidationResult {
  valid: boolean;
  reason: string;
  sitename?: string;
  score?: number;
  /** True when sitename only matched an alt title (not the primary). Caller
   *  must run the page-existence probe even at high confidence — catches
   *  AniList synonym corruption like "Praise the Orc!" listing "Prism Ark"
   *  and the search finding the unrelated prism-ark wiki. */
  altOnly?: boolean;
}

interface ValidateOptions {
  altTitles?: string[];
  /** If the caller already fetched siteinfo, pass the sitename to skip the extra HTTP call. */
  sitename?: string;
}

/**
 * Validate that a discovered Fandom wiki is actually about the given manga.
 */
export async function validateFandomWiki(
  wikiUrl: string,
  mangaTitle: string,
  opts: ValidateOptions = {},
): Promise<WikiValidationResult> {
  const parsed = parseFandomUrl(wikiUrl);
  if (!parsed) {
    return { valid: false, reason: 'unparseable URL' };
  }

  const { subdomain, pageTitle } = parsed;

  // Generic domains are only acceptable as shared catalogs, via their page-title
  if (GENERIC_DOMAINS.has(subdomain)) {
    if (pageTitle && SHARED_CATALOG_DOMAINS.has(subdomain)) {
      return validateByPageTitle(pageTitle, mangaTitle, opts.altTitles);
    }
    return { valid: false, reason: `generic domain (${subdomain})` };
  }

  // Dedicated wikis: sitename is primary signal
  const sitename = opts.sitename ?? await fetchSitename(subdomain);
  if (sitename) {
    const sitenameResult = scoreSitenameMatch(sitename, mangaTitle, opts.altTitles);
    if (sitenameResult.valid) {
      // Borderline sitename matches (score < HIGH_CONFIDENCE_SCORE) get a
      // content-existence probe — confirms the wiki actually has a page for
      // this manga. Catches false positives where sitename fuzzy-matches but
      // the wiki is a different series (minami-ke for "Minami no Teiou",
      // super for "SUPER HXEROS"). Skip the probe for high-confidence
      // matches — many real wikis name pages after JP characters/arcs and
      // never have a top-level "manga title" page (yuusha-ga-shinda is a
      // legitimate match even with no page named "The Legendary Hero Is
      // Dead!" or "Yuusha ga Shinda!"). Exception: alt-only matches still
      // probe — sitename ratio 1.0 against an alt can be AniList synonym
      // corruption (e.g. "Praise the Orc!" listing "Prism Ark"); we need to
      // confirm the wiki actually hosts the manga before trusting it.
      if ((sitenameResult.score ?? 0) >= HIGH_CONFIDENCE_SCORE && !sitenameResult.altOnly) {
        return sitenameResult;
      }
      const candidates = buildCandidatePageTitles(mangaTitle, opts.altTitles ?? []);
      const found = await findExistingMangaPage(subdomain, candidates);
      if (found === null) {
        return {
          valid: false,
          reason: `sitename ${sitenameResult.reason} but no manga page found`,
          sitename,
          ...(sitenameResult.score !== undefined ? { score: sitenameResult.score } : {}),
        };
      }
      return { ...sitenameResult, reason: `${sitenameResult.reason}; page="${found}"` };
    }

    // If URL points to a specific page AND sitename failed AND the subdomain is
    // a known shared-catalog wiki, the page itself may still be about this
    // manga. Don't apply this for non-catalog subdomains: a Fandom search hit
    // can return any page on any wiki (e.g. ss.fandom.com — Wiki of Westeros —
    // returning a Magical Index page via path-substring match), and page-title
    // alone is too weak a signal to accept those.
    if (pageTitle && SHARED_CATALOG_DOMAINS.has(subdomain)) {
      const pageResult = validateByPageTitle(pageTitle, mangaTitle, opts.altTitles);
      if (pageResult.valid) return { ...pageResult, sitename };
    }
    return sitenameResult;
  }

  // No sitename available (fetch failed) — if we have a page title, try that alone
  if (pageTitle) {
    return validateByPageTitle(pageTitle, mangaTitle, opts.altTitles);
  }
  return { valid: false, reason: 'could not fetch sitename' };
}

/** Parse a Fandom wiki URL into its subdomain and optional page-title */
function parseFandomUrl(wikiUrl: string): { subdomain: string; pageTitle?: string } | null {
  try {
    const u = new URL(wikiUrl);
    const host = u.hostname;
    if (!host.endsWith('.fandom.com')) return null;
    const subdomain = host.slice(0, -'.fandom.com'.length);
    if (subdomain.length === 0) return null;

    const pathMatch = /^\/wiki\/([^/?#]+)/.exec(u.pathname);
    if (pathMatch?.[1]) {
      const pageTitle = decodeURIComponent(pathMatch[1]).replace(/_/g, ' ');
      return { subdomain, pageTitle };
    }
    return { subdomain };
  } catch {
    return null;
  }
}

/** Tokenize on whitespace/punctuation, lowercase, keep tokens of length >= MIN_TOKEN_LEN.
 *  Strips wiki-suffix words from token tails \u2014 handles compound names like
 *  "Narutopedia" (manga = "Naruto"), "Bleachpedia", "Onepieceencyclopedia"
 *  where the suffix is fused without a word boundary. */
function extractSignificantTokens(s: string): string[] {
  const raw = s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .split(/[^a-z0-9]+/);
  const out: string[] = [];
  for (const t of raw) {
    const stripped = stripWikiSuffix(t);
    if (stripped.length >= MIN_TOKEN_LEN && !WIKI_SUFFIX_TOKENS.has(stripped)) {
      out.push(stripped);
    }
  }
  return out;
}

/** Strip a known wiki-suffix from the tail of a token (e.g. "narutopedia" \u2192 "naruto").
 *  Only strips when the remaining stem has length >= MIN_TOKEN_LEN, so generic
 *  short tokens ("the wiki", "a pedia") still survive intact. */
function stripWikiSuffix(token: string): string {
  for (const suffix of WIKI_SUFFIX_TOKENS) {
    if (token.length > suffix.length + MIN_TOKEN_LEN - 1 && token.endsWith(suffix)) {
      return token.slice(0, -suffix.length);
    }
  }
  return token;
}

/** Count sitename tokens not found (exact match) in the manga token pool */
function countUnexplained(target: string[], source: Set<string>): number {
  let unexplained = 0;
  for (const t of target) {
    if (!source.has(t)) unexplained++;
  }
  return unexplained;
}

/**
 * Token-overlap gate: reject if the sitename has too many tokens that don't match
 * any manga/alt-title token (exact match). Catches cases like "Hakuryuu Legend" vs
 * "Legend of the Legendary Heroes" — "legend" matches but "legendary" and "heroes"
 * are unexplained, so the wiki is about a different series.
 *
 * Only checks sitename direction (manga can have extra tokens — sub-series scenarios
 * like "JoJo's Bizarre Adventure Part 1" vs "JoJo's Bizarre Wiki" should accept).
 */
function hasSignificantTokenOverlap(
  sitename: string,
  mangaTitle: string,
  altTitles: string[] = [],
): boolean {
  const sitenameTokens = extractSignificantTokens(sitename);
  if (sitenameTokens.length === 0) return true; // no tokens to check against

  // Combine manga title + alts into one token pool (any title variant can explain sitename tokens)
  const mangaTokenSet = new Set([mangaTitle, ...altTitles].flatMap(extractSignificantTokens));
  if (mangaTokenSet.size === 0) return true; // manga title too short — skip gate

  const unexplained = countUnexplained(sitenameTokens, mangaTokenSet);
  return (unexplained / sitenameTokens.length) < MAX_UNEXPLAINED_FRACTION;
}

/** Stricter containment: short common words ("shy", "abyss") shouldn't spuriously match */
function strongContainment(a: string, b: string): boolean {
  if (a.length === 0 || b.length === 0) return false;
  const [shorter, longer] = a.length <= b.length ? [a, b] : [b, a];
  if (shorter.length < MIN_CONTAINMENT_LEN) return false;
  if (!longer.includes(shorter)) return false;
  return shorter.length / longer.length >= MIN_CONTAINMENT_RATIO;
}

/** Containment ratio (0..1). 1 = exact equality; 0.4 = shorter is just 40%
 *  of longer. Used to scale containment confidence so partial containment
 *  ("Super" inside "Super HxEros", ratio 0.45) is treated as borderline
 *  rather than equivalent to exact equality. */
function containmentRatio(a: string, b: string): number {
  if (a.length === 0 || b.length === 0) return 0;
  const [shorter, longer] = a.length <= b.length ? [a, b] : [b, a];
  if (!longer.includes(shorter)) return 0;
  return shorter.length / longer.length;
}

/** Validate a shared-wiki URL by comparing its page-title segment to the manga title */
function validateByPageTitle(
  pageTitle: string,
  mangaTitle: string,
  altTitles?: string[],
): WikiValidationResult {
  const titles = [mangaTitle, ...(altTitles ?? [])];
  const normalizedPage = normalizeTitle(pageTitle);
  let bestScore = 0;
  for (const t of titles) {
    const normalized = normalizeTitle(t);
    if (normalized.length === 0 || normalizedPage.length === 0) continue;
    if (normalizedPage === normalized) return { valid: true, reason: 'page title exact match', score: 1, sitename: pageTitle };
    if (strongContainment(normalizedPage, normalized)) {
      return { valid: true, reason: 'page title containment', score: 0.9, sitename: pageTitle };
    }
    const score = diceCoefficient(normalized, normalizedPage);
    if (score > bestScore) bestScore = score;
  }
  if (bestScore >= MIN_ACCEPT_SCORE) {
    return { valid: true, reason: `page title dice=${bestScore.toFixed(2)}`, score: bestScore, sitename: pageTitle };
  }
  return { valid: false, reason: `page title mismatch (dice=${bestScore.toFixed(2)})`, score: bestScore, sitename: pageTitle };
}

/** Score manga title against wiki sitename with containment + dice coefficient, try alt titles */
function scoreSitenameMatch(
  sitename: string,
  mangaTitle: string,
  altTitles?: string[],
): WikiValidationResult {
  const titles = [mangaTitle, ...(altTitles ?? [])];
  const cleanedSitename = sitename.replace(/\b(wiki|wikia|pedia|fandom|encyclopedia)\b/gi, '').trim();
  const normalizedSitename = normalizeTitle(cleanedSitename);

  let bestScore = 0;
  let bestPrimaryRatio = 0;
  let bestAltRatio = 0;
  for (const t of titles) {
    const normalized = normalizeTitle(t);
    if (normalized.length < 2 || normalizedSitename.length < 2) continue;
    if (strongContainment(normalizedSitename, normalized)) {
      const ratio = containmentRatio(normalizedSitename, normalized);
      if (t === mangaTitle) {
        if (ratio > bestPrimaryRatio) bestPrimaryRatio = ratio;
      } else if (ratio > bestAltRatio) {
        bestAltRatio = ratio;
      }
    }
    const score = diceCoefficient(normalized, normalizedSitename);
    if (score > bestScore) bestScore = score;
  }
  const bestContainmentRatio = Math.max(bestPrimaryRatio, bestAltRatio);
  const altOnly = bestPrimaryRatio === 0 && bestAltRatio > 0;
  if (bestContainmentRatio > 0) {
    if (!hasSignificantTokenOverlap(sitename, mangaTitle, altTitles)) {
      return { valid: false, reason: 'sitename token mismatch (containment only)', score: bestScore, sitename };
    }
    // Confidence scales with containment ratio: 1.0 = exact equality, 0.4-0.99 = partial.
    // Partial containment (e.g. "Super" inside "Super HxEros") is borderline and
    // should fall through to the page-existence probe in validateFandomWiki.
    const confidence = bestContainmentRatio >= 0.95 ? 0.95 : 0.55 + (bestContainmentRatio - 0.4) * 0.5;
    const reason = `sitename containment (ratio=${bestContainmentRatio.toFixed(2)}${altOnly ? ', alt-only' : ''})`;
    return { valid: true, reason, score: confidence, sitename, altOnly };
  }

  if (bestScore >= MIN_ACCEPT_SCORE) {
    // Second gate: require significant token overlap to catch cases like
    // "Hakuryuu Legend" vs "Legend of the Legendary Heroes" where the shared
    // word "legend" alone produces enough bigram overlap to pass dice.
    if (!hasSignificantTokenOverlap(sitename, mangaTitle, altTitles)) {
      return { valid: false, reason: `sitename token mismatch (dice=${bestScore.toFixed(2)})`, score: bestScore, sitename };
    }
    return { valid: true, reason: `sitename dice=${bestScore.toFixed(2)}`, score: bestScore, sitename };
  }
  if (bestScore <= REJECT_SCORE_CEILING) {
    return { valid: false, reason: `sitename mismatch (dice=${bestScore.toFixed(2)})`, score: bestScore, sitename };
  }
  return { valid: false, reason: `sitename ambiguous (dice=${bestScore.toFixed(2)})`, score: bestScore, sitename };
}

/** Fetch a wiki's display name via MediaWiki siteinfo API */
async function fetchSitename(subdomain: string): Promise<string | null> {
  const url = `https://${subdomain}.fandom.com/api.php?action=query&format=json&meta=siteinfo&siprop=general&origin=*`;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => { controller.abort(); }, 5000);
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    if (!response.ok) return null;
    const data = await response.json() as { query?: { general?: { sitename?: string } } };
    return data.query?.general?.sitename ?? null;
  } catch (err) {
    log.debug(`sitename fetch failed for ${subdomain}: ${err instanceof Error ? err.message : String(err)}`);
    return null;
  }
}

interface MediaWikiPageQuery {
  query?: {
    pages?: Record<string, { pageid?: number; missing?: string | boolean; title?: string }>;
  };
}

/**
 * Check whether a wiki has a page matching any of the candidate titles.
 *
 * Uses the MediaWiki batch query (`titles=A|B|C`) so all candidates resolve in
 * one HTTP call. A page is "exists" when MediaWiki returns it with a `pageid`
 * and no `missing` flag. Returns the matched canonical title or null.
 *
 * Used as a content-existence gate that catches false-positive sitename
 * matches — e.g. `super.fandom.com` ("Super Wikia") fuzzy-matches "SUPER
 * HXEROS" but has no page for that title.
 */
async function findExistingMangaPage(
  subdomain: string,
  candidateTitles: string[],
): Promise<string | null> {
  const filtered = [...new Set(candidateTitles.map(t => t.trim()).filter(t => t.length > 0))]
    .slice(0, 10);
  if (filtered.length === 0) return null;
  const url = `https://${subdomain}.fandom.com/api.php?action=query&format=json&titles=${
    encodeURIComponent(filtered.join('|'))
  }&redirects=1&origin=*`;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => { controller.abort(); }, 5000);
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    if (!response.ok) return null;
    const data = await response.json() as MediaWikiPageQuery;
    const pages = data.query?.pages ?? {};
    for (const page of Object.values(pages)) {
      if (page.pageid !== undefined && page.missing === undefined && page.title) {
        return page.title;
      }
    }
    return null;
  } catch (err) {
    log.debug(`page-exists fetch failed for ${subdomain}: ${err instanceof Error ? err.message : String(err)}`);
    return null;
  }
}

/**
 * Build the candidate page-title list for the manga-page existence probe.
 * Includes the manga title, alt titles, and common suffix variants.
 */
function buildCandidatePageTitles(mangaTitle: string, altTitles: string[]): string[] {
  const titles = [mangaTitle, ...altTitles];
  const variants: string[] = [];
  for (const t of titles) {
    if (t.length === 0) continue;
    variants.push(t);
    // Common Fandom disambiguation suffixes
    variants.push(`${t} (manga)`);
    variants.push(`${t} (series)`);
  }
  return variants;
}
