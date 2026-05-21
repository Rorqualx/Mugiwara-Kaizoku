/**
 * Selection Resolver - Multi-tier resolution algorithm for TextSelection anchors
 *
 * Resolves stored selections back to DOM elements/tokens using a fallback strategy:
 * 1. XPath + char offsets (primary - fastest, most reliable)
 * 2. Context match (prefix/suffix TextQuoteSelector)
 * 3. Global offset fallback
 * 4. Text search (slowest, least reliable)
 */

import type { RecoveryStrategy, TextSelection } from '../types';

// ============================================================================
// Types
// ============================================================================

export interface TokenInfo {
  index: number;
  text: string;
  xpath: string | null;
}

export interface ResolutionResult {
  success: boolean;
  strategy: RecoveryStrategy;
  tokenIndices: number[];
  warnings: string[];
  confidence: number;
}

export interface ResolutionContext {
  tokens: TokenInfo[];
  documentText?: string;
}

interface TierResult {
  success: boolean;
  tokenIndices: number[];
  confidence: number;
}

// ============================================================================
// Hash Generation (Client-side verification)
// ============================================================================

export async function generateTextHash(text: string): Promise<string | null> {
  // Check for crypto availability in both browser and Node environments
  const cryptoApi = typeof globalThis !== 'undefined' ? globalThis.crypto : undefined;
  if (!text || !cryptoApi?.subtle) {
    return null;
  }
  try {
    const data = new TextEncoder().encode(text);
    const hashBuffer = await cryptoApi.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  } catch {
    return null;
  }
}

export async function generateContextHash(
  prefix: string | undefined,
  text: string,
  suffix: string | undefined
): Promise<string | null> {
  const content = (prefix ?? '') + text + (suffix ?? '');
  return generateTextHash(content);
}

// ============================================================================
// Word Extraction & Matching Helpers
// ============================================================================

function extractWords(text: string): string[] {
  return text
    .toLowerCase()
    .split(/\s+/)
    .map((w) => w.replace(/[^\w]/g, ''))
    .filter((w) => w.length > 0);
}

function normalizeTokenText(text: string): string {
  return text.toLowerCase().replace(/[^\w]/g, '');
}

function tryMatchSequence(tokens: TokenInfo[], startIdx: number, words: string[]): TokenInfo[] {
  const matched: TokenInfo[] = [];
  let wordIdx = 0;

  for (let i = startIdx; i < tokens.length && wordIdx < words.length; i++) {
    const token = tokens[i];
    if (!token) continue;
    const tokenWord = normalizeTokenText(token.text);
    if (tokenWord === words[wordIdx]) {
      matched.push(token);
      wordIdx++;
    } else if (tokenWord.length > 0) {
      break;
    }
  }

  return matched;
}

function findWordSequenceInCandidates(candidates: TokenInfo[], text: string): number[] {
  const words = extractWords(text);
  if (words.length === 0) return [];

  const sorted = [...candidates].sort((a, b) => a.index - b.index);
  return matchWordsInSortedTokens(sorted, words);
}

function matchWordsInSortedTokens(sorted: TokenInfo[], words: string[]): number[] {
  const matched: number[] = [];
  let wordIdx = 0;

  for (const token of sorted) {
    const tokenWord = normalizeTokenText(token.text);
    const matchResult = processTokenMatch(tokenWord, words, wordIdx, matched, token.index);
    matched.length = 0;
    matched.push(...matchResult.matched);
    wordIdx = matchResult.wordIdx;
    if (wordIdx === words.length) break;
  }

  return matched.length === words.length ? matched : [];
}

function processTokenMatch(
  tokenWord: string,
  words: string[],
  wordIdx: number,
  currentMatched: number[],
  tokenIndex: number
): { matched: number[]; wordIdx: number } {
  const matched = [...currentMatched];

  if (tokenWord === words[wordIdx]) {
    matched.push(tokenIndex);
    return { matched, wordIdx: wordIdx + 1 };
  }

  if (tokenWord.length > 0 && matched.length > 0) {
    if (tokenWord === words[0]) {
      return { matched: [tokenIndex], wordIdx: 1 };
    }
    return { matched: [], wordIdx: 0 };
  }

  return { matched, wordIdx };
}

// ============================================================================
// Context Verification
// ============================================================================

function buildContextBefore(tokens: TokenInfo[], startIdx: number): string {
  const parts: string[] = [];
  let charCount = 0;
  for (let i = startIdx - 1; i >= 0 && charCount < 40; i--) {
    const tokenText = tokens[i]?.text;
    if (!tokenText) continue;
    parts.unshift(tokenText);
    charCount += tokenText.length + 1;
  }
  return parts.join(' ').slice(-32);
}

function buildContextAfter(tokens: TokenInfo[], endIdx: number): string {
  const parts: string[] = [];
  let charCount = 0;
  for (let i = endIdx; i < tokens.length && charCount < 40; i++) {
    const tokenText = tokens[i]?.text;
    if (!tokenText) continue;
    parts.push(tokenText);
    charCount += tokenText.length + 1;
  }
  return parts.join(' ').slice(0, 32);
}

function verifyContext(
  tokens: TokenInfo[],
  startIdx: number,
  length: number,
  prefix: string | undefined,
  suffix: string | undefined
): boolean {
  const beforeText = buildContextBefore(tokens, startIdx);
  const afterText = buildContextAfter(tokens, startIdx + length);

  const prefixMatch = !prefix || beforeText.includes(prefix.slice(-16));
  const suffixMatch = !suffix || afterText.includes(suffix.slice(0, 16));

  return prefixMatch && suffixMatch;
}

// ============================================================================
// Resolution Tiers
// ============================================================================

function resolveByXPath(selection: TextSelection, context: ResolutionContext): TierResult {
  const candidates = context.tokens.filter((t) => t.xpath === selection.xpath);
  if (candidates.length === 0) {
    return { success: false, tokenIndices: [], confidence: 0 };
  }

  const matchedIndices = findWordSequenceInCandidates(candidates, selection.text);
  if (matchedIndices.length > 0) {
    return { success: true, tokenIndices: matchedIndices, confidence: 0.95 };
  }

  return { success: false, tokenIndices: [], confidence: 0 };
}

function resolveByContext(selection: TextSelection, context: ResolutionContext): TierResult {
  const { prefix, suffix, text } = selection;
  if (!prefix && !suffix) {
    return { success: false, tokenIndices: [], confidence: 0 };
  }

  const selectionWords = extractWords(text);
  if (selectionWords.length === 0) {
    return { success: false, tokenIndices: [], confidence: 0 };
  }

  return searchWithContextVerification(context.tokens, selectionWords, prefix, suffix);
}

function searchWithContextVerification(
  tokens: TokenInfo[],
  words: string[],
  prefix: string | undefined,
  suffix: string | undefined
): TierResult {
  for (let startIdx = 0; startIdx < tokens.length; startIdx++) {
    const sequence = tryMatchSequence(tokens, startIdx, words);
    if (sequence.length !== words.length) continue;

    if (verifyContext(tokens, startIdx, sequence.length, prefix, suffix)) {
      return { success: true, tokenIndices: sequence.map((s) => s.index), confidence: 0.8 };
    }
  }
  return { success: false, tokenIndices: [], confidence: 0 };
}

function resolveByGlobalOffset(selection: TextSelection): TierResult {
  // Global offset requires document text verification - not implemented in this tier
  if (selection.globalCharStart === undefined) {
    return { success: false, tokenIndices: [], confidence: 0 };
  }
  return { success: false, tokenIndices: [], confidence: 0 };
}

function resolveByTextSearch(selection: TextSelection, context: ResolutionContext): TierResult {
  const selectionWords = extractWords(selection.text);
  if (selectionWords.length === 0) {
    return { success: false, tokenIndices: [], confidence: 0 };
  }

  for (let startIdx = 0; startIdx < context.tokens.length; startIdx++) {
    const sequence = tryMatchSequence(context.tokens, startIdx, selectionWords);
    if (sequence.length === selectionWords.length) {
      return { success: true, tokenIndices: sequence.map((s) => s.index), confidence: 0.5 };
    }
  }
  return { success: false, tokenIndices: [], confidence: 0 };
}

// ============================================================================
// Main Resolution Functions
// ============================================================================

export function resolveSelection(
  selection: TextSelection,
  context: ResolutionContext
): ResolutionResult {
  // Tier 1: XPath
  const xpathResult = resolveByXPath(selection, context);
  if (xpathResult.success) {
    return buildResult(xpathResult, 'xpath', []);
  }

  // Tier 2: Context match
  const contextResult = resolveByContext(selection, context);
  if (contextResult.success) {
    return buildResult(contextResult, 'context', ['XPath failed, used context match']);
  }

  // Tier 3: Global offset
  const globalResult = resolveByGlobalOffset(selection);
  if (globalResult.success) {
    return buildResult(globalResult, 'global', ['Used global offset fallback']);
  }

  // Tier 4: Text search
  const textResult = resolveByTextSearch(selection, context);
  if (textResult.success) {
    return buildResult(textResult, 'text-search', ['Text search fallback - verify manually']);
  }

  return buildResult({ success: false, tokenIndices: [], confidence: 0 }, 'manual', [
    'Selection could not be resolved',
  ]);
}

function buildResult(
  tier: TierResult,
  strategy: RecoveryStrategy,
  warnings: string[]
): ResolutionResult {
  return {
    success: tier.success,
    strategy,
    tokenIndices: tier.tokenIndices,
    warnings,
    confidence: tier.confidence,
  };
}

export function resolveSelections(
  selections: TextSelection[],
  context: ResolutionContext
): {
  results: Map<string, ResolutionResult>;
  summary: { total: number; resolved: number; averageConfidence: number };
} {
  const results = new Map<string, ResolutionResult>();
  let totalConfidence = 0;
  let resolved = 0;

  for (const selection of selections) {
    const result = resolveSelection(selection, context);
    results.set(selection.id, result);
    totalConfidence += result.confidence;
    if (result.success) resolved++;
  }

  return {
    results,
    summary: {
      total: selections.length,
      resolved,
      averageConfidence: selections.length > 0 ? totalConfidence / selections.length : 0,
    },
  };
}

// ============================================================================
// Health Status Helpers
// ============================================================================

export type SelectionHealth = 'healthy' | 'shifted' | 'stale' | 'broken';

export function getSelectionHealth(result: ResolutionResult): SelectionHealth {
  if (!result.success) return 'broken';
  if (result.strategy === 'xpath') return 'healthy';
  if (result.strategy === 'context') return 'shifted';
  return 'stale';
}

export function getHealthColor(health: SelectionHealth): string {
  const colors: Record<SelectionHealth, string> = {
    healthy: 'green',
    shifted: 'yellow',
    stale: 'orange',
    broken: 'red',
  };
  return colors[health];
}
