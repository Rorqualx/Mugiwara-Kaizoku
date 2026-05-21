/**
 * Date Normalizer
 *
 * Normalizes date values, extracting year when possible.
 * Handles patterns from ComicVine, Fandom, Wikipedia, etc.
 *
 * @module shared/source-knowledge/normalizers/date-normalizer
 */

/**
 * Normalize a date value, extracting just the year if possible.
 * Handles patterns like "2023 In Cover Date ---" -> "2023"
 *
 * @param date - Raw date string from any source
 * @returns Normalized date value (preferring year extraction)
 */
export function normalizeDateValue(date: string): string {
  const trimmed = date.trim();

  // If it's just a year (4 digits), return as-is
  if (/^\d{4}$/.test(trimmed)) {
    return trimmed;
  }

  // Extract year from patterns like "2023 In Cover Date ---"
  const yearMatch = trimmed.match(/^(\d{4})\s+(in\s+)?cover\s+date/i);
  if (yearMatch?.[1]) {
    return yearMatch[1];
  }

  // Extract year from beginning of string if followed by non-digit
  const leadingYear = trimmed.match(/^(\d{4})\D/);
  if (leadingYear?.[1]) {
    return leadingYear[1];
  }

  // Try to find any 4-digit year in the string
  const anyYear = trimmed.match(/\b(19|20)\d{2}\b/);
  if (anyYear?.[0]) {
    return anyYear[0];
  }

  return trimmed;
}
