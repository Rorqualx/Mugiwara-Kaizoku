/**
 * Context building utilities for AI Agent Phase Orchestrator
 *
 * Handles prompt construction for both:
 * - Legacy mode: summary-based prompt with tool calling
 * - New 3-step mode: full data prompt for structured merge output
 */

import { buildPromptWithTools, ENRICHMENT_TASK_PROMPT, AGENTIC_LOOP_PROMPT } from '@/server/ai-agent/agent-core/prompt-engineer';
import type { AgentTool, ProviderDataContext } from '@/server/ai-agent/agent-core/types';
import { rawDataCache } from '@/server/ai-agent/cache/raw-data-cache';
import type { SourceDataCollection, ChapterDataItem } from '@/server/trpc/routers/manga/metadataOperations/enrichment-pipeline/types';
import { createSuccessResult, createErrorResult } from '@/utils/async-result';
import type { AsyncResult } from '@/utils/async-result';
import { logger } from '@/utils/logger';

import type { AgenticLoopState } from './agentic-loop/loop-types';
import type { AgentProcessingContext } from './orchestrator-types';

const _log = logger.child('AIAgentOrchestrator');

/** Max chapters to show in full detail before summarizing (32K context supports ~500) */
const MAX_DETAILED_CHAPTERS = 500;

/**
 * Wrap a promise with timeout
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  errorMessage: string,
): Promise<T> {
  let timeoutId: NodeJS.Timeout | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(errorMessage)), timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

/**
 * Store raw provider data in cache
 */
export async function storeRawProviderData(
  mangaId: number,
  rawProviderData: unknown,
): Promise<AsyncResult<void, Error>> {
  try {
    await rawDataCache.storeRawProviderData(
      mangaId, 'provider_fetch', 'provider_fetch', rawProviderData,
      { provider: 'combined', confidence: 1.0 },
    );
    return createSuccessResult(undefined);
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    return createErrorResult(err);
  }
}

// ============================================================================
// New 3-Step Prompts
// ============================================================================

/**
 * Build full data prompt for AI merge (Step 3).
 * Includes actual chapter data from all sources, not summaries.
 * Manages context window by showing first 50 chapters in detail,
 * summarizing the rest.
 */
export function buildFullDataPrompt(
  data: SourceDataCollection,
  preferredLanguage: string,
): string {
  const lines: string[] = [];

  lines.push(`Manga: ${data.title} (ID: ${data.mangaId})`);
  lines.push(`Expected chapters: ${data.expectedChapterCount}`);
  if (preferredLanguage !== 'en') {
    lines.push(`Preferred language: ${preferredLanguage}`);
  }
  lines.push('');

  // Render each source
  lines.push(...renderSourceSection('ComicVine', data.sources.comicvine));
  lines.push(...renderSourceSection('Fandom', data.sources.fandom));
  lines.push(...renderSourceSection('Wikipedia', data.sources.wikipedia));

  // Gap analysis
  lines.push('=== Gap Analysis ===');
  lines.push(`Coverage: ${data.gaps.chaptersWithTitles}/${data.gaps.totalExpectedChapters} titles (${data.gaps.coveragePercent}%)`);
  if (data.gaps.failedSources.length > 0) {
    lines.push(`Failed sources: ${data.gaps.failedSources.join(', ')}`);
  }
  lines.push('');

  // Volume assignment analysis
  const volumeAnalysis = buildVolumeAssignmentAnalysis(data);
  if (volumeAnalysis.length > 0) {
    lines.push('=== Volume Assignment Analysis ===');
    lines.push(...volumeAnalysis);
    lines.push('');
  }

  // Truncation detection
  const truncationWarnings = detectTruncationPatterns(data);
  if (truncationWarnings.length > 0) {
    lines.push('=== Truncation Warnings ===');
    lines.push(...truncationWarnings);
    lines.push('');
  }

  // Task instruction
  lines.push('=== Task ===');
  lines.push('Merge best data. Priority: Fandom > Wikipedia > ComicVine > MangaDex.');
  lines.push('Output JSON ChapterEnrichmentMaps.');

  return lines.join('\n');
}

/** Render a source section with chapter data */
function renderSourceSection(sourceName: string, chapters: ChapterDataItem[]): string[] {
  const lines: string[] = [];
  const titledCount = chapters.filter(c => c.title).length;

  lines.push(`=== ${sourceName} (${chapters.length} entries, ${titledCount} with titles) ===`);

  if (chapters.length === 0) {
    lines.push('(no data)');
    lines.push('');
    return lines;
  }

  // Show first N chapters in detail
  const detailed = chapters.slice(0, MAX_DETAILED_CHAPTERS);
  for (const ch of detailed) {
    const parts = [`[${ch.number}]`];
    if (ch.title) parts.push(`"${ch.title}"`);
    if (ch.volume !== undefined) parts.push(`vol=${ch.volume}`);
    lines.push(parts.join(' '));
  }

  // Summarize remainder
  const remaining = chapters.length - detailed.length;
  if (remaining > 0) {
    lines.push(`... ${remaining} more chapters`);
  }

  lines.push('');
  return lines;
}

// ============================================================================
// Volume & Truncation Analysis Helpers
// ============================================================================

/** Analyze volume assignment gaps across all sources */
function buildVolumeAssignmentAnalysis(data: SourceDataCollection): string[] {
  const lines: string[] = [];

  // Collect all chapter numbers across sources
  const allChapterNums = new Set<number>();
  const assignedChapterNums = new Set<number>();

  for (const source of Object.values(data.sources)) {
    for (const ch of source) {
      allChapterNums.add(ch.number);
      if (ch.volume !== undefined) assignedChapterNums.add(ch.number);
    }
  }

  const unassigned = allChapterNums.size - assignedChapterNums.size;
  if (unassigned > 0) {
    lines.push(`${unassigned}/${allChapterNums.size} chapters have NO volume assignment.`);
    lines.push('You MUST assign every chapter to a volume. Cross-reference volume boundaries from ALL sources below.');

    // Show per-source volume boundaries so the model can compare
    const sourceNames: Array<[string, ChapterDataItem[]]> = [
      ['Fandom', data.sources.fandom],
      ['Wikipedia', data.sources.wikipedia],
      ['ComicVine', data.sources.comicvine],
    ];

    for (const [name, chapters] of sourceNames) {
      const perSourceBoundaries = buildVolumeBoundariesFromChapters(chapters);
      if (perSourceBoundaries.length === 0) continue;
      lines.push(`${name} volume ranges (${perSourceBoundaries.length} volumes):`);
      for (const b of perSourceBoundaries.slice(0, 20)) {
        lines.push(`  Vol ${b.vol}: ch ${b.start}-${b.end} (${b.end - b.start + 1} chapters)`);
      }
      if (perSourceBoundaries.length > 20) {
        lines.push(`  ... ${perSourceBoundaries.length - 20} more volumes`);
      }
    }

    lines.push('Use source data above to assign chapters. Only interpolate when NO source covers a range.');
  }

  return lines;
}

/** Extract volume boundaries from a single source's chapters */
function buildVolumeBoundariesFromChapters(
  chapters: ChapterDataItem[],
): Array<{ vol: number; start: number; end: number }> {
  const volChapters = new Map<number, number[]>();
  for (const ch of chapters) {
    if (ch.volume === undefined) continue;
    const existing = volChapters.get(ch.volume);
    if (existing) {
      existing.push(ch.number);
    } else {
      volChapters.set(ch.volume, [ch.number]);
    }
  }

  const boundaries: Array<{ vol: number; start: number; end: number }> = [];
  for (const [vol, chs] of volChapters) {
    const sorted = [...chs].sort((a, b) => a - b);
    boundaries.push({
      vol,
      start: sorted[0] ?? 0,
      end: sorted[sorted.length - 1] ?? 0,
    });
  }

  return boundaries.sort((a, b) => a.vol - b.vol);
}


/** Detect truncated or paginated data patterns in source data */
function detectTruncationPatterns(data: SourceDataCollection): string[] {
  const warnings: string[] = [];
  const expected = data.expectedChapterCount;
  if (expected === 0) return warnings;

  for (const [name, chapters] of Object.entries(data.sources)) {
    if (chapters.length === 0) continue;

    const maxChNum = Math.max(...chapters.map(c => c.number));
    const coverage = maxChNum / expected;

    // If source has data but max chapter number is far below expected
    if (coverage < 0.5 && chapters.length > 10) {
      warnings.push(
        `${name}: Data appears TRUNCATED — max chapter ${maxChNum} vs ${expected} expected (${Math.round(coverage * 100)}% range coverage)`,
      );
    }

    // Check for round-number cutoffs (pagination artifacts)
    if (maxChNum % 100 === 0 || maxChNum % 50 === 0) {
      warnings.push(
        `${name}: Suspiciously round cutoff at chapter ${maxChNum} — possible pagination limit`,
      );
    }
  }

  // Check ComicVine volume description gaps
  const cvDescriptions = data.rawData.comicvineVolumeDescriptions;
  if (cvDescriptions && cvDescriptions.length > 0) {
    const withChapters = cvDescriptions.filter(v => v.parsedChapterCount > 0).length;
    const total = cvDescriptions.length;
    if (withChapters < total * 0.5) {
      warnings.push(
        `ComicVine: Only ${withChapters}/${total} volumes had parseable chapter descriptions — later volumes may have empty descriptions`,
      );
    }
  }

  return warnings;
}

// ============================================================================
// Agentic Loop Prompt
// ============================================================================

/**
 * Build the prompt for a single agentic loop iteration.
 *
 * Sends full detail for sources that need work (below 50% coverage) and
 * a compact summary for sources that are already strong. This way the model
 * sees what's already covered without drowning in redundant data.
 */
export function buildLoopIterationPrompt(
  state: AgenticLoopState,
  data: SourceDataCollection,
): string {
  const lines: string[] = [];
  const remaining = state.budget.maxCalls - state.budget.callsUsed;

  lines.push(`=== Iteration ${state.budget.callsUsed + 1}/${state.budget.maxCalls} | Budget: ${remaining} calls | Coverage: ${state.coverage.titlePercent}% ===`);
  lines.push('');

  lines.push(...buildSourceDataByNeed(data, state.preferredLanguage));

  // Action history
  if (state.actionHistory.length > 0) {
    lines.push('=== Action History ===');
    for (const record of state.actionHistory) {
      const toolInfo = record.tool ? ` (${record.tool})` : '';
      lines.push(`[${record.iteration}] ${record.action}${toolInfo}: ${record.resultSummary} (${record.durationMs}ms)`);
    }
    lines.push('');
  }

  lines.push('=== Task ===');
  lines.push('Analyze gaps and choose ONE action. Output JSON only.');

  const userPrompt = lines.join('\n');
  return buildPromptWithTools(AGENTIC_LOOP_PROMPT, userPrompt, []);
}

/**
 * Render source data based on need:
 * - Sources below 50% coverage: full chapter detail (these need investigation)
 * - Sources at/above 50% coverage: compact summary (already working)
 */
function buildSourceDataByNeed(data: SourceDataCollection, preferredLanguage: string): string[] {
  const lines: string[] = [];
  const expected = data.expectedChapterCount;
  const threshold = expected * 0.5;

  lines.push(`Manga: ${data.title} (ID: ${data.mangaId})`);
  lines.push(`Expected chapters: ${expected}`);
  if (preferredLanguage !== 'en') lines.push(`Preferred language: ${preferredLanguage}`);
  lines.push('');

  const sources: Array<[string, ChapterDataItem[]]> = [
    ['ComicVine', data.sources.comicvine],
    ['Fandom', data.sources.fandom],
    ['Wikipedia', data.sources.wikipedia],
  ];

  for (const [name, chapters] of sources) {
    if (chapters.length >= threshold) {
      // Strong source: summary only
      lines.push(...renderSourceSummary(name, chapters, expected));
    } else {
      // Weak source: full detail so the model can see what's missing
      lines.push(...renderSourceSection(name, chapters));
    }
  }

  // Source URLs — helps the model target searches at known wiki domains
  lines.push('=== Source URLs ===');
  if (data.rawData.fandomUrl) {
    const fandomChapterCount = data.sources.fandom.length;
    const fandomCoverage = expected > 0 ? Math.round((fandomChapterCount / expected) * 100) : 0;
    lines.push(`Fandom: ${data.rawData.fandomUrl} (${fandomChapterCount} chapters, ${fandomCoverage}% coverage)`);
  } else {
    lines.push('Fandom: (no URL available)');
  }
  const wikiChapterCount = data.sources.wikipedia.length;
  const wikiCoverage = expected > 0 ? Math.round((wikiChapterCount / expected) * 100) : 0;
  lines.push(`Wikipedia: (${wikiChapterCount} chapters, ${wikiCoverage}% coverage)`);
  const cvChapterCount = data.sources.comicvine.length;
  const cvCoverage = expected > 0 ? Math.round((cvChapterCount / expected) * 100) : 0;
  lines.push(`ComicVine: (${cvChapterCount} chapters, ${cvCoverage}% coverage)`);
  lines.push('');

  // Gap analysis
  lines.push('=== Gap Analysis ===');
  lines.push(`Coverage: ${data.gaps.chaptersWithTitles}/${data.gaps.totalExpectedChapters} titles (${data.gaps.coveragePercent}%)`);
  if (data.gaps.failedSources.length > 0) {
    lines.push(`Failed sources: ${data.gaps.failedSources.join(', ')}`);
  }
  lines.push('');

  return lines;
}

/** Compact summary for a strong source (just counts and range) */
function renderSourceSummary(name: string, chapters: ChapterDataItem[], expected: number): string[] {
  const titledCount = chapters.filter(c => c.title).length;
  const withVolume = chapters.filter(c => c.volume !== undefined).length;
  const pct = expected > 0 ? Math.round((titledCount / expected) * 100) : 0;

  const lines: string[] = [];
  lines.push(`=== ${name} (${chapters.length} entries, ${pct}% coverage — OK) ===`);
  lines.push(`Titles: ${titledCount}, Volumes assigned: ${withVolume}`);

  if (chapters.length > 0) {
    const minCh = Math.min(...chapters.map(c => c.number));
    const maxCh = Math.max(...chapters.map(c => c.number));
    lines.push(`Chapter range: ${minCh}-${maxCh}`);
  }

  lines.push('');
  return lines;
}

// ============================================================================
// Legacy Prompt (backward compat)
// ============================================================================

/**
 * Build enrichment prompt for legacy mode (tool-calling agent)
 */
export function buildEnrichmentPrompt(context: AgentProcessingContext, tools: AgentTool[]): string {
  const { mangaId, title, sourceData, rawProviderData, preferredLanguage } = context;

  // Support both new sourceData and legacy rawProviderData
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- rawProviderData is deprecated fallback
  const dataForPrompt: unknown = sourceData ?? rawProviderData;
  const providerSummary = generateProviderSummary(dataForPrompt);

  const providerContext: ProviderDataContext = {
    mangaId,
    title,
    rawProviderData: (dataForPrompt ?? {}) as Record<string, unknown>,
    enrichmentMaps: {
      chapterTitleMap: {},
      chapterVolumeMap: {},
      chapterCoverMap: {},
      chapterDescriptionMap: {},
      chapterPagesMap: {},
      chapterReleaseDateMap: {},
      volumeDescriptionMap: {},
    },
    providerSummary,
    ...(preferredLanguage ? { preferredLanguage } : {}),
  };

  return buildPromptWithTools(ENRICHMENT_TASK_PROMPT, providerContext, tools);
}

/** Generate summary from SourceDataCollection or raw provider data for prompt */
function generateProviderSummary(data: unknown): string {
  if (!data || typeof data !== 'object') return 'No provider data available';

  // SourceDataCollection format (new)
  if (isSourceDataCollection(data)) {
    const lines: string[] = [];
    lines.push(`Sources collected for "${data.title}":`);
    lines.push(`  - ComicVine: ${data.sources.comicvine.length} chapters`);
    lines.push(`  - Fandom: ${data.sources.fandom.length} chapters`);
    lines.push(`  - Wikipedia: ${data.sources.wikipedia.length} chapters`);
    lines.push(`Coverage: ${data.gaps.coveragePercent}%`);
    return lines.join('\n');
  }

  // Legacy EnrichmentResult format (backward compat)
  const keys = Object.keys(data as Record<string, unknown>);
  return `Raw data keys: ${keys.join(', ')}`;
}

/** Type guard for SourceDataCollection */
function isSourceDataCollection(data: unknown): data is SourceDataCollection {
  if (!data || typeof data !== 'object') return false;
  const obj = data as Record<string, unknown>;
  return 'sources' in obj && 'gaps' in obj && typeof obj['sources'] === 'object';
}
