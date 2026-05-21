/**
 * Agentic Enrichment Loop — Entry Point
 *
 * Code-driven orchestration: the code decides what to do each iteration,
 * the model only assists with specific tasks (suggest search queries).
 * The model never decides "done" — the code drives all 8 iterations.
 *
 * Phases:
 *   1. ASSESS  — Identify weak sources (deterministic)
 *   2. SEARCH  — Search weak source wikis for chapter lists (deterministic)
 *   3. MODEL   — Ask model for alternative search query (if deterministic failed)
 *   4. GLOBAL  — Global wiki search as fallback
 *   5. DONE    — Record results
 *
 * After loop exit, a deterministic merge is built and AI overrides are applied on top.
 */

import { Qwen35InferenceService } from '@/server/ai-agent/agent-core/inference-service';
import { getRemediationTools } from '@/server/ai-agent/tools';
import { coverValidationTool } from '@/server/ai-agent/tools/cover-validation-tool';
import type {
  ChapterEnrichmentMaps,
  EnrichmentProgress,
  SourceDataCollection,
} from '@/server/trpc/routers/manga/metadataOperations/enrichment-pipeline/types';
import { isError } from '@/utils/async-result';
import { logger } from '@/utils/logger';

import { initializeLoopState } from './agentic-loop/loop-state';
import { runOrchestratedLoop } from './agentic-loop/orchestrator';

import type { AIOverrides } from './agentic-loop/loop-types';

const log = logger.child('AgenticLoop');

// ============================================================================
// Main Entry Point
// ============================================================================

/** Run the agentic enrichment loop. Returns AI overrides to apply on top of deterministic merge. */
export async function runAgenticLoop(
  data: SourceDataCollection,
  preferredLanguage: string,
  onProgress?: EnrichmentProgress,
): Promise<AIOverrides> {
  const state = initializeLoopState(data, preferredLanguage);

  // Initialize model
  const inferenceService = Qwen35InferenceService.getInstance();
  const initResult = await inferenceService.initialize();
  if (isError(initResult)) {
    log.warn('Model unavailable for agentic loop, returning empty overrides');
    return state.aiOverrides;
  }

  // Build tool map
  const tools = [...getRemediationTools(), coverValidationTool];
  const toolMap = new Map(tools.map(t => [t.name, t]));

  log.info('Starting orchestrated agentic loop', {
    mangaId: state.mangaId,
    coverage: state.coverage,
    budget: state.budget.maxCalls,
  });

  // Run the code-driven orchestration
  await runOrchestratedLoop(inferenceService, state, data, toolMap, onProgress);

  log.info('Agentic loop finished', {
    iterations: state.budget.callsUsed,
    coverage: state.coverage,
  });

  return state.aiOverrides;
}

// ============================================================================
// AI Override Application
// ============================================================================

/** Apply AI overrides on top of deterministic merge maps */
export function applyAIOverrides(
  maps: ChapterEnrichmentMaps,
  overrides: AIOverrides,
): ChapterEnrichmentMaps {
  const result = { ...maps };

  for (const [k, v] of Object.entries(overrides.titleOverrides)) {
    result.chapterTitleMap[Number(k)] = v;
  }

  for (const [k, v] of Object.entries(overrides.volumeOverrides)) {
    result.chapterVolumeMap[Number(k)] = v;
  }

  for (const [k, v] of Object.entries(overrides.coverSelections)) {
    result.chapterCoverMap[Number(k)] = v;
  }

  for (const rejectedUrl of overrides.coverRejections) {
    for (const [chNum, url] of Object.entries(result.chapterCoverMap)) {
      if (url === rejectedUrl) {
        delete result.chapterCoverMap[Number(chNum)];
      }
    }
  }

  return result;
}
