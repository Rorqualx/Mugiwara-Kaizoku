/**
 * Wiki Discovery — Shared Fandom/Wikipedia Fetch Logic
 *
 * Provides reusable functions for discovering and fetching data from
 * Fandom and Wikipedia wikis. Extracted from phase-fandom-enrichment.ts
 * and wikipedia-fallback/data-fetching.ts so that Phase 1 can also
 * call these without triggering DB application logic.
 */

import { prisma } from '@/server/db';
import { logger } from '@/utils/logger';

import {
  normalizeWikipediaChapters,
  normalizeFandomChapters,
  normalizeFandomVolumes,
} from './wiki-discovery/chapter-normalization';
import { directChapterExtract } from './wiki-discovery/direct-chapter-extract';
import { discoverViaFandomSearch } from './wiki-discovery/fandom-search-discovery';
import { discoverViaInterwikiLinks } from './wiki-discovery/interwiki-discovery';
import { discoverViaMediaWikiSearch } from './wiki-discovery/mediawiki-search-discovery';
import { buildPageExistenceValidator } from './wiki-discovery/parent-page-validator';
import { collectParentVariants } from './wiki-discovery/parent-variants';
import { getSyntheticMetadata } from './wiki-discovery/synthetic-metadata-shim';

import type { ChapterDataItem, VolumeDataItem, UnifiedProviderResults } from './types';

// Re-export for external consumers (wiki-scrape-tool, remediation, test runner, etc.)
export { directChapterExtract };
export { normalizeWikipediaChapters, normalizeFandomChapters, normalizeFandomVolumes };

const log = logger.child('WikiDiscovery');

// ============================================================================
// Fandom Discovery + Fetch
// ============================================================================

/**
 * Discover the best Fandom wiki URL for a manga title.
 *
 * Strategy order:
 * 1. Check Metadata.urls for a previously cached Fandom URL
 * 2. Direct domain probing ({slug}.fandom.com)
 * 2.5. Interwiki discovery via animanga.fandom.com catalog wiki
 * 3. Fandom search API with primary + alternative titles
 *
 * On success, persists the URL to Metadata.urls (fire-and-forget).
 */
export async function discoverFandomWikiUrl(
  mangaId: number,
  title: string,
  forceRefresh?: boolean,
  externalAltTitles?: string[],
): Promise<string | null> {
  const { isManuallyUnbound } = await import('./manual-binding-sentinel');
  if (await isManuallyUnbound(mangaId, 'fandom')) {
    log.info(`Skipping Fandom discovery for manga ${mangaId} — manually marked as unbound`);
    return null;
  }
  if (forceRefresh) {
    log.info('Force refresh: clearing cached Fandom URL');
    await clearCachedFandomUrl(mangaId);
  } else {
    const cachedUrl = await getCachedFandomUrl(mangaId);
    if (cachedUrl) {
      log.info(`Using cached Fandom URL: ${cachedUrl}`);
      return cachedUrl;
    }
  }

  const altTitles = await loadAltTitlesForFandom(mangaId, title, externalAltTitles);

  const { validateFandomWiki } = await import('./wiki-discovery/fandom-wiki-validator');
  const validate = async (url: string): Promise<{ valid: boolean; reason: string }> =>
    validateFandomWiki(url, title, { altTitles });

  // Tier 0: AniList externalLinks — when AniList lists a Fandom URL, prefer it.
  // AL's link is often correct (e.g. yuusha-ga-shinda.fandom.com for "The
  // Legendary Hero Is Dead!" — discovery wouldn't have found this slug from the
  // English title). But AL can be wrong too (e.g. `super.fandom.com` for
  // SUPER HXEROS, `pleaseteacher.fandom.com` for Hanazono Twins) — pass through
  // the same validator before accepting.
  const fromAnilist = await readAnilistFandomUrl(mangaId);
  if (fromAnilist) {
    const accepted = await tryAndCacheFandom(fromAnilist, 'AniList externalLinks', validate, mangaId);
    if (accepted) return accepted;
  }

  // Tier 1: Direct domain probing — many manga have dedicated {slug}.fandom.com wikis.
  // Pass altTitles so romaji/native slugs get probed alongside the English form
  // (e.g. "Ace of the Diamond" → daiya-no-ace, "Komi Can't Communicate" →
  // komi-san-wa-komyushou-desu).
  const direct = await tryAndCacheFandom(await tryDirectFandomDomain(title, altTitles), 'direct domain probe', validate, mangaId);
  if (direct) return direct;

  // Page-existence validator for the primary title — used as a fallback for
  // interwiki/MediaWiki hits when standard sitename validation rejects (e.g.
  // "Demon Slayer" → kimetsu-no-yaiba.fandom.com — sitename "Kimetsu no Yaiba"
  // doesn't match primary "Demon Slayer", but the wiki hosts a "Demon Slayer"
  // page so it's the right binding). Same trust gate as Tier 5: animanga
  // interwiki + MediaWiki search are editor-curated.
  const topLevelPageExistenceValidate = buildPageExistenceValidator([title, ...altTitles]);

  // Tier 2.5: Interwiki discovery via catalog wikis (animanga.fandom.com)
  // Handles non-obvious wiki domains (e.g., "Monster" → obluda.fandom.com)
  const interwikiUrl = await discoverViaInterwikiLinks(title);
  const interwiki = await tryAndCacheFandom(interwikiUrl, 'interwiki discovery', validate, mangaId)
    ?? await tryAndCacheFandom(interwikiUrl, 'interwiki page-existence', topLevelPageExistenceValidate, mangaId);
  if (interwiki) return interwiki;

  // Tier 3: MediaWiki API search on catalog wikis (bypasses Cloudflare unlike CrossWiki)
  const mediaWikiUrl = await discoverViaMediaWikiSearch(title);
  const mediaWiki = await tryAndCacheFandom(mediaWikiUrl, 'MediaWiki search', validate, mangaId)
    ?? await tryAndCacheFandom(mediaWikiUrl, 'MediaWiki page-existence', topLevelPageExistenceValidate, mangaId);
  if (mediaWiki) return mediaWiki;

  // Tier 4: Fandom search API (walks top N results)
  const search = await discoverViaFandomSearch(title, altTitles, validate);
  if (search) {
    void updateCachedFandomUrl(mangaId, search);
    return search;
  }

  // Tier 5: Sub-series fallback. When the title carries an SS / Part / Vol /
  // Season / Book / Arc suffix, the parent series often shares a single Fandom
  // wiki (e.g. "A Certain Magical Index SS" → toarumajutsunoindex.fandom.com,
  // "JoJo's Bizarre Adventure Part 2" → jojo.fandom.com). Strip the suffix from
  // both the primary title AND each alt title (English + romaji), since the
  // wiki slug often follows the JP romaji ("toarumajutsunoindex") rather than
  // the English form ("a-certain-magical-index"). Only one level of fallback
  // to avoid recursion.
  const subSeriesHit = await trySubSeriesFallback(mangaId, title, altTitles, validate);
  if (subSeriesHit) return subSeriesHit;

  return null;
}

/**
 * Tier 5 — sub-series fallback. Strip the suffix from the primary title and
 * each alt title (English + romaji), then probe direct slugs + catalog
 * discovery + Fandom search on the primary parent variant.
 *
 * Helps for spinoff/seasonal titles that share the parent's wiki:
 *   - "A Certain Magical Index SS" → toarumajutsunoindex (via JP romaji slug)
 *   - "Soul Eater NOT!" — handled at Tier 1 since the title still slugs cleanly
 *   - "Strike Witches 1937" → worldwitches (via parent Fandom search)
 */
async function trySubSeriesFallback(
  mangaId: number,
  title: string,
  altTitles: string[],
  validate: (u: string) => Promise<{ valid: boolean; reason: string }>,
): Promise<string | null> {
  const parentVariants = collectParentVariants(title, altTitles);
  if (parentVariants.length === 0) return null;

  log.info(`Tier 5 sub-series fallback: "${title}" → trying parent variants ${JSON.stringify(parentVariants)}`);
  for (const variant of parentVariants) {
    // eslint-disable-next-line no-await-in-loop -- Sequential probing with early return
    const probed = await tryDirectFandomDomain(variant);
    // eslint-disable-next-line no-await-in-loop -- Sequential probing with early return
    const parentDirect = await tryAndCacheFandom(
      probed, `parent direct probe (${variant})`, validate, mangaId,
    );
    if (parentDirect) return parentDirect;
  }
  // Catalog-based discovery on the primary parent variant. Interwiki +
  // MediaWiki search walk animanga.fandom.com which often redirects to the
  // franchise wiki (e.g. "Strike Witches" → worldwitches.fandom.com). When
  // the franchise wiki is named differently from the manga (worldwitches vs
  // "Strike Witches Wiki"), token-overlap validation rejects it — so we use
  // a page-existence validator that accepts when the wiki hosts a page for
  // any parent variant. The animanga interwiki is editor-curated and
  // reliable enough to trust this looser gate.
  const primaryParent = parentVariants[0] ?? title;
  const pageExistenceValidate = buildPageExistenceValidator(parentVariants);

  const parentInterwiki = await tryAndCacheFandom(
    await discoverViaInterwikiLinks(primaryParent), `parent interwiki (${primaryParent})`, pageExistenceValidate, mangaId,
  );
  if (parentInterwiki) return parentInterwiki;

  const parentMediaWiki = await tryAndCacheFandom(
    await discoverViaMediaWikiSearch(primaryParent), `parent MediaWiki search (${primaryParent})`, pageExistenceValidate, mangaId,
  );
  if (parentMediaWiki) return parentMediaWiki;

  const parentSearch = await discoverViaFandomSearch(primaryParent, altTitles, validate);
  if (parentSearch) {
    void updateCachedFandomUrl(mangaId, parentSearch);
    return parentSearch;
  }
  return null;
}


/** Validate a candidate URL and persist it to Metadata.urls when accepted. */
async function tryAndCacheFandom(
  url: string | null,
  source: string,
  validate: (u: string) => Promise<{ valid: boolean; reason: string }>,
  mangaId: number,
): Promise<string | null> {
  if (!url) return null;
  const v = await validate(url);
  if (v.valid) {
    log.info(`Found Fandom wiki via ${source}: ${url} (${v.reason})`);
    void updateCachedFandomUrl(mangaId, url);
    return url;
  }
  log.info(`${source} rejected: ${url} — ${v.reason}`);
  return null;
}

/**
 * Merge DB synonyms with caller-supplied alt titles. Caller hands in variants
 * that aren't in DB yet because Phase 1 runs before Metadata.synonyms is persisted.
 */
async function loadAltTitlesForFandom(
  mangaId: number,
  title: string,
  externalAltTitles: string[] | undefined,
): Promise<string[]> {
  // Synthetic-test shim: when the harness has seeded synonyms for this id,
  // use those instead of querying prisma. Returns null in production.
  const synthetic = getSyntheticMetadata(mangaId);
  const dbSynonyms = synthetic?.synonyms
    ?? (await prisma.manga.findUnique({
      where: { id: mangaId },
      include: { Metadata: { select: { synonyms: true, authors: true } } },
    }))?.Metadata?.synonyms
    ?? [];
  return [...new Set([...dbSynonyms, ...(externalAltTitles ?? [])])]
    .filter(t => typeof t === 'string' && t.length >= 3 && t !== title);
}

/**
 * Read a Fandom URL from AniList's externalLinks if one is published there.
 *
 * Returns dedicated-subdomain URLs only (e.g. `dandadan.fandom.com`); skips
 * catalog-wiki paths (`webtoon.fandom.com/wiki/X`, `manga.fandom.com/wiki/X`)
 * because those are validated separately and rarely yield correct chapter
 * data. Returns `null` when no usable URL is published.
 */
async function readAnilistFandomUrl(mangaId: number): Promise<string | null> {
  try {
    // Synthetic-test shim: when the harness has seeded externalLinks for this
    // id, use those instead of prisma. Returns null in production.
    const synthetic = getSyntheticMetadata(mangaId);
    const metadata = synthetic?.externalLinks !== undefined
      ? { externalLinks: synthetic.externalLinks }
      : await prisma.metadata.findFirst({
          where: { Manga: { id: mangaId } },
          select: { externalLinks: true },
        });
    const links = metadata?.externalLinks;
    if (!Array.isArray(links)) return null;
    for (const raw of links) {
      if (raw === null || typeof raw !== 'object') continue;
      const obj = raw as Record<string, unknown>;
      if (obj['site'] !== 'Fandom') continue;
      const url = typeof obj['url'] === 'string' ? obj['url'] : null;
      if (url === null) continue;
      // Skip catalog-wiki paths — fandom-wiki-validator rejects them anyway,
      // but skipping here saves an unneeded HTTP probe.
      const m = /^https?:\/\/([a-z0-9-]+)\.fandom\.com/i.exec(url);
      if (!m?.[1]) continue;
      const subdomain = m[1].toLowerCase();
      if (CATALOG_FANDOM_SUBDOMAINS.has(subdomain)) continue;
      return url;
    }
    return null;
  } catch {
    return null;
  }
}

/** Subdomains we always skip when sourced from AniList — catalog wikis that
 * host loosely-validated per-series pages. The validator rejects these too,
 * but skipping early avoids a doomed HTTP probe per manga. */
const CATALOG_FANDOM_SUBDOMAINS = new Set([
  'webtoon', 'manga', 'anime', 'animanga', 'isekai', 'yaoi', 'yuripedia',
  'koreanwebtoons', 'kodansha-comics', 'shonen-magazine',
]);

/** Check Metadata.urls for a previously stored Fandom URL */
async function getCachedFandomUrl(mangaId: number): Promise<string | null> {
  try {
    const metadata = await prisma.metadata.findFirst({
      where: { Manga: { id: mangaId } },
      select: { urls: true },
    });
    if (!metadata) return null;
    const fandomUrl = metadata.urls.find(u => u.includes('.fandom.com'));
    return fandomUrl ?? null;
  } catch {
    return null;
  }
}

/** Remove any cached Fandom URL from Metadata.urls so discovery starts fresh */
async function clearCachedFandomUrl(mangaId: number): Promise<void> {
  try {
    const metadata = await prisma.metadata.findFirst({
      where: { Manga: { id: mangaId } },
      select: { id: true, urls: true },
    });
    if (!metadata) return;

    const fandomUrl = metadata.urls.find(u => u.includes('.fandom.com'));
    if (!fandomUrl) return;

    const updatedUrls = metadata.urls.filter(u => u !== fandomUrl);
    await prisma.metadata.update({
      where: { id: metadata.id },
      data: { urls: updatedUrls },
    });
    log.info(`Cleared stale Fandom URL: ${fandomUrl}`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log.warn(`Failed to clear cached Fandom URL: ${msg}`);
  }
}

/** Persist a discovered Fandom URL to Metadata.urls (fire-and-forget).
 *  Replaces any existing Fandom URL when the domain changes (cross-wiki redirect). */
export async function updateCachedFandomUrl(mangaId: number, url: string): Promise<void> {
  try {
    const metadata = await prisma.metadata.findFirst({
      where: { Manga: { id: mangaId } },
      select: { id: true, urls: true },
    });
    if (!metadata) return;

    const existingFandom = metadata.urls.find(u => u.includes('.fandom.com'));
    if (existingFandom === url) return; // Already stored, no-op

    // Replace stale Fandom URL or add new one
    const updatedUrls = existingFandom
      ? metadata.urls.map(u => (u === existingFandom ? url : u))
      : [...metadata.urls, url];

    await prisma.metadata.update({
      where: { id: metadata.id },
      data: { urls: updatedUrls },
    });
    if (existingFandom) {
      log.info(`Replaced stale Fandom URL: ${existingFandom} → ${url}`);
    } else {
      log.info(`Stored Fandom URL in Metadata.urls: ${url}`);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log.warn(`Failed to store Fandom URL: ${msg}`);
  }
}

/**
 * Try to find a dedicated Fandom wiki by probing common domain slugs.
 * e.g., "Goodnight Punpun" → tries punpun.fandom.com, goodnight-punpun.fandom.com
 */
async function tryDirectFandomDomain(
  title: string, altTitles: ReadonlyArray<string> = [],
): Promise<string | null> {
  const slugs = generateFandomSlugs(title, altTitles);
  if (slugs.length === 0) return null;

  for (const slug of slugs) {
    const apiUrl = `https://${slug}.fandom.com/api.php?action=query&meta=siteinfo&format=json`;
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      // eslint-disable-next-line no-await-in-loop -- Sequential probing with early return
      const response = await fetch(apiUrl, {
        signal: controller.signal,
        headers: { 'User-Agent': 'MugiwaraKaizoku/1.0 (manga-metadata-fetcher)' },
      });
      clearTimeout(timeout);

      if (response.ok) {
        // Validate wiki has chapter/volume content before accepting
        // eslint-disable-next-line no-await-in-loop -- Sequential validation with early return
        const hasContent = await wikiHasChapterContent(slug);
        if (!hasContent) {
          log.info(`Direct domain probe: ${slug}.fandom.com exists but has no chapter content, skipping`);
          continue;
        }
        // Return domain-only URL — don't guess the page path because the wiki page
        // name often differs from the manga title (e.g., "Title_(manga)", disambiguation).
        // The adaptive parser and MediaWiki fallback will discover the correct page.
        const wikiUrl = `https://${slug}.fandom.com`;
        log.info(`Direct domain probe found wiki: ${slug}.fandom.com`);
        return wikiUrl;
      }
    } catch {
      // Probe failed — try next slug
    }
  }

  return null;
}

/** Quick check if a Fandom wiki has chapter/volume content (indicates manga wiki) */
async function wikiHasChapterContent(slug: string): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const searchUrl = `https://${slug}.fandom.com/api.php?action=query&list=search&srsearch=Chapter&srlimit=3&format=json`;
    const response = await fetch(searchUrl, {
      signal: controller.signal,
      headers: { 'User-Agent': 'MugiwaraKaizoku/1.0 (manga-metadata-fetcher)' },
    });
    clearTimeout(timeout);

    if (!response.ok) return false;
    const data = await response.json() as { query?: { search?: Array<{ title: string }> } };
    const results = data.query?.search ?? [];
    // Accept if any result title contains "Chapter" or "Volume"
    return results.some(r => /chapter|volume|episode/i.test(r.title));
  } catch {
    return false;
  }
}

/** Well-known title aliases for Fandom domain discovery */
const FANDOM_SLUG_ALIASES: Record<string, string[]> = {
  'detective conan': ['detectiveconan', 'case-closed'],
  'case closed': ['detectiveconan', 'detective-conan'],
  'monster': ['obluda', 'naoki-urasawa-monster'],
  'attack on titan': ['shingekinokyojin', 'attackontitan'],
  'shingeki no kyojin': ['shingekinokyojin', 'attackontitan'],
  'my hero academia': ['bokunoheroacademia', 'myheroacademia'],
  'boku no hero academia': ['bokunoheroacademia', 'myheroacademia'],
  'fullmetal alchemist': ['fma', 'fullmetalalchemist'],
  'jujutsu kaisen': ['jujutsukaisen', 'jujutsu-kaisen'],
  'demon slayer': ['kimetsu-no-yaiba', 'kimetsunoyaiba'],
  'kimetsu no yaiba': ['kimetsu-no-yaiba', 'kimetsunoyaiba', 'demon-slayer'],
  'one punch man': ['onepunchman', 'one-punch-man'],
  'tokyo ghoul': ['tokyoghoul', 'tokyo-ghoul'],
  'hunter x hunter': ['hunterxhunter', 'hunter-x-hunter'],
  'fairy tail': ['fairytail', 'fairy-tail'],
  'sword art online': ['swordartonline', 'sword-art-online'],
  'death note': ['deathnote', 'death-note'],
  'dragon ball': ['dragonball', 'dragon-ball'],
  'black clover': ['blackclover', 'black-clover'],
  'spy x family': ['spy-x-family', 'spyxfamily'],
  'chainsaw man': ['chainsawman', 'chainsaw-man'],
  'vinland saga': ['vinlandsaga', 'vinland-saga'],
  'blue lock': ['bluelock', 'blue-lock'],
  'promised neverland': ['yakusokunoneverland', 'the-promised-neverland'],
  'yakusoku no neverland': ['yakusokunoneverland', 'the-promised-neverland'],
  'made in abyss': ['madeinabyss', 'made-in-abyss'],
  'solo leveling': ['solo-leveling', 'sololeveling'],
  'na honjaman level up': ['solo-leveling', 'sololeveling'],
  'slam dunk': ['slamdunk', 'slam-dunk'],
  'vagabond': ['vagabond'],
  'dandadan': ['dandadan'],
  'haikyuu': ['haikyuu', 'haikyu'],
  'kingdom': ['kingdom', 'kingdom-manga'],
  'noragami': ['noragami'],
  'oshi no ko': ['oshinoko', 'oshi-no-ko'],
  'frieren': ['frieren'],
  'sousou no frieren': ['frieren'],
  'inuyasha': ['inuyasha', 'inu-yasha'],
  'parasyte': ['parasyte', 'kiseijuu'],
  'kaguya-sama': ['kaguyasama-wa-kokurasetai', 'kaguya-sama'],
  'kaguya-sama wa kokurasetai': ['kaguyasama-wa-kokurasetai', 'kaguya-sama'],
  'soul eater': ['souleater', 'soul-eater'],
  'kuroko no basket': ['kurokonobasuke', 'kuroko-no-basket'],
  'record of ragnarok': ['record-of-ragnarok', 'shuumatsu-no-valkyrie'],
  'shuumatsu no valkyrie': ['record-of-ragnarok', 'shuumatsu-no-valkyrie'],
  'world trigger': ['worldtrigger', 'world-trigger'],
  'kaiju no 8': ['kaiju-no-8', 'kaijuno8'],
  'fruits basket': ['fruitsbasket', 'fruits-basket'],
  'eyeshield 21': ['eyeshield21', 'eyeshield-21'],
  'd.gray-man': ['dgrayman', 'd-gray-man'],
  'dgray-man': ['dgrayman', 'd-gray-man'],
  'zatch bell': ['zatchbell', 'zatch-bell'],
  'konjiki no gash bell': ['zatchbell'],
  'undead unluck': ['undead-unluck', 'undeadunluck'],
  'witch hat atelier': ['witch-hat-atelier'],
  'tongari boushi no atelier': ['witch-hat-atelier'],
  'toradora': ['tora-dora', 'toradora'],
  'mashle': ['mashle'],
  'ajin': ['ajin'],
  'gantz': ['gantz'],
  'magi': ['magi'],
  'magi the labyrinth of magic': ['magi'],
  'gintama': ['gintama'],
  'kengan ashura': ['kenganverse', 'kengan-ashura'],
  'sakamoto days': ['sakamoto-days'],
  'the quintessential quintuplets': ['5hanayome', '5toubun-no-hanayome'],
  '5-toubun no hanayome': ['5hanayome'],
  'gotoubun no hanayome': ['5hanayome'],
};

/**
 * Generate the slug variations for a single normalized title.
 * Returns slugs in priority order (full → manga-suffixed → individual words).
 */
function slugVariantsForTitle(title: string): string[] {
  const slugs: string[] = [];
  const normalized = title.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
  const words = normalized.split(/\s+/).filter(w => w.length > 0);
  if (words.length === 0) return slugs;

  const aliases = FANDOM_SLUG_ALIASES[normalized];
  if (aliases) slugs.push(...aliases);

  // Split words at letter-digit boundaries: ["kaiju", "no8"] → ["kaiju", "no", "8"]
  const splitWords = words.flatMap(w => {
    const parts = w.match(/[a-z]+|\d+/g);
    return parts && parts.length > 1 ? parts : [w];
  });
  if (splitWords.length !== words.length) {
    slugs.push(splitWords.join('-'));
  }

  slugs.push(words.join('-'));        // "goodnight-punpun"
  slugs.push(words.join(''));         // "goodnightpunpun"
  slugs.push(`${words.join('-')}-manga`);
  slugs.push(`${words.join('')}manga`);

  const stopWords = new Set(['the', 'a', 'an', 'of', 'no', 'na', 'wa', 'ga', 'to', 'and', 'in', 'on']);
  for (const word of words) {
    if (!stopWords.has(word) && word.length >= 3 && !slugs.includes(word)) {
      slugs.push(word);
    }
  }
  const lastWord = words[words.length - 1];
  if (lastWord && !slugs.includes(lastWord)) {
    slugs.push(lastWord);
  }
  return slugs;
}

/**
 * Generate Fandom domain slug candidates from the primary title plus optional
 * alt-titles (romaji, native-romanized, English synonyms). Cold-import audit
 * caught misses on titles whose canonical Fandom subdomain is the romaji form
 * (e.g. "Ace of the Diamond" / "Daiya no Ace" → daiya-no-ace.fandom.com,
 * "Komi Can't Communicate" / "Komi-san wa Komyushou Desu" →
 * komi-san-wa-komyushou-desu.fandom.com). The English title alone misses
 * these; threading romaji through expands coverage.
 */
function generateFandomSlugs(title: string, altTitles: ReadonlyArray<string> = []): string[] {
  const seen = new Set<string>();
  const ordered: string[] = [];
  const push = (s: string): void => { if (!seen.has(s)) { seen.add(s); ordered.push(s); } };
  // Primary title slugs first (preserve priority).
  for (const s of slugVariantsForTitle(title)) push(s);
  // Then alt-titles (romaji/native), interleaved by priority within their own
  // variant list. Capped at first 4 alt-titles to bound HTTP probe count.
  for (const alt of altTitles.slice(0, 4)) {
    if (!alt || alt.toLowerCase() === title.toLowerCase()) continue;
    for (const s of slugVariantsForTitle(alt)) push(s);
  }
  // Slug budget bumped 12 → 20 to fit alt-title slugs without crowding out
  // primary-title slugs that previously fit comfortably.
  return ordered.slice(0, 20);
}

/**
 * Fetch chapter and volume data from a Fandom wiki URL using the adaptive parser.
 * Returns normalized ChapterDataItem/VolumeDataItem arrays.
 *
 * When the adaptive parser follows interwiki links to a different domain
 * (e.g., monstermanga → obluda), the `resolvedDomain` is returned so callers
 * can update the cached URL.
 */
// eslint-disable-next-line complexity -- Multi-strategy fetch: page-passthrough + self-heal retry + adaptive parse + direct-extract fallback + cross-wiki redirect detection. Each branch is a distinct, necessary fallback; splitting would scatter the single linear fetch flow.
export async function fetchFandomChapterData(fandomUrl: string, seriesTitle?: string, seriesAltTitles?: string[]): Promise<{
  chapterList: ChapterDataItem[];
  volumeList: VolumeDataItem[];
  rawHtml?: string;
  parseSuccess: boolean;
  /** Domain the parser actually used, if different from the input URL */
  resolvedDomain?: string;
  /** Full article-page URL the parser actually extracted from (for persistence) */
  resolvedPageUrl?: string;
}> {
  const { adaptiveParse } = await import('@/server/services/fandom/adaptive');

  try {
    const domain = extractFandomDomain(fandomUrl);
    // When a full article-page URL is bound (e.g. a previously-resolved
    // ".../wiki/Attack_on_Titan:_Before_the_Fall_(Manga)"), pass it through so
    // adaptiveParse parses that page directly instead of re-stripping to the
    // wiki root and re-running generic discovery (which finds the parent series).
    const looksLikePage = /\.fandom\.com\/wiki\/.+/i.test(fandomUrl);
    const parseInput = looksLikePage ? fandomUrl : (domain ?? fandomUrl);
    const parseOpts = {
      fallbackToLegacy: true,
      useCache: false,
      ...(seriesTitle ? { seriesTitle } : {}),
      ...(seriesAltTitles && seriesAltTitles.length > 0 ? { seriesAltTitles } : {}),
    };
    let result = await adaptiveParse(parseInput, parseOpts);

    // Self-heal: a bound article page that no longer yields data (e.g. wiki
    // rename / moved page) re-runs discovery from the domain, which
    // re-resolves the current series page via resolveSeriesPageUrl.
    if ((!result.success || !result.data) && looksLikePage && domain) {
      log.info(`Bound page ${fandomUrl} yielded no data — retrying discovery from domain ${domain}`);
      result = await adaptiveParse(domain, parseOpts);
    }

    if (!result.success || !result.data) {
      log.info(`Adaptive parser returned no data for ${fandomUrl}, trying direct extraction`);
      return await tryDirectFallbackOrFail(fandomUrl);
    }

    // Detect cross-wiki redirect (e.g., monstermanga → obluda)
    // Check both result.domain and the domain in parsedUrl for cross-wiki discovery
    const inputDomain = domain ?? '';
    const parsedUrlDomain = extractFandomDomain(result.parsedUrl);
    const actualDomain = parsedUrlDomain ?? result.domain;
    const resolvedDomain = actualDomain !== inputDomain ? actualDomain : undefined;
    if (resolvedDomain) {
      log.info(`Adaptive parser followed cross-wiki redirect: ${inputDomain} → ${resolvedDomain}`);
    }

    const chapterList = normalizeFandomChapters(result.data);
    const volumeList = normalizeFandomVolumes(result.data);

    if (chapterList.length === 0) {
      log.info(`Adaptive parser found 0 chapters (${volumeList.length} volumes) from ${fandomUrl}, trying direct extraction`);
      const directChapters = await directChapterExtract(fandomUrl);
      if (directChapters.length > 0) {
        return { chapterList: directChapters, volumeList, parseSuccess: true, resolvedPageUrl: result.parsedUrl, ...(resolvedDomain ? { resolvedDomain } : {}) };
      }
    }

    log.info(`Fandom fetch: ${chapterList.length} chapters, ${volumeList.length} volumes from ${fandomUrl}`);
    return { chapterList, volumeList, parseSuccess: chapterList.length > 0, resolvedPageUrl: result.parsedUrl, ...(resolvedDomain ? { resolvedDomain } : {}) };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log.warn(`Fandom fetch failed: ${msg}`);
    return { chapterList: [], volumeList: [], parseSuccess: false };
  }
}

/** Try direct extraction fallback, return failure if nothing found */
async function tryDirectFallbackOrFail(fandomUrl: string): Promise<{
  chapterList: ChapterDataItem[];
  volumeList: VolumeDataItem[];
  parseSuccess: boolean;
}> {
  const directChapters = await directChapterExtract(fandomUrl);
  if (directChapters.length > 0) {
    return { chapterList: directChapters, volumeList: [], parseSuccess: true };
  }
  return { chapterList: [], volumeList: [], parseSuccess: false };
}

// ============================================================================
// Wikipedia Discovery + Fetch
// ============================================================================

/**
 * Fetch Wikipedia chapter data for a manga title.
 * Uses findBestMatch + adaptive extraction, then normalizes to ChapterDataItem[].
 */
export async function fetchWikipediaChapterData(
  title: string,
  mangaId: number,
  hints?: { anilistId?: number; malId?: number; anilistChapters?: number; malChapters?: number; mangadexChapters?: number },
): Promise<UnifiedProviderResults['wikipediaResult']> {
  try {
    const { isManuallyUnbound } = await import('./manual-binding-sentinel');
    if (await isManuallyUnbound(mangaId, 'wikipedia')) {
      log.info(`Skipping Wikipedia discovery for manga ${mangaId} — manually marked as unbound`);
      return null;
    }
    const { fetchWikipediaData, fetchAlternativeTitles } = await import('./wikipedia-fallback/data-fetching');

    const wikiHints = hints ? {
      ...(hints.anilistId ? { anilistId: hints.anilistId } : {}),
      ...(hints.malId ? { malId: hints.malId } : {}),
      ...(hints.anilistChapters ? { anilistChapters: hints.anilistChapters } : {}),
      ...(hints.malChapters ? { malChapters: hints.malChapters } : {}),
      ...(hints.mangadexChapters ? { mangadexChapters: hints.mangadexChapters } : {}),
    } : undefined;

    let data = await fetchWikipediaData(title, wikiHints);

    // Try alternative titles if primary fails
    if (!data) {
      const altTitles = await fetchAlternativeTitles(mangaId);
      for (const altTitle of altTitles.slice(0, 3)) {
        log.info(`Wikipedia: trying alt title "${altTitle}"`);
        // eslint-disable-next-line no-await-in-loop -- Sequential fallback with early return
        data = await fetchWikipediaData(altTitle);
        if (data) break;
      }
    }

    if (!data) {
      log.info(`No Wikipedia data found for "${title}"`);
      return null;
    }

    const chapterList = normalizeWikipediaChapters(data);
    log.info(`Wikipedia fetch: ${chapterList.length} chapters for "${title}"`);

    return { data, chapterList };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log.warn(`Wikipedia fetch failed: ${msg}`);
    return null;
  }
}

/** Extract the domain from a Fandom URL so adaptive parser runs its internal URL discovery */
function extractFandomDomain(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.hostname.endsWith('.fandom.com')) {
      return parsed.hostname; // e.g., "bleach.fandom.com"
    }
    return null;
  } catch {
    return null;
  }
}

