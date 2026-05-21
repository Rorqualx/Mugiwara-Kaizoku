/**
 * AI Page Evaluator — Candidate Gathering, Selection, and Last-Resort Extraction
 *
 * v2: Model acts as investigator (picks right URL), deterministic parser extracts.
 * AI extraction is kept only as absolute last-resort fallback.
 *
 * Flow: Gather candidates → deterministic shortcut or model picks best →
 *       parser extracts chapters → AI extraction only if parser fails.
 */

import { Qwen35InferenceService } from '@/server/ai-agent/agent-core/inference-service';
import { PAGE_EVALUATION_PROMPT, PAGE_SELECTION_PROMPT } from '@/server/ai-agent/agent-core/prompt-engineer';
import type { ChapterDataItem } from '@/server/trpc/routers/manga/metadataOperations/enrichment-pipeline/types';
import { isError, isSuccess } from '@/utils/async-result';
import { logger } from '@/utils/logger';

import { withTimeout } from './context-builder';
import { cleanHtmlToStructuredText as _cleanHtmlToStructuredText } from './structured-text-converter';

const log = logger.child('AIPageEvaluator');

/** Max content size sent to model: 12KB (~3K tokens), fits in 32K context */
const MAX_CONTENT_LENGTH = 12288;

/** Timeout per evaluation call (180s — large chapter lists need ~150s at ~10 tok/s) */
const EVALUATION_TIMEOUT_MS = 180000;

/** Timeout for page selection (model outputs ~30 tokens, 60s generous margin) */
const SELECTION_TIMEOUT_MS = 60000;

/** Known Fandom page title patterns for chapter lists */
const FANDOM_PROBE_TITLES = ['Chapters', 'Chapter_List', 'List_of_Chapters', 'Chapters_and_Volumes'];

// ============================================================================
// Types
// ============================================================================

export interface PageEvaluationResult {
  isCorrectPage: boolean;
  extractedChapters: ChapterDataItem[];
  suggestedQuery: string | null;
  reasoning: string;
  confidence: number;
}

/** A candidate wiki page discovered via MediaWiki API */
export interface CandidatePage {
  title: string;
  url: string;
  size: number;
  snippet: string;
  status: 'found' | 'not_found';
}

/** Result of AI-guided page selection from candidates */
export interface PageSelectionResult {
  selectedUrl: string | null;
  suggestedQuery: string | null;
  reasoning: string;
  confidence: number;
}

// ============================================================================
// Public API — Page Evaluation (used for last-resort AI extraction fallback)
// ============================================================================

/**
 * Fetch a URL, clean the HTML, and evaluate whether it contains a chapter list.
 * If correct, extracts chapters directly. If wrong, suggests a search query.
 */
export async function evaluatePageContent(
  url: string,
  title: string,
  expectedChapterCount: number,
  source: string,
): Promise<PageEvaluationResult> {
  try {
    const content = await fetchAndCleanHtml(url);
    if (content.length < 50) {
      return emptyResult('Page content too short or empty');
    }

    return await evaluateTextContent(content, title, expectedChapterCount, source);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log.warn(`Page evaluation failed for ${source}`, { url, error: msg });
    return emptyResult(`Fetch failed: ${msg}`);
  }
}

/**
 * Evaluate pre-cleaned text content (e.g., ComicVine volume descriptions).
 * Same logic as evaluatePageContent but skips the HTML fetch/clean step.
 */
export async function evaluateTextContent(
  content: string,
  title: string,
  expectedChapterCount: number,
  source: string,
): Promise<PageEvaluationResult> {
  try {
    const truncated = content.slice(0, MAX_CONTENT_LENGTH);

    const inferenceService = Qwen35InferenceService.getInstance();
    const initResult = await inferenceService.initialize();
    if (isError(initResult)) {
      return emptyResult('Inference service initialization failed');
    }

    const contextText = [
      `Manga: ${title}`,
      `Source: ${source}`,
      `Expected chapters: ~${expectedChapterCount}`,
      '',
      '--- PAGE CONTENT ---',
      truncated,
    ].join('\n');

    const prompt = `${PAGE_EVALUATION_PROMPT.systemPrompt}\n\n${PAGE_EVALUATION_PROMPT.userPrompt(contextText)}`;

    log.info(`AI page evaluation: sending ${truncated.length} chars to model`, {
      source, title, expectedChapterCount,
    });

    const result = await withTimeout(
      inferenceService.generate(prompt, []),
      EVALUATION_TIMEOUT_MS,
      `AI page evaluation timed out for ${source}`,
    );

    if (isError(result) || !isSuccess(result)) {
      return emptyResult('Model generation failed');
    }

    const evalResult = parseEvaluationResponse(result.data.response);

    log.info('AI page evaluation result', {
      source, title,
      isCorrectPage: evalResult.isCorrectPage,
      chaptersFound: evalResult.extractedChapters.length,
      confidence: evalResult.confidence,
      suggestedQuery: evalResult.suggestedQuery,
    });

    return evalResult;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log.warn(`Text evaluation failed for ${source}`, { error: msg });
    return emptyResult(`Evaluation failed: ${msg}`);
  }
}

// ============================================================================
// Public API — Candidate Gathering & Page Selection
// ============================================================================

/** Gather candidate pages from a Fandom wiki (2 API calls: probe titles + search) */
export async function gatherFandomCandidates(fandomUrl: string): Promise<CandidatePage[]> {
  const baseUrl = fandomUrl.replace(/\/wiki\/.*$/, '');
  const probed = await probeFandomKnownTitles(baseUrl);
  const searched = await searchFandomApi(baseUrl);
  for (const s of searched) {
    if (!probed.some(c => c.title === s.title)) probed.push(s);
  }
  const found = probed.filter(c => c.status === 'found');
  log.info('Fandom candidates gathered', { count: found.length, titles: found.map(c => c.title) });
  return found;
}

/** Gather candidate pages from Wikipedia (wraps searchChapterListPages → CandidatePage[]) */
export async function gatherWikipediaCandidates(title: string): Promise<CandidatePage[]> {
  try {
    const { searchChapterListPages } = await import(
      '@/server/services/wikipedia/wikipedia/api-client'
    );
    const results = await searchChapterListPages(title, 0);
    return results.map(r => ({
      title: r.title,
      url: `https://en.wikipedia.org/wiki/${encodeURIComponent(r.title.replace(/ /g, '_'))}`,
      size: r.size, snippet: r.snippet, status: 'found' as const,
    }));
  } catch {
    return [];
  }
}

/**
 * Select the best candidate page. Deterministic shortcut first:
 * if a single candidate has "chapters" in the title and size > 20KB,
 * skip the model call entirely. Otherwise, asks the model to pick.
 */
export async function selectBestPage(
  candidates: CandidatePage[], title: string, expectedChapterCount: number, source: string,
): Promise<PageSelectionResult> {
  if (candidates.length === 0) {
    return { selectedUrl: null, suggestedQuery: `${title} chapter list`, reasoning: 'No candidates', confidence: 0 };
  }
  // Deterministic shortcut: single "chapters"-titled candidate > 20KB → skip model
  const chapterPages = candidates.filter(c => /chapters|chapter.list/i.test(c.title) && c.size > 20480);
  if (chapterPages.length === 1) {
    const match = chapterPages[0];
    if (match) {
      log.info('Page selection: deterministic shortcut', { title: match.title, size: match.size });
      return {
        selectedUrl: match.url, suggestedQuery: null,
        reasoning: `Deterministic: "${match.title}" (${Math.round(match.size / 1024)}KB)`, confidence: 0.95,
      };
    }
  }
  return selectPageViaModel(candidates, title, expectedChapterCount, source);
}

/**
 * Parse model's page selection JSON response.
 * Expected: { selectedIndex: 1-N or 0, reasoning, confidence, suggestedQuery }
 */
export function parseSelectionResponse(response: string, candidates: CandidatePage[]): PageSelectionResult {
  try {
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return emptySelection('No JSON in response');
    const parsed: unknown = JSON.parse(jsonMatch[0]);
    if (!parsed || typeof parsed !== 'object') return emptySelection('Invalid JSON');
    const obj = parsed as Record<string, unknown>;
    const idx = typeof obj['selectedIndex'] === 'number' ? obj['selectedIndex'] : 0;
    const reasoning = typeof obj['reasoning'] === 'string' ? obj['reasoning'] : '';
    const confidence = typeof obj['confidence'] === 'number' ? obj['confidence'] : 0.5;
    const suggestedQuery = typeof obj['suggestedQuery'] === 'string' ? obj['suggestedQuery'] : null;
    if (idx > 0 && idx <= candidates.length) {
      const selected = candidates[idx - 1];
      if (selected) {
        log.info('AI page selection result', { idx, title: selected.title, confidence });
        return { selectedUrl: selected.url, suggestedQuery: null, reasoning, confidence };
      }
    }
    return { selectedUrl: null, suggestedQuery, reasoning, confidence };
  } catch { return emptySelection('Failed to parse selection response'); }
}

// ============================================================================
// Page Selection Helpers
// ============================================================================

/** Ask the AI model to select the best candidate page (~30 token output) */
async function selectPageViaModel(
  candidates: CandidatePage[], title: string, expected: number, source: string,
): Promise<PageSelectionResult> {
  try {
    const inferenceService = Qwen35InferenceService.getInstance();
    const initResult = await inferenceService.initialize();
    if (isError(initResult)) return emptySelection('Inference service init failed');
    const candidateList = candidates.map((c, i) =>
      `${i + 1}. "${c.title}" (${Math.round(c.size / 1024)}KB)${c.snippet ? ` — ${c.snippet}` : ''}`
    ).join('\n');
    const ctx = `Manga: ${title}\nSource: ${source}\nExpected chapters: ~${expected}\n\nCandidates:\n${candidateList}`;
    const prompt = `${PAGE_SELECTION_PROMPT.systemPrompt}\n\n${PAGE_SELECTION_PROMPT.userPrompt(ctx)}`;

    log.info('AI page selection: querying model', { source, candidateCount: candidates.length });
    const result = await withTimeout(
      inferenceService.generate(prompt, []), SELECTION_TIMEOUT_MS,
      `AI page selection timed out for ${source}`,
    );
    if (isError(result) || !isSuccess(result)) return emptySelection('Model generation failed');
    return parseSelectionResponse(result.data.response, candidates);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log.warn('AI page selection failed', { source, error: msg });
    return emptySelection(`Selection failed: ${msg}`);
  }
}

function emptySelection(reasoning: string): PageSelectionResult {
  return { selectedUrl: null, suggestedQuery: null, reasoning, confidence: 0 };
}
/** Probe known Fandom page titles via MediaWiki API (single request for all patterns) */
async function probeFandomKnownTitles(baseUrl: string): Promise<CandidatePage[]> {
  try {
    const titles = FANDOM_PROBE_TITLES.join('|');
    const apiUrl = `${baseUrl}/api.php?action=query&titles=${encodeURIComponent(titles)}&prop=info&format=json`;
    const response = await fetch(apiUrl, {
      headers: { 'User-Agent': 'MugiwaraKaizoku/1.0 (manga-metadata-fetcher)' },
    });
    if (!response.ok) return [];
    const data: unknown = await response.json();
    return extractProbePages(data, baseUrl);
  } catch { return []; }
}

/** Extract page info from MediaWiki query response (pages with/without 'missing' flag) */
function extractProbePages(data: unknown, baseUrl: string): CandidatePage[] {
  const pagesObj = extractNestedObject(data, 'query', 'pages');
  if (!pagesObj) return [];
  const candidates: CandidatePage[] = [];
  for (const page of Object.values(pagesObj)) {
    if (!page || typeof page !== 'object') continue;
    const p = page as Record<string, unknown>;
    const pageTitle = typeof p['title'] === 'string' ? p['title'] : '';
    if (!pageTitle) continue;
    candidates.push({
      title: pageTitle,
      url: `${baseUrl}/wiki/${encodeURIComponent(pageTitle.replace(/ /g, '_'))}`,
      size: typeof p['length'] === 'number' ? (p['length'] as number) : 0,
      snippet: '', status: 'missing' in p ? 'not_found' : 'found',
    });
  }
  return candidates;
}

/** Search Fandom wiki for chapter-related pages */
async function searchFandomApi(baseUrl: string): Promise<CandidatePage[]> {
  try {
    const apiUrl = `${baseUrl}/api.php?action=query&list=search&srsearch=chapters&srprop=size&format=json&srlimit=5`;
    const response = await fetch(apiUrl, {
      headers: { 'User-Agent': 'MugiwaraKaizoku/1.0 (manga-metadata-fetcher)' },
    });
    if (!response.ok) return [];
    const data: unknown = await response.json();
    const searchArr = extractNestedArray(data, 'query', 'search');
    if (!searchArr) return [];
    return searchArr
      .filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null)
      .map(item => ({
        title: typeof item['title'] === 'string' ? item['title'] : '',
        url: `${baseUrl}/wiki/${encodeURIComponent(String(item['title'] ?? '').replace(/ /g, '_'))}`,
        size: typeof item['size'] === 'number' ? item['size'] : 0,
        snippet: '', status: 'found' as const,
      }))
      .filter(c => c.title.length > 0);
  } catch { return []; }
}

/** Safely extract a nested object: data[key1][key2] */
function extractNestedObject(data: unknown, key1: string, key2: string): Record<string, unknown> | null {
  if (!data || typeof data !== 'object') return null;
  const obj1 = (data as Record<string, unknown>)[key1];
  if (!obj1 || typeof obj1 !== 'object') return null;
  const obj2 = (obj1 as Record<string, unknown>)[key2];
  return obj2 && typeof obj2 === 'object' ? obj2 as Record<string, unknown> : null;
}

/** Safely extract a nested array: data[key1][key2] */
function extractNestedArray(data: unknown, key1: string, key2: string): unknown[] | null {
  if (!data || typeof data !== 'object') return null;
  const obj1 = (data as Record<string, unknown>)[key1];
  if (!obj1 || typeof obj1 !== 'object') return null;
  const arr = (obj1 as Record<string, unknown>)[key2];
  return Array.isArray(arr) ? arr : null;
}

// ============================================================================
// HTML Fetch & Clean (used for last-resort AI extraction fallback)
// ============================================================================

/**
 * Fetch a URL and clean the HTML to plain text using cheerio.
 * For Fandom URLs, uses the MediaWiki API (direct page fetches get 403).
 * Strips navigation, footers, infoboxes, scripts, and styles.
 */
export async function fetchAndCleanHtml(url: string): Promise<string> {
  const html = await fetchHtmlContent(url);
  if (!html) return '';
  return cleanHtmlToText(html);
}

/** Fetch HTML — uses MediaWiki API for Fandom, direct fetch for others */
async function fetchHtmlContent(url: string): Promise<string | null> {
  if (isFandomUrl(url)) return fetchFandomViaApi(url);

  const response = await fetch(url, {
    headers: { 'User-Agent': 'MugiwariKaizoku/1.0 (manga metadata enrichment)' },
  });
  return response.ok ? response.text() : null;
}

/** Fandom blocks direct page fetches — use MediaWiki parse API instead */
async function fetchFandomViaApi(url: string): Promise<string | null> {
  try {
    const parsed = new URL(url);
    const pageTitle = decodeURIComponent(parsed.pathname.replace('/wiki/', ''));
    const apiUrl = `${parsed.origin}/api.php?action=parse&page=${encodeURIComponent(pageTitle)}&prop=text&format=json&redirects=1`;

    const response = await fetch(apiUrl, {
      headers: { 'User-Agent': 'MugiwaraKaizoku/1.0 (manga-metadata-fetcher)' },
    });
    if (!response.ok) return null;

    const data: unknown = await response.json();
    if (!data || typeof data !== 'object') return null;
    const parseObj = (data as Record<string, unknown>)['parse'];
    if (!parseObj || typeof parseObj !== 'object') return null;
    const textObj = (parseObj as Record<string, unknown>)['text'];
    if (!textObj || typeof textObj !== 'object') return null;
    return typeof (textObj as Record<string, unknown>)['*'] === 'string'
      ? (textObj as Record<string, unknown>)['*'] as string
      : null;
  } catch {
    return null;
  }
}

function isFandomUrl(url: string): boolean {
  try { return new URL(url).hostname.endsWith('.fandom.com'); }
  catch { return false; }
}

/** Clean raw HTML to plain text, keeping structure hints */
async function cleanHtmlToText(html: string): Promise<string> {
  try {
    const { load } = await import('cheerio');
    const $ = load(html);
    const $content = $('.mw-parser-output');

    if ($content.length === 0) {
      const $fallback = $('.page-content').length > 0 ? $('.page-content') : $('body');
      $fallback.find('nav, footer, .navbox, .infobox, .toc, .mw-editsection, script, style, .global-navigation').remove();
      return $fallback.text().replace(/\n{3,}/g, '\n\n').trim();
    }

    $content.find('.navbox, .infobox, .toc, .mw-editsection, script, style').remove();
    return $content.text().replace(/\n{3,}/g, '\n\n').trim();
  } catch {
    return html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s{2,}/g, ' ')
      .trim();
  }
}

/** @see structured-text-converter.ts for implementation */
export const cleanHtmlToStructuredText = _cleanHtmlToStructuredText;

// ============================================================================
// Response Parsing
// ============================================================================

/**
 * Parse the model's JSON response into a PageEvaluationResult.
 * Handles malformed JSON gracefully with fallback.
 */
export function parseEvaluationResponse(response: string): PageEvaluationResult {
  try {
    // Find JSON object in response (model may include text before/after)
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return emptyResult('No JSON found in model response');

    const parsed: unknown = JSON.parse(jsonMatch[0]);
    if (!parsed || typeof parsed !== 'object') return emptyResult('Invalid JSON structure');

    const obj = parsed as Record<string, unknown>;

    const isCorrectPage = obj['isCorrectPage'] === true;
    const suggestedQuery = typeof obj['suggestedQuery'] === 'string' ? obj['suggestedQuery'] : null;
    const reasoning = typeof obj['reasoning'] === 'string' ? obj['reasoning'] : '';
    const confidence = typeof obj['confidence'] === 'number' ? obj['confidence'] : 0.5;

    const extractedChapters = parseChaptersFromArray(obj['chapters']);

    return { isCorrectPage, extractedChapters, suggestedQuery, reasoning, confidence };
  } catch {
    return emptyResult('Failed to parse model response');
  }
}

// ============================================================================
// Helpers
// ============================================================================

/** Parse a raw chapters array from model JSON into ChapterDataItem[] */
function parseChaptersFromArray(raw: unknown): ChapterDataItem[] {
  if (!Array.isArray(raw)) return [];

  const chapters: ChapterDataItem[] = [];
  for (const item of raw) {
    const chapter = parseSingleChapter(item);
    if (chapter) chapters.push(chapter);
  }

  return chapters.sort((a, b) => a.number - b.number);
}

/** Parse a single chapter object from model output */
function parseSingleChapter(item: unknown): ChapterDataItem | null {
  if (!item || typeof item !== 'object') return null;
  const rec = item as Record<string, unknown>;
  const num = typeof rec['number'] === 'number' ? rec['number'] : null;
  const title = typeof rec['title'] === 'string' ? rec['title'] : undefined;
  if (num === null || num <= 0) return null;
  return { number: num, ...(title ? { title } : {}) };
}

function emptyResult(reasoning: string): PageEvaluationResult {
  return {
    isCorrectPage: false,
    extractedChapters: [],
    suggestedQuery: null,
    reasoning,
    confidence: 0,
  };
}
