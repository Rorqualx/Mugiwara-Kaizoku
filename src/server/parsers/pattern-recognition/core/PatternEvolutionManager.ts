/**
 * Pattern Evolution Manager - Main Orchestrator
 *
 * Manages automatic pattern evolution based on performance metrics.
 * Merges similar patterns, splits complex patterns, and optimizes
 * pattern definitions for better accuracy and performance.
 *
 * Architecture:
 * - pattern-evolution/utils.ts - Utilities (3 functions)
 * - pattern-evolution/merging.ts - Merging operations (4 functions)
 * - pattern-evolution/splitting.ts - Splitting operations (4 functions)
 * - pattern-evolution/optimization.ts - Optimization operations (4 functions)
 * - pattern-evolution/management.ts - Management operations (3 functions)
 * - pattern-evolution/tracking.ts - Evolution tracking (1 class + 1 function)
 *
 * Total: 6 modules, largest 284 lines (under 500 limit)
 * Original: 759 lines → Refactored: ~150 lines main + ~800 lines modules
 *
 * FIXED: Eliminated all no-await-in-loop violations using Promise.all()
 */

import { FeatureEngineering } from './FeatureEngineering';
import { MLPipeline } from './MLPipeline';
// Import all extracted modules
import {
  prunePatterns,
  versionPatterns,
  groupPatternsByType
} from './pattern-evolution/management';
import { mergeSimilarPatterns } from './pattern-evolution/merging';
import { optimizePatterns } from './pattern-evolution/optimization';
import { splitComplexPatterns } from './pattern-evolution/splitting';
import {
  EvolutionTracker} from './pattern-evolution/tracking';

import type {
  Pattern,
  PatternEvolution,
  EvolutionReason
} from '../types';

export class PatternEvolutionManager {
  private featureEngineering: FeatureEngineering;
  private mlPipeline: MLPipeline;
  private evolutionTracker: EvolutionTracker;

  // Configuration
  private performanceThreshold = 0.8;
  private mergeThreshold = 0.9;
  private splitThreshold = 0.5;
  private minSampleSize = 10;

  constructor() {
    this.featureEngineering = new FeatureEngineering();
    this.mlPipeline = new MLPipeline();
    this.evolutionTracker = new EvolutionTracker();
  }

  /**
   * Evolve patterns based on performance metrics
   * FIXED: Use Promise.all() to process pattern types in parallel (no-await-in-loop)
   * @param patterns - Patterns to evolve
   * @returns Evolved patterns
   */
  async evolvePatterns(patterns: Pattern[]): Promise<Pattern[]> {
    const patternsByType = groupPatternsByType(patterns);

    // Process all types in parallel (FIXED: was sequential with await in loop)
    const evolvedByType = await Promise.all(
      Array.from(patternsByType.entries()).map(async ([_type, typePatterns]) => {
        // Sequential pipeline for each type (dependencies: merge → split → optimize)
        const mergedPatterns = await mergeSimilarPatterns(
          typePatterns,
          { mergeThreshold: this.mergeThreshold, minSampleSize: this.minSampleSize },
          this.featureEngineering,
          (original, evolved, reason) =>
            this.evolutionTracker.recordEvolution(original, evolved, reason as EvolutionReason)
        );

        const splitPatterns = await splitComplexPatterns(
          mergedPatterns,
          { splitThreshold: this.splitThreshold, minSampleSize: this.minSampleSize },
          (original, evolved, reason) =>
            this.evolutionTracker.recordEvolution(original, evolved, reason as EvolutionReason)
        );

        const optimizedPatterns = await optimizePatterns(
          splitPatterns,
          this.featureEngineering,
          (original, evolved, reason) =>
            this.evolutionTracker.recordEvolution(original, evolved, reason as EvolutionReason)
        );

        return optimizedPatterns;
      })
    );

    // Flatten results from all types
    const flatEvolved = evolvedByType.flat();

    // Prune underperforming patterns
    const prunedPatterns = prunePatterns(
      flatEvolved,
      { performanceThreshold: this.performanceThreshold, minSampleSize: this.minSampleSize }
    );

    // Version and track evolution
    const versionedPatterns = versionPatterns(
      prunedPatterns,
      patterns,
      this.featureEngineering
    );

    return versionedPatterns;
  }

  /**
   * Get evolution history for a pattern
   * @param patternId - Pattern ID
   * @returns Evolution history
   */
  getEvolutionHistory(patternId: string): PatternEvolution[] {
    return this.evolutionTracker.getEvolutionHistory(patternId);
  }

  /**
   * Analyze evolution trends
   * @returns Trend analysis
   */
  analyzeEvolutionTrends(): {
    totalEvolutions: number;
    byReason: Record<EvolutionReason, number>;
    averageAccuracyImprovement: number;
    mostEvolved: string[];
  } {
    return this.evolutionTracker.analyzeEvolutionTrends();
  }
}
