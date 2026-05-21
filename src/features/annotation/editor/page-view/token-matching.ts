/**
 * Token Matching Utilities for PageView
 *
 * Handles matching clicked text/words to token indices
 */

// ============================================================================
// Types
// ============================================================================

export interface DisplayTokenMinimal {
  index: number;
  text: string;
  isImage?: boolean;
  imageSrc?: string | null;
  imageAlt?: string | null;
}

// ============================================================================
// Text Matching
// ============================================================================

/**
 * Strict text matching to avoid false positives like "action" matching "as"
 */
export function isStrictTextMatch(clickedWord: string, tokenText: string): boolean {
  if (tokenText === clickedWord) return true;
  if (tokenText.includes(clickedWord)) return true;

  if (clickedWord.includes(tokenText)) {
    if (tokenText.length < 3) return false;
    const lengthRatio = tokenText.length / clickedWord.length;
    if (lengthRatio >= 0.7) return true;
    const wordBoundaryRegex = new RegExp(`\\b${escapeRegex(tokenText)}\\b`, 'i');
    if (wordBoundaryRegex.test(clickedWord)) return true;
    return false;
  }

  return false;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ============================================================================
// Token Filtering
// ============================================================================

export function filterTokensByClickedWord(
  tokenIndices: number[],
  clickedWord: string,
  allTokens: DisplayTokenMinimal[]
): number[] {
  const lowerWord = clickedWord.toLowerCase().trim();
  if (!lowerWord) return [];

  // PRIORITY 1: Look for EXACT match tokens first
  const exactMatches = tokenIndices.filter((idx) => {
    const token = allTokens.find((t) => t.index === idx);
    if (!token) return false;
    return token.text.toLowerCase().trim() === lowerWord;
  });
  if (exactMatches.length > 0) return exactMatches;

  // PRIORITY 2: For numbers, PREFER tokens containing ONLY this number
  const isNumeric = /^\d+$/.test(lowerWord);
  if (isNumeric) {
    const singleNumberMatches = tokenIndices.filter((idx) => {
      const token = allTokens.find((t) => t.index === idx);
      if (!token) return false;
      const tokenText = token.text.trim();
      const hasMultipleNumbers = (tokenText.match(/\d+/g) ?? []).length > 1;
      if (hasMultipleNumbers) return false;
      return tokenText.includes(lowerWord);
    });
    if (singleNumberMatches.length > 0) return singleNumberMatches;

    // Fall back to any token containing this number (including compound)
    const anyNumberMatches = tokenIndices.filter((idx) => {
      const token = allTokens.find((t) => t.index === idx);
      if (!token) return false;
      return token.text.includes(lowerWord);
    });
    if (anyNumberMatches.length > 0) return anyNumberMatches;
  }

  // PRIORITY 3: Containment matches (less strict)
  const matchingTokens = tokenIndices.filter((idx) => {
    const token = allTokens.find((t) => t.index === idx);
    if (!token) return false;
    return isStrictTextMatch(lowerWord, token.text.toLowerCase().trim());
  });
  if (matchingTokens.length > 0) return matchingTokens;

  // PRIORITY 4: Global search - ONLY if result is unique (single match)
  // Returning multiple global matches risks labeling wrong tokens
  const globalMatches = findTokensByText(clickedWord, allTokens);
  if (globalMatches.length === 1) {
    // Single global match is safe to use
    return globalMatches;
  }
  // Multiple global matches - ambiguous, don't use (could be wrong tokens)

  // STRICT: Only fall back to single-token elements from original parent
  if (tokenIndices.length === 1) return tokenIndices;
  return [];
}

export function filterTokensBySelectedText(
  tokenIndices: number[],
  selectedText: string,
  allTokens: DisplayTokenMinimal[]
): number[] {
  const lowerText = selectedText.toLowerCase().trim();

  const parentMatches = tokenIndices.filter((idx) => {
    const token = allTokens.find((t) => t.index === idx);
    if (!token) return false;
    return isStrictTextMatch(lowerText, token.text.toLowerCase().trim());
  });

  if (parentMatches.length > 0) return parentMatches;

  // Global fallback - ONLY use if unique (single match)
  // Multiple matches are ambiguous and could label wrong tokens
  const globalMatches = findTokensByText(selectedText, allTokens);
  if (globalMatches.length === 1) {
    return globalMatches;
  }

  return [];
}

export function filterTokensByCollectedWords(
  tokenIndices: number[],
  collectedWords: string[],
  allTokens: DisplayTokenMinimal[]
): number[] {
  const lowerWords = collectedWords.map((w) => w.toLowerCase().trim());

  return tokenIndices.filter((idx) => {
    const token = allTokens.find((t) => t.index === idx);
    if (!token) return false;
    const tokenText = token.text.toLowerCase().trim();
    return lowerWords.some((word) => isStrictTextMatch(word, tokenText));
  });
}

// ============================================================================
// Token Search
// ============================================================================

const CJK_CHAR_REGEX = /[\u3000-\u9fff\uac00-\ud7af]/;

function hasCJKCharacters(text: string): boolean {
  return CJK_CHAR_REGEX.test(text);
}

export function findTokensByText(clickedText: string, tokens: DisplayTokenMinimal[]): number[] {
  const lowerClicked = clickedText.toLowerCase().trim();
  const clickedHasCJK = hasCJKCharacters(lowerClicked);

  // PRIORITY 1: Exact match
  const exactMatches = tokens.filter((t) => t.text.toLowerCase().trim() === lowerClicked);
  if (exactMatches.length > 0) return exactMatches.map((t) => t.index);

  // PRIORITY 2: For numbers, prefer single-number tokens
  const isNumeric = /^\d+$/.test(lowerClicked);
  if (isNumeric) {
    const singleNumberMatches = tokens.filter((t) => {
      const tokenText = t.text.trim();
      const numbersInToken = tokenText.match(/\d+/g) ?? [];
      if (numbersInToken.length > 1) return false;
      return tokenText.includes(lowerClicked);
    });
    if (singleNumberMatches.length > 0) {
      singleNumberMatches.sort((a, b) => a.text.length - b.text.length);
      const firstMatch = singleNumberMatches[0];
      if (firstMatch) return [firstMatch.index];
    }

    // Fall back to any token containing this number
    const anyMatches = tokens.filter((t) => t.text.includes(lowerClicked));
    if (anyMatches.length > 0) {
      anyMatches.sort((a, b) => a.text.length - b.text.length);
      const firstMatch = anyMatches[0];
      if (firstMatch) return [firstMatch.index];
    }
  }

  // CJK handling
  if (clickedHasCJK) {
    return findCJKTokenMatches(lowerClicked, tokens);
  }

  // Word boundary matches
  const tokenContainsClickedMatches = tokens.filter((t) => {
    const tokenText = t.text.toLowerCase().trim();
    const escapedClicked = lowerClicked.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const wordBoundary = new RegExp(`\\b${escapedClicked}\\b`);
    if (isNumeric) {
      const numbersInToken = t.text.match(/\d+/g) ?? [];
      if (numbersInToken.length > 1) return false;
    }
    return wordBoundary.test(tokenText);
  });

  if (tokenContainsClickedMatches.length > 0) {
    tokenContainsClickedMatches.sort((a, b) => a.text.length - b.text.length);
    const firstMatch = tokenContainsClickedMatches[0];
    if (firstMatch) return [firstMatch.index];
  }

  // Strict containment matches
  const containedMatches = tokens.filter((t) => {
    const tokenText = t.text.toLowerCase().trim();
    if (isNumeric) {
      const numbersInToken = t.text.match(/\d+/g) ?? [];
      if (numbersInToken.length > 1) return false;
    }
    return isStrictTextMatch(lowerClicked, tokenText);
  });

  if (containedMatches.length > 0) {
    containedMatches.sort((a, b) => {
      const aDiff = Math.abs(a.text.length - lowerClicked.length);
      const bDiff = Math.abs(b.text.length - lowerClicked.length);
      return aDiff - bDiff;
    });
    const closest = containedMatches[0];
    if (closest && Math.abs(closest.text.length - lowerClicked.length) <= 2) {
      return [closest.index];
    }
    return containedMatches.map((t) => t.index);
  }

  return [];
}

function findCJKTokenMatches(clickedText: string, tokens: DisplayTokenMinimal[]): number[] {
  const matchedIndices: number[] = [];

  for (const token of tokens) {
    const tokenText = token.text.toLowerCase().trim();
    if (tokenText.length === 0) continue;

    if (clickedText.includes(tokenText) && tokenText.length > 0) {
      matchedIndices.push(token.index);
    } else if (tokenText.includes(clickedText)) {
      matchedIndices.push(token.index);
    }
  }

  return matchedIndices;
}

/**
 * Find tokens matching collected words as a SEQUENCE (not independently).
 * This prevents labeling ALL "chapters" on a page when user selects "1170 Chapters".
 *
 * Algorithm:
 * 1. For single words: find exact match (only first occurrence)
 * 2. For multi-word phrases: find consecutive tokens matching the sequence
 * 3. Returns only ONE occurrence to avoid over-labeling
 */
export function findTokensByCollectedWords(
  collectedWords: string[],
  allTokens: DisplayTokenMinimal[]
): number[] {
  if (collectedWords.length === 0) return [];

  const lowerWords = collectedWords.map((w) => w.toLowerCase().trim()).filter((w) => w.length > 0);
  if (lowerWords.length === 0) return [];

  // Single word: find first exact match only
  if (lowerWords.length === 1) {
    const word = lowerWords[0];
    if (!word) return [];
    const matches = findTokensByText(word, allTokens);
    // Return only first match to avoid over-labeling
    return matches.length > 0 ? [matches[0] as number] : [];
  }

  // Multi-word phrase: find SEQUENCE of tokens matching all words in order
  // This is the key fix - we match the SEQUENCE, not each word independently
  return findTokenSequence(lowerWords, allTokens);
}

/**
 * Find consecutive tokens that match a sequence of words.
 * Returns only the FIRST occurrence to prevent over-labeling.
 */
function findTokenSequence(
  words: string[],
  allTokens: DisplayTokenMinimal[]
): number[] {
  if (words.length === 0) return [];

  // Try to find a sequence of tokens matching all words in order
  for (let startIdx = 0; startIdx < allTokens.length; startIdx++) {
    const sequence = tryMatchWordSequence(allTokens, startIdx, words);
    if (sequence.length === words.length) {
      // Found a complete match - return only this one occurrence
      return sequence;
    }
  }

  return [];
}

/**
 * Try to match a sequence of words starting at a given token index.
 * Returns array of token indices if successful, empty array otherwise.
 */
function tryMatchWordSequence(
  tokens: DisplayTokenMinimal[],
  startIdx: number,
  words: string[]
): number[] {
  const matched: number[] = [];
  let tokenIdx = startIdx;
  let wordIdx = 0;

  while (wordIdx < words.length && tokenIdx < tokens.length) {
    const token = tokens[tokenIdx];
    const word = words[wordIdx];
    if (!token || !word) break;

    const tokenText = token.text.toLowerCase().trim();

    // Check if this token matches the current word
    if (tokenText === word || isStrictTextMatch(word, tokenText)) {
      matched.push(token.index);
      wordIdx++;
    } else if (matched.length > 0) {
      // We had partial match but this token doesn't continue the sequence
      // Reset and try from next position (handled by outer loop)
      return [];
    }
    // Skip non-matching tokens at the start (before first match)

    tokenIdx++;
  }

  // Return matched indices only if we matched ALL words
  return matched.length === words.length ? matched : [];
}

// ============================================================================
// Image Matching
// ============================================================================

export function findTokensByImage(
  imageSrc: string,
  imageAlt: string,
  tokens: DisplayTokenMinimal[]
): number[] {
  const imageTokens = tokens.filter((t) => t.isImage);

  if (imageSrc) {
    const srcFilename = extractFilename(imageSrc);
    const srcMatches = imageTokens.filter((t) => {
      if (!t.imageSrc) return false;
      const tokenFilename = extractFilename(t.imageSrc);
      return tokenFilename === srcFilename || t.imageSrc.includes(srcFilename) || imageSrc.includes(tokenFilename);
    });
    if (srcMatches.length > 0) return srcMatches.map((t) => t.index);
  }

  if (imageAlt) {
    const lowerAlt = imageAlt.toLowerCase();
    const altMatches = imageTokens.filter((t) => {
      if (!t.imageAlt) return false;
      return t.imageAlt.toLowerCase() === lowerAlt || t.imageAlt.toLowerCase().includes(lowerAlt);
    });
    if (altMatches.length > 0) return altMatches.map((t) => t.index);
  }

  if (imageTokens.length > 0 && imageTokens[0]) {
    return [imageTokens[0].index];
  }

  return [];
}

/**
 * Extract filename from URL, stripping query parameters and fragments
 * Handles both valid URLs and malformed URLs gracefully
 */
function extractFilename(url: string): string {
  try {
    const parsed = new URL(url, 'http://dummy');
    const pathname = parsed.pathname;
    const parts = pathname.split('/');
    const filename = parts[parts.length - 1] ?? '';

    // Strip query params that might be embedded in malformed URLs
    const cleanFilename = filename.split('?')[0]?.split('#')[0] ?? '';
    return cleanFilename;
  } catch {
    // Fallback for malformed URLs
    let cleanUrl = url;

    // Remove query string
    const queryIndex = cleanUrl.indexOf('?');
    if (queryIndex !== -1) {
      cleanUrl = cleanUrl.substring(0, queryIndex);
    }

    // Remove fragment
    const fragmentIndex = cleanUrl.indexOf('#');
    if (fragmentIndex !== -1) {
      cleanUrl = cleanUrl.substring(0, fragmentIndex);
    }

    const parts = cleanUrl.split('/');
    return parts[parts.length - 1] ?? '';
  }
}
