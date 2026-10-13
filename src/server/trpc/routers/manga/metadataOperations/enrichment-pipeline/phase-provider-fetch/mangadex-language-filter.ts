/**
 * Preferred-language gate for the MangaDex chapter numbers that become
 * chapter rows.
 *
 * MangaDex's chapter list is every scanlation upload in every language, and
 * scanlators number extras their own way: Demon Slayer's main entry carries
 * 7.5, 25.1 … 205.2, 205.5 only as Arabic / Brazilian Portuguese / Spanish
 * uploads. Seeding the granular (Tier-1) chapter list with those numbers
 * created ~39 file-less decimal rows that no English source knows about.
 * Downloads already treat `mangadex.preferredLanguage` as a hard filter
 * (d99e2d650); this applies the same language to the chapter numbers.
 *
 * Rule — a MangaDex chapter number is kept when ANY of:
 *   1. it has an upload in the preferred language (`inPreferredLanguage`);
 *   2. another provider names the same number (ComicVine's chapter list here;
 *      Wikipedia / Fandom numbers are unioned separately by chapter
 *      reconciliation, so dropping a number here never hides theirs);
 *   3. it is an integer within the series' range — at most the larger of the
 *      AniList chapter count and the highest preferred-language number, or
 *      any integer when neither is known (an ongoing series with no count).
 *      Licensed series (Demon Slayer, Attack on Titan) have almost no English
 *      uploads, and chapters 1..N must still exist as placeholders.
 * So in practice the gate drops decimals and above-the-count integers that
 * only other-language uploads provide.
 *
 * Fallback: when no number has a preferred-language upload AND no other
 * provider knows the series (no AniList count, no ComicVine chapters), the
 * MangaDex list is the title's only chapter list and is returned unchanged —
 * the gate never wipes a title's list. A title with no preferred-language
 * upload but a known count is still gated: Demon Slayer's main entry has
 * zero English chapters in its feed (licensed; MangaDex still advertises
 * `en` in availableTranslatedLanguages), and its integers 1..N survive via
 * rule 3 while the other-language decimals are dropped. Rule 3 means the
 * gate can only ever drop decimals and above-the-count integers, so no
 * title loses its 1..N placeholders.
 *
 * Items without an `inPreferredLanguage` flag (language unknown) are kept.
 *
 * Pure: no I/O.
 */

/** The fields of a MangaDex chapter item the gate reads. */
export interface LanguageGateItem {
  number: number;
  inPreferredLanguage?: boolean;
}

export interface LanguageGateContext {
  /** The series' chapter count from AniList; 0 when unknown. */
  seriesChapterCount: number;
  /** Chapter numbers another provider (ComicVine) lists for this series. */
  corroboratedNumbers: ReadonlySet<number>;
}

export interface LanguageGateResult<T> {
  kept: T[];
  /** Numbers dropped because only other-language uploads provide them. */
  dropped: number[];
  /** True when the title has no preferred-language upload and the list passed through unchanged. */
  fellBack: boolean;
}

/**
 * Keep the MangaDex chapter numbers the preferred language, another provider,
 * or the series' integer range supports. See the module header for the rule.
 */
export function restrictToPreferredLanguage<T extends LanguageGateItem>(
  chapters: readonly T[],
  ctx: LanguageGateContext,
): LanguageGateResult<T> {
  const preferred = chapters.filter(c => c.inPreferredLanguage === true);
  const countKnown = ctx.seriesChapterCount > 0;
  const otherProviderKnowsSeries = countKnown || ctx.corroboratedNumbers.size > 0;
  if (preferred.length === 0 && !otherProviderKnowsSeries) {
    return { kept: [...chapters], dropped: [], fellBack: chapters.length > 0 };
  }

  const highestPreferred = preferred.reduce((max, c) => Math.max(max, c.number), 0);
  const integerCeiling = Math.max(ctx.seriesChapterCount, highestPreferred);

  const kept: T[] = [];
  const dropped: number[] = [];
  for (const ch of chapters) {
    if (isSupported(ch, ctx.corroboratedNumbers, countKnown, integerCeiling)) kept.push(ch);
    else dropped.push(ch.number);
  }
  return { kept, dropped, fellBack: false };
}

function isSupported(
  ch: LanguageGateItem,
  corroborated: ReadonlySet<number>,
  countKnown: boolean,
  integerCeiling: number,
): boolean {
  if (ch.inPreferredLanguage !== false) return true;
  if (corroborated.has(ch.number)) return true;
  if (!Number.isInteger(ch.number)) return false;
  // No series count: an ongoing series' other-language uploads may run ahead
  // of the preferred language, and nothing bounds them — keep the integers.
  if (!countKnown) return true;
  return ch.number <= integerCeiling;
}
