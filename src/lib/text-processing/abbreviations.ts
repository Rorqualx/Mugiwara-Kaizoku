/**
 * Unified Abbreviations for Sentence Boundary Detection
 *
 * This module provides a single source of truth for abbreviations used in
 * sentence boundary detection across both client and server. This ensures
 * consistent training data extraction.
 *
 * @module lib/text-processing/abbreviations
 */

/**
 * Unified abbreviations list combining client and server needs.
 *
 * Categories:
 * - Titles & Honorifics: dr, mr, mrs, ms, prof, rev, hon
 * - Military/Political: gen, col, lt, sgt, gov, pres, sen, rep
 * - Business: inc, ltd, corp
 * - Publication: vol, ch, pt, no, fig
 * - Common: vs, etc, eg, ie
 * - Suffixes: jr, sr, st
 * - Months: jan, feb, mar, apr, jun, jul, aug, sep, oct, nov, dec
 *
 * Note: May is excluded as it's a common word
 */
export const ABBREVIATIONS_UNIFIED = new Set([
  // === Titles & Honorifics ===
  'dr', // Doctor
  'mr', // Mister
  'mrs', // Missus
  'ms', // Miss/Ms
  'prof', // Professor
  'rev', // Reverend
  'hon', // Honorable

  // === Military & Political ===
  'gen', // General
  'col', // Colonel
  'lt', // Lieutenant
  'sgt', // Sergeant
  'gov', // Governor
  'pres', // President
  'sen', // Senator
  'rep', // Representative

  // === Business ===
  'inc', // Incorporated
  'ltd', // Limited
  'corp', // Corporation

  // === Publication & Numbering ===
  'vol', // Volume
  'ch', // Chapter
  'pt', // Part
  'no', // Number
  'fig', // Figure

  // === Common Abbreviations ===
  'vs', // Versus
  'etc', // Et cetera
  'eg', // Exempli gratia (for example)
  'ie', // Id est (that is)

  // === Suffixes ===
  'jr', // Junior
  'sr', // Senior
  'st', // Saint/Street

  // === Months (not May - it's a common word) ===
  'jan',
  'feb',
  'mar',
  'apr',
  'jun',
  'jul',
  'aug',
  'sep',
  'oct',
  'nov',
  'dec',
]);

/**
 * Array version for backward compatibility with client code.
 * Sorted alphabetically for consistent iteration.
 */
export const ABBREVIATIONS = Array.from(ABBREVIATIONS_UNIFIED).sort();

/**
 * Check if a word is a known abbreviation (case-insensitive).
 *
 * @param word - The word to check (without trailing punctuation)
 * @returns True if the word is a known abbreviation
 */
export function isKnownAbbreviation(word: string): boolean {
  return ABBREVIATIONS_UNIFIED.has(word.toLowerCase());
}
