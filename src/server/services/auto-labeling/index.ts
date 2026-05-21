/**
 * Auto-Labeling Improvement System
 *
 * Public API for the iterative auto-labeling improvement system.
 * Provides functions to run iterations, analyze failures, and track progress.
 *
 * @module auto-labeling
 */

// ============================================================================
// Types
// ============================================================================

export type {
  // Training data types
  DiscoveredUrlType,
  DiscoveredUrl,
  TrainingDataRow,
  TrainingEntry,
  SamplingFilters,

  // Sampled page types
  SampledPage,

  // Entity types
  ExtractedEntity,
  ExpectedEntity,

  // Labeling attempt types
  LabelingAttempt,

  // Metrics types
  LabelingMetrics,
  EntityTypeMetrics,
  EntityMatch,
  AggregatedMetrics,

  // Error types
  FailureDetails,
  FailureAnalysis,
  FailureCategoryAnalysis,
  FailurePattern,

  // Iteration types
  IterationConfig,
  IterationResult,

  // Improvement types
  ImprovementSuggestion,
  ProgressReport as TypesProgressReport,
  IterationSummary as TypesIterationSummary,
  Regression,

  // Agent ground truth types
  AgentGroundTruth,
  AgentGroundTruthConfig,
  AgentIterationResult,
  AgentIterationMetrics,
  DetailedImprovementSuggestion,
  IssueType,
  GroundTruthCacheEntry,
} from './types';

export { ErrorCategory, DEFAULT_ITERATION_CONFIG, ENTITY_TYPE_TARGETS } from './types';
export { isDiscoveredUrlType, isErrorCategory, isSampledPage, isLabelingAttempt } from './types';

// ============================================================================
// Sampler
// ============================================================================

export { loadTrainingData, samplePages, parseDiscoveredUrls, filterBySource } from './sampler';

// ============================================================================
// Parser Bridge
// ============================================================================

export type { ParserExtractionResult, ParserExtractionOptions } from './parser-bridge';
export { extractWithParser, staticAnalysisToLabels, mergeExtractions, normalizeEntityValue } from './parser-bridge';

// ============================================================================
// Bootstrap Bridge
// ============================================================================

export type { BootstrapExtractionResult, BootstrapExtractionOptions } from './bootstrap-bridge';
export {
  runBootstrapLabeling,
  extractEntitiesFromSpans,
  enhanceWithStaticAnalysis,
  countEntitiesFromLabels,
  extractSpansFromLabels,
} from './bootstrap-bridge';

// ============================================================================
// Ground Truth
// ============================================================================

export type { GroundTruthMetadata, GroundTruthResult } from './ground-truth';
export {
  fetchAnilistMetadata,
  buildExpectedEntities,
  normalizeForComparison,
  areSimilar,
  calculateSimilarity,
} from './ground-truth';

// ============================================================================
// Agent Ground Truth
// ============================================================================

export {
  ALL_ENTITY_TYPES,
  DEFAULT_AGENT_CONFIG,
  buildGroundTruthPrompt,
  parseAgentResponse,
  createAgentGroundTruth,
  loadCachedGroundTruth,
  saveGroundTruthToCache,
  getRelevantEntityTypes,
  isHighPriorityEntityType,
} from './agent-ground-truth';

// ============================================================================
// Improvement Analyzer
// ============================================================================

export {
  analyzeFailures as analyzeIterationFailures,
  generateImprovementSummary,
  isSimilar as checkSimilarity,
  findClosestMatch,
} from './improvement-analyzer';

// ============================================================================
// Metrics
// ============================================================================

export type { MatchConfig } from './metrics';
export {
  calculateMetrics,
  matchEntities,
  computeEntityBreakdown,
  aggregateMetrics,
  formatMetrics,
  formatAggregatedMetrics,
} from './metrics';

// ============================================================================
// Error Classifier
// ============================================================================

export { classifyFailure, suggestFix, analyzeFailures } from './error-classifier';

// ============================================================================
// Improvement Tracker
// ============================================================================

export type {
  TrendDirection,
  IterationSummary,
  TrendAnalysis,
  ImprovementPriority,
  ProgressReport,
  TrackerConfig,
} from './improvement-tracker';

export { ImprovementTracker, getTracker, resetTracker } from './improvement-tracker';

// ============================================================================
// Iteration Runner
// ============================================================================

export type { RunnerStatus, ProgressCallback, IterationProgress } from './iteration-runner';

export { runSingleIteration, runIterativeImprovement } from './iteration-runner';

// ============================================================================
// Quick Start Functions
// ============================================================================

import { getTracker } from './improvement-tracker';
import { runSingleIteration, runIterativeImprovement } from './iteration-runner';
import { ENTITY_TYPE_TARGETS } from './types';

import type { ProgressReport } from './improvement-tracker';
import type { IterationConfig, IterationResult } from './types';

/**
 * Run a quick test iteration with default settings.
 *
 * @param sampleSize - Number of pages to sample (default: 5)
 * @returns The iteration result with metrics
 */
export async function quickTest(sampleSize: number = 5): Promise<IterationResult> {
  return runSingleIteration({ sampleSize });
}

/**
 * Start the full improvement cycle.
 *
 * @param config - Optional configuration overrides
 * @returns Array of iteration results
 */
export async function startImprovement(
  config?: Partial<IterationConfig>
): Promise<IterationResult[]> {
  return runIterativeImprovement(config);
}

/**
 * Get current progress report.
 *
 * @returns Progress report with trends and priorities
 */
export function getProgress(): ProgressReport {
  const tracker = getTracker();
  const targets: Record<string, number> = {};
  for (const [key, value] of Object.entries(ENTITY_TYPE_TARGETS)) {
    targets[key] = value;
  }
  return tracker.generateReport([], targets);
}

/**
 * Get formatted progress report as string.
 *
 * @returns Formatted report string for display
 */
export function getFormattedProgress(): string {
  const tracker = getTracker();
  const report = getProgress();
  return tracker.formatReport(report);
}

/**
 * Analyze failures from the most recent iteration.
 *
 * @returns Patterns and suggestions for improvements
 */
export function analyzeRecentFailures(): {
  patterns: Array<{ pattern: string; count: number }>;
  suggestions: string[];
} {
  const tracker = getTracker();
  const history = tracker.getIterationHistory();

  if (history.length === 0) {
    return { patterns: [], suggestions: [] };
  }

  const latest = history[history.length - 1];
  if (!latest) {
    return { patterns: [], suggestions: [] };
  }

  return {
    patterns: latest.topErrors.map(e => ({ pattern: e.category, count: e.count })),
    suggestions: latest.topErrors.map(e => `Fix ${e.category} errors (${e.count} occurrences)`),
  };
}
