/**
 * Entity Normalizer
 *
 * Normalizes entity values for comparison and deduplication.
 * Must match normalizeForComparison() in ground-truth.ts for consistent matching.
 *
 * @module shared/source-knowledge/normalizers/entity-normalizer
 */

/**
 * Normalize an entity value for comparison.
 * NOTE: Must match normalizeForComparison() in ground-truth.ts for consistent matching.
 *
 * @param value - Raw entity value
 * @returns Normalized value for comparison
 */
export function normalizeEntityValue(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\b(the|a|an)\b/gi, '') // Article removal - matches ground-truth.ts
    .replace(/[^\w\s-]/g, '')
    .trim(); // Final trim to clean up any leading/trailing spaces from article removal
}
