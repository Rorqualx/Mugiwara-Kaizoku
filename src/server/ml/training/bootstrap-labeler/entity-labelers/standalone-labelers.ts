/**
 * Standalone Entity Labeler Functions
 *
 * Individual labeler functions for specific entity types.
 * These are convenience wrappers around the core labeling logic.
 */

import type { EntityType, LinearizedToken } from '@/server/ml/features/dom-linearizer';

import { findBestMatch, matchesToSpan } from '../matchers';
import { boostConfidenceWithPatterns } from '../pattern-detector';

import { isValidSummaryText } from './label-filters';

import type { PatternDetectionResult } from '../pattern-detector';
import type { ExtractedValues, TokenSpan, BootstrapOptions } from '../types';


// ============================================================================
// Core Labeling Functions (internal)
// ============================================================================

function labelSingleValue(
  tokens: LinearizedToken[],
  value: string | undefined,
  entityType: EntityType,
  options: BootstrapOptions,
  patternResult?: PatternDetectionResult
): TokenSpan | null {
  if (!value) return null;

  const result = findBestMatch(tokens, value, options);
  if (result.type === 'none') return null;

  const span = matchesToSpan(result.matches);
  if (!span) return null;

  let confidence = result.confidence;
  if (patternResult) {
    for (let i = span.start; i <= span.end; i++) {
      confidence = boostConfidenceWithPatterns(confidence, i, entityType, patternResult);
    }
  }

  if (confidence < (options.minConfidence ?? 0.5)) {
    return null;
  }

  return {
    start: span.start,
    end: span.end,
    entityType,
    confidence,
    matchType: result.type,
  };
}

function labelArrayValues(
  tokens: LinearizedToken[],
  values: string[] | undefined,
  entityType: EntityType,
  options: BootstrapOptions,
  _patternResult?: PatternDetectionResult
): TokenSpan[] {
  if (!values || values.length === 0) return [];

  const spans: TokenSpan[] = [];
  const usedTokens = new Set<number>();

  for (const value of values) {
    const result = findBestMatch(tokens, value, options);
    if (result.type === 'none') continue;

    const span = matchesToSpan(result.matches);
    if (!span) continue;

    // Check if any tokens already used
    let alreadyUsed = false;
    for (let i = span.start; i <= span.end; i++) {
      if (usedTokens.has(i)) {
        alreadyUsed = true;
        break;
      }
    }
    if (alreadyUsed) continue;

    // Mark tokens as used
    for (let i = span.start; i <= span.end; i++) {
      usedTokens.add(i);
    }

    spans.push({
      start: span.start,
      end: span.end,
      entityType,
      confidence: result.confidence,
      matchType: result.type,
    });
  }

  return spans;
}

// ============================================================================
// Entity-Specific Labelers (exported)
// ============================================================================

export function labelTitle(
  tokens: LinearizedToken[],
  extracted: ExtractedValues,
  options: BootstrapOptions
): TokenSpan | null {
  return labelSingleValue(tokens, extracted.title, 'TITLE', options);
}

export function labelAltTitles(
  tokens: LinearizedToken[],
  extracted: ExtractedValues,
  options: BootstrapOptions
): TokenSpan[] {
  return labelArrayValues(tokens, extracted.altTitles, 'ALT_TITLE', options);
}

export function labelAuthor(
  tokens: LinearizedToken[],
  extracted: ExtractedValues,
  options: BootstrapOptions
): TokenSpan | null {
  return labelSingleValue(tokens, extracted.author, 'AUTHOR', options);
}

export function labelArtist(
  tokens: LinearizedToken[],
  extracted: ExtractedValues,
  options: BootstrapOptions
): TokenSpan | null {
  return labelSingleValue(tokens, extracted.artist, 'ARTIST', options);
}

export function labelSummary(
  tokens: LinearizedToken[],
  extracted: ExtractedValues,
  options: BootstrapOptions
): TokenSpan | null {
  if (!extracted.summary || !isValidSummaryText(extracted.summary)) {
    return null;
  }
  return labelSingleValue(tokens, extracted.summary, 'SERIES_SUMMARY', options);
}

export function labelStatus(
  tokens: LinearizedToken[],
  extracted: ExtractedValues,
  options: BootstrapOptions
): TokenSpan | null {
  return labelSingleValue(tokens, extracted.status, 'STATUS', options);
}

export function labelGenres(
  tokens: LinearizedToken[],
  extracted: ExtractedValues,
  options: BootstrapOptions
): TokenSpan[] {
  return labelArrayValues(tokens, extracted.genres, 'GENRE', options);
}

export function labelVolumeCount(
  tokens: LinearizedToken[],
  extracted: ExtractedValues,
  options: BootstrapOptions
): TokenSpan | null {
  const value = extracted.volumeCount?.toString();
  return labelSingleValue(tokens, value, 'VOLUME_COUNT', options);
}

export function labelVolumeNumber(
  tokens: LinearizedToken[],
  extracted: ExtractedValues,
  options: BootstrapOptions
): TokenSpan | null {
  const value = extracted.volumeNumber?.toString();
  return labelSingleValue(tokens, value, 'VOLUME_NUMBER', options);
}

export function labelChapterCount(
  tokens: LinearizedToken[],
  extracted: ExtractedValues,
  options: BootstrapOptions
): TokenSpan | null {
  const value = extracted.chapterCount?.toString();
  return labelSingleValue(tokens, value, 'CHAPTER_COUNT', options);
}

export function labelPageCount(
  tokens: LinearizedToken[],
  extracted: ExtractedValues,
  options: BootstrapOptions
): TokenSpan | null {
  const value = extracted.pageCount?.toString();
  return labelSingleValue(tokens, value, 'PAGE_COUNT', options);
}

export function labelVolumeTitles(
  tokens: LinearizedToken[],
  extracted: ExtractedValues,
  options: BootstrapOptions
): TokenSpan[] {
  return labelArrayValues(tokens, extracted.volumeTitles, 'VOLUME_TITLE', options);
}

export function labelChapterTitles(
  tokens: LinearizedToken[],
  extracted: ExtractedValues,
  options: BootstrapOptions
): TokenSpan[] {
  return labelArrayValues(tokens, extracted.chapterTitles, 'CHAPTER_TITLE', options);
}

export function labelReleaseDate(
  tokens: LinearizedToken[],
  extracted: ExtractedValues,
  options: BootstrapOptions
): TokenSpan | null {
  return labelSingleValue(tokens, extracted.releaseDate, 'RELEASE_DATE', options);
}

export function labelPublisher(
  tokens: LinearizedToken[],
  extracted: ExtractedValues,
  options: BootstrapOptions
): TokenSpan | null {
  return labelSingleValue(tokens, extracted.publisher, 'PUBLISHER', options);
}

export function labelMagazine(
  tokens: LinearizedToken[],
  extracted: ExtractedValues,
  options: BootstrapOptions
): TokenSpan | null {
  return labelSingleValue(tokens, extracted.magazine, 'MAGAZINE', options);
}

export function labelCoverImage(
  tokens: LinearizedToken[],
  extracted: ExtractedValues,
  options: BootstrapOptions
): TokenSpan | null {
  return labelSingleValue(tokens, extracted.coverImage, 'COVER_IMAGE', options);
}

export function labelDemographic(
  tokens: LinearizedToken[],
  extracted: ExtractedValues,
  options: BootstrapOptions
): TokenSpan | null {
  return labelSingleValue(tokens, extracted.demographic, 'DEMOGRAPHIC', options);
}

export function labelThemes(
  tokens: LinearizedToken[],
  extracted: ExtractedValues,
  options: BootstrapOptions
): TokenSpan[] {
  return labelArrayValues(tokens, extracted.themes, 'THEMES', options);
}

export function labelTags(
  tokens: LinearizedToken[],
  extracted: ExtractedValues,
  options: BootstrapOptions
): TokenSpan[] {
  return labelArrayValues(tokens, extracted.tags, 'TAGS', options);
}

export function labelFormat(
  tokens: LinearizedToken[],
  extracted: ExtractedValues,
  options: BootstrapOptions
): TokenSpan | null {
  return labelSingleValue(tokens, extracted.format, 'FORMAT', options);
}
