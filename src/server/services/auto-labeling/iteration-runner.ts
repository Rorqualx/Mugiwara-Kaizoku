/**
 * Iteration Runner
 *
 * Main orchestration for the auto-labeling improvement cycle.
 * Samples pages, runs labeling, measures accuracy, and tracks progress.
 *
 * @module auto-labeling/iteration-runner
 */

import { createLogger } from '@/utils/logger';

import { runBootstrapLabeling } from './bootstrap-bridge';
import { classifyFailure, analyzeFailures } from './error-classifier';
import { fetchAnilistMetadata } from './ground-truth';
import { getTracker } from './improvement-tracker';
import { calculateMetrics, aggregateMetrics } from './metrics';
import { extractWithParser } from './parser-bridge';
import { samplePages, loadTrainingData } from './sampler';
import { DEFAULT_ITERATION_CONFIG, ErrorCategory, ENTITY_TYPE_TARGETS } from './types';

import type {
  FailureAnalysis,
  IterationConfig,
  IterationResult,
  ImprovementSuggestion,
  LabelingAttempt,
  SampledPage,
} from './types';

const logger = createLogger('auto-labeling:iteration-runner');

// ============================================================================
// Types
// ============================================================================

/** Status of the iteration runner. */
export type RunnerStatus = 'idle' | 'running' | 'paused' | 'completed' | 'failed';

/** Progress callback for reporting iteration progress. */
export type ProgressCallback = (progress: IterationProgress) => void;

/** Progress information during iteration. */
export interface IterationProgress {
  currentIteration: number;
  maxIterations: number;
  currentPage: number;
  totalPages: number;
  currentF1: number;
  targetF1: number;
  status: RunnerStatus;
  message: string;
}

// ============================================================================
// Main Runner
// ============================================================================

/** Run a single iteration of the labeling improvement cycle. */
export async function runSingleIteration(
  config?: Partial<IterationConfig>,
  onProgress?: ProgressCallback
): Promise<IterationResult> {
  const cfg = { ...DEFAULT_ITERATION_CONFIG, ...config };
  const startTime = Date.now();
  const iterationNumber = getNextIterationNumber();

  logger.info('Starting iteration', { iterationNumber, sampleSize: cfg.sampleSize });
  reportProgress(onProgress, {
    iteration: iterationNumber,
    maxIterations: 1,
    currentPage: 0,
    totalPages: cfg.sampleSize,
    currentF1: 0,
    targetF1: cfg.targetF1,
    status: 'running',
    message: 'Loading training data',
  });

  // Load and sample pages
  const trainingData = loadTrainingData();
  const sampledPages = samplePages(trainingData, cfg.sampleSize, cfg.filters);

  if (sampledPages.length === 0) {
    throw new Error('No pages sampled - check filters or training data');
  }

  logger.info('Sampled pages', { count: sampledPages.length });

  // Process each page
  const attempts: LabelingAttempt[] = [];
  for (let i = 0; i < sampledPages.length; i++) {
    const page = sampledPages[i];
    if (!page) continue;

    reportProgress(onProgress, {
      iteration: iterationNumber,
      maxIterations: 1,
      currentPage: i + 1,
      totalPages: sampledPages.length,
      currentF1: 0,
      targetF1: cfg.targetF1,
      status: 'running',
      message: `Processing ${page.title}`,
    });

    // eslint-disable-next-line no-await-in-loop -- Sequential processing with progress reporting
    const attempt = await processPage(page, cfg);
    attempts.push(attempt);
  }

  // Aggregate metrics
  const metrics = aggregateMetrics(attempts);

  // Analyze failures
  const failures = buildFailureAnalysis(attempts);

  // Generate suggestions
  const suggestions = generateSuggestions(failures, attempts);

  // Check if target met
  const targetMet = metrics.avgF1 >= cfg.targetF1;

  const result: IterationResult = {
    iterationNumber,
    timestamp: new Date(),
    config: cfg,
    sampledPages,
    attempts,
    metrics,
    failures,
    suggestions,
    durationMs: Date.now() - startTime,
    targetMet,
  };

  // Log to tracker
  const tracker = getTracker({ dataDir: cfg.outputDir });
  tracker.logIteration(result);

  logger.info('Iteration complete', {
    iterationNumber,
    f1: metrics.avgF1,
    successRate: metrics.successfulAttempts / metrics.totalAttempts,
    targetMet,
  });

  reportProgress(onProgress, {
    iteration: iterationNumber,
    maxIterations: 1,
    currentPage: sampledPages.length,
    totalPages: sampledPages.length,
    currentF1: metrics.avgF1,
    targetF1: cfg.targetF1,
    status: targetMet ? 'completed' : 'running',
    message: targetMet ? 'Target F1 met!' : 'Iteration complete',
  });

  return result;
}

/** Run multiple iterations until target is met or max reached. */
export async function runIterativeImprovement(
  config?: Partial<IterationConfig>,
  onProgress?: ProgressCallback
): Promise<IterationResult[]> {
  const cfg = { ...DEFAULT_ITERATION_CONFIG, ...config };
  const results: IterationResult[] = [];

  for (let i = 0; i < cfg.maxIterations; i++) {
    // eslint-disable-next-line no-await-in-loop -- Sequential iterations with early exit on target met
    const result = await runSingleIteration(cfg, (progress) => {
      if (onProgress) {
        onProgress({ ...progress, currentIteration: i + 1, maxIterations: cfg.maxIterations });
      }
    });

    results.push(result);

    if (result.targetMet) {
      logger.info('Target F1 achieved', { iterations: i + 1, f1: result.metrics.avgF1 });
      break;
    }

    // Log progress between iterations
    logger.info('Iteration progress', {
      iteration: i + 1,
      maxIterations: cfg.maxIterations,
      f1: result.metrics.avgF1,
      targetF1: cfg.targetF1,
      gap: cfg.targetF1 - result.metrics.avgF1,
    });
  }

  return results;
}

// ============================================================================
// Page Processing
// ============================================================================

/** Process a single page through the labeling pipeline. */
async function processPage(
  page: SampledPage,
  config: IterationConfig
): Promise<LabelingAttempt> {
  const startTime = Date.now();

  try {
    // Fetch ground truth from AniList, passing urlType for URL-type-aware expected entities
    const groundTruth = await fetchAnilistMetadata(page.anilistId, page.urlType);

    if (!groundTruth.success) {
      return createFailedAttempt(page, startTime, ErrorCategory.GROUND_TRUTH_ERROR, groundTruth.error);
    }

    // Fetch page HTML
    const html = await fetchPageHtml(page.url, config.pageTimeoutMs);

    if (!html) {
      return createFailedAttempt(page, startTime, ErrorCategory.FETCH_ERROR, 'Failed to fetch page HTML');
    }

    // Run parser extraction
    const parserResult = await extractWithParser(page, html, {
      timeoutMs: config.pageTimeoutMs,
      minConfidence: config.minMatchConfidence,
    });

    // Run bootstrap labeling
    const bootstrapResult = runBootstrapLabeling(html, page.url, {
      minConfidence: config.minMatchConfidence,
    });

    // Merge extracted entities (prefer parser, fallback to bootstrap)
    const extractedEntities = mergeEntities(parserResult.entities, bootstrapResult.entities);

    // Calculate metrics
    const metrics = calculateMetrics(extractedEntities, groundTruth.expectedEntities, {
      minSimilarity: config.minMatchConfidence,
    });

    // Determine success based on F1 threshold
    const success = metrics.f1 >= 0.5;

    const attempt: LabelingAttempt = {
      page,
      success,
      extractedEntities,
      expectedEntities: groundTruth.expectedEntities,
      metrics,
      durationMs: Date.now() - startTime,
      timestamp: new Date(),
    };

    // Add optional results only if they exist
    if (bootstrapResult.bootstrapResult) {
      attempt.bootstrapResult = bootstrapResult.bootstrapResult;
    }
    if (parserResult.parserResult) {
      attempt.parserResult = parserResult.parserResult;
    }
    if (parserResult.staticAnalysis) {
      attempt.staticAnalysis = parserResult.staticAnalysis;
    }

    // Classify failure if not successful
    if (!success) {
      const failure = classifyFailure(attempt, parserResult.error ?? bootstrapResult.error);
      attempt.errorCategory = failure.category;
      attempt.error = failure.message;
    }

    return attempt;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logger.error('Error processing page', new Error(errorMsg), { pageId: page.id });
    return createFailedAttempt(page, startTime, ErrorCategory.UNKNOWN, errorMsg);
  }
}

/** Create a failed attempt result. */
function createFailedAttempt(
  page: SampledPage,
  startTime: number,
  category: ErrorCategory,
  errorMessage?: string
): LabelingAttempt {
  const attempt: LabelingAttempt = {
    page,
    success: false,
    errorCategory: category,
    extractedEntities: [],
    expectedEntities: [],
    metrics: null,
    durationMs: Date.now() - startTime,
    timestamp: new Date(),
  };

  if (errorMessage) {
    attempt.error = errorMessage;
  }

  return attempt;
}

/** Fetch page HTML with timeout. */
async function fetchPageHtml(url: string, timeoutMs: number): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; MugiwaraBot/1.0)',
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      logger.warn('Failed to fetch page', { url, status: response.status });
      return null;
    }

    return await response.text();
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      logger.warn('Page fetch timed out', { url, timeoutMs });
    } else {
      logger.error('Error fetching page', error as Error, { url });
    }
    return null;
  }
}

/** Merge entities from parser and bootstrap, preferring parser. */
function mergeEntities(
  parserEntities: LabelingAttempt['extractedEntities'],
  bootstrapEntities: LabelingAttempt['extractedEntities']
): LabelingAttempt['extractedEntities'] {
  const seen = new Map<string, LabelingAttempt['extractedEntities'][0]>();

  // Add parser entities first (higher priority)
  for (const entity of parserEntities) {
    const key = `${entity.type}:${entity.normalizedValue}`;
    seen.set(key, entity);
  }

  // Add bootstrap entities if not already present
  for (const entity of bootstrapEntities) {
    const key = `${entity.type}:${entity.normalizedValue}`;
    if (!seen.has(key)) {
      seen.set(key, entity);
    }
  }

  return Array.from(seen.values());
}

// ============================================================================
// Failure Analysis
// ============================================================================

/** Build failure analysis from attempts. */
function buildFailureAnalysis(attempts: LabelingAttempt[]): FailureAnalysis {
  const failedAttempts = attempts.filter(a => !a.success);
  const { byCategory } = analyzeFailures(attempts);

  const totalFailures = failedAttempts.length;
  const failedPageIds = failedAttempts.map(a => a.page.id);

  // Build category analysis
  const categoryAnalysis: FailureAnalysis['byCategory'] = {} as FailureAnalysis['byCategory'];

  for (const [category, count] of Object.entries(byCategory)) {
    const catAttempts = failedAttempts.filter(a => a.errorCategory === category);
    categoryAnalysis[category as ErrorCategory] = {
      count,
      percentage: totalFailures > 0 ? (count / totalFailures) * 100 : 0,
      examples: catAttempts.slice(0, 3).map(a => ({
        category: a.errorCategory ?? ErrorCategory.UNKNOWN,
        message: a.error ?? 'Unknown error',
      })),
    };
  }

  // Find common patterns
  const commonPatterns = findCommonPatterns(failedAttempts);

  return {
    totalFailures,
    byCategory: categoryAnalysis,
    commonPatterns,
    failedPageIds,
  };
}

/** Find common failure patterns. */
function findCommonPatterns(attempts: LabelingAttempt[]): FailureAnalysis['commonPatterns'] {
  const patterns = new Map<string, { count: number; pageIds: string[] }>();

  for (const attempt of attempts) {
    const pattern = `${attempt.errorCategory}:${attempt.page.source}:${attempt.page.urlType}`;
    const existing = patterns.get(pattern) ?? { count: 0, pageIds: [] };
    existing.count++;
    existing.pageIds.push(attempt.page.id);
    patterns.set(pattern, existing);
  }

  return Array.from(patterns.entries())
    .filter(([_, data]) => data.count >= 2)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 5)
    .map(([pattern, data]) => ({
      pattern,
      count: data.count,
      affectedPages: data.pageIds,
      suggestedFix: getSuggestedFixForPattern(pattern),
    }));
}

/** Get suggested fix for a pattern. */
function getSuggestedFixForPattern(pattern: string): string {
  const [category] = pattern.split(':');

  const suggestions: Record<string, string> = {
    [ErrorCategory.PARSER_SELECTION_FAILED]: 'Review parser selection logic for this page structure',
    [ErrorCategory.STRUCTURE_NOT_RECOGNIZED]: 'Add structure detection patterns for this layout',
    [ErrorCategory.ENTITY_EXTRACTION_FAILED]: 'Improve extraction selectors',
    [ErrorCategory.PATTERN_MISMATCH]: 'Add pattern mappings for this format',
    [ErrorCategory.FETCH_ERROR]: 'Check network access and URL validity',
    [ErrorCategory.GROUND_TRUTH_ERROR]: 'Verify AniList ID mapping',
  };

  return suggestions[category ?? ''] ?? 'Review and address this failure pattern';
}

// ============================================================================
// Suggestions
// ============================================================================

/** Generate improvement suggestions. */
function generateSuggestions(
  failures: FailureAnalysis,
  attempts: LabelingAttempt[]
): ImprovementSuggestion[] {
  const suggestions: ImprovementSuggestion[] = [];
  let suggestionId = 1;

  // Generate suggestions based on failure categories
  for (const [category, analysis] of Object.entries(failures.byCategory)) {
    if (analysis.count === 0) continue;

    const priority = getPriorityForCategory(analysis.percentage);
    const suggestion = createSuggestionForCategory(
      `suggestion-${suggestionId++}`,
      category as ErrorCategory,
      analysis,
      attempts.length
    );

    suggestions.push({ ...suggestion, priority });
  }

  // Sort by estimated impact
  suggestions.sort((a, b) => b.expectedImpact - a.expectedImpact);

  return suggestions.slice(0, 5);
}

/** Get priority based on percentage. */
function getPriorityForCategory(percentage: number): ImprovementSuggestion['priority'] {
  if (percentage >= 40) return 'critical';
  if (percentage >= 25) return 'high';
  if (percentage >= 10) return 'medium';
  return 'low';
}

/** Create suggestion for a failure category. */
function createSuggestionForCategory(
  id: string,
  category: ErrorCategory,
  analysis: { count: number; percentage: number },
  totalAttempts: number
): Omit<ImprovementSuggestion, 'priority'> {
  const categoryConfig: Record<ErrorCategory, { title: string; desc: string; cat: ImprovementSuggestion['category'] }> = {
    [ErrorCategory.PARSER_SELECTION_FAILED]: {
      title: 'Improve Parser Selection',
      desc: 'Review static analyzer recommendations and parser matching logic',
      cat: 'parser',
    },
    [ErrorCategory.STRUCTURE_NOT_RECOGNIZED]: {
      title: 'Add Structure Detection Patterns',
      desc: 'Expand static analyzer to recognize additional page layouts',
      cat: 'structure',
    },
    [ErrorCategory.ENTITY_EXTRACTION_FAILED]: {
      title: 'Fix Entity Extraction',
      desc: 'Review and update extraction selectors for failing pages',
      cat: 'parser',
    },
    [ErrorCategory.PATTERN_MISMATCH]: {
      title: 'Add Pattern Mappings',
      desc: 'Expand pattern detector with new label mappings',
      cat: 'pattern',
    },
    [ErrorCategory.CONFIDENCE_TOO_LOW]: {
      title: 'Adjust Confidence Thresholds',
      desc: 'Review and tune confidence scoring for edge cases',
      cat: 'confidence',
    },
    [ErrorCategory.FETCH_ERROR]: {
      title: 'Improve Network Handling',
      desc: 'Add retry logic and better error handling for network issues',
      cat: 'parser',
    },
    [ErrorCategory.GROUND_TRUTH_ERROR]: {
      title: 'Fix Ground Truth Mapping',
      desc: 'Verify AniList ID mappings in training data',
      cat: 'parser',
    },
    [ErrorCategory.PARSE_ERROR]: {
      title: 'Handle HTML Edge Cases',
      desc: 'Improve HTML parsing for non-standard markup',
      cat: 'parser',
    },
    [ErrorCategory.NO_CONTENT]: {
      title: 'Filter Non-Content Pages',
      desc: 'Add detection for pages without extractable content',
      cat: 'structure',
    },
    [ErrorCategory.TIMEOUT]: {
      title: 'Optimize Processing',
      desc: 'Reduce processing time or increase timeout limits',
      cat: 'threshold',
    },
    [ErrorCategory.UNKNOWN]: {
      title: 'Investigate Unknown Errors',
      desc: 'Review error logs and add specific error handling',
      cat: 'parser',
    },
  };

  const config = categoryConfig[category];
  const impactEstimate = (analysis.count / totalAttempts) * 0.8;

  return {
    id,
    category: config.cat,
    title: config.title,
    description: config.desc,
    expectedImpact: impactEstimate,
    relatedErrors: [category],
    affectedPageCount: analysis.count,
  };
}

// ============================================================================
// Utilities
// ============================================================================

/** Get next iteration number from tracker history. */
function getNextIterationNumber(): number {
  const tracker = getTracker();
  const history = tracker.getIterationHistory();
  return history.length + 1;
}

/** Report progress to callback. */
function reportProgress(
  callback: ProgressCallback | undefined,
  progress: Omit<IterationProgress, 'currentIteration'> & { iteration: number }
): void {
  if (callback) {
    callback({
      currentIteration: progress.iteration,
      maxIterations: progress.maxIterations,
      currentPage: progress.currentPage,
      totalPages: progress.totalPages,
      currentF1: progress.currentF1,
      targetF1: progress.targetF1,
      status: progress.status,
      message: progress.message,
    });
  }
}

// ============================================================================
// Exports
// ============================================================================

export { ENTITY_TYPE_TARGETS };
