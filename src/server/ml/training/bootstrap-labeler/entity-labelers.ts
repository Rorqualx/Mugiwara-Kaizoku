/**
 * Entity Labeling Functions for Bootstrap Labeling
 *
 * Provides functions to apply BIO labels for specific entity types.
 */

import type { BIOTag, EntityType, LinearizedToken } from '@/server/ml/features/dom-linearizer';

import { isLabelWord, isValidSummaryText, stripLabelPrefix } from './entity-labelers/label-filters';
import { detectPageType } from './entity-labelers/page-type-detection';
import { findBestMatch, matchesToSpan } from './matchers';
import { boostConfidenceWithPatterns } from './pattern-detector';
import { isInTableOfContents, isNavboxSectionRangeHeader } from './source-rules';
import { DEFAULT_BOOTSTRAP_OPTIONS } from './types';

import type { PageType } from './entity-labelers/page-type-detection';
import type { PatternDetectionResult } from './pattern-detector';
import type { ExtractedValues, TokenSpan, BootstrapOptions } from './types';

// Re-export for backward compatibility
export { detectPageType };
export type { PageType };

// ============================================================================
// Single Value Labeling
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

  // Skip spans that start in Table of Contents (TOC) - navigation, not content
  const startToken = tokens[span.start];
  if (startToken && isInTableOfContents(startToken)) return null;

  // Skip navbox section range headers (e.g., "1-10", "11-20") - navigation dividers
  if (startToken && isNavboxSectionRangeHeader(startToken)) return null;

  // Apply pattern-based confidence boosts if pattern detection was performed
  let confidence = result.confidence;
  if (patternResult) {
    // Boost confidence for each token in the span that has a matching pattern signal
    for (let i = span.start; i <= span.end; i++) {
      confidence = boostConfidenceWithPatterns(confidence, i, entityType, patternResult);
    }
  }

  // Check against minimum confidence after applying boosts
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

// ============================================================================
// Array Value Labeling
// ============================================================================

function labelArrayValues(
  tokens: LinearizedToken[],
  values: string[] | undefined,
  entityType: EntityType,
  options: BootstrapOptions,
  patternResult?: PatternDetectionResult
): TokenSpan[] {
  if (!values || values.length === 0) return [];

  const spans: TokenSpan[] = [];
  const usedTokens = new Set<number>();

  for (const value of values) {
    const span = labelSingleValueExcluding(
      tokens,
      value,
      entityType,
      options,
      usedTokens,
      patternResult
    );
    if (span) {
      spans.push(span);
      markTokensAsUsed(span, usedTokens);
    }
  }

  return spans;
}

// eslint-disable-next-line max-params -- Labeling requires tokens, value, type, options, tracking sets
function labelSingleValueExcluding(
  tokens: LinearizedToken[],
  value: string,
  entityType: EntityType,
  options: BootstrapOptions,
  usedTokens: Set<number>,
  patternResult?: PatternDetectionResult
): TokenSpan | null {
  const result = findBestMatch(tokens, value, options);
  if (result.type === 'none') return null;

  const span = matchesToSpan(result.matches);
  if (!span) return null;

  // Skip spans that start in Table of Contents (TOC) - navigation, not content
  const startToken = tokens[span.start];
  if (startToken && isInTableOfContents(startToken)) return null;

  // Skip navbox section range headers (e.g., "1-10", "11-20") - navigation dividers
  if (startToken && isNavboxSectionRangeHeader(startToken)) return null;

  // Check if any tokens already used
  for (let i = span.start; i <= span.end; i++) {
    if (usedTokens.has(i)) return null;
  }

  // Apply pattern-based confidence boosts
  let confidence = result.confidence;
  if (patternResult) {
    for (let i = span.start; i <= span.end; i++) {
      confidence = boostConfidenceWithPatterns(confidence, i, entityType, patternResult);
    }
  }

  return {
    start: span.start,
    end: span.end,
    entityType,
    confidence,
    matchType: result.type,
  };
}

function markTokensAsUsed(span: TokenSpan, usedTokens: Set<number>): void {
  for (let i = span.start; i <= span.end; i++) {
    usedTokens.add(i);
  }
}

// ============================================================================
// Entity-Specific Labelers (re-exported from submodule)
// ============================================================================

export {
  labelTitle,
  labelAltTitles,
  labelAuthor,
  labelArtist,
  labelSummary,
  labelStatus,
  labelGenres,
  labelVolumeCount,
  labelVolumeNumber,
  labelChapterCount,
  labelPageCount,
  labelVolumeTitles,
  labelChapterTitles,
  labelReleaseDate,
  labelPublisher,
  labelMagazine,
  labelCoverImage,
  labelDemographic,
  labelThemes,
  labelTags,
  labelFormat,
} from './entity-labelers/standalone-labelers';

// ============================================================================
// Combined Labeler
// ============================================================================

export interface LabelingResult {
  spans: TokenSpan[];
  labels: BIOTag[];
}

export interface LabelingOptions {
  bootstrapOptions?: Partial<BootstrapOptions>;
  patternResult?: PatternDetectionResult;
  /** URL for page type detection (chapter vs series) */
  url?: string;
}

export function labelAllEntities(
  tokens: LinearizedToken[],
  extracted: ExtractedValues,
  options: Partial<BootstrapOptions> = {},
  patternResult?: PatternDetectionResult,
  url?: string
): LabelingResult {
  const opts = { ...DEFAULT_BOOTSTRAP_OPTIONS, ...options };
  const spans: TokenSpan[] = [];

  // Detect page type for context-aware labeling
  const pageType = url ? detectPageType(url) : 'series';

  // Single-value entities with pattern boost support
  addSingleValueSpans(tokens, extracted, opts, patternResult, spans, pageType);

  // Array-value entities with pattern boost support
  addArrayValueSpans(tokens, extracted, opts, patternResult, spans, pageType);

  // Convert spans to BIO labels
  const labels = spansToLabels(tokens.length, spans);

  return { spans, labels };
}

// eslint-disable-next-line max-params, complexity -- Labeling context requires all parameters; handles all single-value entity types with page-type-specific logic
function addSingleValueSpans(
  tokens: LinearizedToken[],
  extracted: ExtractedValues,
  opts: Required<BootstrapOptions>,
  patternResult: PatternDetectionResult | undefined,
  spans: TokenSpan[],
  pageType: PageType
): void {
  // Title - use appropriate entity type based on page type
  // TITLE for series, CHAPTER_TITLE for chapters, VOLUME_TITLE for volumes
  // SKIP for list pages (e.g., "Chapters and Volumes" is not a title)
  // Strip label prefixes (e.g., "Title England" → "England") and skip if just a label word
  const cleanTitle = stripLabelPrefix(extracted.title);
  if (cleanTitle && !isLabelWord(cleanTitle) && pageType !== 'list') {
    let titleEntityType: EntityType = 'TITLE';
    if (pageType === 'chapter') {
      titleEntityType = 'CHAPTER_TITLE';
    } else if (pageType === 'volume') {
      titleEntityType = 'VOLUME_TITLE';
    }
    const title = labelSingleValue(tokens, cleanTitle, titleEntityType, opts, patternResult);
    if (title) spans.push(title);
  }

  // Author
  const author = labelSingleValue(tokens, extracted.author, 'AUTHOR', opts, patternResult);
  if (author) spans.push(author);

  // Artist
  const artist = labelSingleValue(tokens, extracted.artist, 'ARTIST', opts, patternResult);
  if (artist) spans.push(artist);

  // Summary (with navigation message filtering)
  // Use CHAPTER_SUMMARY for chapter pages, VOLUME_SUMMARY for volume pages, SERIES_SUMMARY otherwise
  if (extracted.summary && isValidSummaryText(extracted.summary)) {
    let summaryEntityType: EntityType = 'SERIES_SUMMARY';
    if (pageType === 'chapter') {
      summaryEntityType = 'CHAPTER_SUMMARY';
    } else if (pageType === 'volume') {
      summaryEntityType = 'VOLUME_SUMMARY';
    }
    const summary = labelSingleValue(tokens, extracted.summary, summaryEntityType, opts, patternResult);
    if (summary) spans.push(summary);
  }

  // Status
  const status = labelSingleValue(tokens, extracted.status, 'STATUS', opts, patternResult);
  if (status) spans.push(status);

  // Volume Count — skip on chapter pages (volumeCount is a series-level total, not
  // which volume this chapter belongs to; e.g., "9" = total volumes in series, not "Volume 1")
  if (extracted.volumeCount !== undefined && pageType !== 'chapter') {
    const volumeEntityType: EntityType = 'VOLUME_COUNT';
    const volCount = labelSingleValue(
      tokens,
      extracted.volumeCount.toString(),
      volumeEntityType,
      opts,
      patternResult
    );
    if (volCount) spans.push(volCount);
  }

  // Chapter Count
  const chapCount = labelSingleValue(
    tokens,
    extracted.chapterCount?.toString(),
    'CHAPTER_COUNT',
    opts,
    patternResult
  );
  if (chapCount) spans.push(chapCount);

  // Page Count - only on chapter pages
  if (pageType === 'chapter' && extracted.pageCount !== undefined) {
    const pageCount = labelSingleValue(
      tokens,
      extracted.pageCount.toString(),
      'PAGE_COUNT',
      opts,
      patternResult
    );
    if (pageCount) spans.push(pageCount);
  }

  // Volume Number (specific volume's sequence number, e.g., Vol. 4)
  // Use VOLUME_NUMBER on volume pages
  if (extracted.volumeNumber !== undefined && pageType === 'volume') {
    const volNumber = labelSingleValue(
      tokens,
      extracted.volumeNumber.toString(),
      'VOLUME_NUMBER',
      opts,
      patternResult
    );
    if (volNumber) spans.push(volNumber);
  }

  // Release Date - strip prefixes and skip if just a label word
  const cleanReleaseDate = stripLabelPrefix(extracted.releaseDate);
  if (cleanReleaseDate && !isLabelWord(cleanReleaseDate)) {
    const releaseDate = labelSingleValue(tokens, cleanReleaseDate, 'RELEASE_DATE', opts, patternResult);
    if (releaseDate) spans.push(releaseDate);
  }

  // Publisher
  const publisher = labelSingleValue(
    tokens,
    extracted.publisher,
    'PUBLISHER',
    opts,
    patternResult
  );
  if (publisher) spans.push(publisher);

  // Magazine
  const magazine = labelSingleValue(tokens, extracted.magazine, 'MAGAZINE', opts, patternResult);
  if (magazine) spans.push(magazine);

  // Cover Image
  const coverImage = labelSingleValue(
    tokens,
    extracted.coverImage,
    'COVER_IMAGE',
    opts,
    patternResult
  );
  if (coverImage) spans.push(coverImage);

  // Demographic
  const demographic = labelSingleValue(
    tokens,
    extracted.demographic,
    'DEMOGRAPHIC',
    opts,
    patternResult
  );
  if (demographic) spans.push(demographic);

  // Format (new field)
  const format = labelSingleValue(tokens, extracted.format, 'FORMAT', opts, patternResult);
  if (format) spans.push(format);
}

// eslint-disable-next-line max-params -- Labeling context requires all parameters for proper array entity detection
function addArrayValueSpans(
  tokens: LinearizedToken[],
  extracted: ExtractedValues,
  opts: Required<BootstrapOptions>,
  patternResult: PatternDetectionResult | undefined,
  spans: TokenSpan[],
  pageType: PageType
): void {
  // Alt Titles - use appropriate entity type based on page type
  // ALT_TITLE for series, CHAPTER_ALT_TITLE for chapters, VOLUME_ALT_TITLE for volumes
  if (extracted.altTitles && extracted.altTitles.length > 0) {
    // Strip prefixes and filter out label words from alt titles
    const cleanAltTitles = extracted.altTitles
      .map((t) => stripLabelPrefix(t))
      .filter((t): t is string => t !== undefined && !isLabelWord(t));
    if (cleanAltTitles.length > 0) {
      let altTitleEntityType: EntityType = 'ALT_TITLE';
      if (pageType === 'chapter') {
        altTitleEntityType = 'CHAPTER_ALT_TITLE';
      } else if (pageType === 'volume') {
        altTitleEntityType = 'VOLUME_ALT_TITLE';
      }
      spans.push(...labelArrayValues(tokens, cleanAltTitles, altTitleEntityType, opts, patternResult));
    }
  }

  // Genres
  spans.push(...labelArrayValues(tokens, extracted.genres, 'GENRE', opts, patternResult));

  // Volume Titles
  spans.push(
    ...labelArrayValues(tokens, extracted.volumeTitles, 'VOLUME_TITLE', opts, patternResult)
  );

  // Chapter Titles
  spans.push(
    ...labelArrayValues(tokens, extracted.chapterTitles, 'CHAPTER_TITLE', opts, patternResult)
  );

  // Themes (new field)
  spans.push(...labelArrayValues(tokens, extracted.themes, 'THEMES', opts, patternResult));

  // Tags (new field)
  spans.push(...labelArrayValues(tokens, extracted.tags, 'TAGS', opts, patternResult));

  // NOTE: Characters labeling removed - CHARACTERS entity type is no longer used
}

function spansToLabels(tokenCount: number, spans: TokenSpan[]): BIOTag[] {
  const labels: BIOTag[] = Array.from({ length: tokenCount }, () => 'O' as BIOTag);

  // Sort spans by start index for consistent labeling
  const sortedSpans = [...spans].sort((a, b) => a.start - b.start);

  for (const span of sortedSpans) {
    applySpanLabels(labels, span);
  }

  return labels;
}

function applySpanLabels(labels: BIOTag[], span: TokenSpan): void {
  for (let i = span.start; i <= span.end && i < labels.length; i++) {
    // Don't overwrite existing labels
    if (labels[i] !== 'O') continue;

    // eslint-disable-next-line no-param-reassign -- Required for label array mutation
    labels[i] = i === span.start
      ? (`B-${span.entityType}` as BIOTag)
      : (`I-${span.entityType}` as BIOTag);
  }
}
