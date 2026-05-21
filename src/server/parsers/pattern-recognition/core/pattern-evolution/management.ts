/**
 * Pattern Management Operations
 *
 * Handles pattern lifecycle management including pruning underperformers,
 * versioning changes, and grouping by type.
 *
 * Extracted from: PatternEvolutionManager.ts (lines 584-660)
 */

import type { Pattern } from '@/server/parsers/pattern-recognition/types';

import type { FeatureEngineering } from '../FeatureEngineering';


export interface ManagementConfig {
  performanceThreshold: number;
  minSampleSize: number;
}

/**
 * Prune underperforming patterns
 * @param patterns - Patterns to prune
 * @param config - Management configuration
 * @returns Filtered patterns
 */
export function prunePatterns(
  patterns: Pattern[],
  config: ManagementConfig
): Pattern[] {
  return patterns.filter(pattern => {
    // Keep if high accuracy
    if (pattern.accuracy >= config.performanceThreshold) {
      return true;
    }

    // Keep if recently created (give time to learn)
    const age = Date.now() - pattern.created.getTime();
    const daysOld = age / (1000 * 60 * 60 * 24);
    if (daysOld < 7) {
      return true;
    }

    // Keep if low usage (not enough data)
    if (pattern.usageCount < config.minSampleSize) {
      return true;
    }

    // Prune if consistently underperforming
    return false;
  });
}

/**
 * Version patterns and track changes
 * @param evolved - Evolved patterns
 * @param original - Original patterns
 * @param featureEngineering - Feature engineering instance
 * @returns Versioned patterns
 */
export function versionPatterns(
  evolved: Pattern[],
  original: Pattern[],
  featureEngineering: FeatureEngineering
): Pattern[] {
  const originalMap = new Map(original.map(p => [p.id, p]));

  return evolved.map(pattern => {
    const originalPattern = originalMap.get(pattern.id);

    if (originalPattern) {
      // Check if changed
      const similarity = featureEngineering.calculateSimilarity(
        originalPattern.features,
        pattern.features
      );

      if (similarity < 0.99) {
        // Increment version and update metadata
        return {
          ...pattern,
          version: originalPattern.version + 1,
          metadata: {
            ...pattern.metadata,
            previousVersion: originalPattern.version,
            changeReason: 'evolution'
          }
        };
      }
    }

    return pattern;
  });
}

/**
 * Group patterns by type for analysis
 * @param patterns - Patterns to group
 * @returns Map of type to patterns
 */
export function groupPatternsByType(patterns: Pattern[]): Map<string, Pattern[]> {
  const groups = new Map<string, Pattern[]>();

  for (const pattern of patterns) {
    const type = pattern.type;
    if (!groups.has(type)) {
      groups.set(type, []);
    }
    const typePatterns = groups.get(type);
    if (typePatterns) {
      typePatterns.push(pattern);
    }
  }

  return groups;
}
