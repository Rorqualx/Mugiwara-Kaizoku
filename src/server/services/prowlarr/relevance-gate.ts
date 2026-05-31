/**
 * Prowlarr Relevance Gate
 *
 * Drops wrong-target search results whose title shares the canonical
 * manga title's leading token but adds enough unrelated tokens that
 * they're plainly a different work. The Akira incident is the canonical
 * example: a search for "Akira" returned "Akira Failing in Love v01-02
 * (2026) (Digital) (Rillant)" and "Momose Akira no Hatsukoi Hatan-chuu."
 * — both scored 145 by the additive scoring path because no relevance
 * check fired.
 *
 * Algorithm (per the approved plan):
 *
 *   1. Tokenize each accepted title (canonical + synonyms) into a
 *      lowercased, NFKD-folded, punctuation-stripped, stopword-filtered
 *      token set.
 *   2. Tokenize the release title with the same rules PLUS strip
 *      volume / chapter / year / scanlator-bracket noise so format
 *      markers don't look "foreign".
 *   3. For each accepted title's token set, decide whether the release
 *      passes the per-title gate:
 *        - canonical-size == 0 → pass (can't evaluate)
 *        - canonical-size > 1  → pass (multi-token titles aren't ambiguous)
 *        - only token > 6 chars → pass (distinctive single tokens like
 *          "Berserk", "Vagabond", "Solanin" already disambiguate)
 *        - else: every release token must be in the canonical set OR be
 *          a release qualifier (Deluxe / Omnibus / Color / Edition / …).
 *   4. Reject ONLY when EVERY accepted title fails. A single synonym
 *      passing is enough to allow the release (CJK ↔ romaji parity).
 *
 * Returns a boolean instead of throwing or scoring so the caller can
 * decide whether to drop the result, badge it, or merely log it.
 */

const STOPWORDS = new Set<string>([
  // English connectives
  'the', 'a', 'an', 'of', 'and', 'or', 'to', 'in', 'on',
  // Japanese particles (romaji)
  'no', 'wa', 'ga', 'ni', 'de', 'ka',
  // Spanish/Portuguese connectives
  'da', 'la', 'el', 'los', 'las', 'en', 'y',
]);

/**
 * Tokens that are commonly added by release variants of the SAME work
 * (Deluxe Edition, Color reprint, Omnibus collection, …). Treated as
 * "free" foreign tokens so a "Bleach Color Edition v01" release isn't
 * gated when canonical is just "Bleach". Conservative: only tokens that
 * almost never appear in a real distinct manga title.
 */
const RELEASE_QUALIFIERS = new Set<string>([
  'deluxe', 'omnibus', 'color', 'edition', 'hardcover', 'paperback',
  'complete', 'collection', 'digital', 'compilation', 'remastered',
  'official', 'unofficial', 'volume', 'volumes', 'tankobon', 'tankoubon',
  'hd', 'fhd', 'uhd',
]);

/** Single-token canonical titles longer than this escape the gate
 *  (they're already distinctive enough — "Vagabond", "Berserk",
 *  "Vinland", …). Akira/Goku/Bleach/Naruto-class titles stay gated. */
const SINGLE_TOKEN_GATE_MAX_LEN = 6;

/** Token is "Latin-script" if it's only Latin letters, digits, and
 *  diacritics-after-NFKD. We use this to count canonical-side tokens for
 *  the multi-token escape — CJK synonyms ("アキラ", "AKIRA 総天然色") would
 *  otherwise inflate the count and bypass the gate even when the
 *  release title is purely Latin and obviously wrong-target. */
const LATIN_TOKEN_RE = /^[\p{Script=Latin}\d]+$/u;

function nfkdFold(s: string): string {
  // Decompose then strip combining diacritics. NFKD doesn't decompose
  // CJK, so Japanese tokens survive intact — that's fine; they'll match
  // verbatim against an accepted Japanese synonym.
  return s.normalize('NFKD').replace(/[̀-ͯ]/g, '');
}

function tokenize(title: string): string[] {
  return nfkdFold(title)
    .toLowerCase()
    // Replace non-letter/digit/mark/space with space. Marks (\p{M}) must
    // be kept — Thai vowel signs, Arabic harakat, Devanagari matras are
    // all `\p{M}`, and stripping them would tear "อากิระ" → ["อาก","ระ"]
    // and inflate the canonical token count, bypassing the gate. With
    // `\p{M}` retained the same input tokenizes to ["อากิระ"] as
    // intended. The leading nfkdFold still strips Latin/Greek/Cyrillic
    // combining diacritics so e.g. "Naïve" → "naive".
    .replace(/[^\p{L}\p{N}\p{M}\s]/gu, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOPWORDS.has(t));
}

function stripReleaseNoise(title: string): string {
  let s = title;
  // Bracketed metadata first — scanlator/publisher groups inside [] or ()
  // often contain author names or release-team handles that would pollute
  // the token set if left in (e.g. "(Rillant)", "[Skuld]").
  s = s.replace(/\[[^\]]*\]/g, ' ');
  s = s.replace(/\([^)]*\)/g, ' ');
  // Volume markers: v01, v.01, vol 1, vol.1, volume 1, volumes 1-3
  s = s.replace(/\bv(?:ol(?:ume)?s?\.?)?\s*\d+(?:[-–]\d+)?\b/gi, ' ');
  // Tome (French volume marker)
  s = s.replace(/\btomes?\s*\d+(?:[-–]\d+)?\b/gi, ' ');
  // Chapter markers: c042, ch.5, chapter 5, c001-c060
  s = s.replace(/\bch(?:apter)?s?\.?\s*\d+(?:[-–]\d+)?\b/gi, ' ');
  s = s.replace(/\bc\.?\s*\d+(?:[-–]c?\d+)?\b/gi, ' ');
  // Bare numeric ranges (`041-074`, `100-200`) — almost always chapter
  // or issue ranges in release naming; never part of a manga's name.
  s = s.replace(/\b\d{1,4}\s*[-–]\s*\d{1,4}\b/g, ' ');
  // Bare 4-digit years (`1982`, `2026`) — frequent in releases, never
  // in canonical titles. Bounded to plausible publication-year window.
  s = s.replace(/\b(?:18|19|20)\d{2}\b/g, ' ');
  return s;
}

function tokenizeRelease(title: string): string[] {
  return tokenize(stripReleaseNoise(title));
}

function passesPerTitleGate(releaseTokens: string[], canonical: Set<string>): boolean {
  if (canonical.size === 0) return true;

  // Count Latin-script tokens separately. A CJK-only synonym ("アキラ")
  // is informative for CJK release titles but doesn't disambiguate a
  // Latin release; mixing the two into a single size count inflates the
  // canonical and bypasses the gate even when the release is plainly
  // wrong-target ("AKIRA 総天然色" tokens to ["akira","総天然色"] —
  // size 2, would multi-token-escape without this split).
  const latin = [...canonical].filter((t) => LATIN_TOKEN_RE.test(t));

  if (latin.length > 1) return true;

  if (latin.length === 0) {
    // Purely CJK canonical: fall back to raw size + length on the only token.
    if (canonical.size > 1) return true;
    const [onlyCjk] = canonical;
    if (onlyCjk === undefined) return true;
    if (onlyCjk.length > SINGLE_TOKEN_GATE_MAX_LEN) return true;
  } else {
    const [onlyLatin] = latin;
    if (onlyLatin === undefined) return true;
    if (onlyLatin.length > SINGLE_TOKEN_GATE_MAX_LEN) return true;
  }

  const foreign = releaseTokens.filter(
    (t) => !canonical.has(t) && !RELEASE_QUALIFIERS.has(t),
  );
  return foreign.length === 0;
}

/**
 * Returns `true` when the release title has enough foreign tokens that
 * the caller should drop it from candidates. Always returns `false`
 * when `acceptedTitles` is empty (no canonical to compare against) so
 * pure-discovery flows aren't disturbed.
 */
export function shouldRejectByForeignTokens(
  releaseTitle: string,
  acceptedTitles: string[],
): boolean {
  if (acceptedTitles.length === 0) return false;
  const releaseTokens = tokenizeRelease(releaseTitle);
  if (releaseTokens.length === 0) return false;

  for (const accepted of acceptedTitles) {
    const canonical = new Set(tokenize(accepted));
    if (passesPerTitleGate(releaseTokens, canonical)) return false;
  }
  return true;
}
