/**
 * Format Normalizer
 *
 * Normalizes manga format values (MANGA, MANHWA, MANHUA, etc.).
 * Consolidates format normalization from WikiMetadataExtractor and other sources.
 *
 * @module shared/source-knowledge/normalizers/format-normalizer
 */

/**
 * Normalize a format string to standard values.
 *
 * @param formatText - Raw format text from any source
 * @returns Normalized format value
 */
export function normalizeFormat(formatText: string): string {
  const upper = formatText.toUpperCase();

  if (upper.includes('MANGA')) {
    return 'MANGA';
  }
  if (upper.includes('MANHWA')) {
    return 'MANHWA';
  }
  if (upper.includes('MANHUA')) {
    return 'MANHUA';
  }
  if (upper.includes('NOVEL') || upper.includes('LIGHT NOVEL')) {
    return 'NOVEL';
  }
  if (upper.includes('ONE SHOT') || upper.includes('ONE-SHOT') || upper.includes('ONESHOT')) {
    return 'ONE_SHOT';
  }

  return formatText; // Keep original if no match
}
