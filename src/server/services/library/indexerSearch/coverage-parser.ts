/**
 * Coverage parser
 *
 * Best-effort extraction of volume/chapter coverage from Prowlarr release titles.
 * Recognizes the common release-naming patterns used by manga scanlation packs:
 *
 *   "Series Name v01-v15 (2020) (Digital)"
 *   "Series Name (Vol.1-15)"
 *   "Series Name c001-c100"
 *   "Series Name Ch.1-100"
 *   "圧勝 第01-04巻" (Japanese — canonical for raws)
 *
 * For mixed-language titles where Japanese and English ranges disagree
 * (e.g. "圧勝 第01-04巻 [Asshou vol 02-04]" — bracketed English subtitle is
 * a typo'd label), the Japanese form is matched first so the canonical
 * range wins.
 *
 * iter-A additions (corpus-driven from the persistent-gap loop —
 * see `project_iter_a0_audit_findings.md`):
 *
 *   "[Kamizye] Lookism (001-390) (ongoing) (Webtoon)"     parens-only range
 *   "[Asura] Title [01-550]"                              brackets-only range
 *   "Tales Of Demons And Gods 001-758 {2021-2023}"        bare numeric range
 *   "Title - Tome 1 à 36 [CBZ]"                           French volume keyword
 *   "Title c001-c442.5"                                   decimal at range end
 *
 * iter-A also rejects anime / audio titles outright — the corpus showed
 * Prowlarr returning a lot of `Season 02 - Episodes 38-40`, `S01-S06+EngSubs`,
 * and `LOOKISM OST` for manga queries; widening the parser without this
 * guard would let them through with parseable-looking ranges.
 *
 * When no pattern matches, returns `{ chapters: [], volumes: [] }` so the
 * caller can fall back to "assume covers everything" semantics.
 */

const VOLUME_RANGE_PATTERNS = [
  /第\s*(\d{1,3})\s*[-–—~〜]\s*(\d{1,3})\s*巻/,        // 第01-04巻 (Japanese)
  /v(\d{1,3})\s*[-~]\s*v?(\d{1,3})/i,                  // v01-v15
  /vol\.?\s*(\d{1,3})\s*[-~]\s*(?:vol\.?\s*)?(\d{1,3})/i, // Vol.1-15
  /\btomes?\s+(\d{1,3})\s+(?:[àa]|&agrave;)\s+(\d{1,3})\b/i, // Tome 1 à 36 (French)
];

const VOLUME_SINGLE_PATTERNS = [
  /第\s*(\d{1,3})\s*巻/,        // 第5巻 (Japanese)
  /\bv(\d{1,3})\b/i,
  /\bvol\.?\s*(\d{1,3})\b/i,
];

const CHAPTER_RANGE_PATTERNS = [
  /\bc(\d{1,4})\s*[-~]\s*c?(\d{1,4})(?:\.\d+)?\b/i,                  // c001-c100, c001-c442.5
  /\bch\.?\s*(\d{1,4})\s*[-~]\s*(?:ch\.?\s*)?(\d{1,4})(?:\.\d+)?\b/i, // ch.1-100
  /\bchapters?\s*(\d{1,4})\s*[-~]\s*(\d{1,4})(?:\.\d+)?\b/i,
  /第\s*(\d{1,4})\s*[-–—~〜]\s*(\d{1,4})\s*話/,                       // 第01-50話 (Japanese)
];

const CHAPTER_SINGLE_PATTERNS = [
  /\bc(\d{1,4})\b/i,
  /\bch\.?\s*(\d{1,4})\b/i,
  /\bchapter\s*(\d{1,4})\b/i,
  /第\s*(\d{1,4})\s*話/,        // 第50話 (Japanese)
];

/**
 * Parens-only and brackets-only chapter ranges. Anchored on the wrapping
 * delimiter so years like `(2021-2023)` are filtered structurally — they
 * have 4 digits on each side, while typical chapter ranges in this shape
 * are 3-digit-padded (`001-390`). The year guard below rejects any match
 * whose numbers both fall in [1900, 2099]; the leading-zero requirement
 * on the first number rejects `(38-40)` (anime episodes) but keeps
 * `(001-390)` (Lookism webtoon scrapes).
 */
const PARENS_RANGE = /\(\s*(0\d{2,3}|\d{3,4})\s*[-~]\s*(\d{2,4})(?:\.\d+)?\s*\)/;
const BRACKETS_RANGE = /\[\s*(0\d{2,3}|\d{3,4})\s*[-~]\s*(\d{2,4})(?:\.\d+)?\s*\]/;

/**
 * Bare integer chapter ranges in title body. Requires:
 *   - whitespace / underscore boundary on the left
 *   - first number to be 0-padded 3+ digits OR plain 3-4 digits (rejects
 *     trivial things like `1-3` which could match anything)
 *   - a non-digit/non-letter boundary on the right (so years like
 *     `2021-2023` are filtered by the year guard, but composite tokens
 *     like `001-758{2021` get caught with the right boundary set)
 *
 * The first match in title order wins; year-guard skips year-shaped
 * matches and keeps scanning.
 */
const BARE_RANGE_GLOBAL = /(?:^|[\s_])(0\d{2,3}|\d{3,4})\s*[-~]\s*(\d{2,4})(?:\.\d+)?(?=[\s_({}[\].]|$)/g;

/**
 * Anime / audio anti-patterns. If any of these match, we abandon the
 * release outright — these are not manga packs even if they happen to
 * contain numbers that would otherwise look like coverage.
 */
const ANIME_AUDIO_PATTERNS = [
  /\bseason\s+\d+\b/i,                    // Season 02
  /\bs\d{1,2}\s*[-~]\s*s\d{1,2}\b/i,      // S01-S06
  /\bs\d{1,2}e\d{1,3}\b/i,                // S01E03
  /\bepisodes?\s+\d+/i,                   // Episode 38, Episodes 1-9
  /\b\d{2,3}p\b/i,                        // 720p, 1080p (video resolution)
  /\bost\b/i,                             // OST tag
  /\boriginal\s+soundtrack\b/i,
  /\bmp3\b/i,
  /\bflac\b/i,
];

export interface ParsedCoverage {
  chapters: number[];
  volumes: number[];
}

function expandRange(start: number, end: number): number[] {
  if (end < start) return [];
  const out: number[] = [];
  for (let n = start; n <= end; n++) out.push(n);
  return out;
}

/** Returns the first match found across the patterns, or null. */
function firstMatch(text: string, patterns: RegExp[]): RegExpMatchArray | null {
  for (const re of patterns) {
    const m = text.match(re);
    if (m) return m;
  }
  return null;
}

function looksLikeAnimeOrAudio(title: string): boolean {
  return ANIME_AUDIO_PATTERNS.some(p => p.test(title));
}

function looksLikeYearPair(a: number, b: number): boolean {
  return a >= 1900 && a <= 2099 && b >= 1900 && b <= 2099;
}

/**
 * Find the first chapter-range hit from the parens / brackets / bare
 * patterns, year-guarding each. Returns `null` when nothing usable is
 * present. Bare ranges are scanned globally so the first non-year hit
 * wins (e.g. `001-442.5 (2021-2023)` returns 001-442, not 2021-2023).
 */
function findExtendedChapterRange(title: string): { start: number; end: number } | null {
  const parens = title.match(PARENS_RANGE);
  if (parens?.[1] && parens[2]) {
    const a = parseInt(parens[1], 10);
    const b = parseInt(parens[2], 10);
    if (!looksLikeYearPair(a, b)) return { start: a, end: b };
  }
  const brackets = title.match(BRACKETS_RANGE);
  if (brackets?.[1] && brackets[2]) {
    const a = parseInt(brackets[1], 10);
    const b = parseInt(brackets[2], 10);
    if (!looksLikeYearPair(a, b)) return { start: a, end: b };
  }
  for (const m of title.matchAll(BARE_RANGE_GLOBAL)) {
    if (!m[1] || !m[2]) continue;
    const a = parseInt(m[1], 10);
    const b = parseInt(m[2], 10);
    if (looksLikeYearPair(a, b)) continue;
    return { start: a, end: b };
  }
  return null;
}

export function parseReleaseCoverage(title: string): ParsedCoverage {
  // iter-A: anime / audio releases are not manga, full stop. Bail out
  // before any pattern has a chance to extract a misleading range.
  if (looksLikeAnimeOrAudio(title)) return { chapters: [], volumes: [] };

  const volumes: number[] = [];
  const chapters: number[] = [];

  const vRange = firstMatch(title, VOLUME_RANGE_PATTERNS);
  if (vRange?.[1] && vRange[2]) {
    volumes.push(...expandRange(parseInt(vRange[1], 10), parseInt(vRange[2], 10)));
  } else {
    const vSingle = firstMatch(title, VOLUME_SINGLE_PATTERNS);
    if (vSingle?.[1]) volumes.push(parseInt(vSingle[1], 10));
  }

  const cRange = firstMatch(title, CHAPTER_RANGE_PATTERNS);
  if (cRange?.[1] && cRange[2]) {
    chapters.push(...expandRange(parseInt(cRange[1], 10), parseInt(cRange[2], 10)));
  } else {
    const cSingle = firstMatch(title, CHAPTER_SINGLE_PATTERNS);
    if (cSingle?.[1]) {
      chapters.push(parseInt(cSingle[1], 10));
    } else {
      // iter-A: extended chapter range (parens / brackets / bare integer).
      // Only fires when no `c`/`ch`/`chapter`/`第N話` pattern matched, so
      // it doesn't interfere with the conventional shapes.
      const ext = findExtendedChapterRange(title);
      if (ext) chapters.push(...expandRange(ext.start, ext.end));
    }
  }

  return { chapters, volumes };
}
