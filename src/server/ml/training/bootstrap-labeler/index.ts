/**
 * Bootstrap Labeler for ML Training Data
 *
 * Automatically generates BIO labels for HTML pages using existing extractors.
 * This creates initial training data that can be reviewed and corrected.
 */

import type { BIOTag, EntityType, LinearizedToken } from '@/server/ml/features/dom-linearizer';
import { linearizeDOM } from '@/server/ml/features/dom-linearizer';
import { logger } from '@/utils/logger';

import { labelAllEntities } from './entity-labelers';
import { cleanHtmlForTokenization, shouldCleanForTokenization } from './html-cleaner';
import { extractMetadataValues } from './metadata-extraction';
import { adjustSpansForPageType } from './page-type-adjustments';
import { detectPatterns } from './pattern-detector';
import { propagatePatterns } from './pattern-propagation';
import {
  applyPositionalHeuristics,
  positionalMatchesToSpans,
} from './positional-heuristics';
import { mergeAllSpansWithPriority } from './span-merger';
import { DEFAULT_BOOTSTRAP_OPTIONS } from './types';

import type { PatternDetectionResult } from './pattern-detector';
import type { PropagationResult } from './pattern-propagation';
import type {
  PositionalMatch,
} from './positional-heuristics';
import type {
  BootstrapOptions,
  BootstrapResult,
  BootstrapStats,
  ExtractedValues,
  TokenSpan,
} from './types';

// ============================================================================
// Main Bootstrap Function
// ============================================================================

// eslint-disable-next-line max-statements -- ML labeling requires many sequential extraction steps
export function bootstrapLabels(
  html: string,
  url: string,
  options: Partial<BootstrapOptions> = {}
): BootstrapResult {
  const opts = { ...DEFAULT_BOOTSTRAP_OPTIONS, ...options };

  logger.info('Starting bootstrap labeling', { url });

  // Clean HTML if source type benefits from it (removes navigation, ads, etc.)
  let processedHtml = html;
  if (shouldCleanForTokenization(url)) {
    const cleanResult = cleanHtmlForTokenization(html, url);
    processedHtml = cleanResult.html;
  }

  // Linearize DOM with higher token limit for large list pages
  // Default is 10000, but list pages with many volumes/chapters need more
  // List pages (e.g., "Chapters and Volumes") need 50k to include all volume covers (17-20+)
  const isListPageByUrl = /chapters.*volumes|volumes.*chapters|list.*of/i.test(url.toLowerCase());
  const tokenLimit = isListPageByUrl ? 50000 : 20000;
  const linearized = linearizeDOM(processedHtml, url, { maxTokens: tokenLimit });
  const tokens = linearized.tokens;
  const sourceType = linearized.sourceType;

  // ==========================================================================
  // WIKIPEDIA LABELING - Re-enabling one by one for verification
  // Phase 1: Positional heuristics (source-rules) - ENABLED
  // Phase 2: Pattern detection - ENABLED
  // Phase 3: Pattern propagation - ENABLED
  // Phase 4: Metadata extraction - DISABLED
  // Phase 5: Entity labelers - DISABLED
  // ==========================================================================
  if (sourceType === 'wikipedia') {
    // Phase 1: Apply positional heuristics (source-rules)
    const positionalMatches = applyPositionalHeuristics(tokens, 'wikipedia', url);
    const positionalSpans = positionalMatchesToSpans(positionalMatches);
    logPositionalStats(positionalMatches, url);

    // Track indices claimed by positional heuristics
    const positionalClaimedIndices = new Set<number>();
    for (const span of positionalSpans) {
      for (let i = span.start; i <= span.end; i++) {
        positionalClaimedIndices.add(i);
      }
    }

    // Phase 2: Detect patterns (for pattern signals only — propagation disabled for Wikipedia)
    const patternResult = detectPatterns(tokens, sourceType);

    // Phase 3: Pattern propagation DISABLED for Wikipedia
    // Positional source rules already handle all Wikipedia entities (infobox metadata,
    // chapter/volume tables, titles, cover images). Propagation creates false positives
    // in non-target sections (stage plays, image captions, anime sections, etc.)

    // Convert positional spans directly to labels
    const labels: BIOTag[] = tokens.map(() => 'O');
    for (const span of positionalSpans) {
      for (let i = span.start; i <= span.end && i < labels.length; i++) {
        const prefix = i === span.start ? 'B-' : 'I-';
        labels[i] = `${prefix}${span.entityType}` as BIOTag;
      }
    }

    const stats = calculateStats(tokens, labels);

    logger.info('Wikipedia bootstrap labeling complete', {
      url,
      totalTokens: tokens.length,
      positionalMatches: positionalMatches.length,
      labeledTokens: stats.labeledTokens,
    });

    return {
      tokens,
      labels,
      spans: positionalSpans,
      extractedValues: {},
      confidence: calculateConfidence(stats),
      needsReview: true,
      stats,
      patternSignals: patternResult.patterns,
    };
  }
  // ==========================================================================

  // Phase 1: Apply positional heuristics (high-confidence structural rules)
  // Pass URL for page type detection (e.g., manga pages with "(manga)" in URL)
   
  // Map anilist to unknown since we don't scrape that site (no rules defined)
  const heuristicSourceType = sourceType === 'anilist' ? 'unknown' : sourceType;
  const positionalMatches = applyPositionalHeuristics(tokens, heuristicSourceType, url);
  const positionalSpans = positionalMatchesToSpans(positionalMatches);
  logPositionalStats(positionalMatches, url);

  // Track indices claimed by positional heuristics
  const positionalClaimedIndices = new Set<number>();
  for (const span of positionalSpans) {
    for (let i = span.start; i <= span.end; i++) {
      positionalClaimedIndices.add(i);
    }
  }

  // Phase 2: Detect structural patterns (label:value, table headers, infoboxes, definition lists)
  // Pass sourceType for provider-specific overrides (Wikipedia nested tables, multi-word headers)
  logger.info('[BOOTSTRAP-DEBUG] detectPatterns called', {
    sourceType,
    totalTokens: tokens.length,
    urlContainsWikipedia: url.includes('wikipedia'),
  });
  const patternResult = detectPatterns(tokens, sourceType);
  logger.info('[BOOTSTRAP-DEBUG] patterns detected', {
    patternCount: patternResult.patterns.length,
    tableHeaderPatterns: patternResult.patterns.filter(p => p.type === 'table_header_value').length,
    samplePatterns: patternResult.patterns.slice(0, 5).map(p => ({
      type: p.type,
      entityType: p.entityType,
      valueIndicesCount: p.valueTokenIndices.length,
      source: p.source,
    })),
  });
  logPatternStats(patternResult, url);

  // Phase 3: Propagate patterns to spans (NEW - direct labeling from patterns)
  // Pass URL for page type detection (chapter pages use CHAPTER_SUMMARY instead of SERIES_SUMMARY)
  const propagationResult = propagatePatterns(tokens, patternResult, positionalClaimedIndices, url);

  // Debug: Log large spans that might indicate table-wide labeling issue
  const largeSpans = propagationResult.spans.filter(s => (s.end - s.start) > 30);
  if (largeSpans.length > 0) {
    logger.warn('[BOOTSTRAP-DEBUG] Large propagation spans detected', {
      largeSpanCount: largeSpans.length,
      spans: largeSpans.map(s => ({
        entityType: s.entityType,
        start: s.start,
        end: s.end,
        size: s.end - s.start + 1,
        sampleText: tokens.slice(s.start, Math.min(s.start + 5, s.end + 1)).map(t => t.text).join(' '),
      })),
    });
  }

  logPropagationStats(propagationResult, url);

  // Phase 4: Extract metadata using existing extractors
  const extracted = extractMetadataValues(html, url);

  // Phase 5: Generate BIO labels with pattern confidence boosts
  // Pass URL for page type detection (chapter vs series vs volume)
  const { spans: extractorSpans, labels: extractorLabels } = labelAllEntities(
    tokens,
    extracted,
    opts,
    patternResult,
    url
  );

  // Phase 6: Merge all spans with priority (positional > propagation > extractor)
  const { mergedSpans: rawMergedSpans, mergedLabels: rawMergedLabels } = mergeAllSpansWithPriority(
    tokens.length,
    positionalSpans,
    propagationResult.spans,
    extractorSpans,
    extractorLabels
  );

  // Phase 6b: Adjust entity types based on page type (chapter vs series)
  // This catches ALL code paths after merge but before final output
  const { adjustedSpans: mergedSpans, adjustedLabels: mergedLabels } = adjustSpansForPageType(
    tokens.length,
    rawMergedSpans,
    rawMergedLabels,
    url,
    tokens
  );

  // Phase 7: Extract chapter URLs from CHAPTER_TITLE spans that have linkHref
  const chapterUrls = extractChapterUrlsFromSpans(tokens, mergedSpans);
  if (chapterUrls.length > 0) {
    extracted.chapterUrls = chapterUrls;
  }

  // Calculate statistics
  const stats = calculateStats(tokens, mergedLabels);
  const confidence = calculateConfidence(stats);

  logger.info('Bootstrap labeling complete', {
    url,
    totalTokens: tokens.length,
    labeledTokens: stats.labeledTokens,
    positionalMatches: positionalMatches.length,
    propagatedSpans: propagationResult.spans.length,
    patternsDetected: patternResult.patterns.length,
    confidence,
  });

  return {
    tokens,
    labels: mergedLabels,
    spans: mergedSpans,
    extractedValues: extracted,
    confidence,
    needsReview: confidence < 0.8,
    stats,
    patternSignals: patternResult.patterns,
  };
}

/**
 * Log positional heuristic match statistics
 */
function logPositionalStats(matches: PositionalMatch[], url: string): void {
  if (matches.length === 0) {
    logger.debug('No positional heuristic matches', { url });
    return;
  }

  const ruleHits: Record<string, number> = {};
  for (const match of matches) {
    ruleHits[match.rule.id] = (ruleHits[match.rule.id] ?? 0) + 1;
  }

  logger.debug('Positional heuristics applied', {
    url,
    totalMatches: matches.length,
    ...ruleHits,
  });
}

function logPatternStats(patternResult: PatternDetectionResult, url: string): void {
  const patternCounts: Record<string, number> = {};
  for (const p of patternResult.patterns) {
    patternCounts[p.type] = (patternCounts[p.type] ?? 0) + 1;
  }

  logger.debug('Pattern detection complete', {
    url,
    totalPatterns: patternResult.patterns.length,
    tokensWithBoosts: patternResult.tokenConfidenceBoosts.size,
    ...patternCounts,
  });
}

/**
 * Log pattern propagation statistics
 */
function logPropagationStats(propagationResult: PropagationResult, url: string): void {
  if (propagationResult.spans.length === 0) {
    logger.debug('No pattern propagation spans', { url });
    return;
  }

  const entityCounts: Record<string, number> = {};
  for (const span of propagationResult.spans) {
    entityCounts[span.entityType] = (entityCounts[span.entityType] ?? 0) + 1;
  }

  logger.debug('Pattern propagation complete', {
    url,
    totalSpans: propagationResult.spans.length,
    propagatedTokens: propagationResult.propagatedIndices.size,
    ...entityCounts,
  });
}

/**
 * Extract chapter URLs from CHAPTER_TITLE spans that have linkHref.
 * This resolves the conflict where CHAPTER_TITLE and CHAPTER_URL compete for the same tokens.
 * Instead of labeling the URL, we extract it as metadata from linked CHAPTER_TITLE spans.
 */
function extractChapterUrlsFromSpans(tokens: LinearizedToken[], spans: TokenSpan[]): string[] {
  const urls: string[] = [];
  const seenUrls = new Set<string>();

  for (const span of spans) {
    if (span.entityType !== 'CHAPTER_TITLE') continue;

    // Find the first linkHref in this span
    for (let i = span.start; i <= span.end && i < tokens.length; i++) {
      const token = tokens[i];
      if (token?.isLink && token.linkHref && !seenUrls.has(token.linkHref)) {
        urls.push(token.linkHref);
        seenUrls.add(token.linkHref);
        break; // One URL per CHAPTER_TITLE span
      }
    }
  }

  return urls;
}

// ============================================================================
// Metadata Extraction
// ============================================================================

// ============================================================================
// Statistics Calculation
// ============================================================================

const ALL_ENTITY_TYPES: EntityType[] = [
  'TITLE', 'ALT_TITLE', 'AUTHOR', 'ARTIST', 'SERIES_SUMMARY', 'STATUS',
  'GENRE', 'VOLUME_COUNT', 'CHAPTER_COUNT', 'VOLUME_TITLE',
  'CHAPTER_TITLE', 'RELEASE_DATE', 'PUBLISHER', 'MAGAZINE',
  'COVER_IMAGE', 'DEMOGRAPHIC', 'THEMES', 'TAGS', 'FORMAT',
];

function countLabeledEntities(labels: BIOTag[]): { labeledTokens: number; counts: Record<EntityType, number> } {
  const counts = initializeEntityCounts();
  let labeledTokens = 0;

  for (const label of labels) {
    if (label !== 'O') {
      labeledTokens++;
      const entityType = label.substring(2) as EntityType;
      counts[entityType] = counts[entityType] + 1;
    }
  }

  return { labeledTokens, counts };
}

function calculateStats(tokens: LinearizedToken[], labels: BIOTag[]): BootstrapStats {
  const { labeledTokens, counts } = countLabeledEntities(labels);

  const matchedEntities = ALL_ENTITY_TYPES.filter((e) => counts[e] > 0);
  const missedEntities = ALL_ENTITY_TYPES.filter((e) => counts[e] === 0);

  return {
    totalTokens: tokens.length,
    labeledTokens,
    entityCounts: counts,
    matchedEntities,
    missedEntities,
  };
}

function initializeEntityCounts(): Record<EntityType, number> {
  return {
    // Core metadata (alphabetical)
    ALT_TITLE: 0, ARTIST: 0, AUTHOR: 0,
    COVER_IMAGE: 0, DEMOGRAPHIC: 0, FORMAT: 0, GENRE: 0,
    MAGAZINE: 0, ORIGINAL_RUN: 0, START_DATE: 0, END_DATE: 0, PAGE_TYPE: 0, PUBLISHER: 0, RELEASE_DATE: 0,
    SERIES_SUMMARY: 0, STATUS: 0, TAGS: 0, THEMES: 0, TITLE: 0,
    // Counts
    CHAPTER_COUNT: 0, CHAPTER_RANGE: 0, PAGE_COUNT: 0, VOLUME_COUNT: 0, VOLUME_NUMBER: 0, VOLUME_PAGE_COUNT: 0,
    // Chapter-specific
    CHAPTER_ALT_TITLE: 0, CHAPTER_BELONGS_TO_VOLUME: 0, CHAPTER_COVER: 0, CHAPTER_NUMBER: 0, CHAPTER_RELEASE_DATE: 0, CHAPTER_SUMMARY: 0, CHAPTER_TITLE: 0, CHAPTER_URL: 0,
    // Volume-specific
    ENGLISH_ISBN: 0, ENGLISH_PUBLISHER: 0, ENGLISH_RELEASE_DATE: 0,
    ISBN: 0, VOLUME_ALT_TITLE: 0, VOLUME_COVER: 0, VOLUME_RELEASE_DATE: 0, VOLUME_SUMMARY: 0, VOLUME_TITLE: 0, VOLUME_URL: 0,
    // Navigation/Links
    CHAPTERS_LIST_URL: 0, GALLERY_URL: 0, VOLUMES_LIST_URL: 0,
    // Table/Data sections
    CHAPTER_TABLE: 0, GALLERY_SECTION: 0, VOLUME_CHAPTER_TABLE: 0, VOLUME_TABLE: 0,
  };
}

function calculateConfidence(stats: BootstrapStats): number {
  const weights: Partial<Record<EntityType, number>> = {
    TITLE: 3,
    AUTHOR: 2,
    STATUS: 2,
    VOLUME_COUNT: 1.5,
    CHAPTER_COUNT: 1.5,
    SERIES_SUMMARY: 1,
  };

  let totalWeight = 0;
  let matchedWeight = 0;

  for (const [entity, weight] of Object.entries(weights)) {
    totalWeight += weight;
    if (stats.matchedEntities.includes(entity as EntityType)) {
      matchedWeight += weight;
    }
  }

  return totalWeight > 0 ? matchedWeight / totalWeight : 0;
}

// ============================================================================
// Exports
// ============================================================================

export type { BootstrapResult, BootstrapOptions, ExtractedValues, TokenSpan };
export { DEFAULT_BOOTSTRAP_OPTIONS } from './types';

// Suggestion types and functions (Phase 4)
export type {
  LabelSuggestion,
  BootstrapResultEnhanced,
  SuggestionSource,
  SuggestionThresholds,
} from './types';
export { DEFAULT_SUGGESTION_THRESHOLDS } from './types';
export {
  generateSuggestions,
  applySuggestionToLabels,
  autoApplySuggestions,
  getPendingSuggestions,
  groupSuggestionsByEntity,
} from './suggestion-generator';
