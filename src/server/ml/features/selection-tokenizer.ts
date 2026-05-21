/**
 * Selection Tokenizer - Converts user selections to word-level tokens
 *
 * This post-processor takes user text selections and generates accurate
 * word-level tokens with BIO labels for ML training.
 */

import type { BIOTag, EntityType } from './bio-types';

// ============================================================================
// Types
// ============================================================================

export interface TextSelection {
  id: string;
  text: string;
  label: EntityType;
  xpath: string;
  charStart: number;
  charEnd: number;
  imageSrc?: string;
  imageAlt?: string;
  isImage?: boolean;
  createdAt: number;
}

export interface WordToken {
  id: string;
  text: string;
  normalizedText: string;
  xpath: string;
  charStart: number;
  charEnd: number;
  wordIndex: number;
  type: 'word' | 'number' | 'cjk' | 'punctuation' | 'mixed' | 'image';
  label: BIOTag;
  selectionId: string;
}

export interface TokenizationResult {
  tokens: WordToken[];
  labels: BIOTag[];
  stats: TokenizationStats;
}

interface TokenizationStats {
  totalSelections: number;
  totalTokens: number;
  tokensByType: Record<string, number>;
  tokensByLabel: Record<string, number>;
}

// ============================================================================
// Constants
// ============================================================================

const CJK_RANGES: ReadonlyArray<readonly [number, number]> = [
  [0x3000, 0x303f], // CJK Punctuation
  [0x3040, 0x309f], // Hiragana
  [0x30a0, 0x30ff], // Katakana
  [0x4e00, 0x9fff], // CJK Unified Ideographs
  [0xac00, 0xd7af], // Hangul
];

// ============================================================================
// Main Tokenization Function
// ============================================================================

export function tokenizeSelections(selections: TextSelection[]): TokenizationResult {
  const allTokens: WordToken[] = [];

  for (const selection of selections) {
    const tokens = tokenizeSelection(selection);
    allTokens.push(...tokens);
  }

  const stats = calculateStats(selections.length, allTokens);

  return { tokens: allTokens, labels: allTokens.map((t) => t.label), stats };
}

function calculateStats(selectionCount: number, tokens: WordToken[]): TokenizationStats {
  const stats: TokenizationStats = {
    totalSelections: selectionCount,
    totalTokens: tokens.length,
    tokensByType: {},
    tokensByLabel: {},
  };

  for (const token of tokens) {
    stats.tokensByType[token.type] = (stats.tokensByType[token.type] ?? 0) + 1;
    stats.tokensByLabel[token.label] = (stats.tokensByLabel[token.label] ?? 0) + 1;
  }

  return stats;
}

// ============================================================================
// Selection Tokenization
// ============================================================================

function tokenizeSelection(selection: TextSelection): WordToken[] {
  if (selection.isImage) {
    return [createImageToken(selection)];
  }

  const tokens = extractWordTokens(selection);
  applyBIOLabels(tokens, selection.label);
  return tokens;
}

function extractWordTokens(selection: TextSelection): WordToken[] {
  const text = selection.text;
  const tokens: WordToken[] = [];
  let wordIndex = 0;
  let i = 0;

  while (i < text.length) {
    const result = processCharacter(text, i, selection, wordIndex);
    if (result.token) {
      tokens.push(result.token);
      wordIndex++;
    }
    i = result.nextIndex;
  }

  return tokens;
}

interface ProcessResult {
  token: WordToken | null;
  nextIndex: number;
}

function processCharacter(
  text: string,
  i: number,
  selection: TextSelection,
  wordIndex: number
): ProcessResult {
  const char = text[i];
  if (!char) return { token: null, nextIndex: i + 1 };

  const code = char.charCodeAt(0);

  // Skip whitespace
  if (isWhitespace(char)) {
    return { token: null, nextIndex: i + 1 };
  }

  // CJK character - single token
  if (isCJK(code)) {
    const token = createWordToken(
      selection, char, selection.charStart + i, selection.charStart + i + 1, wordIndex, 'cjk'
    );
    return { token, nextIndex: i + 1 };
  }

  // Alphanumeric - collect sequence
  if (isAlphaNumeric(char, code)) {
    return collectAlphanumericSequence(text, i, selection, wordIndex);
  }

  // Punctuation - skip
  return { token: null, nextIndex: i + 1 };
}

function collectAlphanumericSequence(
  text: string,
  start: number,
  selection: TextSelection,
  wordIndex: number
): ProcessResult {
  let end = start;
  while (end < text.length) {
    const char = text[end];
    if (!char) break;
    if (!isAlphaNumeric(char, char.charCodeAt(0))) break;
    end++;
  }

  const word = text.substring(start, end);
  const type = classifyWord(word);
  const token = createWordToken(
    selection, word, selection.charStart + start, selection.charStart + end, wordIndex, type
  );

  return { token, nextIndex: end };
}

// ============================================================================
// Token Creation
// ============================================================================

// eslint-disable-next-line max-params -- Word token creation requires selection, text, position, and type
function createWordToken(
  selection: TextSelection,
  text: string,
  charStart: number,
  charEnd: number,
  wordIndex: number,
  type: WordToken['type']
): WordToken {
  return {
    id: `${selection.id}_w${wordIndex}`,
    text,
    normalizedText: text.toLowerCase(),
    xpath: selection.xpath,
    charStart,
    charEnd,
    wordIndex,
    type,
    label: 'O',
    selectionId: selection.id,
  };
}

function createImageToken(selection: TextSelection): WordToken {
  const displayText = selection.imageAlt ? `[IMAGE: ${selection.imageAlt}]` : '[IMAGE]';

  return {
    id: `${selection.id}_img`,
    text: displayText,
    normalizedText: displayText.toLowerCase(),
    xpath: selection.xpath,
    charStart: selection.charStart,
    charEnd: selection.charEnd,
    wordIndex: 0,
    type: 'image',
    label: `B-${selection.label}` as BIOTag,
    selectionId: selection.id,
  };
}

// ============================================================================
// BIO Labels
// ============================================================================

function applyBIOLabels(tokens: WordToken[], entityType: EntityType): void {
  if (tokens.length === 0) return;

  const firstToken = tokens[0];
  if (firstToken) {
    firstToken.label = `B-${entityType}` as BIOTag;
  }

  for (let i = 1; i < tokens.length; i++) {
    const token = tokens[i];
    if (token) {
      token.label = `I-${entityType}` as BIOTag;
    }
  }
}

// ============================================================================
// Character Classification
// ============================================================================

function isWhitespace(char: string): boolean {
  return /\s/.test(char);
}

function isCJK(code: number): boolean {
  return CJK_RANGES.some(([start, end]) => code >= start && code <= end);
}

function isAlphaNumeric(char: string, code: number): boolean {
  if (/[a-zA-Z0-9]/.test(char)) return true;
  if (code >= 0x00c0 && code <= 0x024f) return true;
  return false;
}

function classifyWord(word: string): 'word' | 'number' | 'mixed' {
  if (/^\d+$/.test(word)) return 'number';
  if (/\d/.test(word) && /[a-zA-Z]/.test(word)) return 'mixed';
  if (/^\d/.test(word) || /\d$/.test(word)) return 'number';
  return 'word';
}

// ============================================================================
// Training Data Export
// ============================================================================

export function selectionsToTrainingData(
  selections: TextSelection[],
  pageTokens: Array<{ id: string; text: string; xpath: string }>
): { tokens: string[]; labels: BIOTag[] } {
  const { tokens: selectionTokens } = tokenizeSelections(selections);

  const labels: BIOTag[] = pageTokens.map((pageToken) => {
    const matchingLabel = findMatchingLabel(pageToken, selectionTokens);
    return matchingLabel ?? 'O';
  });

  return { tokens: pageTokens.map((t) => t.text), labels };
}

function findMatchingLabel(
  pageToken: { xpath: string; text: string },
  selectionTokens: WordToken[]
): BIOTag | null {
  for (const selToken of selectionTokens) {
    if (selToken.xpath !== pageToken.xpath) continue;
    if (pageToken.text.toLowerCase().includes(selToken.text.toLowerCase())) {
      return selToken.label;
    }
  }
  return null;
}

export function generateTrainingTokens(
  _htmlSnapshot: string,
  selections: TextSelection[]
): TokenizationResult {
  return tokenizeSelections(selections);
}

// ============================================================================
// Bootstrap Integration - Convert spans to selections
// ============================================================================

interface BootstrapSpan {
  start: number;
  end: number;
  entityType: EntityType;
  confidence: number;
}

interface BootstrapToken {
  id: string;
  text: string;
  xpath: string;
  charOffset: number;
  textLength: number;
  isImage?: boolean;
  imageSrc?: string | null;
  imageAlt?: string | null;
}

/**
 * Convert bootstrap labeler spans to TextSelections
 * This bridges the existing auto-labeler with the new selection-based system
 */
export function bootstrapSpansToSelections(
  spans: BootstrapSpan[],
  tokens: BootstrapToken[]
): TextSelection[] {
  const selections: TextSelection[] = [];
  const now = Date.now();

  for (const span of spans) {
    const selection = spanToSelection(span, tokens, now);
    if (selection) {
      selections.push(selection);
    }
  }

  return selections;
}

function spanToSelection(
  span: BootstrapSpan,
  tokens: BootstrapToken[],
  timestamp: number
): TextSelection | null {
  const spanTokens = tokens.slice(span.start, span.end + 1);
  if (spanTokens.length === 0) return null;

  const firstToken = spanTokens[0];
  const lastToken = spanTokens[spanTokens.length - 1];
  if (!firstToken || !lastToken) return null;

  // Combine text from all tokens in span
  const text = spanTokens.map((t) => t.text).join(' ');

  // Check if this is an image selection
  const isImage = firstToken.isImage === true;

  const selection: TextSelection = {
    id: `bootstrap_${span.entityType}_${span.start}_${span.end}`,
    text,
    label: span.entityType,
    xpath: firstToken.xpath,
    charStart: firstToken.charOffset,
    charEnd: lastToken.charOffset + lastToken.textLength,
    createdAt: timestamp,
  };

  // Only add image fields if this is an image
  if (isImage) {
    selection.isImage = true;
    if (firstToken.imageSrc) selection.imageSrc = firstToken.imageSrc;
    if (firstToken.imageAlt) selection.imageAlt = firstToken.imageAlt;
  }

  return selection;
}

/**
 * Auto-label a page using the bootstrap labeler and convert to selections
 */
export async function autoLabelPage(
  html: string,
  url: string
): Promise<{ selections: TextSelection[]; confidence: number }> {
  // Dynamic import to avoid circular dependencies
  const { bootstrapLabels } = await import('@/server/ml/training/bootstrap-labeler');

  const result = await bootstrapLabels(html, url);

  const selections = bootstrapSpansToSelections(
    result.spans as BootstrapSpan[],
    result.tokens as BootstrapToken[]
  );

  return {
    selections,
    confidence: result.confidence,
  };
}
