/**
 * Vector Similarity Utilities
 *
 * Mathematical functions for vector operations and similarity
 * calculations used in pattern matching.
 *
 * Extracted from: DatabasePatternStore.ts (lines 645-668)
 */

/**
 * Calculate cosine similarity between two vectors
 *
 * Returns a similarity score between 0 and 1, where:
 * - 1 = identical vectors
 * - 0 = orthogonal vectors or incompatible inputs
 *
 * Cosine similarity is calculated as:
 * cos(θ) = (a · b) / (||a|| * ||b||)
 *
 * Where:
 * - a · b is the dot product of vectors a and b
 * - ||a|| and ||b|| are the magnitudes (norms) of the vectors
 *
 * @param a - First vector (array of numbers)
 * @param b - Second vector (array of numbers)
 * @returns Similarity score (0-1), or 0 if vectors have different lengths or zero magnitude
 *
 * @example
 * ```typescript
 * // Identical vectors
 * cosineSimilarity([1, 2, 3], [1, 2, 3]); // Returns: 1
 *
 * // Orthogonal vectors
 * cosineSimilarity([1, 0], [0, 1]); // Returns: 0
 *
 * // Partial similarity
 * cosineSimilarity([1, 2, 3], [2, 4, 6]); // Returns: 1 (parallel vectors)
 * ```
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  // Vectors must have same dimensions
  if (a.length !== b.length) return 0;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    const aVal = a[i];
    const bVal = b[i];

    // FIXED: Changed from `aVal !== null && bVal !== undefined`
    // Array access returns `number | undefined`, not `number | null`
    if (aVal !== undefined && bVal !== undefined) {
      dotProduct += aVal * bVal;
      normA += aVal * aVal;
      normB += bVal * bVal;
    }
  }

  // Avoid division by zero
  if (normA === 0 || normB === 0) return 0;

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}
