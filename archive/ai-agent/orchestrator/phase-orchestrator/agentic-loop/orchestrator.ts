/**
 * Orchestrator-Driven Agentic Loop
 *
 * The CODE drives the strategy, the MODEL fills in the blanks.
 * Each iteration has a clear purpose — the model never decides "done".
 *
 * Phases:
 *   1. ASSESS    — Deterministic: identify weak sources (no model)
 *   2. SEARCH    — Deterministic: search weak source wikis for chapter lists
 *   3. MODEL_SEARCH — Model suggests alternative search query (if deterministic failed)
 *   4. SCRAPE    — Deterministic: scrape best search result
 *   5. GLOBAL    — Model-guided: global wiki search as fallback
 *   6. FINALIZE  — Record results
 */

import type { Qwen35InferenceService } from '@/server/ai-agent/agent-core/inference-service';
import { SEARCH_QUERY_PROMPT, buildPromptWithTools } from '@/server/ai-agent/agent-core/prompt-engineer';
import type { AgentTool } from '@/server/ai-agent/agent-core/types';
import type {
  EnrichmentProgress,
  SourceDataCollection,
} from '@/server/trpc/routers/manga/metadataOperations/enrichment-pipeline/types';
import { isError, isSuccess } from '@/utils/async-result';
import { logger } from '@/utils/logger';

import { logAction, recordAction, updateCoverage } from './loop-state';
import {
  mergeScrapeIntoData,
  parseSearchSuggestion,
  rankSearchResults,
  scoreSearchResult,
  summarizeResultTitles,
} from './search-helpers';
import { probeDirectUrls } from './url-probing';

import type { AgenticLoopState } from './loop-types';

const log = logger.child('LoopOrchestrator');

// ============================================================================
// Types
// ============================================================================

/** Deterministic search queries for Fandom wikis */
const FANDOM_QUERIES = ['Chapters', 'Chapter List', 'Volumes', 'List of chapters', 'Episodes'];

/** A weak source that needs remediation */
interface WeakSource {
  name: 'fandom' | 'wikipedia';
  chapterCount: number;
  coverage: number;
  baseUrl?: string | undefined;
  queriesTried: string[];
  lastSearchResults?: string[];
}

/** Shared context for orchestration */
interface OrchestratorContext {
  inferenceService: Qwen35InferenceService;
  state: AgenticLoopState;
  data: SourceDataCollection;
  toolMap: Map<string, AgentTool>;
  onProgress?: EnrichmentProgress | undefined;
  urlsScraped: Set<string>;
}

// ============================================================================
// Main Orchestrator
// ============================================================================

/** Run the orchestrated loop — code drives phases, model assists */
export async function runOrchestratedLoop(
  inferenceService: Qwen35InferenceService,
  state: AgenticLoopState,
  data: SourceDataCollection,
  toolMap: Map<string, AgentTool>,
  onProgress?: EnrichmentProgress,
): Promise<void> {
  const ctx: OrchestratorContext = {
    inferenceService, state, data, toolMap, onProgress, urlsScraped: new Set(),
  };

  // Phase 1: Assess weak sources (deterministic — no model call)
  const weakSources = assessWeakSources(ctx);
  log.info('Assessment complete', {
    weakSources: weakSources.map(s => `${s.name}:${s.coverage}%`),
  });

  if (weakSources.length === 0) {
    log.info('All sources have adequate coverage, skipping search phases');
    return;
  }

  // Phase 2+: Process each weak source
  /* eslint-disable no-await-in-loop -- Sequential source processing */
  for (const source of weakSources) {
    if (isBudgetExhausted(state) || isCoverageMet(state)) break;
    await processWeakSource(ctx, source);
  }

  // Global fallback: if still below threshold, try global wiki search
  if (!isBudgetExhausted(state) && !isCoverageMet(state)) {
    await globalFallbackSearch(ctx);
  }
  /* eslint-enable no-await-in-loop */

  log.info('Orchestrated loop complete', {
    iterations: state.budget.callsUsed,
    coverage: state.coverage.titlePercent,
  });
}

// ============================================================================
// Phase 1: Assessment (deterministic)
// ============================================================================

/** Identify sources below coverage threshold */
function assessWeakSources(ctx: OrchestratorContext): WeakSource[] {
  const { data, state } = ctx;
  const expected = data.expectedChapterCount;
  if (expected === 0) return [];

  const threshold = 0.5; // Sources below 50% are weak
  const sources: WeakSource[] = [];

  // Check Fandom
  const fandomCount = data.sources.fandom.length;
  const fandomCoverage = fandomCount / expected;
  if (fandomCoverage < threshold) {
    const baseUrl = data.rawData.fandomUrl?.replace(/\/wiki\/.*$/, '').replace(/\/$/, '');
    sources.push({
      name: 'fandom',
      chapterCount: fandomCount,
      coverage: Math.round(fandomCoverage * 100),
      baseUrl,
      queriesTried: [],
    });
  }

  // Check Wikipedia
  const wikiCount = data.sources.wikipedia.length;
  const wikiCoverage = wikiCount / expected;
  if (wikiCoverage < threshold) {
    sources.push({
      name: 'wikipedia',
      chapterCount: wikiCount,
      coverage: Math.round(wikiCoverage * 100),
      queriesTried: [],
    });
  }

  // Log assessment (does NOT consume budget — pure code, no network)
  logAction(state, {
    iteration: state.budget.callsUsed + 1,
    action: 'assess',
    resultSummary: sources.length > 0
      ? `Weak: ${sources.map(s => `${s.name}(${s.coverage}%)`).join(', ')}`
      : 'All sources adequate',
    durationMs: 0,
  });

  return sources;
}

// ============================================================================
// Phase 2-5: Process each weak source
// ============================================================================

/** Search and scrape for a single weak source */
async function processWeakSource(
  ctx: OrchestratorContext,
  source: WeakSource,
): Promise<void> {
  const { state, onProgress } = ctx;

  // Step A: Multi-query deterministic search
  if (isBudgetExhausted(state)) return;
  await reportProgress(onProgress, state, `Searching ${source.name} for chapter list...`);

  const deterministicResult = await deterministicSearch(ctx, source);
  if (deterministicResult === 'found_data') return;

  // Step B: Model-suggested search (if deterministic failed)
  if (isBudgetExhausted(state) || isCoverageMet(state)) return;
  await reportProgress(onProgress, state, `AI suggesting alternative search for ${source.name}...`);
  await modelGuidedSearch(ctx, source);

  // Step C: Direct URL probes (bypass search API entirely)
  if (source.name === 'fandom' && source.baseUrl) {
    if (isBudgetExhausted(state) || isCoverageMet(state)) return;
    const scrapeTool = ctx.toolMap.get('wiki_scrape');
    if (scrapeTool) {
      await reportProgress(onProgress, state, `Probing known URLs on ${source.name}...`);
      await probeDirectUrls({
        baseUrl: source.baseUrl, scrapeTool, state, data: ctx.data,
        urlsScraped: ctx.urlsScraped,
        isBudgetExhausted: () => isBudgetExhausted(state),
        isCoverageMet: () => isCoverageMet(state),
      });
    }
  }
}

/** Deterministic search: search wiki for "Chapters" and scrape best result */
async function deterministicSearch(
  ctx: OrchestratorContext,
  source: WeakSource,
): Promise<'found_data' | 'no_results' | 'no_improvement'> {
  const { state, data, toolMap } = ctx;
  const iteration = state.budget.callsUsed + 1;
  const startMs = Date.now();

  if (source.name === 'fandom' && source.baseUrl) {
    const searchTool = toolMap.get('wiki_page_search');
    if (!searchTool) {
      logAction(state, { iteration, action: 'search', tool: 'wiki_page_search', resultSummary: 'tool not available', durationMs: 0 });
      return 'no_results';
    }

    /* eslint-disable no-await-in-loop -- Sequential multi-query search */
    for (const query of FANDOM_QUERIES) {
      if (isBudgetExhausted(state)) return 'no_results';
      const queryStartMs = Date.now();
      const iterNow = state.budget.callsUsed + 1;
      source.queriesTried.push(query);

      const result = await searchTool.execute({ wikiBaseUrl: source.baseUrl, query });
      if (isError(result) || !isSuccess(result)) {
        logAction(state, { iteration: iterNow, action: 'search', tool: 'wiki_page_search', params: JSON.stringify({ query }), resultSummary: `"${query}" search failed`, durationMs: Date.now() - queryStartMs });
        continue;
      }

      const searchData = result.data as Record<string, unknown> | null;
      const resultItems = searchData?.['results'];
      if (!Array.isArray(resultItems) || resultItems.length === 0) {
        logAction(state, { iteration: iterNow, action: 'search', tool: 'wiki_page_search', params: JSON.stringify({ query }), resultSummary: `"${query}" returned 0 results`, durationMs: Date.now() - queryStartMs });
        continue;
      }

      // Store result titles for model context
      // eslint-disable-next-line no-param-reassign -- Intentional mutation of source tracking state
      source.lastSearchResults = resultItems.slice(0, 10).map(r => {
        if (r && typeof r === 'object') return String((r as Record<string, unknown>)['title'] ?? '?');
        return '?';
      });

      const scrapeResult = await scrapeRankedResults(ctx, resultItems, iterNow, queryStartMs);
      if (scrapeResult === 'found_data') return 'found_data';
    }
    /* eslint-enable no-await-in-loop */
    return 'no_results';
  }

  if (source.name === 'wikipedia') {
    // Global search for Wikipedia chapter list
    const searchTool = toolMap.get('wiki_url_search');
    if (!searchTool) {
      recordAction(state, { iteration, action: 'search', tool: 'wiki_url_search', resultSummary: 'tool not available', durationMs: 0 });
      return 'no_results';
    }

    const query = `List of ${data.title} chapters Wikipedia`;
    source.queriesTried.push(query);
    const result = await searchTool.execute({ query });

    if (isError(result) || !isSuccess(result)) {
      recordAction(state, { iteration, action: 'search', tool: 'wiki_url_search', params: JSON.stringify({ query }), resultSummary: 'search failed', durationMs: Date.now() - startMs });
      return 'no_results';
    }

    const searchData = result.data as Record<string, unknown> | null;
    const resultItems = searchData?.['results'];
    if (!Array.isArray(resultItems) || resultItems.length === 0) {
      recordAction(state, { iteration, action: 'search', tool: 'wiki_url_search', params: JSON.stringify({ query }), resultSummary: 'search returned 0 results', durationMs: Date.now() - startMs });
      return 'no_results';
    }

    return scrapeRankedResults(ctx, resultItems, iteration, startMs);
  }

  return 'no_results';
}

/** Model-guided search: ask the model for an alternative search query */
async function modelGuidedSearch(
  ctx: OrchestratorContext,
  source: WeakSource,
): Promise<void> {
  const { inferenceService, state, data, toolMap } = ctx;
  const iteration = state.budget.callsUsed + 1;
  const startMs = Date.now();

  // Build summary for the model (including result titles for context)
  const triedSummary = source.queriesTried.length > 0
    ? `Already tried queries: ${source.queriesTried.map(q => `"${q}"`).join(', ')}`
    : 'No searches attempted yet.';

  const resultTitleContext = source.lastSearchResults && source.lastSearchResults.length > 0
    ? `Last search results returned these page titles: ${source.lastSearchResults.map(t => `"${t}"`).join(', ')}\nNote: If ALL results are individual chapter/episode pages, this wiki likely has NO dedicated chapter list page.`
    : '';

  const historyLines = state.actionHistory.map(r =>
    `  [${r.iteration}] ${r.action}${r.tool ? ` (${r.tool})` : ''}: ${r.resultSummary}`,
  ).join('\n');

  const promptContext = [
    `Manga: "${data.title}" (${data.expectedChapterCount} chapters expected)`,
    `Weak source: ${source.name} (${source.chapterCount} chapters, ${source.coverage}% coverage)`,
    source.baseUrl ? `Wiki URL: ${source.baseUrl}` : '',
    triedSummary,
    resultTitleContext,
    '',
    'Action history:',
    historyLines,
  ].filter(Boolean).join('\n');

  const prompt = buildPromptWithTools(SEARCH_QUERY_PROMPT, promptContext, []);
  const generateResult = await inferenceService.generate(prompt, []);
  inferenceService.resetChat();

  if (isError(generateResult) || !isSuccess(generateResult)) {
    recordAction(state, { iteration, action: 'model_search', resultSummary: 'model generation failed', durationMs: Date.now() - startMs });
    return;
  }

  const response = generateResult.data.response;
  const parsed = parseSearchSuggestion(response);

  if (!parsed) {
    recordAction(state, { iteration, action: 'model_search', resultSummary: 'model returned unparseable response', durationMs: Date.now() - startMs });
    return;
  }

  // Execute the model's suggested search
  const tool = toolMap.get(parsed.tool);
  if (!tool) {
    recordAction(state, { iteration, action: 'model_search', tool: parsed.tool, resultSummary: `tool ${parsed.tool} not available`, durationMs: Date.now() - startMs });
    return;
  }

  source.queriesTried.push(parsed.params['query'] ?? 'unknown');
  const searchResult = await tool.execute(parsed.params);

  if (isError(searchResult) || !isSuccess(searchResult)) {
    recordAction(state, { iteration, action: 'model_search', tool: parsed.tool, params: JSON.stringify(parsed.params), resultSummary: 'search failed', durationMs: Date.now() - startMs });
    return;
  }

  const searchData = searchResult.data as Record<string, unknown> | null;
  const resultItems = searchData?.['results'];
  if (!Array.isArray(resultItems) || resultItems.length === 0) {
    recordAction(state, { iteration, action: 'model_search', tool: parsed.tool, params: JSON.stringify(parsed.params), resultSummary: 'search returned 0 results', durationMs: Date.now() - startMs });
    return;
  }

  await scrapeRankedResults(ctx, resultItems, iteration, startMs);
}

// ============================================================================
// Phase 6: Global Fallback
// ============================================================================

/** Last-resort global search when per-source searches failed */
async function globalFallbackSearch(ctx: OrchestratorContext): Promise<void> {
  const { state, data, toolMap, onProgress } = ctx;
  const iteration = state.budget.callsUsed + 1;
  const startMs = Date.now();

  await reportProgress(onProgress, state, 'AI trying global search fallback...');

  const searchTool = toolMap.get('wiki_url_search');
  if (!searchTool) return;

  const query = `${data.title} chapter list wiki`;
  const result = await searchTool.execute({ query });

  if (isError(result) || !isSuccess(result)) {
    recordAction(state, { iteration, action: 'global_search', tool: 'wiki_url_search', params: JSON.stringify({ query }), resultSummary: 'search failed', durationMs: Date.now() - startMs });
    return;
  }

  const searchData = result.data as Record<string, unknown> | null;
  const resultItems = searchData?.['results'];
  if (!Array.isArray(resultItems) || resultItems.length === 0) {
    recordAction(state, { iteration, action: 'global_search', tool: 'wiki_url_search', params: JSON.stringify({ query }), resultSummary: 'search returned 0 results', durationMs: Date.now() - startMs });
    return;
  }

  const scrapeResult = await scrapeRankedResults(ctx, resultItems, iteration, startMs);

  if (scrapeResult !== 'found_data' && !isBudgetExhausted(state)) {
    await modelGuidedSearch(ctx, {
      name: 'fandom',
      chapterCount: data.sources.fandom.length,
      coverage: Math.round((data.sources.fandom.length / data.expectedChapterCount) * 100),
      queriesTried: [query],
    });
  }
}

// ============================================================================
// Shared Helpers
// ============================================================================

/** Rank, filter, and scrape the best search result */
async function scrapeRankedResults(
  ctx: OrchestratorContext,
  resultItems: unknown[],
  iteration: number,
  startMs: number,
): Promise<'found_data' | 'no_results' | 'no_improvement'> {
  const { state, data, toolMap, urlsScraped } = ctx;

  // Rank results
  const ranked = rankSearchResults(resultItems);
  const titleSummary = summarizeResultTitles(ranked);

  // Check if best result is worth scraping
  const bestCandidate = ranked[0];
  const bestScore = bestCandidate ? scoreSearchResult(bestCandidate) : -1;

  if (bestScore <= 0) {
    recordAction(state, {
      iteration, action: 'search', resultSummary: `${resultItems.length} results, no chapter list pages. Results: ${titleSummary}`, durationMs: Date.now() - startMs,
    });
    return 'no_results';
  }

  // Extract URL from best result
  const topUrl = bestCandidate && typeof bestCandidate === 'object'
    ? (bestCandidate as Record<string, unknown>)['url']
    : undefined;
  if (typeof topUrl !== 'string') {
    recordAction(state, { iteration, action: 'search', resultSummary: `${resultItems.length} results, no scrapeable URL`, durationMs: Date.now() - startMs });
    return 'no_results';
  }

  // Skip already-scraped URLs
  if (urlsScraped.has(topUrl)) {
    recordAction(state, { iteration, action: 'search', resultSummary: `best result ${topUrl} already scraped`, durationMs: Date.now() - startMs });
    return 'no_improvement';
  }

  // Scrape
  const scrapeTool = toolMap.get('wiki_scrape');
  if (!scrapeTool) {
    recordAction(state, { iteration, action: 'search', resultSummary: 'scrape tool unavailable', durationMs: Date.now() - startMs });
    return 'no_results';
  }

  urlsScraped.add(topUrl);
  const scrapeResult = await scrapeTool.execute({ url: topUrl });
  if (isError(scrapeResult) || !isSuccess(scrapeResult)) {
    recordAction(state, { iteration, action: 'scrape', params: JSON.stringify({ url: topUrl }), resultSummary: `scrape of ${topUrl} failed`, durationMs: Date.now() - startMs });
    return 'no_improvement';
  }

  const newChapters = mergeScrapeIntoData(scrapeResult.data, data);
  updateCoverage(state, data);

  const summary = newChapters > 0
    ? `scraped ${topUrl}: +${newChapters} chapters, coverage now ${state.coverage.titlePercent}%`
    : `scraped ${topUrl}: 0 new chapters (no improvement)`;

  recordAction(state, { iteration, action: 'search+scrape', tool: 'wiki_scrape', params: JSON.stringify({ url: topUrl }), resultSummary: summary, durationMs: Date.now() - startMs });

  log.info('Scrape result', { url: topUrl, newChapters, coverage: state.coverage.titlePercent });
  return newChapters > 0 ? 'found_data' : 'no_improvement';
}

// ============================================================================
// Budget & Coverage Helpers
// ============================================================================

const COVERAGE_THRESHOLD = 90;

function isBudgetExhausted(state: AgenticLoopState): boolean {
  if (state.budget.callsUsed >= state.budget.maxCalls) return true;
  const elapsed = Date.now() - state.budget.startTimeMs;
  return elapsed >= state.budget.maxDurationMs;
}

function isCoverageMet(state: AgenticLoopState): boolean {
  return state.coverage.titlePercent >= COVERAGE_THRESHOLD;
}

async function reportProgress(
  onProgress: EnrichmentProgress | undefined,
  state: AgenticLoopState,
  message: string,
): Promise<void> {
  const iteration = state.budget.callsUsed + 1;
  await onProgress?.(
    'ai_agent',
    `AI [${iteration}/${state.budget.maxCalls}] ${message} (${state.coverage.titlePercent}% coverage)`,
  );
}
