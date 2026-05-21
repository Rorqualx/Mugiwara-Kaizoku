/**
 * Improvement Tracker
 *
 * Tracks iteration results over time, identifies regressions, and generates
 * improvement priority lists based on failure patterns.
 *
 * @module auto-labeling/improvement-tracker
 */

import { existsSync, mkdirSync, readFileSync, readdirSync, unlinkSync, writeFileSync } from 'fs';
import { join } from 'path';

import { createLogger } from '@/utils/logger';

import { analyzeFailures } from './error-classifier';

import type { ErrorCategory, IterationResult, LabelingAttempt } from './types';

const logger = createLogger('auto-labeling:improvement-tracker');

// ============================================================================
// Types
// ============================================================================

/** Trend direction for metrics. */
export type TrendDirection = 'improving' | 'declining' | 'stable';

/** Iteration summary for tracking (extends types.ts IterationSummary). */
export interface IterationSummary {
  iterationNumber: number;
  timestamp: Date;
  totalPages: number;
  successCount: number;
  successRate: number;
  avgPrecision: number;
  avgRecall: number;
  avgF1: number;
  topErrors: Array<{ category: ErrorCategory; count: number }>;
  durationMs: number;
}

/** Trend analysis result. */
export interface TrendAnalysis {
  direction: TrendDirection;
  recentF1Scores: number[];
  averageChange: number;
  isRegression: boolean;
  regressionDetails?: string;
}

/** Improvement priority item. */
export interface ImprovementPriority {
  category: ErrorCategory;
  count: number;
  percentOfFailures: number;
  suggestion: string;
  estimatedImpact: 'high' | 'medium' | 'low';
}

/** Progress report. */
export interface ProgressReport {
  totalIterations: number;
  latestIteration: IterationSummary | null;
  trend: TrendAnalysis | null;
  priorities: ImprovementPriority[];
  targetProgress: Record<string, { current: number; target: number; met: boolean }>;
}

/** Tracker configuration. */
export interface TrackerConfig {
  dataDir?: string;
  maxIterationsToKeep?: number;
  regressionThreshold?: number;
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_DATA_DIR = 'data/auto-labeling/iterations';

const DEFAULT_CONFIG: Required<TrackerConfig> = {
  dataDir: DEFAULT_DATA_DIR,
  maxIterationsToKeep: 100,
  regressionThreshold: 0.05,
};

// ============================================================================
// Pure Helper Functions
// ============================================================================

/** Calculate F1 score from counts. */
function calculateF1FromCounts(tp: number, fp: number, fn: number): number {
  const precision = tp + fp > 0 ? tp / (tp + fp) : 0;
  const recall = tp + fn > 0 ? tp / (tp + fn) : 0;
  return precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;
}

/** Determine trend direction from average change. */
function determineTrendDirection(averageChange: number): TrendDirection {
  if (averageChange > 0.01) return 'improving';
  if (averageChange < -0.01) return 'declining';
  return 'stable';
}

/** Estimate impact based on percentage of failures. */
function estimateImpact(percent: number): 'high' | 'medium' | 'low' {
  if (percent >= 30) return 'high';
  if (percent >= 15) return 'medium';
  return 'low';
}

/** Calculate average change in F1 scores. */
function calculateAverageChange(scores: number[]): number {
  if (scores.length <= 1) return 0;

  let totalChange = 0;
  for (let i = 1; i < scores.length; i++) {
    const prev = scores[i - 1];
    const curr = scores[i];
    if (prev !== undefined && curr !== undefined) {
      totalChange += curr - prev;
    }
  }
  return totalChange / (scores.length - 1);
}

/** Check if there's a regression in recent scores. */
function checkForRegression(scores: number[], threshold: number): boolean {
  if (scores.length < 2) return false;

  const lastScore = scores[scores.length - 1];
  const prevScores = scores.slice(0, -1);
  const maxPrevScore = Math.max(...prevScores);

  if (lastScore === undefined) return false;
  return lastScore < maxPrevScore - threshold;
}

/** Build regression details message. */
function buildRegressionDetails(scores: number[]): string {
  const lastScore = scores[scores.length - 1] ?? 0;
  const maxScore = Math.max(...scores.slice(0, -1));
  return `F1 dropped from ${(maxScore * 100).toFixed(1)}% to ${(lastScore * 100).toFixed(1)}%`;
}

/** Read and parse a single iteration file. */
function readIterationFile(filepath: string): IterationSummary | null {
  try {
    const content = readFileSync(filepath, 'utf-8');
    const data = JSON.parse(content) as { summary: IterationSummary };
    return data.summary;
  } catch {
    return null;
  }
}

/** Count errors by category from failed attempts. */
function countErrorsByCategory(
  attempts: LabelingAttempt[]
): Map<ErrorCategory, number> {
  const counts = new Map<ErrorCategory, number>();
  for (const attempt of attempts) {
    if (attempt.errorCategory) {
      counts.set(attempt.errorCategory, (counts.get(attempt.errorCategory) ?? 0) + 1);
    }
  }
  return counts;
}

/** Aggregate entity metrics from attempts. */
function aggregateEntityMetrics(
  attempts: LabelingAttempt[]
): Map<string, { tp: number; fp: number; fn: number }> {
  const metrics = new Map<string, { tp: number; fp: number; fn: number }>();

  for (const attempt of attempts) {
    if (!attempt.metrics) continue;
    for (const [entityType, m] of Object.entries(attempt.metrics.byEntityType)) {
      const existing = metrics.get(entityType) ?? { tp: 0, fp: 0, fn: 0 };
      existing.tp += m.truePositives;
      existing.fp += m.falsePositives;
      existing.fn += m.falseNegatives;
      metrics.set(entityType, existing);
    }
  }

  return metrics;
}

// ============================================================================
// Serialization Functions
// ============================================================================

/** Serialize a single attempt for storage. */
function serializeAttempt(attempt: LabelingAttempt): unknown {
  const metricsData = attempt.metrics
    ? {
        precision: attempt.metrics.precision,
        recall: attempt.metrics.recall,
        f1: attempt.metrics.f1,
        truePositives: attempt.metrics.truePositives,
        falsePositives: attempt.metrics.falsePositives,
        falseNegatives: attempt.metrics.falseNegatives,
      }
    : null;

  return {
    page: attempt.page,
    success: attempt.success,
    errorCategory: attempt.errorCategory,
    error: attempt.error,
    extractedEntities: attempt.extractedEntities.slice(0, 20),
    expectedEntities: attempt.expectedEntities.slice(0, 20),
    metrics: metricsData,
    durationMs: attempt.durationMs,
  };
}

/** Serialize result for storage. */
function serializeResult(result: IterationResult): unknown {
  return {
    iterationNumber: result.iterationNumber,
    timestamp: result.timestamp,
    durationMs: result.durationMs,
    targetMet: result.targetMet,
    metrics: result.metrics,
    failures: result.failures,
    suggestions: result.suggestions,
    attempts: result.attempts.map(serializeAttempt),
  };
}

// ============================================================================
// Report Formatting Functions
// ============================================================================

/** Format latest iteration section. */
function formatLatestIteration(latest: IterationSummary): string[] {
  return [
    '',
    'Latest Iteration:',
    `  Success Rate: ${(latest.successRate * 100).toFixed(1)}%`,
    `  Precision: ${(latest.avgPrecision * 100).toFixed(1)}%`,
    `  Recall: ${(latest.avgRecall * 100).toFixed(1)}%`,
    `  F1 Score: ${(latest.avgF1 * 100).toFixed(1)}%`,
  ];
}

/** Format trend section. */
function formatTrend(trend: TrendAnalysis): string[] {
  const lines = [
    '',
    'Trend Analysis:',
    `  Direction: ${trend.direction}`,
    `  Avg Change: ${(trend.averageChange * 100).toFixed(2)}% per iteration`,
  ];

  if (trend.isRegression) {
    lines.push(`  ⚠️ REGRESSION: ${trend.regressionDetails}`);
  }

  return lines;
}

/** Format target progress section. */
function formatTargetProgress(
  targetProgress: Record<string, { current: number; target: number; met: boolean }>
): string[] {
  const lines = ['', 'Target Progress:'];

  for (const [entityType, progress] of Object.entries(targetProgress)) {
    const status = progress.met ? '✓' : '○';
    const current = (progress.current * 100).toFixed(1);
    const target = (progress.target * 100).toFixed(1);
    lines.push(`  ${status} ${entityType}: ${current}% / ${target}%`);
  }

  return lines;
}

/** Format priorities section. */
function formatPriorities(priorities: ImprovementPriority[]): string[] {
  const lines = ['', 'Improvement Priorities:'];

  for (const priority of priorities.slice(0, 5)) {
    const impact = priority.estimatedImpact.toUpperCase();
    lines.push(`  [${impact}] ${priority.category}: ${priority.count} errors (${priority.percentOfFailures.toFixed(1)}%)`);
    lines.push(`         ${priority.suggestion}`);
  }

  return lines;
}

// ============================================================================
// Tracker Class
// ============================================================================

/** Improvement tracker for managing iteration history. */
export class ImprovementTracker {
  private readonly config: Required<TrackerConfig>;
  private readonly dataDir: string;

  constructor(config?: TrackerConfig) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.dataDir = this.config.dataDir;
    this.ensureDataDir();
  }

  private ensureDataDir(): void {
    if (!existsSync(this.dataDir)) {
      mkdirSync(this.dataDir, { recursive: true });
    }
  }

  /** Log an iteration result. */
  logIteration(result: IterationResult): IterationSummary {
    const summary = this.createSummary(result);
    this.saveIteration(result, summary);
    this.cleanupOldIterations();
    return summary;
  }

  private createSummary(result: IterationResult): IterationSummary {
    const totalPages = result.attempts.length;
    const successCount = result.attempts.filter(a => a.success).length;
    const successRate = totalPages > 0 ? successCount / totalPages : 0;
    const failedAttempts = result.attempts.filter(a => !a.success);
    const errorCounts = countErrorsByCategory(failedAttempts);

    const topErrors = Array.from(errorCounts.entries())
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return {
      iterationNumber: result.iterationNumber,
      timestamp: result.timestamp,
      totalPages,
      successCount,
      successRate,
      avgPrecision: result.metrics.avgPrecision,
      avgRecall: result.metrics.avgRecall,
      avgF1: result.metrics.avgF1,
      topErrors,
      durationMs: result.durationMs,
    };
  }

  private saveIteration(result: IterationResult, summary: IterationSummary): void {
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `iteration-${ts}.json`;
    const filepath = join(this.dataDir, filename);

    const data = { summary, result: serializeResult(result) };

    try {
      writeFileSync(filepath, JSON.stringify(data, null, 2));
      logger.info('Saved iteration result', { iterationNumber: result.iterationNumber, filepath });
    } catch (error) {
      logger.error('Failed to save iteration result', error as Error);
    }
  }

  private cleanupOldIterations(): void {
    const files = this.getIterationFiles();
    if (files.length <= this.config.maxIterationsToKeep) return;

    const toDelete = files.slice(this.config.maxIterationsToKeep);
    for (const file of toDelete) {
      this.deleteFile(join(this.dataDir, file));
    }
  }

  private getIterationFiles(): string[] {
    try {
      return readdirSync(this.dataDir)
        .filter(f => f.startsWith('iteration-') && f.endsWith('.json'))
        .sort()
        .reverse();
    } catch {
      return [];
    }
  }

  private deleteFile(filepath: string): void {
    try {
      unlinkSync(filepath);
    } catch {
      // Ignore deletion errors
    }
  }

  /** Get all iteration summaries. */
  getIterationHistory(): IterationSummary[] {
    const files = this.getIterationFiles().reverse();
    const summaries: IterationSummary[] = [];

    for (const file of files) {
      const summary = readIterationFile(join(this.dataDir, file));
      if (summary) summaries.push(summary);
    }

    return summaries;
  }

  /** Analyze trends in iteration history. */
  analyzeTrend(windowSize: number = 5): TrendAnalysis | null {
    const history = this.getIterationHistory();
    if (history.length < 2) return null;

    const recentF1Scores = history.slice(-windowSize).map(i => i.avgF1);
    const averageChange = calculateAverageChange(recentF1Scores);
    const direction = determineTrendDirection(averageChange);
    const isRegression = checkForRegression(recentF1Scores, this.config.regressionThreshold);

    const result: TrendAnalysis = { direction, recentF1Scores, averageChange, isRegression };
    if (isRegression) {
      result.regressionDetails = buildRegressionDetails(recentF1Scores);
    }
    return result;
  }

  /** Generate improvement priorities. */
  generatePriorities(attempts: LabelingAttempt[]): ImprovementPriority[] {
    const { byCategory, suggestions } = analyzeFailures(attempts);
    const totalFailures = Object.values(byCategory).reduce((sum, count) => sum + count, 0);

    if (totalFailures === 0) return [];

    return Object.entries(byCategory)
      .filter(([_, count]) => count > 0)
      .sort(([, a], [, b]) => b - a)
      .map(([category, count]) => {
        const percentOfFailures = (count / totalFailures) * 100;
        const suggestion = suggestions.find(s => s.includes(category)) ?? `Address ${category} errors`;
        return {
          category: category as ErrorCategory,
          count,
          percentOfFailures,
          suggestion,
          estimatedImpact: estimateImpact(percentOfFailures),
        };
      });
  }

  /** Generate a progress report. */
  generateReport(
    currentAttempts: LabelingAttempt[],
    targets: Record<string, number>
  ): ProgressReport {
    const history = this.getIterationHistory();
    const latestIteration = history[history.length - 1] ?? null;

    return {
      totalIterations: history.length,
      latestIteration,
      trend: this.analyzeTrend(),
      priorities: this.generatePriorities(currentAttempts),
      targetProgress: this.calculateTargetProgress(currentAttempts, targets),
    };
  }

  private calculateTargetProgress(
    attempts: LabelingAttempt[],
    targets: Record<string, number>
  ): Record<string, { current: number; target: number; met: boolean }> {
    const entityMetrics = aggregateEntityMetrics(attempts);
    const progress: Record<string, { current: number; target: number; met: boolean }> = {};

    for (const [entityType, target] of Object.entries(targets)) {
      const m = entityMetrics.get(entityType);
      const current = m ? calculateF1FromCounts(m.tp, m.fp, m.fn) : 0;
      progress[entityType] = { current, target, met: current >= target };
    }

    return progress;
  }

  /** Format progress report for display. */
  formatReport(report: ProgressReport): string {
    const lines = ['='.repeat(60), 'Auto-Labeling Progress Report', '='.repeat(60), ''];
    lines.push(`Total Iterations: ${report.totalIterations}`);

    if (report.latestIteration) lines.push(...formatLatestIteration(report.latestIteration));
    if (report.trend) lines.push(...formatTrend(report.trend));
    if (Object.keys(report.targetProgress).length > 0) {
      lines.push(...formatTargetProgress(report.targetProgress));
    }
    if (report.priorities.length > 0) lines.push(...formatPriorities(report.priorities));

    lines.push('', '='.repeat(60));
    return lines.join('\n');
  }
}

// ============================================================================
// Singleton
// ============================================================================

let trackerInstance: ImprovementTracker | null = null;

/** Get or create the tracker instance. */
export function getTracker(config?: TrackerConfig): ImprovementTracker {
  trackerInstance ??= new ImprovementTracker(config);
  return trackerInstance;
}

/** Reset the tracker instance (for testing). */
export function resetTracker(): void {
  trackerInstance = null;
}
