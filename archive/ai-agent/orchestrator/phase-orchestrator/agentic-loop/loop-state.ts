/**
 * Agentic Loop State Management
 *
 * Initialize, update, and query loop state for the agentic enrichment loop.
 */

import type { SourceDataCollection } from '@/server/trpc/routers/manga/metadataOperations/enrichment-pipeline/types';

import type {
  AgenticLoopState,
  ActionRecord,
  LoopCoverage,
  TerminationReason,
} from './loop-types';

/** Default budget: 8 model calls, 5 minutes */
const DEFAULT_MAX_CALLS = 8;
const DEFAULT_MAX_DURATION_MS = 5 * 60 * 1000;

/** Coverage threshold for early exit (90% titles) */
const COVERAGE_THRESHOLD = 90;

/** Create initial loop state from source data */
export function initializeLoopState(
  data: SourceDataCollection,
  preferredLanguage: string,
): AgenticLoopState {
  return {
    mangaId: data.mangaId,
    title: data.title,
    expectedChapterCount: data.expectedChapterCount,
    preferredLanguage,
    budget: {
      maxCalls: DEFAULT_MAX_CALLS,
      callsUsed: 0,
      startTimeMs: Date.now(),
      maxDurationMs: DEFAULT_MAX_DURATION_MS,
    },
    coverage: computeCoverage(data),
    actionHistory: [],
    aiOverrides: {
      titleOverrides: {},
      volumeOverrides: {},
      coverSelections: {},
      coverRejections: [],
    },
  };
}

/** Compute current coverage from source data */
export function computeCoverage(data: SourceDataCollection): LoopCoverage {
  const expected = data.expectedChapterCount;
  if (expected === 0) {
    return { titlePercent: 100, volumePercent: 100, coverPercent: 0 };
  }

  const titledChapters = new Set<number>();
  const volumeAssigned = new Set<number>();
  const withCovers = new Set<number>();

  for (const source of Object.values(data.sources)) {
    for (const ch of source) {
      if (ch.title) titledChapters.add(ch.number);
      if (ch.volume !== undefined) volumeAssigned.add(ch.number);
      if (ch.cover) withCovers.add(ch.number);
    }
  }

  return {
    titlePercent: Math.round((titledChapters.size / expected) * 100),
    volumePercent: Math.round((volumeAssigned.size / expected) * 100),
    coverPercent: Math.round((withCovers.size / expected) * 100),
  };
}

/** Record an action and update budget */
export function recordAction(
  state: AgenticLoopState,
  record: ActionRecord,
): void {
  state.actionHistory.push(record);
  state.budget.callsUsed++;
}

/** Log an action without counting toward budget (for assessment and quick probes) */
export function logAction(
  state: AgenticLoopState,
  record: ActionRecord,
): void {
  state.actionHistory.push(record);
}

/** Update coverage in state from current source data */
export function updateCoverage(
  state: AgenticLoopState,
  data: SourceDataCollection,
): void {
  state.coverage = computeCoverage(data);
}

/** Check if the loop should terminate and return the reason */
export function shouldTerminate(state: AgenticLoopState): TerminationReason | null {
  // 1. Coverage met
  if (state.coverage.titlePercent >= COVERAGE_THRESHOLD) {
    return 'coverage_met';
  }

  // 2. Budget exhausted
  if (state.budget.callsUsed >= state.budget.maxCalls) {
    return 'budget_exhausted';
  }

  // 3. Time limit
  const elapsed = Date.now() - state.budget.startTimeMs;
  if (elapsed >= state.budget.maxDurationMs) {
    return 'time_limit';
  }

  // 4. Stagnation — last 3 actions with no improvement
  if (state.actionHistory.length >= 3) {
    const recent = state.actionHistory.slice(-3);
    const allNoImprovement = recent.every(r =>
      r.resultSummary.includes('no improvement') || r.resultSummary.includes('0 new'),
    );
    if (allNoImprovement) {
      return 'stagnation';
    }
  }

  return null;
}
