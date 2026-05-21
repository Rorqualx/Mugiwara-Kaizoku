/**
 * Evolution Tracking Operations
 *
 * Tracks pattern evolution history and analyzes trends.
 * Maintains historical records of merges, splits, and optimizations.
 *
 * Extracted from: PatternEvolutionManager.ts (lines 665-758)
 */

import type {
  Pattern,
  PatternEvolution,
  EvolutionReason,
  EvolutionMetrics
} from '@/server/parsers/pattern-recognition/types';

/**
 * Evolution tracker class to manage history
 */
export class EvolutionTracker {
  private evolutionHistory: Map<string, PatternEvolution[]> = new Map();

  /**
   * Record evolution event in history
   * @param originalPatterns - Original patterns before evolution
   * @param evolvedPattern - Evolved pattern result
   * @param reason - Reason for evolution
   */
  recordEvolution(
    originalPatterns: Pattern[],
    evolvedPattern: Pattern,
    reason: EvolutionReason
  ): void {
    const firstOriginalPattern = originalPatterns[0];
    if (!firstOriginalPattern) return;

    const evolution: PatternEvolution = {
      id: `evo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      originalPattern: firstOriginalPattern, // Primary pattern
      evolvedPattern,
      reason,
      metrics: calculateEvolutionMetrics(originalPatterns, evolvedPattern),
      timestamp: new Date()
    };

    // Store in history
    const patternId = evolvedPattern.id;
    if (!this.evolutionHistory.has(patternId)) {
      this.evolutionHistory.set(patternId, []);
    }
    const historyEntry = this.evolutionHistory.get(patternId);
    if (historyEntry) {
      historyEntry.push(evolution);
    }
  }

  /**
   * Get evolution history for a specific pattern
   * @param patternId - Pattern ID to lookup
   * @returns Array of evolution events
   */
  getEvolutionHistory(patternId: string): PatternEvolution[] {
    return this.evolutionHistory.get(patternId) ?? [];
  }

  /**
   * Analyze evolution trends across all patterns
   * @returns Aggregated trend statistics
   */
  analyzeEvolutionTrends(): {
    totalEvolutions: number;
    byReason: Record<EvolutionReason, number>;
    averageAccuracyImprovement: number;
    mostEvolved: string[];
  } {
    let totalEvolutions = 0;
    const byReason: Record<string, number> = {};
    let totalAccuracyImprovement = 0;
    const evolutionCounts = new Map<string, number>();

    for (const [patternId, evolutions] of this.evolutionHistory) {
      totalEvolutions += evolutions.length;
      evolutionCounts.set(patternId, evolutions.length);

      for (const evolution of evolutions) {
        byReason[evolution.reason] = (byReason[evolution.reason] ?? 0) + 1;
        totalAccuracyImprovement += evolution.metrics.accuracyImprovement;
      }
    }

    // Find most evolved patterns
    const sorted = Array.from(evolutionCounts.entries())
      .sort((a, b) => b[1] - a[1]);
    const mostEvolved = sorted.slice(0, 5).map(([id]) => id);

    return {
      totalEvolutions,
      byReason: byReason as Record<EvolutionReason, number>,
      averageAccuracyImprovement: totalEvolutions > 0 ?
        totalAccuracyImprovement / totalEvolutions : 0,
      mostEvolved
    };
  }
}

/**
 * Calculate metrics for an evolution event
 * @param originalPatterns - Original patterns
 * @param evolvedPattern - Evolved pattern
 * @returns Calculated metrics
 */
export function calculateEvolutionMetrics(
  originalPatterns: Pattern[],
  evolvedPattern: Pattern
): EvolutionMetrics {
  const avgOriginalAccuracy = originalPatterns.reduce((sum, p) =>
    sum + p.accuracy, 0) / originalPatterns.length;

  const totalOriginalUsage = originalPatterns.reduce((sum, p) =>
    sum + p.usageCount, 0);

  return {
    accuracyImprovement: evolvedPattern.accuracy - avgOriginalAccuracy,
    performanceImprovement: 0, // To be calculated based on actual performance
    coverageIncrease: evolvedPattern.usageCount / totalOriginalUsage - 1,
    complexityReduction: originalPatterns.length > 1 ?
      (originalPatterns.length - 1) / originalPatterns.length : 0
  };
}
