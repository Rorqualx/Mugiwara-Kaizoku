/**
 * Series Page Resolver
 *
 * Resolves the correct *series-specific* article page on a shared/franchise
 * Fandom wiki. Spin-offs live on the same wiki as the parent series
 * (e.g. "Attack on Titan: Before the Fall (Manga)" on attackontitan.fandom.com),
 * so binding to the wiki root and running generic chapter discovery scrapes the
 * PARENT series' chapter list. This resolver finds the spin-off's own article
 * page via the MediaWiki API, scored against the series title, so chapter
 * discovery starts from the right page.
 *
 * @module series-page-resolver
 */

import { diceCoefficient, normalizeTitle } from '@/server/utils/string';
import { logger } from '@/utils/logger';

const TIMEOUT_MS = 5000;
const MAX_TITLES = 40;
/** Lenient threshold for the titles-existence path (candidates are derived
 *  directly from the series title, so genuine hits score high). */
const MIN_BATCH_SCORE = 0.55;
/** Strict threshold for the title-search fallback — guards against returning a
 *  shorter parent-series page (e.g. "Attack on Titan" scores ~0.65 against
 *  "Attack on Titan: Before the Fall"). */
const MIN_SEARCH_SCORE = 0.8;

interface PageQueryResponse {
  query?: {
    pages?: Record<string, { pageid?: number; missing?: string | boolean; title?: string }>;
  };
}

/**
 * Generate candidate wiki page titles for a series, handling colon↔dash
 * differences, `(Manga)` disambiguation suffixes, macron/diacritic folding, and
 * dedicated chapter-list pages. e.g. "Attack on Titan - Before the Fall" →
 *   "Attack on Titan: Before the Fall (Manga)" (overview) AND
 *   "List of Attack on Titan: Before the Fall chapters" (the actual chapter data).
 */
export function buildSeriesPageCandidates(seriesTitle: string, altTitles: string[] = []): string[] {
  const bases = [seriesTitle, ...altTitles].filter(t => typeof t === 'string' && t.trim().length >= 3);
  const out = new Set<string>();
  for (const base of bases) {
    const variants = new Set<string>([base]);
    if (base.includes(' - ')) variants.add(base.replace(/ - /g, ': '));
    if (base.includes(': ')) variants.add(base.replace(/: /g, ' - '));
    for (const v of [...variants]) {
      const folded = v.normalize('NFKD').replace(/[̀-ͯ]/g, '');
      if (folded !== v) variants.add(folded);
    }
    for (const v of variants) {
      // Chapter-list pages first — they hold the actual chapter/volume data and
      // are preferred over the overview article (which often lacks a parseable
      // table and would fall back to the parent series' generic list).
      out.add(`List of ${v} chapters`);
      out.add(`${v} Chapters`);
      // Overview / article pages.
      out.add(v);
      out.add(`${v} (Manga)`);
      out.add(`${v} (manga)`);
      out.add(`${v} (series)`);
    }
  }
  return [...out].slice(0, MAX_TITLES);
}

/** True when the page title is a dedicated chapter/volume listing page. */
function isChapterListTitle(pageTitle: string): boolean {
  return /^List of\s+.+\s+(chapters|volumes)$/i.test(pageTitle)
    || /\s+(chapters|chapter list|chapters and volumes)$/i.test(pageTitle);
}

/** Strip list-page wrapper + trailing disambiguation paren before scoring, so a
 *  "List of X chapters" page scores against the clean series title X. */
function scoreTitle(pageTitle: string, queryNorm: string): number {
  const clean = pageTitle
    .replace(/^List of\s+/i, '')
    .replace(/\s+(chapters|chapter list|chapters and volumes)$/i, '')
    .replace(/\s*\([^)]*\)\s*$/, '');
  return diceCoefficient(normalizeTitle(clean), queryNorm);
}

/** Pick the best existing page: among those scoring above `minScore`, prefer a
 *  dedicated chapter-list page (real data) over an overview article. */
function pickBestPage(
  hits: Array<{ title: string; score: number }>, minScore: number,
): { title: string; score: number } | null {
  const qualified = hits.filter(h => h.score >= minScore);
  if (qualified.length === 0) return null;
  const listPages = qualified.filter(h => isChapterListTitle(h.title));
  const pool = listPages.length > 0 ? listPages : qualified;
  return pool.reduce((best, h) => (h.score > best.score ? h : best));
}

function buildPageUrl(domain: string, pageTitle: string): string {
  // Preserve colons + parens (valid in MediaWiki titles / Fandom URLs); only
  // spaces become underscores.
  return `https://${domain}/wiki/${encodeURI(pageTitle.replace(/ /g, '_'))}`;
}

/** Query the wiki for which candidate page titles exist; score survivors. */
async function resolveViaTitlesBatch(
  domain: string, candidates: string[], queryNorm: string, signal: AbortSignal,
): Promise<{ title: string; score: number } | null> {
  const params = new URLSearchParams({
    action: 'query', format: 'json', titles: candidates.join('|'), redirects: '1', origin: '*',
  });
  const response = await fetch(`https://${domain}/api.php?${params.toString()}`, {
    signal,
    headers: { 'User-Agent': 'MugiwaraKaizoku/1.0 (manga-metadata-fetcher)' },
  });
  if (!response.ok) return null;
  const data = await response.json() as PageQueryResponse;
  const hits: Array<{ title: string; score: number }> = [];
  for (const page of Object.values(data.query?.pages ?? {})) {
    if (page.pageid === undefined || page.missing !== undefined || typeof page.title !== 'string') continue;
    hits.push({ title: page.title, score: scoreTitle(page.title, queryNorm) });
  }
  return pickBestPage(hits, MIN_BATCH_SCORE);
}

/** Fallback: MediaWiki title search, accepting only a strong score so the
 *  parent-series root page can't win. */
async function resolveViaTitleSearch(
  domain: string, query: string, queryNorm: string, signal: AbortSignal,
): Promise<{ title: string; score: number } | null> {
  const params = new URLSearchParams({
    action: 'query', list: 'search', srsearch: query, srwhat: 'title',
    srlimit: '5', format: 'json', origin: '*',
  });
  const response = await fetch(`https://${domain}/api.php?${params.toString()}`, {
    signal,
    headers: { 'User-Agent': 'MugiwaraKaizoku/1.0 (manga-metadata-fetcher)' },
  });
  if (!response.ok) return null;
  const data = await response.json() as { query?: { search?: Array<{ title: string }> } };
  const hits = (data.query?.search ?? []).map(r => ({ title: r.title, score: scoreTitle(r.title, queryNorm) }));
  return pickBestPage(hits, MIN_SEARCH_SCORE);
}

/**
 * Resolve the best-matching existing wiki page for a series on a Fandom wiki.
 * Returns a full `/wiki/` URL (colons + parens preserved) or null when no
 * candidate page exists / scores above threshold (caller then falls back to
 * slug-pattern probing + generic discovery).
 */
export async function resolveSeriesPageUrl(
  domain: string,
  seriesTitle: string,
  altTitles: string[] = [],
  timeoutMs: number = TIMEOUT_MS,
): Promise<string | null> {
  const candidates = buildSeriesPageCandidates(seriesTitle, altTitles);
  if (candidates.length === 0) return null;

  const queryNorm = normalizeTitle(seriesTitle);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => { controller.abort(); }, timeoutMs);
  try {
    const batch = await resolveViaTitlesBatch(domain, candidates, queryNorm, controller.signal)
      ?? await resolveViaTitleSearch(domain, seriesTitle, queryNorm, controller.signal);
    if (!batch) {
      logger.info(`[seriesPageResolver] No qualifying page on ${domain} for "${seriesTitle}"`);
      return null;
    }
    const url = buildPageUrl(domain, batch.title);
    logger.info(`[seriesPageResolver] Resolved "${seriesTitle}" → ${url} (score ${batch.score.toFixed(2)})`);
    return url;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.warn(`[seriesPageResolver] probe failed for ${domain}: ${msg}`);
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}
