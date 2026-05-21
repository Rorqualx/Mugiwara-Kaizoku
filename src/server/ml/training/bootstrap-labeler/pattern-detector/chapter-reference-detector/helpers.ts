/**
 * Helper functions for chapter reference detection.
 * @module pattern-detector/chapter-reference-detector/helpers
 */

import type { LinearizedToken } from '@/server/ml/features/dom-linearizer';

/**
 * Check if a token marks the end of a chapter entry.
 */
export function isChapterBoundary(token: LinearizedToken, startInTable: boolean): boolean {
  if (token.isHeader) return true;
  if (token.isInTable && !startInTable) return true;
  const text = token.text.trim();
  if (text === '•' || text === '*') return true;
  // Check for next chapter pattern - also handle standalone numbers
  if (/^[*•]\s*\d{1,4}\.|^0\d{1,3}\.|^\d{2,3}$/.test(text)) return true;
  return false;
}

/**
 * Check if a token is a TOC item that should be skipped.
 */
export function isTocToken(token: LinearizedToken): boolean {
  const text = token.text.trim();
  if (text === '(Top)' || text === 'Top' || text === 'Contents') return true;
  if (token.sectionType === 'sidebar') return true;
  if (token.classes.some(c => c.toLowerCase().includes('toc'))) return true;
  if (token.cssPath.toLowerCase().includes('toc')) return true;
  return false;
}

/**
 * Collect all token indices that are part of this chapter entry.
 * Handles split tokens where number and period are separate (e.g., "002" + ".").
 */
// eslint-disable-next-line complexity -- token collection requires multiple format-aware branches
export function collectChapterTokenIndices(
  tokens: LinearizedToken[],
  startIndex: number,
  skipPeriodToken = false
): number[] {
  const indices: number[] = [startIndex];
  // If number and period are split, include the period token
  if (skipPeriodToken && tokens[startIndex + 1]?.text.trim() === '.') {
    indices.push(startIndex + 1);
  }
  const lookStart = skipPeriodToken ? startIndex + 2 : startIndex + 1;
  const endIndex = Math.min(startIndex + 15, tokens.length);
  const startToken = tokens[startIndex];
  const startInTable = startToken?.isInTable ?? false;
  let foundCloseParen = (startToken?.text ?? '').includes(')');

  for (let j = lookStart; j < endIndex; j++) {
    const nextToken = tokens[j];
    if (!nextToken) break;
    // Check boundary but handle standalone numbers differently
    if (nextToken.isHeader) break;
    if (nextToken.isInTable && !startInTable) break;
    const nextText = nextToken.text.trim();
    // Stop at next chapter (asterisk pattern or standalone 2-3 digit number)
    if (/^[*•]\s*\d{1,4}\./.test(nextText)) break;
    if (/^\d{2,3}$/.test(nextText) && tokens[j + 1]?.text.trim() === '.') break;
    if (isTocToken(nextToken)) continue;
    if (nextText.length > 0) {
      indices.push(j);
      if (nextText.includes(')')) foundCloseParen = true;
      if (foundCloseParen) break;
    }
  }
  return indices;
}

/**
 * Check if text has a strong Wikipedia chapter indicator.
 */
export function hasStrongChapterIndicator(text: string): boolean {
  const normalized = text.trim();
  if (/^[*•]\s*\d{1,4}\./.test(normalized)) return true;
  if (/^0\d{1,3}\./.test(normalized)) return true;
  if (/^\d{3}\.\s*["「]/.test(normalized)) return true;
  if (/^\d{1,3}\.\s+["「]/.test(normalized)) return true;
  return false;
}
