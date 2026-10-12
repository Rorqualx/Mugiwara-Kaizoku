/**
 * One comparison key for alternate titles (`Metadata.synonyms`).
 *
 * Three writers used to compare synonyms three different ways — the finalize
 * union by exact string, the overlay by trimmed lower-case, the list selector
 * by lower-case with folded separators — so "Shingeki no Kyojin" and
 * "SHINGEKI NO KYOJIN" passed one of them and were stored side by side.
 * Every writer now keys on `synonymKey`.
 *
 * The key is for comparison only; what is stored is always a provider's own
 * spelling (the first one seen).
 *
 * Pure functions — no DB, no I/O.
 */

/** Whitespace, underscore, ASCII hyphen and the Unicode dashes U+2010–U+2015. */
const SEPARATOR_RUN = /[\s_\-\u2010-\u2015]+/gu;

/**
 * Comparison key: NFKC (full-width and compatibility forms fold onto their
 * plain equivalents), lower-case, and any run of whitespace, underscores,
 * hyphens or dashes becomes one space. Returns '' for a string with nothing to compare.
 */
export function synonymKey(value: string): string {
  return value.normalize('NFKC').toLowerCase().replace(SEPARATOR_RUN, ' ').trim();
}

/**
 * De-duplicate a synonym list by `synonymKey`, keeping order and the
 * first-seen spelling (trimmed). Non-strings and blank entries are dropped.
 */
export function dedupeSynonyms(values: readonly unknown[]): string[] {
  const seen = new Set<string>();
  const kept: string[] = [];
  for (const value of values) {
    if (typeof value !== 'string') continue;
    const key = synonymKey(value);
    if (key.length === 0 || seen.has(key)) continue;
    seen.add(key);
    kept.push(value.trim());
  }
  return kept;
}

/** Whether two synonym lists hold the same strings in the same order. */
export function sameSynonymList(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}
