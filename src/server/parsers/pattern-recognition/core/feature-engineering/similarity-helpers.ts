/**
 * Similarity Calculation Helpers Module
 *
 * Provides similarity calculation functions for comparing pattern features
 * across structural, semantic, and statistical dimensions. Used for pattern
 * matching, deduplication, and clustering operations.
 *
 * Extracted from: FeatureEngineering.ts (lines 503-640)
 */

import type {
  PatternFeatures,
  StructuralFeatures,
  SemanticFeatures,
  StatisticalFeatures,
  FeatureConfig
} from './types';

// ============================================================================
// Main Similarity Calculator
// ============================================================================

/**
 * Calculate similarity between two feature vectors
 *
 * Computes a weighted average of structural, semantic, and statistical
 * similarity scores based on the enabled feature types in the configuration.
 *
 * @param features1 - First feature vector
 * @param features2 - Second feature vector
 * @param config - Feature configuration controlling which similarity types to calculate
 * @returns Similarity score in range [0, 1] where 1 is identical
 *
 * @example
 * ```typescript
 * const similarity = calculateSimilarity(
 *   patternA.features,
 *   patternB.features,
 *   { enableStructural: true, enableSemantic: true, enableStatistical: true }
 * );
 * if (similarity > 0.8) {
 *   console.log('Patterns are very similar');
 * }
 * ```
 */
export function calculateSimilarity(
  features1: PatternFeatures,
  features2: PatternFeatures,
  config: FeatureConfig
): number {
  const scores: number[] = [];

  // Structural similarity
  if (config.enableStructural) {
    scores.push(structuralSimilarity(features1.structural, features2.structural));
  }

  // Semantic similarity
  if (config.enableSemantic) {
    scores.push(semanticSimilarity(features1.semantic, features2.semantic));
  }

  // Statistical similarity
  if (config.enableStatistical) {
    scores.push(statisticalSimilarity(features1.statistical, features2.statistical));
  }

  // Average similarity
  return scores.length > 0
    ? scores.reduce((sum, score) => sum + score, 0) / scores.length
    : 0;
}

// ============================================================================
// Domain-Specific Similarity Functions
// ============================================================================

/**
 * Calculate structural similarity between two feature sets
 *
 * Compares DOM structure attributes including tag names, classes, depth,
 * parent relationships, sibling counts, and element positions.
 *
 * @param s1 - First structural features
 * @param s2 - Second structural features
 * @returns Structural similarity score in range [0, 1]
 *
 * Weights:
 * - Tag name match: 30%
 * - Class overlap: 20%
 * - Parent tag match: 20%
 * - DOM depth similarity: 10%
 * - Sibling count similarity: 10%
 * - Position similarity: 10%
 */
export function structuralSimilarity(s1: StructuralFeatures, s2: StructuralFeatures): number {
  let score = 0;
  let weight = 0;

  // Tag name match
  if (s1.tagName === s2.tagName) {
    score += 0.3;
  }
  weight += 0.3;

  // Class overlap
  const classOverlap = setOverlap(s1.classList ?? [], s2.classList ?? []);
  score += classOverlap * 0.2;
  weight += 0.2;

  // DOM depth similarity
  const depthDiff = Math.abs((s1.domDepth ?? 0) - (s2.domDepth ?? 0));
  score += Math.max(0, 1 - depthDiff / 10) * 0.1;
  weight += 0.1;

  // Parent tag match
  if (s1.parentTag === s2.parentTag) {
    score += 0.2;
  }
  weight += 0.2;

  // Sibling count similarity
  const siblingDiff = Math.abs((s1.siblingCount ?? 0) - (s2.siblingCount ?? 0));
  score += Math.max(0, 1 - siblingDiff / 10) * 0.1;
  weight += 0.1;

  // Position similarity
  const positionDiff = Math.abs((s1.position ?? 0) - (s2.position ?? 0));
  score += Math.max(0, 1 - positionDiff / 10) * 0.1;
  weight += 0.1;

  return weight > 0 ? score / weight : 0;
}

/**
 * Calculate semantic similarity between two feature sets
 *
 * Compares semantic attributes including type, text length, presence of
 * numbers/dates/ISBNs, and embedding vectors.
 *
 * @param s1 - First semantic features
 * @param s2 - Second semantic features
 * @returns Semantic similarity score in range [0, 1]
 *
 * Weights:
 * - Semantic type match: 40%
 * - Boolean features (numbers/date/ISBN): 30%
 * - Embedding cosine similarity: 20% (when available)
 * - Text length similarity: 10%
 */
export function semanticSimilarity(s1: SemanticFeatures, s2: SemanticFeatures): number {
  let score = 0;
  let weight = 0;

  // Semantic type match
  if (s1.semanticType === s2.semanticType && s1.semanticType !== undefined) {
    score += 0.4;
  }
  weight += 0.4;

  // Text length similarity
  const lengthRatio = Math.min(s1.textLength ?? 1, s2.textLength ?? 1) /
                     Math.max(s1.textLength ?? 1, s2.textLength ?? 1);
  score += lengthRatio * 0.1;
  weight += 0.1;

  // Boolean features match
  if (s1.hasNumbers === s2.hasNumbers) score += 0.1;
  if (s1.hasDate === s2.hasDate) score += 0.1;
  if (s1.hasISBN === s2.hasISBN) score += 0.1;
  weight += 0.3;

  // Embedding similarity (cosine similarity)
  if (s1.embeddings && s2.embeddings) {
    const cosineSim = cosineSimilarity(s1.embeddings, s2.embeddings);
    score += cosineSim * 0.2;
    weight += 0.2;
  }

  return weight > 0 ? score / weight : 0;
}

/**
 * Calculate statistical similarity between two feature sets
 *
 * Compares statistical properties using Euclidean distance in feature space.
 * Features include entropy, densities, ratios, and word length statistics.
 *
 * @param s1 - First statistical features
 * @param s2 - Second statistical features
 * @returns Statistical similarity score in range [0, 1]
 *
 * Features compared:
 * - Entropy
 * - Text density
 * - Numeric density
 * - Punctuation density
 * - Capital letter ratio
 * - Average word length (using required `avgWordLength` field)
 * - Unique word ratio
 * - Pattern score
 */
export function statisticalSimilarity(s1: StatisticalFeatures, s2: StatisticalFeatures): number {
  const features1 = [
    s1.entropy ?? 0,
    s1.textDensity ?? 0,
    s1.numericDensity ?? 0,
    s1.punctuationDensity ?? 0,
    s1.capitalLetterRatio ?? 0,
    s1.avgWordLength, // Required field, no fallback needed
    s1.uniqueWordRatio ?? 0,
    s1.patternScore ?? 0
  ];

  const features2 = [
    s2.entropy ?? 0,
    s2.textDensity ?? 0,
    s2.numericDensity ?? 0,
    s2.punctuationDensity ?? 0,
    s2.capitalLetterRatio ?? 0,
    s2.avgWordLength, // Required field, no fallback needed
    s2.uniqueWordRatio ?? 0,
    s2.patternScore ?? 0
  ];

  return 1 - euclideanDistance(features1, features2) / Math.sqrt(features1.length);
}

// ============================================================================
// Low-Level Math Utilities
// ============================================================================

/**
 * Calculate Jaccard similarity (set overlap) between two string arrays
 *
 * Computes the size of the intersection divided by the size of the union.
 * Handles edge cases of empty sets.
 *
 * @param set1 - First string array
 * @param set2 - Second string array
 * @returns Overlap coefficient in range [0, 1] where 1 is identical sets
 *
 * @example
 * ```typescript
 * setOverlap(['a', 'b', 'c'], ['b', 'c', 'd']) // Returns 0.5
 * setOverlap([], []) // Returns 1.0 (both empty)
 * setOverlap(['a'], []) // Returns 0.0
 * ```
 */
export function setOverlap(set1: string[], set2: string[]): number {
  if (set1.length === 0 && set2.length === 0) return 1;
  if (set1.length === 0 || set2.length === 0) return 0;

  const s1 = new Set(set1);
  const s2 = new Set(set2);
  const intersection = new Set([...s1].filter(x => s2.has(x)));
  const union = new Set([...s1, ...s2]);

  return intersection.size / union.size;
}

/**
 * Calculate cosine similarity between two vectors
 *
 * Computes the cosine of the angle between two vectors using their dot product
 * and magnitudes. Returns 0 if vectors have different lengths or zero magnitude.
 *
 * @param vec1 - First vector
 * @param vec2 - Second vector
 * @returns Cosine similarity in range [-1, 1] (typically [0, 1] for feature vectors)
 *
 * @example
 * ```typescript
 * cosineSimilarity([1, 0, 0], [1, 0, 0]) // Returns 1.0 (identical)
 * cosineSimilarity([1, 0, 0], [0, 1, 0]) // Returns 0.0 (orthogonal)
 * cosineSimilarity([1, 2, 3], [2, 4, 6]) // Returns 1.0 (parallel)
 * ```
 */
export function cosineSimilarity(vec1: number[], vec2: number[]): number {
  if (vec1.length !== vec2.length) return 0;

  let dotProduct = 0;
  let norm1 = 0;
  let norm2 = 0;

  for (let i = 0; i < vec1.length; i++) {
    const v1 = vec1[i];
    const v2 = vec2[i];
    if (v1 !== undefined && v2 !== undefined) {
      dotProduct += v1 * v2;
      norm1 += v1 * v1;
      norm2 += v2 * v2;
    }
  }

  if (norm1 === 0 || norm2 === 0) return 0;
  return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
}

/**
 * Calculate Euclidean distance between two vectors
 *
 * Computes the L2 norm (straight-line distance) between two points in
 * n-dimensional space. Returns Infinity if vectors have different lengths.
 *
 * @param vec1 - First vector
 * @param vec2 - Second vector
 * @returns Euclidean distance (non-negative), or Infinity if lengths differ
 *
 * @example
 * ```typescript
 * euclideanDistance([0, 0], [3, 4]) // Returns 5.0
 * euclideanDistance([1, 1, 1], [2, 2, 2]) // Returns ~1.732
 * euclideanDistance([1, 2], [1, 2, 3]) // Returns Infinity (length mismatch)
 * ```
 */
export function euclideanDistance(vec1: number[], vec2: number[]): number {
  if (vec1.length !== vec2.length) return Infinity;

  let sum = 0;
  for (let i = 0; i < vec1.length; i++) {
    const v1 = vec1[i];
    const v2 = vec2[i];
    if (v1 !== undefined && v2 !== undefined) {
      const diff = v1 - v2;
      sum += diff * diff;
    }
  }

  return Math.sqrt(sum);
}
