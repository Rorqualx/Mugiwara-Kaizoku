/**
 * AI Agent Phase Orchestrator — 2-Step Flow
 *
 * Step 1: Validation-driven remediation (parallel Fandom + Wikipedia + ComicVine, no AI)
 * Step 2: Agentic loop — AI actively investigates gaps, validates covers, merges iteratively
 *
 * Falls back to deterministic merge if AI fails at any point.
 */

import { checkFeatureFlag } from '@/config/featureFlags';
import { configService } from '@/server/services/config/configService';
import {
  buildChapterSourceLookups,
  pickBestChapterValue,
} from '@/server/trpc/routers/manga/metadataOperations/enrichment-pipeline/source-priority-config';
import type { ChapterField } from '@/server/trpc/routers/manga/metadataOperations/enrichment-pipeline/source-priority-config';
import type {
  ChapterEnrichmentMaps,
  EnrichmentProgress,
  SourceDataCollection,
} from '@/server/trpc/routers/manga/metadataOperations/enrichment-pipeline/types';
import { createEmptyEnrichmentMaps } from '@/server/trpc/routers/manga/metadataOperations/enrichment-pipeline/types';
import { createSuccessResult, createErrorResult, isError, isSuccess } from '@/utils/async-result';
import type { AsyncResult } from '@/utils/async-result';
import { logger } from '@/utils/logger';

import { Qwen35InferenceService } from '../agent-core/inference-service';

import { runAgenticLoop, applyAIOverrides } from './phase-orchestrator/agentic-loop';
import { remediateComicVine } from './phase-orchestrator/comicvine-remediation';
import {
  withTimeout,
  storeRawProviderData,
  buildEnrichmentPrompt,
} from './phase-orchestrator/context-builder';
import { runExtendedParsing } from './phase-orchestrator/extended-parsing';
import { runAIGuidedHtmlTriage } from './phase-orchestrator/html-triage';
import { DEFAULT_CONFIG, type AgentProcessingContext } from './phase-orchestrator/orchestrator-types';
import { remediateFandom, remediateWikipedia, runRawHtmlFallback } from './phase-orchestrator/remediation';
import { parseEnrichmentMapsFromResponse } from './phase-orchestrator/response-parser';
import { executeToolCalls } from './phase-orchestrator/tool-executor';
import { validateAndFixVolumeMap, fillUnassignedChapterVolumes } from './phase-orchestrator/validation';

const log = logger.child('AIAgentOrchestrator');

// ============================================================================
// Main Entry Point — 2-Step Flow
// ============================================================================

/** Run smart agent enrichment with the 2-step approach (remediation + agentic loop). */
export async function runSmartAgentEnrichment(
  mangaId: number,
  title: string,
  data: SourceDataCollection,
  preferredLanguage: string,
  onProgress?: EnrichmentProgress,
): Promise<ChapterEnrichmentMaps> {
  const startTime = Date.now();
  log.info('Starting smart agent enrichment', { mangaId, title, coverage: data.gaps.coveragePercent });

  try {
    // Step 1: Parallel deterministic remediation with validation gates
    const { comicvine, fandom, wikipedia } = data.sources;
    await onProgress?.('ai_agent_remediation', `Validating ${comicvine.length} ComicVine + ${fandom.length} Fandom + ${wikipedia.length} Wikipedia chapters...`);
    await runDeterministicRemediation(data);

    // Step 2: Agentic loop — AI actively investigates gaps, validates, merges
    await onProgress?.('ai_agent', `Starting AI investigation (coverage ${data.gaps.coveragePercent}%)...`);
    const aiOverrides = await runAgenticLoop(data, preferredLanguage, onProgress);

    // Build field-aware merge, then apply AI overrides on top
    const deterministicMaps = buildFieldAwareMerge(data);
    const maps = applyAIOverrides(deterministicMaps, aiOverrides);

    // Validate and fill volume assignments
    maps.chapterVolumeMap = validateAndFixVolumeMap(maps.chapterVolumeMap);
    maps.chapterVolumeMap = fillUnassignedChapterVolumes(maps.chapterVolumeMap, data.expectedChapterCount, data);

    const duration = Date.now() - startTime;
    log.info('Smart agent enrichment completed', { mangaId, duration, titles: Object.keys(maps.chapterTitleMap).length });
    return maps;
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    log.warn('AI enrichment failed, falling back to field-aware merge', { mangaId, error: err.message });
    return buildFieldAwareMerge(data);
  }
}

// ============================================================================
// Step 1: Deterministic Remediation (Parallel)
// ============================================================================

/**
 * Run ComicVine, Fandom, and Wikipedia remediation in parallel.
 * Each source runs through validation-driven strategies independently.
 */
async function runDeterministicRemediation(data: SourceDataCollection): Promise<void> {
  const wikiDiscovery = await import(
    '@/server/trpc/routers/manga/metadataOperations/enrichment-pipeline/wiki-discovery'
  );

  // Run all three source remediations in parallel
  await Promise.allSettled([
    remediateComicVine(data),
    remediateFandom(data, wikiDiscovery),
    remediateWikipedia(data, wikiDiscovery),
  ]);

  // Raw HTML fallback for sources where parser failed but HTML is available
  await runRawHtmlFallback(data);

  // Extended parsing: when parser has the right URL but wrong structure detection,
  // retry ALL parsers exhaustively. Only falls back to AI raw HTML extraction
  // if every deterministic parser fails to meet coverage threshold.
  await runExtendedParsing(data);

  // AI-guided HTML triage: model reviews search candidates and picks pages
  // to fetch raw HTML from for extraction (bridges parser failures)
  await runAIGuidedHtmlTriage(data);

  recalculateGaps(data);
}


// ============================================================================
// Field-Aware Merge (replaces flat deterministic merge)
// ============================================================================

/**
 * Build enrichment maps using per-field source priority.
 *
 * Instead of a flat ordering where later sources blindly overwrite all fields,
 * each field picks the highest-priority source that has data for that chapter.
 * E.g., chapter-volume mapping prefers Wikipedia > Fandom > ComicVine,
 * while chapter titles prefer Fandom > Wikipedia > ComicVine.
 *
 * See source-priority-config.ts for the full priority table.
 */
export function buildFieldAwareMerge(data: SourceDataCollection): ChapterEnrichmentMaps {
  const maps = createEmptyEnrichmentMaps();
  const lookups = buildChapterSourceLookups(data.sources);

  // Collect all unique chapter numbers across all sources
  const allChapterNums = new Set<number>();
  for (const chapters of Object.values(data.sources)) {
    for (const ch of chapters) {
      allChapterNums.add(ch.number);
    }
  }

  // For each chapter, pick the best source value per field
  const fieldToMap: Array<[ChapterField, Record<number, unknown>]> = [
    ['title', maps.chapterTitleMap],
    ['volume', maps.chapterVolumeMap],
    ['cover', maps.chapterCoverMap],
    ['description', maps.chapterDescriptionMap],
    ['pages', maps.chapterPagesMap],
    ['releaseDate', maps.chapterReleaseDateMap],
  ];

  for (const chNum of allChapterNums) {
    for (const [field, map] of fieldToMap) {
      const value = pickBestChapterValue(field, chNum, lookups);
      if (value !== undefined) {
        (map as Record<number, unknown>)[chNum] = value;
      }
    }
  }

  // Validate volume map before returning — removes implausible ranges
  maps.chapterVolumeMap = validateAndFixVolumeMap(maps.chapterVolumeMap);
  // Fill any remaining unassigned chapters with interpolated volume assignments
  maps.chapterVolumeMap = fillUnassignedChapterVolumes(maps.chapterVolumeMap, data.expectedChapterCount, data);

  log.info('Field-aware merge completed', {
    titles: Object.keys(maps.chapterTitleMap).length,
    volumes: Object.keys(maps.chapterVolumeMap).length,
    covers: Object.keys(maps.chapterCoverMap).length,
  });

  return maps;
}

/**
 * Legacy flat merge — kept as export for backward compatibility with tests.
 * Delegates to buildFieldAwareMerge which uses per-field priorities.
 */
export function buildDeterministicMerge(data: SourceDataCollection): ChapterEnrichmentMaps {
  return buildFieldAwareMerge(data);
}

// ============================================================================
// Helpers
// ============================================================================

/** Recalculate gap analysis after remediation updates */
function recalculateGaps(data: SourceDataCollection): void {
  const allTitled = new Set<number>();
  for (const source of Object.values(data.sources)) {
    for (const ch of source) {
      if (ch.title) allTitled.add(ch.number);
    }
  }

  /* eslint-disable no-param-reassign -- Intentional in-place recalculation of gap analysis */
  data.gaps.chaptersWithTitles = allTitled.size;
  data.gaps.coveragePercent = data.gaps.totalExpectedChapters > 0
    ? Math.round((allTitled.size / data.gaps.totalExpectedChapters) * 100)
    : 0;

  data.gaps.failedSources = [];
  if (data.sources.fandom.length === 0) data.gaps.failedSources.push('fandom');
  if (data.sources.wikipedia.length === 0) data.gaps.failedSources.push('wikipedia');
  data.gaps.needsRemediation = data.gaps.coveragePercent < 50 && data.gaps.failedSources.length > 0;
  /* eslint-enable no-param-reassign */
}

// ============================================================================
// Legacy Entry Point (backward compat with existing tests)
// ============================================================================

/**
 * Legacy AI agent enrichment — uses old tool-calling approach.
 * Accepts SourceDataCollection (or raw data via rawProviderData field).
 */
export async function runAIAgentEnrichment(
  mangaId: number,
  title: string,
  sourceData: SourceDataCollection | unknown,
  onProgress?: EnrichmentProgress,
): Promise<AsyncResult<ChapterEnrichmentMaps, Error>> {
  const startTime = Date.now();
  log.info('Starting AI agent enrichment', { mangaId, title });

  try {
    const aiAgentEnabled = await checkFeatureFlag('aiAgentEnrichment');
    if (!aiAgentEnabled) {
      return createErrorResult(new Error('AI agent enrichment feature disabled'));
    }

    await onProgress?.('ai_agent', 'Initializing AI agent...');

    const storeResult = await storeRawProviderData(mangaId, sourceData);
    if (isError(storeResult)) return createErrorResult(storeResult.error);

    const preferredLanguage = await configService.get<string>('general.language', 'en');
    const context: AgentProcessingContext = {
      mangaId, title, sourceData: sourceData as SourceDataCollection,
      rawProviderData: sourceData,
      config: DEFAULT_CONFIG, preferredLanguage,
    };

    await onProgress?.('ai_agent', 'Analyzing provider data...');
    const inferenceService = Qwen35InferenceService.getInstance();
    const initResult = await inferenceService.initialize();
    if (isError(initResult)) return createErrorResult(initResult.error);

    const { getAllTools } = await import('../tools');
    const tools = getAllTools();
    inferenceService.registerTools(tools);

    await onProgress?.('ai_agent', 'Processing with AI agent...');
    const prompt = buildEnrichmentPrompt(context, tools);

    const generateResult = await withTimeout(
      inferenceService.generate(prompt, tools),
      DEFAULT_CONFIG.timeoutMs,
      `Agent generation timed out after ${DEFAULT_CONFIG.timeoutMs}ms`,
    );
    if (isError(generateResult)) return createErrorResult(generateResult.error);
    if (!isSuccess(generateResult)) return createErrorResult(new Error('Unexpected generate status'));

    const agentResponse = generateResult.data;
    if (agentResponse.confidence < DEFAULT_CONFIG.confidenceThreshold) {
      return createErrorResult(
        new Error(`Agent confidence ${agentResponse.confidence} below threshold ${DEFAULT_CONFIG.confidenceThreshold}`),
      );
    }

    await onProgress?.('ai_agent', 'Executing tool calls...');
    const enrichmentMaps = await resolveLegacyMaps(agentResponse, tools, mangaId, title);
    if (isError(enrichmentMaps) || !isSuccess(enrichmentMaps)) {
      return isError(enrichmentMaps) ? enrichmentMaps : createErrorResult(new Error('Unexpected enrichment status'));
    }

    const duration = Date.now() - startTime;
    log.info('AI agent enrichment completed', { mangaId, duration, confidence: agentResponse.confidence });
    return createSuccessResult(enrichmentMaps.data);
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    return createErrorResult(err);
  }
}

/** Resolve enrichment maps from legacy agent response */
async function resolveLegacyMaps(
  agentResponse: { toolCalls?: Array<{ name: string; arguments: Record<string, unknown> }>; response: string },
  tools: import('../agent-core/types').AgentTool[],
  mangaId: number,
  title: string,
): Promise<AsyncResult<ChapterEnrichmentMaps, Error>> {
  if (agentResponse.toolCalls && agentResponse.toolCalls.length > 0) {
    return executeToolCalls(agentResponse.toolCalls, tools, mangaId, title);
  }
  return parseEnrichmentMapsFromResponse(agentResponse.response);
}

/**
 * Integration point for pipeline-orchestrator.ts
 */
export async function runAgentEnrichmentPhases(
  mangaId: number,
  title: string,
  sourceData: SourceDataCollection,
  onProgress?: EnrichmentProgress,
): Promise<ChapterEnrichmentMaps> {
  const preferredLanguage = await configService.get<string>('general.language', 'en');
  return runSmartAgentEnrichment(mangaId, title, sourceData, preferredLanguage, onProgress);
}
