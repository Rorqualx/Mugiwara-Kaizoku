/**
 * Auto-Propagation Helpers
 *
 * Functions for expanding token selection and finding matching sequences
 * to automatically label similar text throughout a document.
 */

import type { DisplayToken } from '../types';

/**
 * Checks if a token looks like it could be part of a name (capitalized word, not punctuation)
 */
export function looksLikeName(text: string): boolean {
  if (!text || text.length === 0) return false;
  // Must start with uppercase letter
  if (!/^[A-Z]/.test(text)) return false;
  // Should be primarily letters (allow some punctuation like hyphens)
  if (!/^[A-Za-z][A-Za-z'-]*$/.test(text)) return false;
  // Should be reasonable length for a name
  if (text.length < 2 || text.length > 20) return false;
  return true;
}

/**
 * Expands token selection to include adjacent unlabeled tokens that look like names.
 * This handles cases like "Eiichiro Oda" where Oda is a link but Eiichiro is plain text.
 */
export function expandToAdjacentNames(
  tokens: DisplayToken[],
  selectedIndices: number[]
): number[] {
  if (selectedIndices.length === 0) return selectedIndices;

  const sortedIndices = [...selectedIndices].sort((a, b) => a - b);
  const firstIdx = sortedIndices[0] ?? 0;
  const lastIdx = sortedIndices[sortedIndices.length - 1] ?? 0;

  // Check if selected tokens look like names
  const selectedLooksLikeName = sortedIndices.some((i) => {
    const token = tokens[i];
    return token && looksLikeName(token.text);
  });

  // Only expand if we're dealing with name-like tokens
  if (!selectedLooksLikeName) return sortedIndices;

  const expanded: number[] = [...sortedIndices];

  // Look backward for adjacent name tokens
  let prevIdx = firstIdx - 1;
  while (prevIdx >= 0) {
    const prevToken = tokens[prevIdx];
    if (!prevToken) break;
    // Stop if already labeled
    if (prevToken.label !== 'O') break;
    // Stop if not a name-like token
    if (!looksLikeName(prevToken.text)) break;
    // Include this token
    expanded.unshift(prevIdx);
    prevIdx--;
  }

  // Look forward for adjacent name tokens
  let nextIdx = lastIdx + 1;
  while (nextIdx < tokens.length) {
    const nextToken = tokens[nextIdx];
    if (!nextToken) break;
    // Stop if already labeled
    if (nextToken.label !== 'O') break;
    // Stop if not a name-like token
    if (!looksLikeName(nextToken.text)) break;
    // Include this token
    expanded.push(nextIdx);
    nextIdx++;
  }

  return expanded.sort((a, b) => a - b);
}

/**
 * Finds all occurrences of a token sequence in the document.
 * Used for auto-labeling: when user labels "One Piece", find all other "One Piece" occurrences.
 */
export function findMatchingSequences(
  tokens: DisplayToken[],
  selectedIndices: number[]
): number[][] {
  if (selectedIndices.length === 0) return [];

  // Get the text sequence of selected tokens
  const sortedIndices = [...selectedIndices].sort((a, b) => a - b);
  const selectedTexts = sortedIndices.map((i) => tokens[i]?.text.toLowerCase().trim() ?? '');

  // Skip if any token text is empty
  if (selectedTexts.some((t) => !t)) return [];

  const matches: number[][] = [];

  // Scan through all tokens to find matching sequences
  for (let startIdx = 0; startIdx < tokens.length; startIdx++) {
    // Skip if this is part of the original selection
    if (sortedIndices.includes(startIdx)) continue;

    // Check if sequence starting here matches
    let isMatch = true;
    const matchIndices: number[] = [];

    for (let offset = 0; offset < selectedTexts.length; offset++) {
      const tokenIdx = startIdx + offset;
      if (tokenIdx >= tokens.length) {
        isMatch = false;
        break;
      }

      const token = tokens[tokenIdx];
      if (!token || token.text.toLowerCase().trim() !== selectedTexts[offset]) {
        isMatch = false;
        break;
      }

      // Skip if this token is already labeled (don't overwrite existing labels)
      if (token.label !== 'O') {
        isMatch = false;
        break;
      }

      matchIndices.push(tokenIdx);
    }

    if (isMatch && matchIndices.length === selectedTexts.length) {
      matches.push(matchIndices);
    }
  }

  return matches;
}
