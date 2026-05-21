/**
 * Pattern Splitting Operations
 *
 * Handles splitting of complex patterns into simpler specialized variants.
 * Improves accuracy by creating focused patterns for different feature types.
 *
 * Extracted from: PatternEvolutionManager.ts (lines 367-464)
 * FIXED: Removed unnecessary async/await (no-await-in-loop violation)
 */

import type { Pattern } from '@/server/parsers/pattern-recognition/types';

export interface SplitConfig {
  splitThreshold: number;
  minSampleSize: number;
}

/**
 * Split complex patterns into simpler ones
 * @param patterns - Patterns to analyze for splitting
 * @param config - Split configuration
 * @param recordEvolution - Callback to record evolution
 * @returns Array of split patterns (synchronous)
 */
export function splitComplexPatterns(
  patterns: Pattern[],
  config: SplitConfig,
  recordEvolution: (original: Pattern[], evolved: Pattern, reason: string) => void
): Pattern[] {
  const result: Pattern[] = [];

  for (const pattern of patterns) {
    if (shouldSplitPattern(pattern, config)) {
      const splitPatterns = splitPattern(pattern); // NOW SYNCHRONOUS
      const firstSplitPattern = splitPatterns[0];
      if (firstSplitPattern) {
        recordEvolution([pattern], firstSplitPattern, 'split');
      }
      result.push(...splitPatterns);
    } else {
      result.push(pattern);
    }
  }

  return result;
}

/**
 * Check if a pattern should be split
 */
export function shouldSplitPattern(
  pattern: Pattern,
  config: SplitConfig
): boolean {
  // Split if accuracy is low despite high usage
  if (pattern.accuracy < config.splitThreshold && pattern.usageCount > config.minSampleSize) {
    return true;
  }

  // Split if selector is too complex
  const selectorComplexity = pattern.selector.split(',').length;
  if (selectorComplexity > 3) {
    return true;
  }

  // Split if features have high variance (metadata should contain this)
  const variance = pattern.metadata['featureVariance'];
  if (typeof variance === 'number' && variance > 0.5) {
    return true;
  }

  return false;
}

/**
 * Split a complex pattern into specialized variants
 * FIXED: Removed Promise.resolve wrapper (was causing no-await-in-loop)
 */
export function splitPattern(pattern: Pattern): Pattern[] {
  // For now, create two variations with different feature emphasis
  const patterns: Pattern[] = [];

  // Pattern focusing on structural features
  const structuralPattern: Pattern = {
    ...pattern,
    id: `${pattern.id}_structural`,
    name: `${pattern.name} (Structural)`,
    features: {
      ...pattern.features,
      statistical: {
        ...pattern.features.statistical,
        patternScore: (pattern.features.statistical.patternScore ?? 0) * 0.5
      }
    },
    version: pattern.version + 1,
    metadata: {
      ...pattern.metadata,
      splitFrom: pattern.id,
      splitReason: 'complexity',
      emphasis: 'structural'
    }
  };

  // Pattern focusing on semantic features
  const semanticPattern: Pattern = {
    ...pattern,
    id: `${pattern.id}_semantic`,
    name: `${pattern.name} (Semantic)`,
    features: {
      ...pattern.features,
      structural: {
        ...pattern.features.structural,
        domDepth: 0,
        siblingCount: 0
      }
    },
    version: pattern.version + 1,
    metadata: {
      ...pattern.metadata,
      splitFrom: pattern.id,
      splitReason: 'complexity',
      emphasis: 'semantic'
    }
  };

  patterns.push(structuralPattern, semanticPattern);

  return patterns; // Direct return, NO Promise.resolve
}
