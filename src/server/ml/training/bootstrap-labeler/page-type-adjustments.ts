/**
 * Post-Merge Page Type Adjustments
 *
 * Adjusts entity types based on page type AFTER all span sources are merged.
 * This catches ALL code paths (positional heuristics, pattern propagation, extractors)
 * in one centralized place.
 */

import type { BIOTag, EntityType, LinearizedToken } from '@/server/ml/features/dom-linearizer';

import { detectPageType } from './entity-labelers';

import type { TokenSpan } from './types';

/**
 * Check if a span contains a range pattern (e.g., "12 - 15").
 * Looks for dash tokens (hyphen, en-dash, em-dash) within the span.
 */
function spanContainsRangePattern(tokens: LinearizedToken[], span: TokenSpan): boolean {
  for (let i = span.start; i <= span.end && i < tokens.length; i++) {
    const t = tokens[i];
    if (t && /^[-–—]$/.test(t.text)) {
      return true;
    }
  }
  return false;
}

/** Adjust a single span for chapter page context */
function adjustSpanForChapterPage(span: TokenSpan): TokenSpan {
  if (span.entityType === 'VOLUME_COUNT') {
    return { ...span, entityType: 'CHAPTER_BELONGS_TO_VOLUME' as EntityType };
  }
  if (span.entityType === 'CHAPTER_COUNT') {
    return { ...span, entityType: 'CHAPTER_NUMBER' as EntityType };
  }
  if (span.entityType === 'COVER_IMAGE') {
    return { ...span, entityType: 'CHAPTER_COVER' as EntityType };
  }
  return span;
}

/** Adjust a single span for volume page context */
function adjustSpanForVolumePage(span: TokenSpan, tokens?: LinearizedToken[]): TokenSpan {
  if (span.entityType === 'COVER_IMAGE') {
    return { ...span, entityType: 'VOLUME_COVER' as EntityType };
  }
  if (span.entityType === 'VOLUME_COUNT') {
    return { ...span, entityType: 'VOLUME_NUMBER' as EntityType };
  }
  // "Chapters: 12 - 15" on a volume page is a range, not a count
  if (span.entityType === 'CHAPTER_COUNT' && tokens && spanContainsRangePattern(tokens, span)) {
    return { ...span, entityType: 'CHAPTER_RANGE' as EntityType };
  }
  return span;
}

/**
 * Split CHAPTER_TITLE spans on volume pages into CHAPTER_NUMBER + CHAPTER_TITLE.
 *
 * Input span: "Chapter 176 : Voyage to the West (10)" as CHAPTER_TITLE
 * Output:
 *   - "Chapter" → unlabeled (removed from spans)
 *   - "176" → CHAPTER_NUMBER
 *   - ":" → unlabeled (removed from spans)
 *   - "Voyage to the West (10)" → CHAPTER_TITLE
 */
function splitChapterTitleSpans(spans: TokenSpan[], tokens: LinearizedToken[]): TokenSpan[] {
  const result: TokenSpan[] = [];

  for (const span of spans) {
    if (span.entityType !== 'CHAPTER_TITLE') {
      result.push(span);
      continue;
    }

    const splitResult = trySplitChapterSpan(span, tokens);
    if (splitResult) {
      result.push(...splitResult);
    } else {
      result.push(span);
    }
  }

  return result;
}

const SEPARATOR_CHARS = new Set(['-', '–', '—', '‐', ':']);

/** Try to split a single CHAPTER_TITLE span into CHAPTER_NUMBER + CHAPTER_TITLE */
function trySplitChapterSpan(span: TokenSpan, tokens: LinearizedToken[]): TokenSpan[] | null {
  if (tokens[span.start]?.text !== 'Chapter') return null;

  // Token after "Chapter" should be a number
  const numberIndex = span.start + 1;
  const numberToken = tokens[numberIndex];
  if (!numberToken || !/^\d+$/.test(numberToken.text)) return null;

  // Find where the title text starts (skip separator tokens)
  let titleStart = numberIndex + 1;
  while (titleStart <= span.end) {
    const t = tokens[titleStart];
    if (t && !SEPARATOR_CHARS.has(t.text)) break;
    titleStart++;
  }

  const splitSpans: TokenSpan[] = [];

  // CHAPTER_NUMBER span for just the number
  splitSpans.push({
    start: numberIndex,
    end: numberIndex,
    entityType: 'CHAPTER_NUMBER' as EntityType,
    confidence: span.confidence,
    matchType: span.matchType,
  });

  // CHAPTER_TITLE span for the title text (if any remains after separator)
  if (titleStart <= span.end) {
    splitSpans.push({
      start: titleStart,
      end: span.end,
      entityType: 'CHAPTER_TITLE' as EntityType,
      confidence: span.confidence,
      matchType: span.matchType,
    });
  }

  return splitSpans;
}

/**
 * Adjust entity types in merged spans based on page type.
 *
 * On chapter pages:
 * - VOLUME_COUNT → CHAPTER_BELONGS_TO_VOLUME (which volume this chapter is in)
 * - CHAPTER_COUNT → CHAPTER_NUMBER (the chapter's own number, e.g., "Chapter 1")
 * - COVER_IMAGE → CHAPTER_COVER (the chapter's cover image)
 *
 * On volume pages:
 * - COVER_IMAGE → VOLUME_COVER (the volume's cover image)
 * - VOLUME_COUNT → VOLUME_NUMBER (this volume's number, e.g., "Volume 3" → "3")
 * - CHAPTER_COUNT with range pattern → CHAPTER_RANGE (e.g., "12 - 15")
 *
 * This runs AFTER all span sources are merged to catch ALL code paths
 * (positional heuristics, pattern propagation, extractors) in one place.
 */
export function adjustSpansForPageType(
  tokenCount: number,
  spans: TokenSpan[],
  labels: BIOTag[],
  url: string,
  tokens?: LinearizedToken[]
): { adjustedSpans: TokenSpan[]; adjustedLabels: BIOTag[] } {
  const pageType = detectPageType(url);

  // Only adjust for chapter and volume pages
  if (pageType !== 'chapter' && pageType !== 'volume') {
    return { adjustedSpans: spans, adjustedLabels: labels };
  }

  // Adjust entity types based on page type
  let adjustedSpans = spans.map(span => {
    if (pageType === 'chapter') {
      return adjustSpanForChapterPage(span);
    }
    return adjustSpanForVolumePage(span, tokens);
  });

  // On volume pages, split "Chapter 176 : Title" spans into CHAPTER_NUMBER + CHAPTER_TITLE
  if (pageType === 'volume' && tokens) {
    adjustedSpans = splitChapterTitleSpans(adjustedSpans, tokens);
  }

  // Regenerate labels from adjusted spans
  const adjustedLabels = spansToLabels(tokenCount, adjustedSpans);

  return { adjustedSpans, adjustedLabels };
}

/**
 * Convert token spans to BIO label array.
 * Used to regenerate labels after span adjustments.
 */
function spansToLabels(tokenCount: number, spans: TokenSpan[]): BIOTag[] {
  const labels: BIOTag[] = Array.from({ length: tokenCount }, () => 'O' as BIOTag);
  const sortedSpans = [...spans].sort((a, b) => a.start - b.start);

  for (const span of sortedSpans) {
    for (let i = span.start; i <= span.end && i < labels.length; i++) {
      // Skip already labeled tokens (earlier spans take precedence)
      if (labels[i] !== 'O') continue;
      labels[i] = i === span.start
        ? (`B-${span.entityType}` as BIOTag)
        : (`I-${span.entityType}` as BIOTag);
    }
  }

  return labels;
}
