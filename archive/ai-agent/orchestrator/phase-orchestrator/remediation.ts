/**
 * Per-Source Remediation — Validation-Driven Remediation Loop
 *
 * Tries multiple strategies per source in sequence with validation gates:
 *   1. Deterministic probing (known URL patterns)
 *   2. Re-fetch with fixed fragment handling
 *   3. Direct HTML extraction (regex patterns on raw HTML)
 *   4. AI-guided page selection → deterministic parser → AI extraction last resort
 *
 * Fandom, Wikipedia, and ComicVine remediation run in parallel.
 * ComicVine remediation is in ./comicvine-remediation.ts.
 */

import type {
  ChapterDataItem,
  SourceDataCollection,
} from '@/server/trpc/routers/manga/metadataOperations/enrichment-pipeline/types';
import { logger } from '@/utils/logger';

import {
  evaluatePageContent,
  gatherFandomCandidates,
  gatherWikipediaCandidates,
  selectBestPage,
} from './ai-page-evaluator';
import { validateSourceData } from './validation';

const log = logger.child('SourceRemediation');

type WikiDiscovery = typeof import('@/server/trpc/routers/manga/metadataOperations/enrichment-pipeline/wiki-discovery');

const FANDOM_CHAPTER_PAGE_PATTERNS = [
  '/wiki/Chapters',
  '/wiki/Chapter_List',
  '/wiki/List_of_Chapters',
  '/wiki/Chapters_and_Volumes',
];

const WIKIPEDIA_BASE = 'https://en.wikipedia.org/wiki/';

// ============================================================================
// Per-Source Remediation Functions
// ============================================================================

/**
 * Remediate Fandom data using multiple strategies with validation gates.
 * Stops as soon as data is acceptable.
 */
export async function remediateFandom(
  data: SourceDataCollection,
  wikiDiscovery: WikiDiscovery,
): Promise<void> {
  const expected = data.expectedChapterCount;
  if (validateSourceData('fandom', data.sources.fandom, expected).isAcceptable) return;

  let bestResult = data.sources.fandom;
  let bestUrl = data.rawData.fandomUrl;

  // Attempt 1: Retry if completely failed
  const retryResult = await retryFandomDiscovery(data, wikiDiscovery);
  if (retryResult && retryResult.chapters.length > bestResult.length) {
    bestResult = retryResult.chapters;
    bestUrl = retryResult.url;
    if (checkAndUpdate('fandom', data, bestResult, expected, bestUrl)) return;
  }

  // Attempt 2: Probe known chapter list page URL patterns
  if (data.rawData.fandomUrl) {
    const probeResult = await probeFandomPages(data.rawData.fandomUrl, wikiDiscovery);
    if (probeResult.chapters.length > bestResult.length) {
      bestResult = probeResult.chapters;
      bestUrl = probeResult.url;
      if (checkAndUpdate('fandom', data, bestResult, expected, bestUrl)) return;
    }
  }

  // Attempt 3: Direct HTML extraction on current URL
  if (data.rawData.fandomUrl) {
    const directResult = await wikiDiscovery.directChapterExtract(data.rawData.fandomUrl);
    if (directResult.length > bestResult.length) {
      bestResult = directResult;
      if (checkAndUpdate('fandom', data, bestResult, expected, bestUrl)) return;
    }
  }

  // Attempt 4: AI-guided page selection → deterministic parser → AI extraction fallback
  if (data.rawData.fandomUrl) {
    const aiResult = await tryFandomPageSelection(data, bestResult, expected, wikiDiscovery);
    if (aiResult.length > bestResult.length) {
      bestResult = aiResult;
      if (checkAndUpdate('fandom', data, bestResult, expected, bestUrl)) return;
    }
  }

  // Accept best result even if not acceptable
  if (bestResult.length > data.sources.fandom.length) {
    updateFandom(data, bestResult, bestUrl);
    log.info('Fandom remediation: accepted best non-ideal result', {
      chapters: bestResult.length,
    });
  }
}

/**
 * Remediate Wikipedia data using multiple strategies with validation gates.
 */
export async function remediateWikipedia(
  data: SourceDataCollection,
  wikiDiscovery: WikiDiscovery,
): Promise<void> {
  const expected = data.expectedChapterCount;
  if (validateSourceData('wikipedia', data.sources.wikipedia, expected).isAcceptable) return;

  let bestResult = data.sources.wikipedia;

  // Attempt 1: Re-fetch with original title (fragment bug now fixed)
  const result = await wikiDiscovery.fetchWikipediaChapterData(data.title, data.mangaId);
  if (result && result.chapterList.length > bestResult.length) {
    bestResult = result.chapterList;
    if (checkAndUpdate('wikipedia', data, bestResult, expected)) return;
  }

  // Attempt 2: Try alternative search queries
  const altQueries = [
    `${data.title} chapter list`,
    `${data.title} manga chapters`,
  ];
  for (const query of altQueries) {
    // eslint-disable-next-line no-await-in-loop -- Sequential probing with early return on success
    const altResult = await wikiDiscovery.fetchWikipediaChapterData(query, data.mangaId);
    if (altResult && altResult.chapterList.length > bestResult.length) {
      bestResult = altResult.chapterList;
      if (checkAndUpdate('wikipedia', data, bestResult, expected)) return;
    }
  }

  // Attempt 3: AI-guided page selection (1 model call instead of N)
  const selectionResult = await tryWikipediaPageSelection(data.title, expected, data.mangaId, wikiDiscovery);
  if (selectionResult.length > bestResult.length) {
    bestResult = selectionResult;
    if (checkAndUpdate('wikipedia', data, bestResult, expected)) return;
  }

  // Accept best result even if not acceptable
  if (bestResult.length > data.sources.wikipedia.length) {
    updateWikipedia(data, bestResult);
    log.info('Wikipedia remediation: accepted best non-ideal result', {
      chapters: bestResult.length,
    });
  }
}

/**
 * AI page evaluation fallback for sources still failing after remediation.
 * Evaluates pages with wrong-page detection for Fandom and Wikipedia.
 */
export async function runRawHtmlFallback(data: SourceDataCollection): Promise<void> {
  const expected = data.expectedChapterCount;

  if (data.rawData.fandomUrl && !validateSourceData('fandom', data.sources.fandom, expected).isAcceptable) {
    await tryFandomPageEvaluation(data);
  }
  if (!validateSourceData('wikipedia', data.sources.wikipedia, expected).isAcceptable) {
    await tryWikipediaPageEvaluation(data);
  }
}

/** AI-guided Fandom page selection: gather candidates → select → parse */
async function tryFandomPageSelection(
  data: SourceDataCollection,
  currentBest: ChapterDataItem[],
  expected: number,
  wikiDiscovery: WikiDiscovery,
): Promise<ChapterDataItem[]> {
  const fandomUrl = data.rawData.fandomUrl;
  if (!fandomUrl) return currentBest;

  try {
    // Step 1: Gather candidates via MediaWiki API
    const candidates = await gatherFandomCandidates(fandomUrl);

    // Step 2: Select best page (deterministic shortcut or model)
    const selection = await selectBestPage(candidates, data.title, expected, 'fandom');

    // Step 3: If selected, run parser → regex fallback → AI extraction last resort
    if (selection.selectedUrl) {
      const result = await wikiDiscovery.fetchFandomChapterData(selection.selectedUrl);
      if (result.parseSuccess && result.chapterList.length > currentBest.length) {
        return result.chapterList;
      }
      const directResult = await wikiDiscovery.directChapterExtract(selection.selectedUrl);
      if (directResult.length > currentBest.length) return directResult;
      // AI extraction last resort
      const evalResult = await evaluatePageContent(selection.selectedUrl, data.title, expected, 'fandom');
      if (evalResult.isCorrectPage && evalResult.extractedChapters.length > currentBest.length) {
        return evalResult.extractedChapters;
      }
    }

    // Step 4: No page selected but model suggested a query → re-search
    if (!selection.selectedUrl && selection.suggestedQuery) {
      return await aiGuidedFandomReSearch(selection.suggestedQuery, fandomUrl, wikiDiscovery);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log.warn('Fandom page selection failed', { error: msg });
  }

  return currentBest;
}

/** Re-search Fandom using MediaWiki search API with the AI-suggested query */
async function aiGuidedFandomReSearch(
  query: string,
  fandomUrl: string,
  wikiDiscovery: WikiDiscovery,
): Promise<ChapterDataItem[]> {
  try {
    const baseUrl = fandomUrl.replace(/\/wiki\/.*$/, '');
    const searchUrl = `${baseUrl}/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&srlimit=3`;

    const response = await fetch(searchUrl, {
      headers: { 'User-Agent': 'MugiwariKaizoku/1.0 (manga metadata enrichment)' },
    });
    if (!response.ok) return [];

    const searchData: unknown = await response.json();
    const results = extractSearchResults(searchData);
    if (results.length === 0) return [];

    const topTitle = results[0] ?? '';
    const foundUrl = `${baseUrl}/wiki/${encodeURIComponent(topTitle.replace(/ /g, '_'))}`;

    log.info('AI-guided Fandom re-search found page', { query, foundUrl });

    const fetchResult = await wikiDiscovery.fetchFandomChapterData(foundUrl);
    return fetchResult.parseSuccess ? fetchResult.chapterList : [];
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log.warn('AI-guided Fandom re-search failed', { query, error: msg });
    return [];
  }
}

/** Fallback page evaluation for Fandom (used in runRawHtmlFallback) */
async function tryFandomPageEvaluation(data: SourceDataCollection): Promise<void> {
  const fandomUrl = data.rawData.fandomUrl;
  if (!fandomUrl) return;

  try {
    const evalResult = await evaluatePageContent(fandomUrl, data.title, data.expectedChapterCount, 'fandom');
    if (!evalResult.isCorrectPage || evalResult.extractedChapters.length <= data.sources.fandom.length) return;

    log.info('AI page evaluation improved Fandom data', {
      before: data.sources.fandom.length,
      after: evalResult.extractedChapters.length,
    });

    /* eslint-disable no-param-reassign -- Intentional in-place mutation */
    data.sources.fandom = evalResult.extractedChapters;
    data.rawData.fandomParseSuccess = true;
    /* eslint-enable no-param-reassign */
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log.warn('Fandom page evaluation fallback failed', { error: msg });
  }
}

/** AI-guided Wikipedia page selection: gather candidates → select → parse */
async function tryWikipediaPageSelection(
  title: string,
  expected: number,
  mangaId: number,
  wikiDiscovery: WikiDiscovery,
): Promise<ChapterDataItem[]> {
  try {
    // Step 1: Gather candidates via Wikipedia search API
    const candidates = await gatherWikipediaCandidates(title);
    if (candidates.length === 0) return [];

    // Step 2: Select best page (one model call instead of N)
    const selection = await selectBestPage(candidates, title, expected, 'wikipedia');

    // Step 3: If selected, run parser → AI extraction last resort
    if (selection.selectedUrl) {
      const extractedTitle = decodeURIComponent(
        selection.selectedUrl.replace('https://en.wikipedia.org/wiki/', ''),
      ).replace(/_/g, ' ');
      const result = await wikiDiscovery.fetchWikipediaChapterData(extractedTitle, mangaId);
      if (result && result.chapterList.length > 0) return result.chapterList;
      // AI extraction last resort
      const evalResult = await evaluatePageContent(selection.selectedUrl, title, expected, 'wikipedia');
      if (evalResult.isCorrectPage) return evalResult.extractedChapters;
    }

    // Step 4: No page selected but model suggested a query → re-search
    if (!selection.selectedUrl && selection.suggestedQuery) {
      return await searchAndRescrapeWikipedia(selection.suggestedQuery, title, expected, mangaId, wikiDiscovery);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log.warn('Wikipedia page selection failed', { error: msg });
  }

  return [];
}

/**
 * Search Wikipedia API for the correct page, then re-run the deterministic parser.
 * Falls back to AI extraction only if the parser still fails.
 */
async function searchAndRescrapeWikipedia(
  query: string,
  title: string,
  expected: number,
  mangaId: number,
  wikiDiscovery: WikiDiscovery,
): Promise<ChapterDataItem[]> {
  try {
    const foundTitle = await searchWikipediaForTitle(query);
    if (!foundTitle) return [];

    log.info('Wikipedia AI re-search: found page, re-running parser', { query, foundTitle });

    // Step 1: Re-run deterministic parser on the found page (second scraping attempt)
    const parserResult = await wikiDiscovery.fetchWikipediaChapterData(foundTitle, mangaId);
    if (parserResult && parserResult.chapterList.length > 0) {
      log.info('Wikipedia re-scrape succeeded via parser', { chapters: parserResult.chapterList.length });
      return parserResult.chapterList;
    }

    // Step 2: Parser failed — fall back to AI extraction on the found page
    const url = `${WIKIPEDIA_BASE}${encodeURIComponent(foundTitle.replace(/ /g, '_'))}`;
    const evalResult = await evaluatePageContent(url, title, expected, 'wikipedia');
    return evalResult.isCorrectPage ? evalResult.extractedChapters : [];
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log.warn('Wikipedia re-scrape failed', { query, error: msg });
    return [];
  }
}

/** Search Wikipedia API and return the top result title */
async function searchWikipediaForTitle(query: string): Promise<string | null> {
  const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&srlimit=3`;

  const response = await fetch(searchUrl, {
    headers: { 'User-Agent': 'MugiwariKaizoku/1.0 (manga metadata enrichment)' },
  });
  if (!response.ok) return null;

  const searchData: unknown = await response.json();
  const results = extractSearchResults(searchData);
  return results[0] ?? null;
}

/** Fallback page selection for Wikipedia (used in runRawHtmlFallback) */
async function tryWikipediaPageEvaluation(data: SourceDataCollection): Promise<void> {
  const wikiDiscovery = await import(
    '@/server/trpc/routers/manga/metadataOperations/enrichment-pipeline/wiki-discovery'
  );
  try {
    const chapters = await tryWikipediaPageSelection(
      data.title, data.expectedChapterCount, data.mangaId, wikiDiscovery,
    );
    if (chapters.length <= data.sources.wikipedia.length) return;

    log.info('Wikipedia AI page selection improved data', {
      before: data.sources.wikipedia.length, after: chapters.length,
    });

    /* eslint-disable no-param-reassign -- Intentional in-place mutation */
    data.sources.wikipedia = chapters;
    data.rawData.wikipediaParseSuccess = true;
    /* eslint-enable no-param-reassign */
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log.warn('Wikipedia page evaluation fallback failed', { error: msg });
  }
}

// ============================================================================
// Helpers
// ============================================================================

/** Extract page titles from MediaWiki search API response */
function extractSearchResults(data: unknown): string[] {
  if (!data || typeof data !== 'object') return [];
  const obj = data as Record<string, unknown>;
  const query = obj['query'];
  if (!query || typeof query !== 'object') return [];
  const queryObj = query as Record<string, unknown>;
  const search = queryObj['search'];
  if (!Array.isArray(search)) return [];

  return search
    .filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null)
    .map(item => typeof item['title'] === 'string' ? item['title'] : '')
    .filter(title => title.length > 0);
}

/** Retry Fandom discovery when initial fetch completely failed */
async function retryFandomDiscovery(
  data: SourceDataCollection, wikiDiscovery: WikiDiscovery,
): Promise<{ chapters: ChapterDataItem[]; url: string } | null> {
  if (data.sources.fandom.length > 0 || data.rawData.fandomUrl) return null;
  const url = await wikiDiscovery.discoverFandomWikiUrl(data.mangaId, data.title);
  if (!url) return null;
  const result = await wikiDiscovery.fetchFandomChapterData(url);
  return result.parseSuccess && result.chapterList.length > 0
    ? { chapters: result.chapterList, url }
    : null;
}

/** Validate, update if acceptable, and return whether to stop */
function checkAndUpdate(
  source: 'fandom' | 'wikipedia', data: SourceDataCollection,
  chapters: ChapterDataItem[], expected: number, url?: string,
): boolean {
  if (!validateSourceData(source, chapters, expected).isAcceptable) return false;
  if (source === 'fandom') updateFandom(data, chapters, url);
  else updateWikipedia(data, chapters);
  return true;
}

/** Probe Fandom wiki for chapter list pages using known URL patterns */
async function probeFandomPages(
  fandomUrl: string, wikiDiscovery: WikiDiscovery,
): Promise<{ chapters: ChapterDataItem[]; url: string }> {
  const baseUrl = fandomUrl.replace(/\/wiki\/.*$/, '');
  let bestChapters: ChapterDataItem[] = [];
  let bestUrl = fandomUrl;
  for (const pattern of FANDOM_CHAPTER_PAGE_PATTERNS) {
    const probeUrl = `${baseUrl}${pattern}`;
    // eslint-disable-next-line no-await-in-loop -- Sequential probing with early return
    const probeResult = await probeSingleFandomPage(probeUrl, wikiDiscovery);
    if (probeResult && probeResult.length > bestChapters.length) {
      bestChapters = probeResult;
      bestUrl = probeUrl;
      log.info('Fandom probe found better page', { url: probeUrl, chapters: bestChapters.length });
    }
  }
  return { chapters: bestChapters, url: bestUrl };
}

/** Probe a single Fandom page URL, returning chapters or null on failure */
async function probeSingleFandomPage(
  url: string, wikiDiscovery: WikiDiscovery,
): Promise<ChapterDataItem[] | null> {
  try {
    const result = await wikiDiscovery.fetchFandomChapterData(url);
    return result.parseSuccess ? result.chapterList : null;
  } catch { return null; }
}

/** Update Fandom source data in-place */
function updateFandom(data: SourceDataCollection, chapters: ChapterDataItem[], url: string | undefined): void {
  /* eslint-disable no-param-reassign -- Intentional in-place mutation of SourceDataCollection */
  data.sources.fandom = chapters;
  if (url) data.rawData.fandomUrl = url;
  data.rawData.fandomParseSuccess = true;
  /* eslint-enable no-param-reassign */
}

/** Update Wikipedia source data in-place */
function updateWikipedia(data: SourceDataCollection, chapters: ChapterDataItem[]): void {
  /* eslint-disable no-param-reassign -- Intentional in-place mutation of SourceDataCollection */
  data.sources.wikipedia = chapters;
  data.rawData.wikipediaParseSuccess = true;
  /* eslint-enable no-param-reassign */
}
