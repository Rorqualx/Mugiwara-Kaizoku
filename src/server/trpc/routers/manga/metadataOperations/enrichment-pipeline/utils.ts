/**
 * Enrichment Pipeline Utilities
 *
 * Shared helper functions used across pipeline phases.
 */

/** Check if a chapter title is likely English using language tag + content heuristics */
export function isLikelyEnglish(title: string, language?: string): boolean {
  if (!title) return false;
  if (language && language !== 'en') return false;
  if (/[àâãäåçéèêëìíîïñòóôõöùúûüýÿœæ]/i.test(title)) return false;
  if (/[\u3000-\u9FFF\uAC00-\uD7AF]/.test(title)) return false;
  return true;
}

/** Normalize a title for comparison: NFKD fold accents, lowercase, strip punctuation/whitespace */
export function normalizeTitle(title: string): string {
  return title.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Edition/variant qualifiers that distinguish a manga from its main series.
 * Bidirectional: rejects if query has qualifier candidate lacks, OR candidate
 * has qualifier query lacks.
 *
 * Iter MDE2: `/colou?red?/` only matched "colored"/"coloured" because the
 * regex requires the literal "e" before optional "d". A plain "Color" title
 * (Chainsaw Man Color, One Piece Color) was silently treated as no-qualifier
 * and incorrectly matched the main series. Replaced with `/colou?r(?:ed)?/`
 * so the colored family covers color / colour / colored / coloured uniformly.
 */
const EDITION_QUALIFIERS = [
  /\bcolou?r(?:ed)?\b/i,
  /\bdigital\s*colou?r(?:ed)?\b/i,
  /\bofficial\s*colou?r(?:ed)?\b/i,
  /\bomnibus\b/i,
  /\bbox\s*set\b/i,
  /\bdeluxe\b/i,
  /\bfull\s*colou?r\b/i,
  /カラー/,
  /完全版/,
];

/**
 * Spinoff/alternate-version qualifiers: reject if candidate has these but query doesn't.
 * Prevents "Overlord: Shin Sekai-hen" matching a plain "Overlord" query.
 *
 * Iter-25: extended with sequel/ordinal markers so the pipeline distinguishes
 * e.g. "Dragon Ball GT" from "Dragon Ball", "Code Geass R2" from "Code Geass",
 * "20th Century Boys" from "21st Century Boys", "Bastard 2nd Heaven" from
 * "Bastard!!", etc.
 */
const SPINOFF_QUALIFIERS = [
  /\bshin\b/i, /\bgaiden\b/i, /\bpart\s*\d/i,
  /\b4-?koma\b/i, /\bantho(logy)?\b/i, /\b\w+-bu!?\b/i,
  // Sequel / ordinal markers
  /\bgt\b/i, /\br2\b/i, /\bkai\b/i, /\bshippuu?den\b/i,
  /\b\d+(?:st|nd|rd|th)\b/i,          // 20th, 21st, 2nd, etc.
  /\bx\d{2,}\b/i,                     // x365 (Hidamari Sketch x365)
];

/**
 * Check if there is an edition or spinoff mismatch between query and candidate.
 * Bidirectional for EDITION_QUALIFIERS; candidate→query only for SPINOFF_QUALIFIERS.
 */
export function hasEditionMismatch(query: string, candidateTitle: string): boolean {
  for (const pattern of EDITION_QUALIFIERS) {
    if (pattern.test(query) && !pattern.test(candidateTitle)) return true;
    if (pattern.test(candidateTitle) && !pattern.test(query)) return true;
  }
  for (const pattern of SPINOFF_QUALIFIERS) {
    if (pattern.test(candidateTitle) && !pattern.test(query)) return true;
    if (pattern.test(query) && !pattern.test(candidateTitle)) return true;
  }
  return false;
}

/** Bigram Sørensen–Dice coefficient for fuzzy title similarity (0-1).
 *  Uses multiset intersection so repeated bigrams on either side are only matched
 *  once each. The previous Set-based implementation allowed candidates with
 *  repeating bigrams to score >1 (e.g. "dandadan" vs "dadadadan" scored 1.33,
 *  beating the real "Dandadan" exact match). */
export function diceCoefficient(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return 0;

  const bigramsA = new Map<string, number>();
  for (let i = 0; i < a.length - 1; i++) {
    const bg = a.slice(i, i + 2);
    bigramsA.set(bg, (bigramsA.get(bg) ?? 0) + 1);
  }

  let intersection = 0;
  for (let i = 0; i < b.length - 1; i++) {
    const bg = b.slice(i, i + 2);
    const count = bigramsA.get(bg);
    if (count !== undefined && count > 0) {
      intersection++;
      bigramsA.set(bg, count - 1);
    }
  }

  return (2 * intersection) / ((a.length - 1) + (b.length - 1));
}
