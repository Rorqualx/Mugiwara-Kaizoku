/**
 * Compute Labels from Selections
 *
 * Derives BIO labels for tokens from user text selections.
 * This is the bridge between selection-based UI and token-based display.
 */

import { useCallback, useEffect, useRef } from 'react';

import type { BIOTag, EntityType } from '@/server/ml/features/bio-types';

import type { DisplayToken, TextSelection } from '../types';

// ============================================================================
// Types
// ============================================================================

/**
 * Minimal token info needed for matching
 */
interface TokenInfo {
  index: number;
  text: string;
  xpath: string | null;
  label?: BIOTag;
}

/**
 * Selection match result
 */
interface SelectionMatch {
  tokenIndex: number;
  label: BIOTag;
  selectionId: string;
}

// ============================================================================
// Main Computation Function
// ============================================================================

/**
 * Computes BIO labels for tokens based on selections
 *
 * Algorithm:
 * 1. PRESERVE existing token labels as baseline (don't reset to 'O')
 * 2. For each selection, find tokens that match by xpath + text overlap
 * 3. Apply B-ENTITY for first token, I-ENTITY for rest (only for matched tokens)
 * 4. Unmatched tokens keep their existing labels (preserves direct brush labels)
 */
export function computeLabelsFromSelections(
  selections: TextSelection[],
  tokens: TokenInfo[]
): BIOTag[] {
  // CRITICAL: Preserve existing labels instead of resetting all to 'O'
  // This ensures direct token labeling (brush mode) is not wiped out
  const labels: BIOTag[] = tokens.map((t) => t.label ?? 'O');

  if (selections.length === 0) return labels;

  // Find matches for each selection
  const matches = findAllMatches(selections, tokens);

  // Apply labels from matches (only these tokens get updated)
  for (const match of matches) {
    if (match.tokenIndex >= 0 && match.tokenIndex < labels.length) {
      labels[match.tokenIndex] = match.label;
    }
  }

  return labels;
}

/**
 * Find all token matches for all selections
 */
function findAllMatches(selections: TextSelection[], tokens: TokenInfo[]): SelectionMatch[] {
  const matches: SelectionMatch[] = [];

  for (const selection of selections) {
    const selectionMatches = findMatchesForSelection(selection, tokens);
    matches.push(...selectionMatches);
  }

  return matches;
}

/**
 * Find tokens that match a single selection
 */
function findMatchesForSelection(
  selection: TextSelection,
  tokens: TokenInfo[]
): SelectionMatch[] {
  // Handle image selections
  if (selection.isImage) {
    const imageMatch = findImageMatch(selection, tokens);
    return imageMatch ? [imageMatch] : [];
  }

  // Find tokens with matching xpath
  const candidateTokens = tokens.filter((t) => t.xpath === selection.xpath);

  if (candidateTokens.length === 0) {
    // Try fuzzy xpath matching (partial path)
    return findFuzzyXPathMatches(selection, tokens);
  }

  // Find tokens whose text appears in the selection
  return findTextMatches(selection, candidateTokens);
}

/**
 * Find image token match
 */
function findImageMatch(selection: TextSelection, tokens: TokenInfo[]): SelectionMatch | null {
  // Find token with matching imageSrc or alt text
  for (const token of tokens) {
    if (token.xpath === selection.xpath) {
      return {
        tokenIndex: token.index,
        label: `B-${selection.label}` as BIOTag,
        selectionId: selection.id,
      };
    }
  }
  return null;
}

/**
 * Find text matches within an xpath's tokens
 */
function findTextMatches(
  selection: TextSelection,
  candidateTokens: TokenInfo[]
): SelectionMatch[] {
  const selectionTextLower = selection.text.toLowerCase();
  const selectionWords = extractWords(selectionTextLower);

  if (selectionWords.length === 0) return [];

  // Find sequence of tokens that match selection words
  const matchedTokens = findMatchingTokenSequence(candidateTokens, selectionWords);

  // Convert matched indices to SelectionMatch objects
  return matchedTokens.map((tokenIdx, i) => ({
    tokenIndex: tokenIdx,
    label: (i === 0 ? `B-${selection.label}` : `I-${selection.label}`) as BIOTag,
    selectionId: selection.id,
  }));
}

/**
 * Find a sequence of tokens matching the selection words
 */
function findMatchingTokenSequence(
  candidateTokens: TokenInfo[],
  selectionWords: string[]
): number[] {
  let wordIndex = 0;
  const matchedTokens: number[] = [];

  for (const token of candidateTokens) {
    const tokenTextLower = token.text.toLowerCase().trim();
    const currentWord = selectionWords[wordIndex];

    if (currentWord && tokenTextLower === currentWord) {
      matchedTokens.push(token.index);
      wordIndex++;
      if (wordIndex === selectionWords.length) break;
    } else if (wordIndex > 0) {
      // Reset and check if current token starts new match
      const resetResult = resetAndCheckNewMatch(token, selectionWords);
      wordIndex = resetResult.wordIndex;
      matchedTokens.length = 0;
      if (resetResult.matched) {
        matchedTokens.push(token.index);
      }
    }
  }

  return matchedTokens;
}

/**
 * Reset sequence matching and check if token starts new match
 */
function resetAndCheckNewMatch(
  token: TokenInfo,
  selectionWords: string[]
): { wordIndex: number; matched: boolean } {
  const tokenTextLower = token.text.toLowerCase().trim();
  const firstWord = selectionWords[0];

  if (firstWord && tokenTextLower === firstWord) {
    return { wordIndex: 1, matched: true };
  }
  return { wordIndex: 0, matched: false };
}

/**
 * Find matches using fuzzy xpath matching (for when exact xpath doesn't match)
 */
function findFuzzyXPathMatches(
  selection: TextSelection,
  tokens: TokenInfo[]
): SelectionMatch[] {
  const selectionWords = extractWords(selection.text.toLowerCase());

  if (selectionWords.length === 0) return [];

  // Try to find tokens with matching text sequence anywhere
  for (let startIdx = 0; startIdx < tokens.length; startIdx++) {
    const sequence = tryMatchSequence(tokens, startIdx, selectionWords);

    if (sequence.length === selectionWords.length) {
      return createMatchesFromSequence(sequence, selection);
    }
  }

  return [];
}

/**
 * Create SelectionMatch objects from a matched token sequence
 */
function createMatchesFromSequence(
  sequence: number[],
  selection: TextSelection
): SelectionMatch[] {
  return sequence.map((tokenIdx, i) => ({
    tokenIndex: tokenIdx,
    label: (i === 0 ? `B-${selection.label}` : `I-${selection.label}`) as BIOTag,
    selectionId: selection.id,
  }));
}

/**
 * Try to match a sequence of tokens starting at given index
 */
function tryMatchSequence(
  tokens: TokenInfo[],
  startIdx: number,
  selectionWords: string[]
): number[] {
  const matched: number[] = [];

  for (let i = 0; i < selectionWords.length; i++) {
    const tokenIdx = startIdx + i;
    if (tokenIdx >= tokens.length) return [];

    const token = tokens[tokenIdx];
    const word = selectionWords[i];
    if (!token || !word) return [];

    if (token.text.toLowerCase().trim() !== word) {
      return [];
    }

    matched.push(tokenIdx);
  }

  return matched;
}

/**
 * Extract words from text (lowercase, no punctuation)
 */
function extractWords(text: string): string[] {
  return text
    .split(/\s+/)
    .map((w) => w.replace(/[^\w\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff]/g, '').toLowerCase())
    .filter((w) => w.length > 0);
}

// ============================================================================
// React Hook
// ============================================================================

/**
 * Hook that computes token labels from selections and updates tokens state
 */
export function useComputeLabelsFromSelections(
  selections: TextSelection[],
  tokens: DisplayToken[],
  setTokens: React.Dispatch<React.SetStateAction<DisplayToken[]>>
): void {
  // Track previous selections to avoid unnecessary updates
  const prevSelectionsRef = useRef<string>('');

  const computeAndApply = useCallback(() => {
    if (tokens.length === 0) return;

    // CRITICAL: Include existing label in tokenInfos to preserve direct labels
    const tokenInfos: TokenInfo[] = tokens.map((t) => ({
      index: t.index,
      text: t.text,
      xpath: t.xpath,
      label: t.label, // Preserve existing label for non-selection tokens
    }));

    const computedLabels = computeLabelsFromSelections(selections, tokenInfos);

    setTokens((prev) =>
      prev.map((token, idx) => {
        const newLabel = computedLabels[idx] ?? token.label;
        return token.label === newLabel ? token : { ...token, label: newLabel };
      })
    );
  }, [selections, tokens, setTokens]);

  useEffect(() => {
    const selectionsKey = JSON.stringify(
      selections.map((s) => ({ id: s.id, label: s.label, text: s.text }))
    );

    if (selectionsKey !== prevSelectionsRef.current) {
      prevSelectionsRef.current = selectionsKey;
      computeAndApply();
    }
  }, [selections, computeAndApply]);
}

// ============================================================================
// Utility: Compute Entity Counts from Selections
// ============================================================================

/**
 * Compute entity counts from selections for stats display
 */
export function computeEntityCountsFromSelections(
  selections: TextSelection[]
): Record<EntityType, number> {
  const counts: Record<string, number> = {};

  for (const selection of selections) {
    counts[selection.label] = (counts[selection.label] ?? 0) + 1;
  }

  return counts as Record<EntityType, number>;
}
