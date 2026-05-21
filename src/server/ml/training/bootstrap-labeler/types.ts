/**
 * Types for Bootstrap Labeling
 *
 * Defines types for automatic BIO label generation using existing extractors.
 */

import type { BIOTag, EntityType, LinearizedToken } from '@/server/ml/features/dom-linearizer';

import type { ListPageExtractionResult } from './list-page-extractor/types';
import type { PatternSignal as PatternSignalType } from './pattern-detector';


// Re-export pattern types for convenience
export type {
  PatternType,
  PatternSignal,
  PatternDetectionResult,
} from './pattern-detector';

// Local alias to avoid circular dependency issues
type PatternSignal = PatternSignalType;

// ============================================================================
// Extracted Metadata Types
// ============================================================================

export interface ExtractedValues {
  title?: string | undefined;
  altTitles?: string[] | undefined;
  author?: string | undefined;
  artist?: string | undefined;
  summary?: string | undefined;
  status?: string | undefined;
  genres?: string[] | undefined;
  volumeCount?: number | string | undefined;
  volumeNumber?: number | string | undefined; // This volume's sequence number in series (e.g., Vol. 4)
  chapterCount?: number | string | undefined;
  chapterVolumeNumber?: number | string | undefined; // Which volume a chapter belongs to
  volumeTitles?: string[] | undefined;
  chapterTitles?: string[] | undefined;
  chapterUrls?: string[] | undefined;
  pageCount?: number | string | undefined; // Number of pages in a chapter
  releaseDate?: string | undefined;
  publisher?: string | undefined;
  magazine?: string | undefined;
  coverImage?: string | undefined;
  demographic?: string | undefined;
  // New high-value fields
  themes?: string[] | undefined;
  tags?: string[] | undefined;
  format?: string | undefined;
  characters?: string[] | undefined;

  // List page structured data (for "Chapters and Volumes" pages)
  listPageData?: ListPageExtractionResult | undefined;
}

// ============================================================================
// Token Matching Types
// ============================================================================

export interface TokenMatch {
  tokenIndex: number;
  startCharIndex: number;
  endCharIndex: number;
  matchedText: string;
  matchType: 'exact' | 'substring' | 'multi-token' | 'propagation';
}

export interface TokenSpan {
  start: number;
  end: number;
  entityType: EntityType;
  confidence: number;
  matchType: TokenMatch['matchType'];
}

// ============================================================================
// Bootstrap Result Types
// ============================================================================

export interface BootstrapResult {
  tokens: LinearizedToken[];
  labels: BIOTag[];
  spans: TokenSpan[];
  extractedValues: ExtractedValues;
  confidence: number;
  needsReview: boolean;
  stats: BootstrapStats;
  /** Pattern signals detected during labeling (for debugging/analysis) */
  patternSignals?: PatternSignal[];
}

export interface BootstrapStats {
  totalTokens: number;
  labeledTokens: number;
  entityCounts: Record<EntityType, number>;
  matchedEntities: EntityType[];
  missedEntities: EntityType[];
}

// ============================================================================
// Bootstrap Options
// ============================================================================

export interface BootstrapOptions {
  minConfidence?: number;
  preferExactMatch?: boolean;
  maxMultiTokenSpan?: number;
  enableFuzzyMatch?: boolean;
  focusEntities?: EntityType[];
}

export const DEFAULT_BOOTSTRAP_OPTIONS: Required<BootstrapOptions> = {
  minConfidence: 0.5,
  preferExactMatch: true,
  maxMultiTokenSpan: 10,
  enableFuzzyMatch: true,
  focusEntities: [],
};

// ============================================================================
// Per-Entity Confidence Configuration
// ============================================================================

export interface EntityConfidenceConfig {
  /** Minimum confidence required to accept a match */
  minConfidence: number;
  /** Additional confidence boost from pattern detection */
  patternBoost: number;
  /** Whether a pattern signal is required for this entity type */
  requirePatternSignal: boolean;
}

/**
 * Per-entity confidence thresholds
 *
 * Different entity types have different reliability characteristics:
 * - TITLE: Usually reliable, often in prominent position
 * - AUTHOR/ARTIST: Needs pattern signal to avoid false positives
 * - VOLUME_COUNT/CHAPTER_COUNT: Numbers need high confidence to avoid collisions
 * - GENRE: Often in lists, lower threshold acceptable
 */
export const ENTITY_CONFIDENCE_THRESHOLDS: Partial<Record<EntityType, EntityConfidenceConfig>> = {
  TITLE: { minConfidence: 0.7, patternBoost: 0.1, requirePatternSignal: false },
  ALT_TITLE: { minConfidence: 0.6, patternBoost: 0.15, requirePatternSignal: true },
  AUTHOR: { minConfidence: 0.6, patternBoost: 0.15, requirePatternSignal: true },
  ARTIST: { minConfidence: 0.6, patternBoost: 0.15, requirePatternSignal: true },
  STATUS: { minConfidence: 0.5, patternBoost: 0.2, requirePatternSignal: true },
  VOLUME_COUNT: { minConfidence: 0.8, patternBoost: 0.1, requirePatternSignal: true },
  VOLUME_NUMBER: { minConfidence: 0.8, patternBoost: 0.1, requirePatternSignal: true },
  CHAPTER_COUNT: { minConfidence: 0.8, patternBoost: 0.1, requirePatternSignal: true },
  CHAPTER_BELONGS_TO_VOLUME: { minConfidence: 0.8, patternBoost: 0.1, requirePatternSignal: true },
  CHAPTER_NUMBER: { minConfidence: 0.8, patternBoost: 0.1, requirePatternSignal: true },
  PAGE_COUNT: { minConfidence: 0.8, patternBoost: 0.1, requirePatternSignal: true },
  VOLUME_PAGE_COUNT: { minConfidence: 0.8, patternBoost: 0.1, requirePatternSignal: true },
  GENRE: { minConfidence: 0.4, patternBoost: 0.2, requirePatternSignal: false },
  SERIES_SUMMARY: { minConfidence: 0.5, patternBoost: 0.1, requirePatternSignal: false },
  PUBLISHER: { minConfidence: 0.6, patternBoost: 0.15, requirePatternSignal: true },
  MAGAZINE: { minConfidence: 0.6, patternBoost: 0.15, requirePatternSignal: true },
  DEMOGRAPHIC: { minConfidence: 0.5, patternBoost: 0.2, requirePatternSignal: true },
  RELEASE_DATE: { minConfidence: 0.6, patternBoost: 0.15, requirePatternSignal: true },
  THEMES: { minConfidence: 0.5, patternBoost: 0.15, requirePatternSignal: false },
  TAGS: { minConfidence: 0.4, patternBoost: 0.15, requirePatternSignal: false },
  FORMAT: { minConfidence: 0.6, patternBoost: 0.15, requirePatternSignal: true },
  // NOTE: CHARACTERS removed - entity type no longer used
  COVER_IMAGE: { minConfidence: 0.7, patternBoost: 0.1, requirePatternSignal: false },
};

/**
 * Get confidence config for an entity type with defaults
 */
export function getEntityConfidenceConfig(entityType: EntityType): EntityConfidenceConfig {
  return ENTITY_CONFIDENCE_THRESHOLDS[entityType] ?? {
    minConfidence: 0.5,
    patternBoost: 0.15,
    requirePatternSignal: false,
  };
}

// ============================================================================
// Suggestion Types (Phase 4: Suggestion-Based Pre-Annotation UI)
// ============================================================================

/** Source of a label suggestion */
export type SuggestionSource =
  | 'positional'
  | 'pattern'
  | 'css_selector'
  | 'propagation'
  | 'source_rule';

/**
 * A suggestion for labeling one or more tokens.
 * Suggestions are presented to users for review before being applied as labels.
 */
export interface LabelSuggestion {
  /** Unique identifier for this suggestion */
  id: string;
  /** Token indices this suggestion applies to */
  tokenIndices: number[];
  /** Suggested entity type */
  entityType: EntityType;
  /** Confidence score (0-1) */
  confidence: number;
  /** Source of the suggestion */
  source: SuggestionSource;
  /** Human-readable explanation of why this suggestion was made */
  reasoning: string;
  /** Rule ID that generated this suggestion (for debugging) */
  ruleId?: string;
  /** Combined text of the suggested tokens */
  text: string;
}

/**
 * Extended bootstrap result with suggestions for review.
 * Separates high-confidence auto-applied labels from lower-confidence suggestions.
 */
export interface BootstrapResultEnhanced extends BootstrapResult {
  /** Suggestions ranked by confidence (highest first) */
  suggestions: LabelSuggestion[];
  /** Number of high-confidence labels auto-applied */
  autoAppliedCount: number;
  /** Number of medium-confidence suggestions needing review */
  pendingReviewCount: number;
  /** Threshold used for auto-applying labels */
  autoApplyThreshold: number;
}

/** Thresholds for suggestion handling */
export interface SuggestionThresholds {
  /** Labels above this confidence are auto-applied (default: 0.9) */
  autoApply: number;
  /** Labels below this confidence are hidden (default: 0.4) */
  minDisplay: number;
}

export const DEFAULT_SUGGESTION_THRESHOLDS: SuggestionThresholds = {
  autoApply: 0.9,
  minDisplay: 0.4,
};
