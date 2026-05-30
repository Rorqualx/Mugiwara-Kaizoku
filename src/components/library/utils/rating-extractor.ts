import type { Prisma } from '@prisma/client';

/**
 * Phase 1: Metadata.rating widened from Float to Json {value, scoredBy?, rank?, source?}.
 * Extract the numeric `value` for filter/sort/comparison. Legacy float values
 * coerce directly; new JSON values pull `.value`.
 */
export function getRatingValue(rating: Prisma.JsonValue | null | undefined): number {
  if (rating === null || rating === undefined) return 0;
  if (typeof rating === 'number') return rating;
  if (typeof rating === 'object' && rating !== null && !Array.isArray(rating) && 'value' in rating) {
    const v = (rating as { value: unknown }).value;
    if (typeof v === 'number') return v;
  }
  return 0;
}
