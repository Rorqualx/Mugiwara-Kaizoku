/**
 * Status Normalizer
 *
 * Normalizes publication status values to standard format.
 * Used by both ML bootstrap-labeler and app parser bridge.
 *
 * @module shared/source-knowledge/normalizers/status-normalizer
 */

/**
 * Normalize a status value to standard format.
 *
 * @param status - Raw status string from any source
 * @returns Normalized status value
 */
export function normalizeStatusValue(status: string): string {
  const normalized = status.toLowerCase().trim();

  if (normalized.includes('ongoing') || normalized.includes('running')) {
    return 'ongoing';
  }
  if (normalized.includes('completed') || normalized.includes('finished')) {
    return 'completed';
  }
  if (normalized.includes('hiatus')) {
    return 'hiatus';
  }
  if (normalized.includes('cancelled') || normalized.includes('canceled')) {
    return 'cancelled';
  }

  return normalized;
}
