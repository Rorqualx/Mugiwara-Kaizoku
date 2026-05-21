/**
 * Pattern Merging Operations
 *
 * Handles merging of similar patterns to reduce redundancy.
 * Combines patterns based on similarity thresholds and weighted metrics.
 *
 * Extracted from: PatternEvolutionManager.ts (lines 64-305)
 */

import type {
  Pattern,
  PatternFeatures
} from '@/server/parsers/pattern-recognition/types';

import { weightedAverage, combineSelectors } from './utils';

import type { FeatureEngineering } from '../FeatureEngineering';

/**
 * Configuration for pattern merging operations
 */
export interface MergeConfig {
  mergeThreshold: number;
  minSampleSize: number;
}

/**
 * Merge similar patterns to reduce redundancy
 * @param patterns - Patterns to analyze for merging
 * @param config - Merge configuration
 * @param featureEngineering - Feature engineering instance
 * @param recordEvolution - Callback to record evolution history
 * @returns Merged patterns
 */
export function mergeSimilarPatterns(
  patterns: Pattern[],
  config: MergeConfig,
  featureEngineering: FeatureEngineering,
  recordEvolution: (original: Pattern[], evolved: Pattern, reason: string) => void
): Promise<Pattern[]> {
  if (patterns.length < 2) return Promise.resolve(patterns);

  const merged: Pattern[] = [];
  const processed = new Set<string>();

  for (let i = 0; i < patterns.length; i++) {
    const pattern = patterns[i];
    if (!pattern) continue;
    if (processed.has(pattern.id)) continue;

    const similarGroup: Pattern[] = [pattern];
    processed.add(pattern.id);

    // Find similar patterns
    for (let j = i + 1; j < patterns.length; j++) {
      const otherPattern = patterns[j];
      if (!otherPattern) continue;
      if (processed.has(otherPattern.id)) continue;

      const similarity = featureEngineering.calculateSimilarity(
        pattern.features,
        otherPattern.features
      );

      if (similarity >= config.mergeThreshold) {
        similarGroup.push(otherPattern);
        processed.add(otherPattern.id);
      }
    }

    // Merge if group size > 1
    if (similarGroup.length > 1) {
      const mergedPattern = mergePatternGroup(similarGroup);
      recordEvolution(similarGroup, mergedPattern, 'merge');
      merged.push(mergedPattern);
    } else {
      merged.push(pattern);
    }
  }

  return Promise.resolve(merged);
}

/**
 * Merge a group of similar patterns into single optimized pattern
 * @param patterns - Group of similar patterns to merge
 * @returns Single merged pattern
 */
export function mergePatternGroup(patterns: Pattern[]): Pattern {
  // Calculate weighted averages based on performance
  const totalWeight = patterns.reduce((sum, p) => sum + p.accuracy * p.usageCount, 0);

  // Merge features
  const mergedFeatures = mergeFeatures(
    patterns.map(p => ({ features: p.features, weight: p.accuracy * p.usageCount }))
  );

  // Combine selectors
  const selectors = patterns.map(p => p.selector);
  const mergedSelector = combineSelectors(selectors);

  // Calculate merged performance metrics
  const avgAccuracy = patterns.reduce((sum, p) =>
    sum + p.accuracy * p.usageCount, 0) / totalWeight;
  const avgSuccessRate = patterns.reduce((sum, p) =>
    sum + p.successRate * p.usageCount, 0) / totalWeight;
  const totalUsageCount = patterns.reduce((sum, p) => sum + p.usageCount, 0);

  const firstPattern = patterns[0];
  if (!firstPattern) {
    throw new Error('Cannot merge empty pattern group');
  }

  return {
    id: `merged_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    name: `Merged: ${firstPattern.name}`,
    type: firstPattern.type,
    features: mergedFeatures,
    selector: mergedSelector,
    confidence: avgAccuracy,
    accuracy: avgAccuracy,
    usageCount: totalUsageCount,
    successRate: avgSuccessRate,
    lastUsed: new Date(),
    created: new Date(),
    version: Math.max(...patterns.map(p => p.version)) + 1,
    source: 'evolved',
    metadata: {
      mergedFrom: patterns.map(p => p.id),
      mergeReason: 'high_similarity',
      originalCount: patterns.length
    }
  };
}

/**
 * Merge feature sets with weights
 * @param weightedFeatures - Array of features with associated weights
 * @returns Merged feature set
 */
export function mergeFeatures(
  weightedFeatures: Array<{ features: PatternFeatures; weight: number }>
): PatternFeatures {
  const totalWeight = weightedFeatures.reduce((sum, wf) => sum + wf.weight, 0);

  // Initialize merged features with empty structures
  const merged: PatternFeatures = {
    structural: {
      tagCounts: {},
      maxDepth: 0,
      averageDepth: 0,
      elementCount: 0,
      domDepth: 0,
      siblingCount: 0,
      classList: [],
      tagName: '',
      attributes: {}
    },
    semantic: {
      keywordDensity: {},
      topicDistribution: {},
      sentimentScore: 0,
      readabilityScore: 0,
      textLength: 0,
      hasNumbers: false,
      embeddings: []
    },
    statistical: {
      wordCount: 0,
      avgWordLength: 0,
      sentenceCount: 0,
      avgSentenceLength: 0,
      paragraphCount: 0,
      entropy: 0,
      patternScore: 0
    },
    visual: {
      isVisible: true,
      isAboveFold: false,
      fontSize: 0,
      boundingBox: { x: 0, y: 0, width: 0, height: 0 }
    },
    contextual: {
      nearbyText: []
    }
  };

  // Merge structural features
  const mergedDomDepth = weightedAverage(
    weightedFeatures.map(wf => ({
      value: wf.features.structural.domDepth ?? 0,
      weight: wf.weight
    }))
  );
  merged.structural = {
    ...merged.structural,
    domDepth: mergedDomDepth
  };

  const mergedSiblingCount = weightedAverage(
    weightedFeatures.map(wf => ({
      value: wf.features.structural.siblingCount ?? 0,
      weight: wf.weight
    }))
  );
  merged.structural = {
    ...merged.structural,
    siblingCount: mergedSiblingCount
  };

  // Merge class lists
  const allClasses = new Map<string, number>();
  for (const wf of weightedFeatures) {
    for (const className of (wf.features.structural.classList ?? [])) {
      allClasses.set(className, (allClasses.get(className) ?? 0) + wf.weight);
    }
  }
  const mergedClassList = Array.from(allClasses.entries())
    .filter(([_, weight]) => weight / totalWeight > 0.5)
    .map(([className]) => className);
  if (mergedClassList.length > 0) {
    merged.structural = {
      ...merged.structural,
      ...(mergedClassList.length > 0 ? { classList: mergedClassList } : {})
    };
  }

  // Merge semantic features
  const mergedTextLength = weightedAverage(
    weightedFeatures.map(wf => ({
      value: wf.features.semantic.textLength ?? 0,
      weight: wf.weight
    }))
  );
  merged.semantic = {
    ...merged.semantic,
    textLength: mergedTextLength
  };

  const hasNumbersWeight = weightedFeatures
    .filter(wf => wf.features.semantic.hasNumbers)
    .reduce((sum, wf) => sum + wf.weight, 0) / totalWeight;
  if (hasNumbersWeight > 0.5) {
    merged.semantic = {
      ...merged.semantic,
      hasNumbers: true
    };
  }

  // Merge statistical features
  const mergedEntropy = weightedAverage(
    weightedFeatures.map(wf => ({
      value: wf.features.statistical.entropy ?? 0,
      weight: wf.weight
    }))
  );
  merged.statistical = {
    ...merged.statistical,
    entropy: mergedEntropy
  };

  const mergedPatternScore = weightedAverage(
    weightedFeatures.map(wf => ({
      value: wf.features.statistical.patternScore ?? 0,
      weight: wf.weight
    }))
  );
  merged.statistical = {
    ...merged.statistical,
    patternScore: mergedPatternScore
  };

  // Copy remaining features from highest weighted pattern
  const bestPattern = weightedFeatures.reduce((best, current) =>
    current.weight > best.weight ? current : best
  );

  Object.assign(merged.structural, bestPattern.features.structural);
  Object.assign(merged.semantic, bestPattern.features.semantic);
  Object.assign(merged.statistical, bestPattern.features.statistical);
  Object.assign(merged.visual, bestPattern.features.visual);
  Object.assign(merged.contextual, bestPattern.features.contextual);

  return merged;
}
