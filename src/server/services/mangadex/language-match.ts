/**
 * MangaDex `translatedLanguage` matcher.
 *
 * MangaDex emits codes like `en`, `en-us`, `pt-br`, `es-la` interchangeably.
 * Match either the exact code or the family — `en` matches `en-us`, and an
 * item tagged `en-us` matches a preferred code of `en`.
 *
 * Shared by the enrichment pipeline (mangadex-chapter-list) and the
 * one-shot survey (`scripts/surveys/clear-non-preferred-chapter-titles.ts`).
 */

export function isPreferredLanguage(
  language: string | null | undefined,
  preferredLanguage: string,
): boolean {
  if (!language) return false;
  const lang = language.toLowerCase();
  const pref = preferredLanguage.toLowerCase();
  return lang === pref || lang.startsWith(`${pref}-`) || pref.startsWith(`${lang}-`);
}
