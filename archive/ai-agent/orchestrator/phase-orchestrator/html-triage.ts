/**
 * AI-Guided HTML Triage — Per-Source
 *
 * After deterministic remediation, if a source still has gaps, the model
 * reviews that source's candidate pages (title, size, snippet) and picks
 * which ones to fetch raw HTML from for AI-based chapter extraction.
 *
 * Each source gets its own model call — less data = more attention = better output.
 */

import { Qwen35InferenceService } from '@/server/ai-agent/agent-core/inference-service';
import type { SourceDataCollection } from '@/server/trpc/routers/manga/metadataOperations/enrichment-pipeline/types';
import { isError, isSuccess } from '@/utils/async-result';
import { logger } from '@/utils/logger';

import {
  evaluatePageContent,
  gatherFandomCandidates,
  gatherWikipediaCandidates,
} from './ai-page-evaluator';
import { withTimeout } from './context-builder';
import { validateSourceData } from './validation';

import type { CandidatePage } from './ai-page-evaluator';

const log = logger.child('HtmlTriage');

/** Max candidates to show the model per source */
const MAX_CANDIDATES = 8;

/** Timeout for a single triage model call (~100 tokens output) */
const TRIAGE_TIMEOUT_MS = 60000;

type SourceName = 'fandom' | 'wikipedia';

// ============================================================================
// Main Entry Point
// ============================================================================

/**
 * After remediation, triage each failing source independently.
 * One model call per source — focused data, better attention.
 */
export async function runAIGuidedHtmlTriage(data: SourceDataCollection): Promise<void> {
  const expected = data.expectedChapterCount;

  // Run each source triage independently (not in parallel — sequential model calls)
  if (!validateSourceData('fandom', data.sources.fandom, expected).isAcceptable && data.rawData.fandomUrl) {
    await triageSource('fandom', data);
  }
  if (!validateSourceData('wikipedia', data.sources.wikipedia, expected).isAcceptable) {
    await triageSource('wikipedia', data);
  }
}

// ============================================================================
// Per-Source Triage
// ============================================================================

/** Gather candidates for one source, ask model to pick, fetch+evaluate */
async function triageSource(source: SourceName, data: SourceDataCollection): Promise<void> {
  const candidates = await gatherCandidates(source, data);
  if (candidates.length === 0) return;

  const selectedUrls = await triageWithModel(source, candidates, data);
  if (selectedUrls.length === 0) return;

  await evaluateSelectedPages(source, selectedUrls, data);
}

/** Gather candidates for a single source */
async function gatherCandidates(source: SourceName, data: SourceDataCollection): Promise<CandidatePage[]> {
  if (source === 'fandom' && data.rawData.fandomUrl) {
    return gatherFandomCandidates(data.rawData.fandomUrl);
  }
  if (source === 'wikipedia') {
    return gatherWikipediaCandidates(data.title);
  }
  return [];
}

// ============================================================================
// Model Triage (per source)
// ============================================================================

/** Present one source's candidates to model, get back URLs to fetch */
async function triageWithModel(
  source: SourceName,
  candidates: CandidatePage[],
  data: SourceDataCollection,
): Promise<string[]> {
  try {
    const inferenceService = Qwen35InferenceService.getInstance();
    const initResult = await inferenceService.initialize();
    if (isError(initResult)) return [];

    const prompt = buildTriagePrompt(source, candidates.slice(0, MAX_CANDIDATES), data);
    const result = await withTimeout(
      inferenceService.generate(prompt, []),
      TRIAGE_TIMEOUT_MS,
      `HTML triage timed out for ${source}`,
    );

    if (isError(result) || !isSuccess(result)) return [];

    return parseTriageResponse(result.data.response, candidates);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log.warn(`HTML triage failed for ${source}`, { error: msg });
    return [];
  }
}

/** Build a focused triage prompt for one source */
function buildTriagePrompt(
  source: SourceName,
  candidates: CandidatePage[],
  data: SourceDataCollection,
): string {
  const currentCount = data.sources[source].length;
  const lines: string[] = [];

  lines.push(`You are a manga metadata analyst. Review these ${source} wiki page candidates`);
  lines.push('and select which ones likely contain a chapter list worth fetching.');
  lines.push('');
  lines.push(`Manga: ${data.title}`);
  lines.push(`Expected chapters: ${data.expectedChapterCount}`);
  lines.push(`Current ${source} data: ${currentCount} chapters (needs improvement)`);
  lines.push('');
  lines.push('=== Candidate Pages ===');

  for (let i = 0; i < candidates.length; i++) {
    const c = candidates[i];
    if (!c) continue;
    const sizeKB = Math.round(c.size / 1024);
    const snippetInfo = c.snippet ? ` — "${c.snippet.slice(0, 100)}"` : '';
    lines.push(`${i + 1}. "${c.title}" (${sizeKB}KB)${snippetInfo}`);
  }

  lines.push('');
  lines.push('=== Rules ===');
  lines.push('- Pages titled "Chapters", "Chapter List", "Episodes" are strong candidates');
  lines.push('- Larger pages (50KB+) likely contain chapter tables');
  lines.push('- Individual chapter pages (e.g., "Chapter 1") are NOT useful');
  lines.push('- Character, location, or category pages are NOT useful');
  lines.push('- Select up to 2 pages');
  lines.push('');
  lines.push('Output ONLY valid JSON: { "selectedIndices": [1, 3], "reasoning": "..." }');

  return lines.join('\n');
}

/** Parse the model's triage response to get selected URLs */
function parseTriageResponse(response: string, candidates: CandidatePage[]): string[] {
  try {
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return [];

    const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
    const indices = parsed['selectedIndices'];
    if (!Array.isArray(indices)) return [];

    const urls: string[] = [];
    for (const idx of indices) {
      if (typeof idx !== 'number' || idx < 1 || idx > candidates.length) continue;
      const candidate = candidates[idx - 1];
      if (candidate) urls.push(candidate.url);
    }

    const reasoning = typeof parsed['reasoning'] === 'string' ? parsed['reasoning'] : '';
    log.info('HTML triage selected', { count: urls.length, reasoning });
    return urls.slice(0, 2);
  } catch {
    log.warn('Failed to parse HTML triage response');
    return [];
  }
}

// ============================================================================
// Page Evaluation
// ============================================================================

/** Fetch and evaluate selected pages for one source */
async function evaluateSelectedPages(
  source: SourceName,
  urls: string[],
  data: SourceDataCollection,
): Promise<void> {
  /* eslint-disable no-await-in-loop -- Sequential: each evaluation uses the model */
  for (const url of urls) {
    const evalResult = await evaluatePageContent(url, data.title, data.expectedChapterCount, source);

    if (!evalResult.isCorrectPage || evalResult.extractedChapters.length === 0) {
      log.info('HTML triage: page not useful', { url, source, reasoning: evalResult.reasoning });
      continue;
    }

    if (evalResult.extractedChapters.length <= data.sources[source].length) continue;

    log.info(`HTML triage improved ${source} data`, {
      url, before: data.sources[source].length, after: evalResult.extractedChapters.length,
    });

    /* eslint-disable no-param-reassign -- Intentional in-place mutation */
    data.sources[source] = evalResult.extractedChapters;
    if (source === 'fandom') {
      data.rawData.fandomUrl = url;
      data.rawData.fandomParseSuccess = true;
    } else {
      data.rawData.wikipediaParseSuccess = true;
    }
    /* eslint-enable no-param-reassign */

    // Found better data for this source — stop evaluating more pages
    break;
  }
  /* eslint-enable no-await-in-loop */
}
