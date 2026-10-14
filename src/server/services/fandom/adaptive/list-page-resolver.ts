/**
 * List Page Resolver
 *
 * Finds the page on a Fandom wiki that actually holds the chapter list (and the
 * page that holds the volume list) with deterministic MediaWiki API lookups
 * instead of HEAD-probing ~40 guessed URLs:
 *
 *   1. One `titles=` query (redirects followed) over known naming variants —
 *      "Chapters and Volumes", "Volumes & Chapters", "List of X chapters",
 *      "X (Manga)", … — plus a title search for "chapters" / "volumes".
 *   2. Each existing candidate is fetched through `action=parse` and measured:
 *      how many distinct chapter numbers and volume numbers it lists.
 *   3. The page with the most chapters wins; the page with the most volumes
 *      is reported separately when it is not the same page.
 *
 * On a wiki shared by several series (sitename ≠ series title) only pages
 * named after this series are considered, so a spin-off never picks up the
 * parent series' generic "Chapters and Volumes" page.
 *
 * @module list-page-resolver
 */

import { load, type CheerioAPI } from 'cheerio';

import { diceCoefficient, normalizeTitle } from '@/server/utils/string';
import { logger } from '@/utils/logger';

import { buildSeriesPageCandidates } from './series-page-resolver';

const USER_AGENT = 'MugiwaraKaizoku/1.0 (https://github.com/Rorqualx/Mugiwara-Kaizoku)';
const DEFAULT_TIMEOUT_MS = 8000;
/** MediaWiki accepts at most 50 titles per query. */
const TITLES_PER_QUERY = 50;
/** Pages fetched and measured per resolution (bounds request count). */
const MAX_MEASURED = 8;
/** Same bar series-page-resolver uses for a series-named page. */
const MIN_SERIES_SCORE = 0.55;
/** Sitename vs series title similarity above which the wiki is this series' own. */
const DEDICATED_WIKI_SCORE = 0.85;

/** Generic list-page names used across Fandom manga wikis. */
export const GENERIC_LIST_TITLES: readonly string[] = [
  'Chapters and Volumes', 'Volumes and Chapters', 'Volumes & Chapters', 'Chapters & Volumes',
  'List of Chapters and Volumes', 'List of Volumes and Chapters', 'Chapters and Volumes List',
  'Chapters and Volumes/Volumes', 'Chapters and Volumes/Chapters',
  'List of Chapters', 'List of chapters', 'List of Volumes', 'List of volumes',
  'Chapters', 'Volumes', 'Chapter List', 'Volume List', 'Releases (Manga)', 'Manga Guide', 'Manga',
];

/** What a page lists, measured from its rendered HTML. */
export interface ListPageContent {
  /** Distinct chapter numbers the page names or links. */
  chapters: number;
  /** Distinct volume numbers the page names, links or anchors. */
  volumes: number;
}

export interface ListPageCandidate extends ListPageContent {
  title: string;
  url: string;
}

export interface ListPageResolution {
  /** Page holding the chapter list (most distinct chapters). */
  chapterPageUrl: string;
  /** Page holding the volume list; same as chapterPageUrl when that page also has the volumes. */
  volumePageUrl: string;
  /** Every measured candidate, best chapter page first (for logging / surveys). */
  candidates: ListPageCandidate[];
  /** True when the wiki was judged to be this series' own wiki. */
  dedicatedWiki: boolean;
}

export interface ResolveListPagesOptions {
  seriesTitle?: string;
  altTitles?: string[];
  timeoutMs?: number;
  /** A page already bound to the title; kept unless a candidate clearly lists more. */
  incumbentUrl?: string;
  /** Other names of the series (synonyms), used only to tell whether the wiki is its own. */
  nameHints?: string[];
}

/** Chapter words wikis use: "Chapter 12", "Act 3" (Pluto), "Curse 5" (Dorohedoro), "Stage 7" (Evangelion), "Days 1" (Sakamoto Days). */
const CHAPTER_TEXT_RE = /\b(?:Chapter|Ch\.|Episode|Ep\.|Act|Stage|Lesson|Round|Curse|File|Mission|Phase|Night|Days|Shot|Fight|Quest)\s*#?\s*(\d{1,4})\b/gi;
/** "Chapters 1-7" / "Chapter 8–16" ranges (Black Clover's volume gallery). */
const CHAPTER_RANGE_RE = /\b(?:Chapters?|Ch\.)\s*(\d{1,4})\s*[-–—~]\s*(\d{1,4})\b/gi;
const CHAPTER_HREF_RE = /href="\/wiki\/(?:[^"]*?_)?(?:Chapter|Episode)_(\d{1,4})(?=["#_(]|%28)/gi;
/** "001. Title" / "1: Title" at the start of a list item or table cell. */
const NUMBERED_ITEM_RE = /<(?:li|td)[^>]*>\s*(?:<(?!\/)[^>]+>\s*)*(\d{1,4})\s*[.:)]\s*(?=\S)/gi;
const VOLUME_TEXT_RE = /\bVol(?:ume|\.)?[\s_]*(\d{1,3})\b/gi;
const VOLUME_ID_RE = /id="(?:Volume|Vol)_?(\d{1,3})"/gi;
const VOLUME_HREF_RE = /href="\/wiki\/(?:[^"]*?_)?Volume_(\d{1,3})(?=["#_(]|%28)/gi;
/** Longest chapter range expanded from a "Chapters N-M" label. */
const MAX_RANGE = 60;
/**
 * Parts of a page that are not its own list: prose, references, navboxes,
 * infoboxes, table of contents. A character article mentions "Chapter 12" in
 * prose and footnotes hundreds of times; a list page lists chapters in
 * tables and lists.
 */
const NOISE_SELECTORS = '.mw-parser-output > p, body > p, sup.reference, .references, .reflist, .navbox, table.navbox, .portable-infobox, aside, #toc, .toc, script, style';

function collectNumbers(re: RegExp, text: string, max: number, into: Set<number>): void {
  for (const m of text.matchAll(re)) {
    const n = Number(m[1]);
    if (n > 0 && n <= max) into.add(n);
  }
}

function collectRanges(text: string, into: Set<number>): void {
  for (const m of text.matchAll(CHAPTER_RANGE_RE)) {
    const from = Number(m[1]);
    const to = Number(m[2]);
    if (from > 0 && to >= from && to - from <= MAX_RANGE) for (let n = from; n <= to; n++) into.add(n);
  }
}

/** Ordered lists number their items: `<ol start="5">` with 4 items lists 5-8. */
function collectOrderedLists($: CheerioAPI, into: Set<number>): void {
  $('ol').each((_, ol) => {
    const items = $(ol).children('li').filter((__, li) => $(li).find('a').length > 0).length;
    if (items < 2) return;
    const start = Number($(ol).attr('start') ?? '1');
    if (!Number.isFinite(start) || start < 0) return;
    for (let i = 0; i < items; i++) into.add(start + i);
  });
}

/** Count the distinct chapter and volume numbers a rendered wiki page lists. */
export function measureListPageContent(html: string): ListPageContent {
  const $ = load(html);
  $(NOISE_SELECTORS).remove();
  const listHtml = $.html();
  const text = $.root().text().replace(/\s+/g, " ");
  const chapters = new Set<number>();
  collectNumbers(CHAPTER_TEXT_RE, text, 3000, chapters);
  collectNumbers(CHAPTER_HREF_RE, listHtml, 3000, chapters);
  collectOrderedLists($, chapters);
  const numbered = new Set<number>();
  collectNumbers(NUMBERED_ITEM_RE, listHtml, 3000, numbered);
  // Numbered rows only count when they form a real list, not a stray "1." somewhere.
  if (numbered.size >= 10) for (const n of numbered) chapters.add(n);
  // "Chapters 1-7" ranges stand in only when the page lists no chapters one by
  // one (a volume gallery); an overview's story-arc ranges must not outweigh a list.
  if (chapters.size < 10) collectRanges(text, chapters);
  chapters.delete(0);
  const volumes = new Set<number>();
  collectNumbers(VOLUME_TEXT_RE, text, 300, volumes);
  collectNumbers(VOLUME_ID_RE, listHtml, 300, volumes);
  collectNumbers(VOLUME_HREF_RE, listHtml, 300, volumes);
  return { chapters: chapters.size, volumes: volumes.size };
}

/** A page is a usable list when it names at least 10 chapters or 3 volumes. */
export function isUsableListPage(c: ListPageContent): boolean {
  return c.chapters >= 10 || c.volumes >= 3;
}

/** True when every letter of the name is Latin script (accents allowed). */
function isLatinName(name: string): boolean {
  return !/[^\p{Script=Latin}\p{N}\p{P}\p{Z}\p{S}\p{M}]/u.test(name);
}

/** True when the wiki's own name (or subdomain) is this series' title. */
export function isDedicatedWiki(sitename: string, domain: string, names: string[]): boolean {
  const site = normalizeTitle(sitename.replace(/\s*(?:wiki|wikia|encyclopedia|fandom)\s*$/i, ''));
  const sub = normalizeTitle(domain.replace(/\.(?:fandom|wikia)\.com$/i, ''));
  // Only Latin-script names: normalizeTitle drops other scripts, so
  // "JOJO的奇妙冒险 第七部" would shrink to "jojo" and match jojo.fandom.com.
  return names.filter(isLatinName).some((n) => {
    const q = normalizeTitle(n);
    return q.length >= 2 && (diceCoefficient(site, q) >= DEDICATED_WIKI_SCORE || diceCoefficient(sub, q) >= DEDICATED_WIKI_SCORE);
  });
}

/** Score a series-named page against the series title (list wrapper and disambiguation stripped). */
function seriesScore(pageTitle: string, queryNorm: string): number {
  const clean = pageTitle
    .replace(/\/.*$/, '')
    .replace(/^List of\s+/i, '')
    .replace(/\s+(chapters|chapter list|chapters and volumes|volumes)$/i, '')
    .replace(/\s*\([^)]*\)\s*$/, '');
  return diceCoefficient(normalizeTitle(clean), queryNorm);
}

function isListTitle(title: string): boolean {
  return /chapter|volume|releases|manga guide/i.test(title);
}

/**
 * Order measured candidates: most chapters first; then a page named as a
 * list; then most volumes; then the shorter title. At equal chapters the list
 * page wins over the series article: "Kimetsu no Yaiba (Manga)" and "Dr. Stone
 * (Manga)" count the same chapters from a navigation box (bare numbers, one
 * box filing a chapter a volume off), while "Chapters and Volumes" lists them
 * with their titles.
 */
export function rankByChapters(a: ListPageCandidate, b: ListPageCandidate): number {
  return b.chapters - a.chapters
    || Number(isListTitle(b.title)) - Number(isListTitle(a.title))
    || b.volumes - a.volumes
    || a.title.length - b.title.length;
}

/**
 * Pick the chapter page and the volume page from measured candidates.
 * The incumbent (an already-bound page) is kept unless it is unusable, a
 * challenger lists clearly more chapters (≥1.5× + 5), or the incumbent is a
 * series article and the challenger a list page with at least as many.
 */
export function pickListPages(
  candidates: ListPageCandidate[], incumbentUrl?: string,
): { chapterPage: ListPageCandidate; volumePage: ListPageCandidate } | null {
  const usable = candidates.filter(isUsableListPage).sort(rankByChapters);
  const best = usable[0];
  if (!best) return null;
  let chapterPage = best;
  const incumbent = incumbentUrl ? candidates.find(c => c.url === incumbentUrl) : undefined;
  const listPageTakesOver = incumbent !== undefined && isListTitle(best.title) && !isListTitle(incumbent.title)
    && best.chapters >= incumbent.chapters;
  if (incumbent && isUsableListPage(incumbent) && best.chapters < incumbent.chapters * 1.5 + 5 && !listPageTakesOver) {
    chapterPage = incumbent;
  }
  const mostVolumes = [...usable].sort((a, b) => b.volumes - a.volumes || rankByChapters(a, b))[0] ?? chapterPage;
  // Keep one page when it already carries (nearly) all the volumes.
  const volumePage = chapterPage.volumes >= mostVolumes.volumes * 0.9 ? chapterPage : mostVolumes;
  return { chapterPage, volumePage };
}

function pageUrl(domain: string, title: string): string {
  return `https://${domain}/wiki/${encodeURI(title.replace(/ /g, '_')).replace(/\?/g, '%3F').replace(/&/g, '%26')}`;
}

function titleFromUrl(url: string): string | null {
  const m = /\/wiki\/(.+)$/.exec(url);
  if (!m?.[1]) return null;
  try { return decodeURIComponent(m[1]).replace(/_/g, ' '); } catch { return m[1].replace(/_/g, ' '); }
}

async function apiGet<T>(domain: string, params: Record<string, string>, signal: AbortSignal): Promise<T | null> {
  const qs = new URLSearchParams({ format: 'json', formatversion: '2', origin: '*', ...params });
  const res = await fetch(`https://${domain}/api.php?${qs.toString()}`, { signal, headers: { 'User-Agent': USER_AGENT } });
  if (!res.ok) return null;
  return await res.json() as T;
}

interface QueryPagesResponse { query?: { pages?: Array<{ title?: string; missing?: boolean; ns?: number; pageid?: number }> } }
interface SearchResponse { query?: { search?: Array<{ title: string }> } }
interface SiteinfoResponse { query?: { general?: { sitename?: string } } }
interface ParseResponse { parse?: { title?: string; text?: string } }

/** Which of `titles` exist (after redirects), as resolved page titles in request order. */
async function existingTitles(domain: string, titles: string[], signal: AbortSignal): Promise<string[]> {
  const found: string[] = [];
  for (let i = 0; i < titles.length; i += TITLES_PER_QUERY) {
    // eslint-disable-next-line no-await-in-loop -- at most two batches; sequential keeps the wiki load polite
    const data = await apiGet<QueryPagesResponse>(domain, { action: 'query', titles: titles.slice(i, i + TITLES_PER_QUERY).join('|'), redirects: '1' }, signal);
    for (const p of data?.query?.pages ?? []) {
      if (p.missing === true || p.pageid === undefined || typeof p.title !== 'string' || p.ns !== 0) continue;
      if (!found.includes(p.title)) found.push(p.title);
    }
  }
  return found;
}

async function searchListTitles(domain: string, signal: AbortSignal): Promise<string[]> {
  const out: string[] = [];
  for (const q of ['chapters', 'volumes']) {
    // eslint-disable-next-line no-await-in-loop -- two small sequential searches
    const data = await apiGet<SearchResponse>(domain, { action: 'query', list: 'search', srsearch: q, srwhat: 'title', srnamespace: '0', srlimit: '10' }, signal);
    for (const r of data?.query?.search ?? []) {
      // A single "Chapter 12" / "Volume 3" page is not a list.
      if (/chapter|volume/i.test(r.title) && !/^(?:chapter|volume|vol\.?)\s*\d/i.test(r.title) && !out.includes(r.title)) out.push(r.title);
    }
  }
  return out;
}

async function measurePage(domain: string, title: string, signal: AbortSignal): Promise<ListPageCandidate | null> {
  const data = await apiGet<ParseResponse>(domain, { action: 'parse', page: title, prop: 'text', redirects: '1' }, signal);
  const html = data?.parse?.text;
  if (typeof html !== 'string') return null;
  const resolved = data?.parse?.title ?? title;
  return { title: resolved, url: pageUrl(domain, resolved), ...measureListPageContent(html) };
}

/** Typographic apostrophes in DB titles ("Journey’s End") never match a wiki page name ("Journey's End"). */
function straightenQuotes(s: string): string {
  return s.replace(/[‘’ʼ]/g, "'");
}

/**
 * Candidate page titles in priority order (series-named first). On the
 * series' own wiki, the first synonyms also name pages ("Call of the Night
 * (Manga)" for Yofukashi no Uta) and the generic list names are added.
 */
export function buildCandidateTitles(
  seriesTitle: string | undefined, altTitles: string[], dedicated: boolean, nameHints: string[] = [],
): string[] {
  const alts = [...altTitles, ...(dedicated ? nameHints.filter(isLatinName).slice(0, 4) : [])];
  const series = seriesTitle ? buildSeriesPageCandidates(straightenQuotes(seriesTitle), alts.map(straightenQuotes)) : [];
  return [...new Set([...series, ...(dedicated ? GENERIC_LIST_TITLES : [])])];
}

/**
 * Existing candidate pages: naming variants (one titles query, redirects
 * followed) plus, on the series' own wiki, a title search for list pages. On a
 * shared wiki only pages named after this series survive.
 */
async function gatherCandidateTitles(
  domain: string,
  ctx: { seriesTitle: string | undefined; altTitles: string[]; nameHints: string[]; dedicated: boolean },
  signal: AbortSignal,
): Promise<string[]> {
  const titles = await existingTitles(domain, buildCandidateTitles(ctx.seriesTitle, ctx.altTitles, ctx.dedicated, ctx.nameHints), signal);
  if (ctx.dedicated) {
    for (const t of await searchListTitles(domain, signal)) if (!titles.includes(t)) titles.push(t);
    return titles;
  }
  if (!ctx.seriesTitle) return titles;
  const queryNorm = normalizeTitle(ctx.seriesTitle);
  return titles.filter(t => seriesScore(t, queryNorm) >= MIN_SERIES_SCORE);
}

/**
 * Measure the bound page (first, keeping its stored URL so keeping it never
 * rewrites the cached binding) and up to 8 candidates.
 */
async function measureCandidates(
  domain: string, titles: string[], incumbentUrl: string | undefined, signal: AbortSignal,
): Promise<{ measured: ListPageCandidate[]; incumbentKept: string | undefined }> {
  const measured: ListPageCandidate[] = [];
  const incumbentTitle = incumbentUrl ? titleFromUrl(incumbentUrl) : null;
  const incumbent = incumbentUrl && incumbentTitle ? await measurePage(domain, incumbentTitle, signal) : null;
  if (incumbent && incumbentUrl) measured.push({ ...incumbent, url: incumbentUrl });

  for (const t of titles.slice(0, MAX_MEASURED)) {
    if (measured.some(m => m.title === t)) continue;
    // eslint-disable-next-line no-await-in-loop -- sequential, ≤8 parse calls per wiki
    const c = await measurePage(domain, t, signal);
    if (c && !measured.some(m => m.title === c.title)) measured.push(c);
  }
  return { measured, incumbentKept: incumbent ? incumbentUrl : undefined };
}

/**
 * Resolve the chapter-list and volume-list pages of a Fandom wiki.
 * Returns null when no page on the wiki names at least 10 chapters or 3 volumes
 * (caller falls back to its older discovery).
 */
export async function resolveListPages(
  domain: string, options: ResolveListPagesOptions = {},
): Promise<ListPageResolution | null> {
  const { seriesTitle, altTitles = [], timeoutMs = DEFAULT_TIMEOUT_MS, incumbentUrl, nameHints = [] } = options;
  const signal = AbortSignal.timeout(timeoutMs * 4);
  try {
    const site = await apiGet<SiteinfoResponse>(domain, { action: 'query', meta: 'siteinfo' }, signal);
    const sitename = site?.query?.general?.sitename ?? '';
    const dedicated = !seriesTitle || isDedicatedWiki(sitename, domain, [seriesTitle, ...altTitles, ...nameHints]);
    const titles = await gatherCandidateTitles(domain, { seriesTitle, altTitles, nameHints, dedicated }, signal);
    const { measured, incumbentKept } = await measureCandidates(domain, titles, incumbentUrl, signal);
    const picked = pickListPages(measured, incumbentKept);
    if (!picked) {
      logger.info(`[listPageResolver] No page on ${domain} lists ≥10 chapters or ≥3 volumes (${measured.length} measured)`);
      return null;
    }
    logger.info(`[listPageResolver] ${domain}: chapters → ${picked.chapterPage.title} (${picked.chapterPage.chapters} ch, ${picked.chapterPage.volumes} vol), volumes → ${picked.volumePage.title}`, {
      dedicated, candidates: measured.map(m => `${m.title}:${m.chapters}/${m.volumes}`),
    });
    return {
      chapterPageUrl: picked.chapterPage.url,
      volumePageUrl: picked.volumePage.url,
      candidates: [...measured].sort(rankByChapters),
      dedicatedWiki: dedicated,
    };
  } catch (err) {
    logger.warn(`[listPageResolver] ${domain} lookup failed: ${err instanceof Error ? err.message : String(err)}`);
    return null;
  }
}
