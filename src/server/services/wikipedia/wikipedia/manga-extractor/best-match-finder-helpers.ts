/**
 * Wikipedia Best Match Finder - Helper Functions
 *
 * Extracted helper functions to reduce complexity of the main findBestMatch function.
 * Each helper has a single, focused responsibility.
 *
 * Phase 3: Business logic helpers (support for main orchestration).
 */

import { wikipediaVolumeExtractor } from '@/server/services/wikipedia/wikipediaVolumeExtractor';
import { logger } from '@/utils/logger';

import { getVolumeList, getVolumesWithDescriptions, getChapterList } from './index';

import type {
  WikipediaMangaData,
  WikipediaVolume,
  WikipediaChapter,
  WikipediaSearchResult,
} from '../types';

/**
 * Result type for volume extraction operations
 */
export interface VolumeExtractionResult {
  volumes: WikipediaVolume[];
  chapters: WikipediaChapter[];
}

/**
 * Result type for enhanced volume extraction with updated manga info
 */
export interface EnhancedVolumeExtractionResult extends VolumeExtractionResult {
  updatedMangaInfo: WikipediaMangaData;
}

/**
 * Media type suffixes that indicate non-manga content
 * These should be filtered out when selecting the main manga page
 */
const NON_MANGA_MEDIA_SUFFIXES = [
  '(film)',
  '(anime)',
  '(TV series)',
  '(TV anime)',
  '(video game)',
  '(OVA)',
  '(ONA)',
  '(film series)',
  '(musical)',
  '(novel)',
  '(light novel)',
] as const;

/**
 * Check if a title indicates non-manga media content
 *
 * @param title - Wikipedia page title
 * @returns True if the title indicates non-manga content
 */
function isNonMangaMedia(title: string): boolean {
  const lowerTitle = title.toLowerCase();
  return NON_MANGA_MEDIA_SUFFIXES.some((suffix) =>
    lowerTitle.includes(suffix.toLowerCase())
  );
}

/**
 * Check if a title indicates a manga page (has "(manga)" suffix)
 *
 * @param title - Wikipedia page title
 * @returns True if the title has "(manga)" suffix
 */
function isMangaPage(title: string): boolean {
  return title.toLowerCase().includes('(manga)');
}

/**
 * Keywords that indicate a Wikipedia page is about a manga/comic/anime work.
 * Used as a relevance gate in `selectMainPage` — pages without `(manga)`/
 * `(comics)` in the title MUST mention one of these in their search snippet,
 * otherwise we reject. Catches false-positive matches like "Asshou" → "Assam"
 * (Indian state article) or "What I Love About You" → "What I Love About Your
 * Love" (Jana Kramer song) — both score high enough to pass the similarity
 * floor but neither is about a manga.
 */
const MANGA_RELEVANCE_KEYWORDS = /\b(manga|anime|comic[\s-]?book|tankōbon|tankobon|tank&#x14d;bon|sh&#x14d;nen|sh&#x14d;jo|shounen|shonen|shojo|seinen|josei|webtoon|manhwa|manhua|graphic novel|mangaka|serialized in|weekly\s+sh|weekly\s+sh&#x14d;nen|kodansha|shogakukan|shueisha|hakusensha|square enix|kadokawa|viz media|shonen jump|jump\s?\+|comic\s?walker|young animal|big comic|web comic|anthology|one-shot|illustrated by|written and illustrated|drawn by|Japanese\s+\w+\s+series|tank.{0,3}bon)\b/i;

// Match a non-manga descriptor anywhere inside the trailing parenthetical
// (e.g. "(The Romantics song)", "(2009 film)", "(disambiguation)"), not just
// at the start.
const SUFFIX_HINTS_NON_MANGA = /\([^)]*\b(video[\s-]?game|film|anime(?:\s+TV)?|TV\s*series|novel|album|song|band|musician|singer|actor|actress|disambiguation|company|brand|footballer|politician|fictional character|character|species)\b[^)]*\)$/i;

// Patterns that, when present early in the extract, prove the article is NOT
// about a manga — used to override HCF acceptance for fuzzy-title song/film
// matches like "What I Love About Your Love" (Jana Kramer song).
const EXTRACT_NON_MANGA_PROOF = /^.{0,200}?\b(?:is\s+a(?:n)?\s+(?:song|single|track|album|film|movie|video[\s-]?game|novel|TV\s+series|television\s+series|band|musical\s+artist|singer|composer|actor|actress|footballer|cricketer|politician|species)|by\s+(?:American|British|Japanese|Israeli|Korean|French|German|Italian|Australian)\s+(?:singer|songwriter|musician|band|composer|actor|footballer))/i;

/** Page titles whose suffix marks them unambiguously as a comic/manga article. */
const MANGA_TITLE_SUFFIXES = /\((manga|comics?|graphic novel|webtoon|webcomic|manhwa|manhua)\)$/i;

/**
 * Generic stub-page titles that should never bind as a manga article.
 * Wikipedia's MediaWiki search occasionally surfaces these short noun-phrase
 * stubs (e.g. "Season 1") when a query contains those tokens. Cold-import
 * audit caught "Cheese in the Trap Season 1" → "Season 1" page.
 */
const GENERIC_STUB_TITLE = /^(season\s*\d+|volume\s*\d+|episode\s*\d+|book\s*\d+|part\s*\d+|chapter\s*\d+|the\s+series|series\s+\d*|episode|chapter|volume)$/i;

/**
 * Threshold for accepting a page on title similarity alone (no extract keywords
 * required). Tuned to 0.85: catches exact-title matches like "The Legendary
 * Hero Is Dead!" (1.0) and "Dragon Ball" (1.0) while rejecting word-overlap
 * wrongs like "What I Love About You" → "What I Love About Your Love" (0.65,
 * Jana Kramer song with empty Wikipedia extract).
 */
const HIGH_CONFIDENCE_DIRECT_HIT_FLOOR = 0.85;

function passesMangaRelevanceGate(result: WikipediaSearchResult, query?: string): boolean {
  // Hard reject for clearly non-manga title suffixes.
  if (SUFFIX_HINTS_NON_MANGA.test(result.title)) {
    logger.warn(`[WIKIPEDIA] Page "${result.title}" rejected — non-manga suffix in title`);
    return false;
  }
  // Hard reject generic stub titles (Season N, Volume N, Episode, etc.) — these
  // are never legitimate manga article anchors. Cold-import audit caught
  // "Cheese in the Trap Season 1" → "Season 1" stub.
  if (GENERIC_STUB_TITLE.test(result.title.trim())) {
    logger.warn(`[WIKIPEDIA] Page "${result.title}" rejected — generic stub title`);
    return false;
  }
  // Hard reject pages whose paren-disambiguator is a proper-noun (location,
  // institution, etc.) absent from the query AND not a recognized manga-media
  // suffix. Cold-import audit caught "Daily Lives of High School Boys" →
  // "Boys' High School (Brooklyn)" — the (Brooklyn) tag isn't in query.
  if (query !== undefined) {
    const disambigMatch = /\(([^)]+)\)\s*$/.exec(result.title.trim());
    if (disambigMatch?.[1] && !MANGA_TITLE_SUFFIXES.test(result.title)) {
      const disambig = disambigMatch[1].toLowerCase().trim();
      const queryLower = query.toLowerCase();
      const disambigWords = disambig.split(/[\s_-]+/).filter((w) => w.length >= 3);
      const hasMatchingToken = disambigWords.some((w) => queryLower.includes(w));
      if (!hasMatchingToken) {
        logger.warn(`[WIKIPEDIA] Page "${result.title}" rejected — paren disambig "(${disambig})" not present in query "${query}"`);
        return false;
      }
    }
  }
  const extractText = result.extract ?? '';
  // Hard reject when extract proves it's a song/film/video-game/etc., even if
  // the title looks innocuous. Catches "What I Love About Your Love" (Jana
  // Kramer song) which scores high on title similarity but its extract starts
  // with "is a song by American singer-songwriter Jana Kramer".
  if (EXTRACT_NON_MANGA_PROOF.test(extractText)) {
    logger.warn(`[WIKIPEDIA] Page "${result.title}" rejected — extract proves non-manga work`);
    return false;
  }
  if (MANGA_TITLE_SUFFIXES.test(result.title)) return true;
  if (MANGA_RELEVANCE_KEYWORDS.test(extractText)) return true;
  // High-confidence direct hit — extract empty/short OR doesn't have keywords,
  // but query closely matches the page title. Catches valid manga pages whose
  // 3-sentence intro extract starts with the JP romanization (Legendary Hero
  // Is Dead, Magi, Kindaichi). Risk: also passes word-overlap wrongs like
  // Jana Kramer song. Mitigated by SUFFIX_HINTS_NON_MANGA above.
  // Short / single-token queries are too ambiguous for HCF — variant "san"
  // exact-matches Wikipedia's "San" disambig page at score 1.0 even though it
  // has nothing to do with manga. Require ≥ 8 chars AND ≥ 2 tokens before HCF
  // can fire (covers "Dragon Ball", "Vinland Saga", "Tokyo Revengers" etc.).
  const queryHasEnoughBody = query !== undefined
    && query.length >= 8 && /\s/.test(query.trim());
  if (queryHasEnoughBody && query) {
    const score = Math.max(
      similarityScore(query, result.title),
      similarityScore(stripScoringSuffix(query), stripScoringSuffix(result.title)),
    );
    if (score >= HIGH_CONFIDENCE_DIRECT_HIT_FLOOR) {
      logger.info(`[WIKIPEDIA] Page "${result.title}" accepted on high-confidence title match (${score.toFixed(2)} ≥ ${HIGH_CONFIDENCE_DIRECT_HIT_FLOOR})`);
      return true;
    }
  }
  logger.warn(`[WIKIPEDIA] Page "${result.title}" rejected — no manga relevance in title or extract`);
  return false;
}

/**
 * Minimum dice × length-ratio similarity required between the query title and
 * the picked Wikipedia page title. Below this we return null to avoid
 * cross-binding to unrelated topics — e.g. "Asshou" was matching to
 * "Association football", "Praise the Orc!" to the generic "Orc" article.
 * Tuned against post-purge re-enrichment data: 0.30 catches all sub-0.10
 * cross-bindings while letting "(manga)" suffix matches like
 * "Dragon Ball (manga)" (0.51) and "Code Geass: Nightmare of Nunnally"
 * (parent-franchise sub-pages) pass.
 */
const MIN_TITLE_SIMILARITY = 0.30;

function buildBigrams(s: string): Set<string> {
  const norm = s.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
  const out = new Set<string>();
  for (let i = 0; i < norm.length - 1; i++) out.add(norm.slice(i, i + 2));
  return out;
}

function similarityScore(a: string, b: string): number {
  const A = buildBigrams(a);
  const B = buildBigrams(b);
  if (A.size === 0 && B.size === 0) return 1;
  if (A.size === 0 || B.size === 0) return 0;
  let inter = 0;
  for (const x of A) if (B.has(x)) inter++;
  const dice = (2 * inter) / (A.size + B.size);
  const la = a.length, lb = b.length;
  const ratio = (la === 0 || lb === 0) ? 0 : Math.min(la, lb) / Math.max(la, lb);
  return dice * ratio;
}

/** Strip "(manga)"/"(video game)"/"List of X chapters" suffixes for scoring. */
function stripScoringSuffix(title: string): string {
  return title
    .replace(/\s*\([^)]*\)\s*$/u, '')
    .replace(/^List of\s+|\s+chapters?$/giu, '')
    .trim();
}

function passesSimilarityFloor(query: string, candidate: string): boolean {
  const score = Math.max(
    similarityScore(query, candidate),
    similarityScore(stripScoringSuffix(query), stripScoringSuffix(candidate)),
  );
  if (score < MIN_TITLE_SIMILARITY) {
    logger.warn(`[WIKIPEDIA] Rejecting page "${candidate}" — similarity ${score.toFixed(2)} < ${MIN_TITLE_SIMILARITY} for query "${query}"`);
    return false;
  }
  return true;
}

/**
 * iter-MM-9-B: detect a sub-series suffix in the query.
 *
 * "A Certain Magical Index SS" -> "SS"
 * "Super Robot Wars OG" -> "OG"
 * "A Certain Magical Index NT" -> "NT"
 * "Berserk" -> null
 *
 * Returns the uppercased suffix, or null when the query is for a
 * top-level series. Case-INSENSITIVE match but case-preserved return
 * is uppercased so callers can do `\bSS\b` regex tests reliably.
 *
 * Known suffixes deliberately limited to short, unambiguous tokens that
 * appear as standalone words at the END of a manga title. Common
 * franchise sub-series markers across Japanese light novel / manga
 * properties:
 *   - SS: Short Stories (Toaru, Date A Live, Hyakuren no Haou)
 *   - NT: New Testament (Toaru, sequel arc)
 *   - OG: Original Generation (Super Robot Wars)
 *   - SP: Special (Toaru SP, Code Geass SP)
 *   - Re: Reboot/Renewal (Code Geass: Re;, Mahou Sensei Negima!? Re:)
 */
export function extractSubSeriesSuffix(query: string): string | null {
  const m = /\b(SS|NT|OG|SP|Re)\s*$/i.exec(query.trim());
  if (!m?.[1]) return null;
  return m[1].toUpperCase();
}

/**
 * iter-MM-9-B: sub-series suffix gate. When the query carries a
 * sub-series suffix, the candidate page MUST satisfy one of:
 *   1. Its title contains the same suffix as a standalone word
 *      (e.g. "A Certain Magical Index SS" -> page contains "SS").
 *   2. Its similarity to the full query is >= 0.85 (direct hit).
 *
 * Otherwise reject. This prevents the parent-series article from
 * winning when the query was clearly for a spinoff
 * (the "A Certain Magical Index SS" -> "A Certain Magical Index_season_2"
 * mis-bind that motivated iter-MM-9).
 *
 * Note: returning null is preferred over a parent-series binding
 * here. The Wikipedia EXTRACTOR pulls infobox data (volume count,
 * chapter count) from whatever page wins — and the parent's infobox
 * carries main-series data that overrides the AL anchor count.
 * Better to leave unbound than to bind the parent.
 *
 * Queries without a suffix bypass the gate.
 */
export function passesSubSeriesGate(query: string, candidate: string): boolean {
  const suffix = extractSubSeriesSuffix(query);
  if (!suffix) return true;
  const escapedSuffix = suffix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  if (new RegExp(`\\b${escapedSuffix}\\b`, 'i').test(candidate)) return true;
  if (similarityScore(query, candidate) >= 0.85) return true;
  logger.warn(`[WIKIPEDIA] Sub-series gate rejected "${candidate}" — suffix "${suffix}" missing AND similarity < 0.85 for query "${query}"`);
  return false;
}

/**
 * Select the main manga page from search results
 * Prioritizes:
 * 1. Pages with "(manga)" suffix (most specific)
 * 2. Pages without non-manga media suffixes (film, anime, TV series, etc.)
 * 3. Pages that are not disambiguation or list pages
 *
 * Also enforces a similarity floor against the query — Wikipedia search
 * returns loose-keyword matches that previously bound wrong articles
 * (e.g. "Asshou" → "Association football"). See `MIN_TITLE_SIMILARITY` above.
 *
 * @param searchResults - Wikipedia search results
 * @param query - The search query (passed through from `searchWithVariants`)
 * @returns Main page or null if no suitable page found
 */
export function selectMainPage(
  searchResults: WikipediaSearchResult[],
  query?: string,
): WikipediaSearchResult | null {
  if (searchResults.length === 0) return null;

  // iter-MM-9-B: when query has a sub-series suffix (SS/NT/OG/SP/Re),
  // the candidate must carry the same suffix or be a direct-hit. This
  // is the 10th guard in the WP-matcher line — see passesSubSeriesGate.
  // No fallback to "List of …" articles: those carry parent-series
  // infobox data that would override the AL anchor count via the
  // Wikipedia extractor.
  const filterByQuery = (r: WikipediaSearchResult): boolean => {
    if (!query) return true;
    if (!passesSimilarityFloor(query, r.title)) return false;
    if (!passesSubSeriesGate(query, r.title)) return false;
    return true;
  };
  const filterByRelevance = (r: WikipediaSearchResult): boolean => passesMangaRelevanceGate(r, query);
  const scoreFor = (r: WikipediaSearchResult): number => {
    if (!query) return 0;
    return Math.max(
      similarityScore(query, r.title),
      similarityScore(stripScoringSuffix(query), stripScoringSuffix(r.title)),
    );
  };
  const pickBest = (cands: WikipediaSearchResult[]): WikipediaSearchResult | undefined => {
    if (cands.length === 0) return undefined;
    if (!query) return cands[0];
    return [...cands].sort((a, b) => scoreFor(b) - scoreFor(a))[0];
  };

  // Priority 1: pages with explicit "(manga)" suffix — these are unambiguous,
  // pick the highest-similarity one when multiple exist (e.g. "Berserk (manga)"
  // vs "Berserk Volumes (manga)" against query "Berserk").
  const mangaPages = searchResults.filter(
    (r) => !r.isDisambiguation && isMangaPage(r.title) && filterByQuery(r),
  );
  const mangaPage = pickBest(mangaPages);
  if (mangaPage) {
    logger.info(`[WIKIPEDIA] Selected manga-specific page: "${mangaPage.title}"`);
    return mangaPage;
  }

  // Priority 2: best-scoring non-list non-media page among query+relevance passers.
  // Switched from first-match to best-score so "Tatsuki Fujimoto Before Chainsaw
  // Man" beats "Chainsaw Man" when query matches the full title.
  const mainCands = searchResults.filter(
    (r) =>
      !r.isDisambiguation &&
      !r.title.includes('List of') &&
      !r.title.includes('chapters') &&
      !isNonMangaMedia(r.title) &&
      filterByQuery(r) &&
      filterByRelevance(r),
  );
  const mainPage = pickBest(mainCands);
  if (mainPage) {
    logger.info(`[WIKIPEDIA] Selected main page (filtered non-manga): "${mainPage.title}"`);
    return mainPage;
  }

  const fallbackCands = searchResults.filter(
    (r) => !r.isDisambiguation && filterByQuery(r) && filterByRelevance(r),
  );
  const fallback = pickBest(fallbackCands);
  if (fallback) {
    logger.warn(`[WIKIPEDIA] Using fallback page (all manga-specific filtered): "${fallback.title}"`);
    return fallback;
  }

  if (query) {
    logger.warn(`[WIKIPEDIA] No page passed similarity floor for query "${query}" (${searchResults.length} results filtered)`);
    return null;
  }
  return searchResults[0] ?? null;
}

/**
 * Extract enhanced volume data using the wikipediaVolumeExtractor
 * Creates updated manga info with metadata from the extractor
 *
 * @param title - Manga title to extract
 * @param mangaInfo - Manga info to update
 * @returns Volumes, chapters, and updated manga info
 */
export async function extractEnhancedVolumeData(
  title: string,
  mangaInfo: WikipediaMangaData
): Promise<EnhancedVolumeExtractionResult> {
  logger.info(
    `[WIKIPEDIA] Attempting enhanced extractor for: "${title}"`
  );

  try {
    const volumeData = await wikipediaVolumeExtractor.extractVolumeData(title);

    logger.info(`[WIKIPEDIA] Enhanced extractor returned:`, {
      hasData: !!volumeData,
      volumeCount: volumeData?.volumes.length ?? 0,
      totalVolumes: volumeData?.totalVolumes ?? 0,
    });

    if (!volumeData || volumeData.volumes.length === 0) {
      return { volumes: [], chapters: [], updatedMangaInfo: mangaInfo };
    }

    logger.info(
      `[WIKIPEDIA] Enhanced extractor found ${volumeData.volumes.length} volumes with rich metadata`
    );

    // Convert extractor volumes to WikipediaVolume format
    const volumesWithSummaries = volumeData.volumes.map((vol) => {
      const volume: WikipediaVolume = {
        number: parseInt(vol.number) || 0,
        chapters:
          vol.chapters?.map((ch) => ({
            number: ch.number,
            title: ch.title ?? '',
          })) ?? [],
      };

      const volTitle = vol.title ?? vol.englishTitle ?? vol.japaneseTitle;
      if (volTitle) volume.title = volTitle;

      const altTitles = [vol.japaneseTitle, vol.englishTitle].filter(
        Boolean
      ) as string[];
      if (altTitles.length > 0) volume.alternativeTitles = altTitles;

      if (vol.releaseDate) volume.originalReleaseDate = vol.releaseDate;
      if (vol.isbn) volume.isbn = vol.isbn;
      if (vol.summary) {
        volume.description = vol.summary;
        volume.summary = vol.summary;
      }

      return volume;
    });

    // Extract all chapters from volumes
    const allChapters: WikipediaChapter[] = [];
    volumesWithSummaries.forEach((vol) => {
      if (vol.chapters.length > 0) {
        allChapters.push(...vol.chapters);
      }
    });

    // Create updated manga info with volume data (no mutation)
    // Only update fields that don't exist and have values from extractor
    const updates: Partial<WikipediaMangaData> = {};

    if (!mangaInfo.volumes && volumeData.totalVolumes) {
      updates.volumes = volumeData.totalVolumes;
    }
    if (!mangaInfo.chapters && volumeData.totalChapters) {
      updates.chapters = volumeData.totalChapters;
    }
    if (!mangaInfo.publisher && volumeData.publisher) {
      updates.publisher = volumeData.publisher;
    }
    if (!mangaInfo.englishPublisher && volumeData.englishPublisher) {
      updates.englishPublisher = volumeData.englishPublisher;
    }

    const updatedMangaInfo: WikipediaMangaData = {
      ...mangaInfo,
      ...updates,
    };

    return {
      volumes: volumesWithSummaries,
      chapters: allChapters,
      updatedMangaInfo,
    };
  } catch (error) {
    logger.error(
      `[WIKIPEDIA] Enhanced extractor error:`,
      error instanceof Error ? error.message : String(error)
    );
    return { volumes: [], chapters: [], updatedMangaInfo: mangaInfo };
  }
}

/**
 * Merge additional volumes from volume list URL
 * Enriches existing volumes with descriptions and adds missing volumes
 *
 * @param existingVolumes - Volumes already extracted
 * @param volumeListUrl - URL to fetch additional volumes from
 * @returns Merged volume list with descriptions where available
 */
export async function mergeAdditionalVolumes(
  existingVolumes: WikipediaVolume[],
  volumeListUrl: string
): Promise<WikipediaVolume[]> {
  logger.info(
    `[WIKIPEDIA] Fetching enriched volume list from: ${volumeListUrl}`
  );

  // Use getVolumesWithDescriptions to try getting descriptions first
  const enrichedVolumes = await getVolumesWithDescriptions(volumeListUrl);
  const allVolumesList = enrichedVolumes.length > 0
    ? enrichedVolumes
    : await getVolumeList(volumeListUrl);

  // Track existing volume numbers for quick lookup (normalize to number for consistent comparison)
  const existingVolumeNumbers = new Set(
    existingVolumes.map((v) => Number(v.number))
  );

  // Merge: enrich existing volumes with descriptions if available
  const mergedVolumes: WikipediaVolume[] = existingVolumes.map((existing) => {
    const enriched = allVolumesList.find((v) => Number(v.number) === Number(existing.number));
    // Prefer enriched data if it has description and existing doesn't
    if (enriched?.description && !existing.description) {
      return { ...existing, description: enriched.description };
    }
    return existing;
  });

  // Add any missing volumes (normalize to number for consistent comparison)
  const missingVolumes = allVolumesList.filter(
    (v) => !existingVolumeNumbers.has(Number(v.number))
  );

  if (missingVolumes.length > 0) {
    logger.info(
      `[WIKIPEDIA] Adding ${missingVolumes.length} additional volumes (total: ${mergedVolumes.length + missingVolumes.length})`
    );
  }

  const enrichedCount = mergedVolumes.filter((v) => v.description).length;
  if (enrichedCount > 0) {
    logger.info(
      `[WIKIPEDIA] Enriched ${enrichedCount} volumes with descriptions`
    );
  }

  return [...mergedVolumes, ...missingVolumes].sort(
    (a, b) => a.number - b.number
  );
}

/**
 * Fetch enriched volumes with descriptions from volume list URL
 * Falls back to regular volume list if no descriptions found
 *
 * @param volumeListUrl - URL to fetch volumes from
 * @returns Volumes with descriptions or regular volumes
 */
export async function fetchEnrichedVolumes(
  volumeListUrl: string
): Promise<WikipediaVolume[]> {
  logger.info(
    `[WIKIPEDIA] Following volume list URL: ${volumeListUrl}`
  );

  // Try to get volumes with descriptions (like Kaiju No. 8)
  const enrichedVolumes = await getVolumesWithDescriptions(volumeListUrl);

  if (enrichedVolumes.length > 0) {
    logger.info(
      `[WIKIPEDIA] Found ${enrichedVolumes.length} volumes with descriptions`
    );
    return enrichedVolumes;
  }

  // Fall back to regular volume list
  const regularVolumes = await getVolumeList(volumeListUrl);
  logger.info(
    `[WIKIPEDIA] Found ${regularVolumes.length} regular volumes`
  );
  return regularVolumes;
}

/**
 * Process chapter list: fetch chapters and assign them to volumes
 * Updates volumes with chapter assignments and returns chapters
 *
 * @param mangaTitle - Manga title to search for
 * @param volumes - Volumes to assign chapters to
 * @returns Updated volumes and chapter list
 */
export async function processChapterList(
  mangaTitle: string,
  volumes: WikipediaVolume[]
): Promise<{ chapters: WikipediaChapter[]; updatedVolumes: WikipediaVolume[] }> {
  const chapters = await getChapterList(mangaTitle);

  if (chapters.length === 0) {
    return { chapters: [], updatedVolumes: volumes };
  }

  logger.info(
    `[WIKIPEDIA] Found ${chapters.length} chapters from chapter list`
  );

  if (volumes.length === 0) {
    return { chapters, updatedVolumes: volumes };
  }

  logger.info(
    `[WIKIPEDIA] Assigning ${chapters.length} chapters to ${volumes.length} volumes`
  );

  // Clear existing chapters in volumes and reassign
  let updatedVolumes = volumes.map((vol) => ({
    ...vol,
    chapters: [] as WikipediaChapter[],
  }));

  // Assign each chapter to its volume
  chapters.forEach((chapter) => {
    if (chapter.volumeNumber) {
      const volume = updatedVolumes.find(
        (v) => v.number === chapter.volumeNumber
      );
      if (volume) {
        volume.chapters.push(chapter);
      }
    }
  });

  // Calculate chapter ranges for volumes
  updatedVolumes = calculateVolumeChapterRanges(updatedVolumes);

  logger.info(`[WIKIPEDIA] Chapter assignment complete`);

  return { chapters, updatedVolumes };
}

/**
 * Calculate and update chapter ranges for volumes
 * Pure function that computes chapter ranges based on volume chapters
 *
 * @param volumes - Volumes to calculate ranges for
 * @returns Volumes with updated chapter ranges
 */
export function calculateVolumeChapterRanges(
  volumes: WikipediaVolume[]
): WikipediaVolume[] {
  return volumes.map((vol) => {
    if (vol.chapters.length === 0) {
      return vol;
    }

    const chapterNumbers = vol.chapters
      .map((ch) =>
        typeof ch.number === 'number'
          ? ch.number
          : parseInt(String(ch.number), 10)
      )
      .filter((n) => !isNaN(n));

    if (chapterNumbers.length === 0) {
      return vol;
    }

    const minChapter = Math.min(...chapterNumbers);
    const maxChapter = Math.max(...chapterNumbers);

    return {
      ...vol,
      chapterRange:
        minChapter === maxChapter
          ? `${minChapter}`
          : `${minChapter}-${maxChapter}`,
    };
  });
}

/**
 * Generate missing chapter list from volume data
 * Creates a synthetic chapter list when individual chapters aren't available
 *
 * @param volumes - Volumes containing chapter information
 * @returns Generated chapter list
 */
export function generateMissingChapterList(
  volumes: WikipediaVolume[]
): WikipediaChapter[] {
  // Calculate max chapter from volume data
  let maxChapter = 0;

  volumes.forEach((vol) => {
    if (vol.chapters.length > 0) {
      const lastChapter = Math.max(
        ...vol.chapters.map((ch) =>
          typeof ch.number === 'number'
            ? ch.number
            : parseInt(String(ch.number), 10)
        )
      );
      if (lastChapter > maxChapter) {
        maxChapter = lastChapter;
      }
    }
  });

  if (maxChapter === 0) {
    return [];
  }

  // Generate full chapter list
  const chapters: WikipediaChapter[] = [];
  for (let i = 1; i <= maxChapter; i++) {
    const volumeNum =
      volumes.find((v) => v.chapters.some((ch) => ch.number === i))?.number ?? 0;

    chapters.push({
      number: i,
      title: `Chapter ${i}`,
      volumeNumber: volumeNum,
    });
  }

  return chapters;
}
