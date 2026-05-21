/**
 * Title normalisation + fallback-query helpers shared across the AniList
 * matcher.
 *
 * `stripTitlePatterns` removes edition/format suffixes that poison free-text
 * search (e.g. "Kingdom Hearts Manga" → "Kingdom Hearts"). `buildFallbackSearchQuery`
 * produces a shorter retry query for long compound titles that AniList's
 * search misses on the first pass.
 */

/**
 * Strip common patterns from titles before normalisation.
 * Improves matching for series like JoJo Part 4/5, Kingdom Hearts Manga, etc.
 */
export function stripTitlePatterns(title: string): string {
  return (
    title
      // Remove "Part X" (Arabic numerals)
      .replace(/\s+Part\s+\d+\b/gi, '')
      // Remove "Part X" (Roman numerals I-X)
      .replace(/\s+Part\s+(?:I{1,3}|IV|VI{0,3}|IX|X{0,3})\b/gi, '')
      // Remove years in parentheses
      .replace(/\s*\(\d{4}\)/g, '')
      // Remove quality/edition suffixes. "Manga" is included because library
      // titles like "Kingdom Hearts Manga" poison free-text AniList search —
      // the canonical AniList title is just "Kingdom Hearts".
      .replace(/\s*-?\s*(?:Digital|HD|Complete|Omnibus|Colored|Full Color|Manga)\s*$/gi, '')
      .trim()
  );
}

/**
 * Build a shorter fallback search query for providers that don't handle long
 * or compound titles well (AniList). Strategy:
 *   - Take everything before the first colon or " - " break.
 *   - Cap at 5 words.
 * Returns null when the result equals the input (no useful shortening).
 */
export function buildFallbackSearchQuery(title: string): string | null {
  const beforeColon = title.split(':')[0]?.trim() ?? title;
  const beforeDash = beforeColon.split(' - ')[0]?.trim() ?? beforeColon;
  const words = beforeDash.split(/\s+/).filter((w) => w.length > 0);
  const shortened = words.slice(0, 5).join(' ');
  if (shortened.length === 0) return null;
  if (shortened === title.trim()) return null;
  return shortened;
}
