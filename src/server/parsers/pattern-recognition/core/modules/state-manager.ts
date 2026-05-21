/**
 * State Manager Module
 *
 * Manages state export/import and system metrics for the Pattern Recognition Engine.
 * Handles serialization of patterns, learning data, and configuration with proper
 * type guards and validation.
 *
 * Extracted from: PatternRecognitionEngine.ts (lines 656-742)
 * Date: 2025-11-20
 */

import type {
  Pattern,
  PatternType,
  SystemMetrics,
  EngineConfig,
} from '@/server/parsers/pattern-recognition/types';
import { getUnknownProperty } from '@/utils/type-guards/safe-access';

import { isRecord, isValidPatternType } from './utils';



// ============================================================================
// Interfaces
// ============================================================================

/**
 * Dependencies required by StateManager
 */
interface StateManagerDependencies {
  /** Map of pattern ID to Pattern */
  patterns: Map<string, Pattern>;
  /** Map of pattern type to patterns of that type */
  patternsByType: Map<PatternType, Pattern[]>;
  /** Cache statistics provider */
  cache: {
    getStatistics(): Record<string, unknown>;
  };
  /** Performance monitor */
  monitor: {
    getStatistics(): {
      averageInferenceTime: number;
    };
  };
  /** Current engine configuration */
  config: EngineConfig;
  /** Cache hit counter */
  cacheHits: number;
  /** Cache miss counter */
  cacheMisses: number;
}

// ============================================================================
// State Manager Class
// ============================================================================

/**
 * Manages state export/import and metrics collection for the Pattern Recognition Engine
 */
export class StateManager {
  private patterns: Map<string, Pattern>;
  private patternsByType: Map<PatternType, Pattern[]>;
  private cache: StateManagerDependencies['cache'];
  private monitor: StateManagerDependencies['monitor'];
  private config: EngineConfig;
  private cacheHits: number;
  private cacheMisses: number;

  /**
   * Create a new StateManager
   * @param deps - Dependencies required for state management
   */
  constructor(deps: StateManagerDependencies) {
    this.patterns = deps.patterns;
    this.patternsByType = deps.patternsByType;
    this.cache = deps.cache;
    this.monitor = deps.monitor;
    this.config = deps.config;
    this.cacheHits = deps.cacheHits;
    this.cacheMisses = deps.cacheMisses;
  }

  /**
   * Get current system metrics
   * @returns SystemMetrics containing pattern, model, performance, and learning statistics
   */
  getMetrics(): SystemMetrics {
    // ML components disabled - using default statistics
    const learningStats = { totalExamples: 0 };
    const learningMetrics = { accuracy: 0 };
    // const learningStats = this.activeLearning.getStatistics();
    // const learningMetrics = this.activeLearning.getMetrics();
    const _cacheStats = this.cache.getStatistics();
    const performanceStats = this.monitor.getStatistics();

    return {
      patterns: {
        total: this.patterns.size,
        active: Array.from(this.patterns.values()).filter(
          (p) => p.usageCount > 0
        ).length,
        learned: Array.from(this.patterns.values()).filter(
          (p) => p.source === 'learned'
        ).length,
        evolved: Array.from(this.patterns.values()).filter(
          (p) => p.source === 'evolved'
        ).length,
      },
      models: {
        total: 4, // classifier, similarity, anomaly, ensemble
        accuracy: learningMetrics.accuracy,
        lastUpdated: new Date(),
      },
      performance: {
        averageInferenceTime: performanceStats.averageInferenceTime,
        cacheHitRate: this.cacheHits / (this.cacheHits + this.cacheMisses),
        memoryUsage: process.memoryUsage().heapUsed / 1024 / 1024, // MB
      },
      learning: {
        totalExamples: learningStats.totalExamples,
        accuracy: learningMetrics.accuracy,
        lastLearned: new Date(),
      },
    };
  }

  /**
   * Export engine state for persistence
   * @returns Promise resolving to state object containing patterns, learning data, metrics, and config
   */
  exportState(): Promise<unknown> {
    return Promise.resolve({
      patterns: Array.from(this.patterns.values()),
      learningData: {}, // ML components disabled
      // learningData: this.activeLearning.exportLearningData(),
      metrics: this.getMetrics(),
      config: this.config,
    });
  }

  /**
   * Helper method to process a single pattern during import
   * Reduces nesting depth in importState
   */
  private processPatternImport(pattern: unknown): void {
    if (!isRecord(pattern)) return;

    const id = getUnknownProperty(pattern, 'id');
    if (typeof id !== 'string') return;

    // Cast pattern to Pattern type after validation
    const patternObj = pattern as unknown as Pattern;
    this.patterns.set(id, patternObj);

    const type = getUnknownProperty(pattern, 'type');
    if (typeof type !== 'string' || !isValidPatternType(type)) return;

    // Ensure pattern list exists for this type
    if (!this.patternsByType.has(type as PatternType)) {
      this.patternsByType.set(type as PatternType, []);
    }

    const patternList = this.patternsByType.get(type as PatternType);
    if (patternList) {
      patternList.push(patternObj);
    }
  }

  /**
   * Import engine state from persisted data
   * Validates and restores patterns, learning data, and configuration
   * @param state - Unknown state object to import
   * @returns Promise that resolves when import is complete
   */
  importState(state: unknown): Promise<void> {
    if (!isRecord(state)) return Promise.resolve();

    // Import patterns
    const patterns = getUnknownProperty(state, 'patterns');
    if (Array.isArray(patterns)) {
      this.patterns.clear();
      this.patternsByType.clear();

      for (const pattern of patterns) {
        this.processPatternImport(pattern);
      }
    }

    // Import learning data
    if (getUnknownProperty(state, 'learningData')) {
      // ML components disabled - learning data import skipped
      // this.activeLearning.importLearningData(state.learningData);
    }

    // Update config if provided
    const config = getUnknownProperty(state, 'config');
    if (isRecord(config)) {
      this.config = { ...this.config, ...config };
    }

    return Promise.resolve();
  }
}
