/**
 * Pattern Optimization Operations
 *
 * Optimizes pattern definitions for better performance and accuracy.
 * Simplifies selectors, reduces feature dimensionality, and removes redundancy.
 *
 * Extracted from: PatternEvolutionManager.ts (lines 469-579)
 * FIXED: Made synchronous (no actual async operations)
 *
 * @module pattern-evolution/optimization
 */

import type {
  Pattern,
  PatternFeatures
} from '@/server/parsers/pattern-recognition/types';

import type { FeatureEngineering } from '../FeatureEngineering';

/**
 * Optimize patterns for better performance
 *
 * @param patterns - Patterns to optimize
 * @param featureEngineering - Feature engineering instance
 * @param recordEvolution - Callback for evolution tracking
 * @returns Optimized patterns (synchronous)
 */
export function optimizePatterns(
  patterns: Pattern[],
  featureEngineering: FeatureEngineering,
  recordEvolution: (original: Pattern[], evolved: Pattern, reason: string) => void
): Pattern[] {
  const optimized: Pattern[] = [];

  for (const pattern of patterns) {
    // Skip if recently optimized
    const lastOptimizedValue = pattern.metadata['lastOptimized'];
    if (lastOptimizedValue && (typeof lastOptimizedValue === 'string' || typeof lastOptimizedValue === 'number' || lastOptimizedValue instanceof Date)) {
      const lastOptimized = new Date(lastOptimizedValue);
      const daysSinceOptimization = (Date.now() - lastOptimized.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceOptimization < 7) {
        optimized.push(pattern);
        continue;
      }
    }

    // Optimize selector
    const optimizedSelector = optimizeSelector(pattern.selector);

    // Optimize features
    const optimizedFeatures = optimizeFeatures(pattern.features);

    const optimizedPattern: Pattern = {
      ...pattern,
      selector: optimizedSelector,
      features: optimizedFeatures,
      version: pattern.version + 0.1,
      metadata: {
        ...pattern.metadata,
        lastOptimized: new Date().toISOString(),
        optimizationReason: 'performance'
      }
    };

    if (hasSignificantChanges(pattern, optimizedPattern, featureEngineering)) {
      recordEvolution([pattern], optimizedPattern, 'optimization');
    }

    optimized.push(optimizedPattern);
  }

  return optimized; // Direct return, no Promise
}

/**
 * Optimize CSS selector for better performance
 *
 * Removes redundant whitespace, simplifies overly specific selectors,
 * and limits depth to improve matching performance.
 *
 * @param selector - CSS selector to optimize
 * @returns Optimized selector
 */
export function optimizeSelector(selector: string): string {
  // Remove redundant parts
  const optimized = selector
    .replace(/\s+/g, ' ')
    .replace(/\s*>\s*/g, ' > ')
    .replace(/\s*,\s*/g, ', ');

  // Simplify overly specific selectors
  const parts = optimized.split(',');
  const simplified = parts.map(part => {
    // Remove unnecessary descendant combinators
    const cleanedPart = part.replace(/(\S)\s+(\S)/g, '$1 $2');

    // Limit depth
    const elements = cleanedPart.split(' ');
    if (elements.length > 4) {
      // Keep first and last two elements
      return `${elements[0]} ${elements[1]} ... ${elements[elements.length - 2]} ${elements[elements.length - 1]}`;
    }

    return cleanedPart;
  });

  return simplified.join(', ');
}

/**
 * Optimize feature set by reducing dimensionality
 *
 * Reduces computational overhead by truncating embeddings and
 * removing rarely-used features.
 *
 * @param features - Pattern features to optimize
 * @returns Optimized features
 */
export function optimizeFeatures(features: PatternFeatures): PatternFeatures {
  // Remove low-importance features to reduce computation
  const optimized = { ...features };

  // Simplify embeddings if too large
  if (features.semantic.embeddings && features.semantic.embeddings.length > 64) {
    // Use PCA or similar dimensionality reduction
    // For now, just truncate
    optimized.semantic = {
      ...optimized.semantic,
      embeddings: features.semantic.embeddings.slice(0, 64)
    };
  }

  // Remove rarely-used contextual features
  if (features.contextual.nearbyText.length > 3) {
    optimized.contextual = {
      ...optimized.contextual,
      nearbyText: features.contextual.nearbyText.slice(0, 3)
    };
  }

  return optimized;
}

/**
 * Check if optimization resulted in significant changes
 *
 * Compares original and optimized patterns to determine if changes
 * are substantial enough to warrant recording evolution.
 *
 * @param original - Original pattern
 * @param optimized - Optimized pattern
 * @param featureEngineering - Feature engineering instance for similarity calculation
 * @returns True if changes are significant
 */
export function hasSignificantChanges(
  original: Pattern,
  optimized: Pattern,
  featureEngineering: FeatureEngineering
): boolean {
  // Check selector changes
  if (original.selector !== optimized.selector) {
    return true;
  }

  // Check feature changes
  const similarity = featureEngineering.calculateSimilarity(
    original.features,
    optimized.features
  );

  return similarity < 0.95;
}
