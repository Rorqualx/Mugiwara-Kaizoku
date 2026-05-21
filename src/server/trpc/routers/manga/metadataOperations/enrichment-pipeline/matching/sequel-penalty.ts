/**
 * Token-level penalties applied on top of Dice scoring in pickBestTitleMatch.
 *
 * These use a space-preserving tokenisation (separate from the pipeline's
 * utils.normalizeTitle, which strips whitespace for bigram Dice).
 */

import { stripTitlePatterns } from './title-normalization';

const SEQUEL_WORD_MARKERS: ReadonlySet<string> = new Set([
  'ii', 'iii', 'iv', 'v', 'vi', 'vii', 'viii', 'ix', 'x',
  'gt', 'r2', 'kai', 'gaiden', 'shippuuden', 'shippuden', 'final', 'zero', 'plus',
]);

const SEQUEL_ORDINAL_REGEX = /^(?:\d+(?:st|nd|rd|th)?|r|z)$/i;

function isSequelToken(word: string): boolean {
  if (SEQUEL_WORD_MARKERS.has(word.toLowerCase())) return true;
  return SEQUEL_ORDINAL_REGEX.test(word);
}

/**
 * Space-preserving tokenisation for overlap checks. Keeps words as units so
 * `applySingleTokenGuard` can count word intersections.
 *
 * Distinct from pipeline/utils.normalizeTitle which strips whitespace down to
 * a single compact string for bigram Sørensen-Dice.
 */
function tokenize(title: string): string[] {
  return stripTitlePatterns(title)
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter((w) => w.length > 0);
}

/**
 * Penalise a confidence score when the library title and the best-matching
 * candidate title disagree on a sequel/variant marker.
 *
 * Examples that should fire (−0.35):
 *   "Dragon Ball GT" vs "Dragon Ball"          — library has "gt"
 *   "20th Century Boys" vs "21st Century Boys" — mismatched ordinals
 *   "Code Geass R2" vs "Code Geass"            — library has "r2"
 *
 * Examples that must NOT fire:
 *   "Bleach" vs "Bleach Short Story Edition"   — "short/story/edition" not ordinals
 *   "Naruto" vs "NARUTO"                       — identical after normalisation
 */
export function applySequelPenalty(
  confidence: number,
  libraryTitle: string,
  bestMatchTitle: string,
): number {
  const libTokens = tokenize(libraryTitle);
  const matchTokens = tokenize(bestMatchTitle);
  const libSet = new Set(libTokens);
  const matchSet = new Set(matchTokens);
  const libExtras = libTokens.filter((w) => !matchSet.has(w));
  const matchExtras = matchTokens.filter((w) => !libSet.has(w));
  const eitherSequel = libExtras.some(isSequelToken) || matchExtras.some(isSequelToken);
  return eitherSequel ? confidence - 0.35 : confidence;
}

/**
 * Downweight candidates where the library title has ≥2 tokens but only one
 * overlaps with the best-matching candidate title (and the candidate has ≥3
 * tokens). Prevents a single common word from driving a high-confidence
 * false match — e.g. "Twisted Visions" matching a candidate whose synonyms
 * contain "Twisted" alone.
 */
export function applySingleTokenGuard(
  confidence: number,
  libraryTitle: string,
  bestMatchTitle: string,
): number {
  const libTokens = tokenize(libraryTitle);
  const matchTokens = tokenize(bestMatchTitle);
  if (libTokens.length < 2) return confidence;
  const matchSet = new Set(matchTokens);
  const overlap = libTokens.filter((t) => matchSet.has(t)).length;
  if (overlap <= 1 && matchTokens.length >= 3) {
    return confidence - 0.25;
  }
  return confidence;
}
