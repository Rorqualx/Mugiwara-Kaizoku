/**
 * Agent Review Types
 *
 * Type definitions for the LLM-based label verification workflow.
 * These types support the agent review step between auto-labeling and human review.
 */

import type { BIOTag, EntityType } from '@/server/ml/features/bio-types';

import type { AnnotationSourceType, AnnotationStatus } from '@prisma/client';


// ============================================================================
// Page Type Classification
// ============================================================================

/**
 * Page type classification for context-aware validation
 */
export type PageType =
  | 'SERIES_PAGE'        // Main manga/series overview (/wiki/One_Piece)
  | 'MANGA_PAGE'         // Alternative series page format (/manga/one-piece)
  | 'VOLUME_OVERVIEW'    // List of all volumes (/wiki/One_Piece/Volumes)
  | 'CHAPTER_OVERVIEW'   // List of all chapters (/wiki/One_Piece/Chapters)
  | 'INDIVIDUAL_VOLUME'  // Single volume details (/wiki/One_Piece/Volume_1)
  | 'INDIVIDUAL_CHAPTER' // Single chapter details (/wiki/One_Piece/Chapter_1)
  | 'UNKNOWN';

// ============================================================================
// Agent Review Result
// ============================================================================

/**
 * Result of an agent's review of a page's labels
 */
export interface AgentReviewResult {
  /** ID of the reviewed page */
  pageId: string;

  /** Review outcome status */
  status: 'approved' | 'corrected' | 'flagged';

  /** Overall confidence in the review (0-1) */
  confidence: number;

  /** Label corrections made by agent */
  corrections: AgentCorrections;

  /** Issues identified during review */
  issues: AgentIssues;

  /** Summary notes from the agent */
  notes: string;

  /** Processing time in milliseconds */
  processingTimeMs: number;

  /** Model version used for review */
  modelVersion: string;

  /** Detected page type for context */
  detectedPageType: PageType;

  /** Discovered URLs for related pages (chapters, volumes) */
  discoveredUrls: DiscoveredUrl[];
}

// ============================================================================
// Corrections
// ============================================================================

/**
 * Corrections made by the agent to existing labels
 */
export interface AgentCorrections {
  /** Labels added where none existed */
  added: LabelCorrection[];

  /** Labels removed as false positives */
  removed: LabelCorrection[];

  /** Labels changed to a different entity type */
  modified: LabelCorrection[];
}

/**
 * A single label correction
 */
export interface LabelCorrection {
  /** Start token index in the token array */
  tokenStart: number;

  /** End token index (exclusive) in the token array */
  tokenEnd: number;

  /** The actual text being labeled */
  text: string;

  /** Previous label (null if this is an addition) */
  previousLabel: BIOTag | null;

  /** New label being applied */
  newLabel: BIOTag;

  /** Reason for the correction */
  reason: string;

  /** Confidence in this specific correction (0-1) */
  confidence: number;
}

// ============================================================================
// Issues
// ============================================================================

/**
 * Issues found during agent review
 */
export interface AgentIssues {
  /** Critical issues requiring human review */
  errors: ReviewIssue[];

  /** Potential problems worth checking */
  warnings: ReviewIssue[];

  /** Improvement suggestions (non-blocking) */
  suggestions: ReviewIssue[];
}

/**
 * A single issue identified during review
 */
export interface ReviewIssue {
  /** Type of issue detected */
  type: AgentIssueType;

  /** Severity level */
  severity: 'error' | 'warning' | 'suggestion';

  /** Token indices affected (if applicable) */
  tokenIndices?: number[];

  /** Human-readable description of the issue */
  message: string;

  /** Suggested action to resolve */
  suggestedAction?: string;

  /** Entity type related to the issue (if applicable) */
  relatedEntity?: EntityType;
}

/**
 * Types of issues the agent can detect
 */
export type AgentIssueType =
  | 'navigation_as_content'     // Wiki nav labeled as real content
  | 'numeric_collision'         // Page number vs count confusion
  | 'author_attribution_error'  // Character name as author
  | 'missing_critical_entity'   // Missing TITLE, AUTHOR, etc.
  | 'wrong_page_type_context'   // CHAPTER_SUMMARY on series page
  | 'summary_is_navigation'     // Summary text is actually nav
  | 'duplicate_entity'          // Same entity labeled twice
  | 'impossible_value'          // Invalid ISBN, impossible date
  | 'low_confidence_span'       // Auto-labeler had low confidence
  | 'inconsistent_labeling'     // Similar patterns labeled differently
  | 'truncated_entity'          // Entity seems cut off
  | 'overlapping_entities'      // Entities overlap incorrectly
  | 'wrong_entity_type'         // Entity type doesn't match content
  | 'page_type_mismatch';       // Page type doesn't match expected entities

// ============================================================================
// URL Discovery
// ============================================================================

/**
 * A discovered URL for related pages
 */
export interface DiscoveredUrl {
  /** The discovered URL */
  url: string;

  /** Type of page the URL points to */
  pageType: PageType;

  /** Link text that led to discovery */
  linkText: string;

  /** Token index where the link was found */
  tokenIndex: number;

  /** Whether this URL should be auto-bootstrapped */
  shouldBootstrap: boolean;

  /** Priority for processing (higher = more important) */
  priority: number;
}

// ============================================================================
// Batch Processing
// ============================================================================

/**
 * Options for batch agent review processing
 */
export interface BatchReviewOptions {
  /** Pages per batch (default: 50) */
  batchSize: number;

  /** Parallel requests (default: 5) */
  concurrency: number;

  /** Only review pages from this source */
  sourceTypeFilter?: AnnotationSourceType;

  /** Only review pages with status */
  statusFilter?: AnnotationStatus;

  /** Only review pages below this confidence */
  minConfidenceThreshold?: number;

  /** Maximum pages to process in this run */
  maxPages?: number;

  /** Priority order for processing */
  priorityOrder: 'lowest_confidence' | 'oldest_first' | 'newest_first';

  /** Auto-apply corrections above this confidence */
  autoApplyThreshold: number;

  /** Model to use for review */
  modelId: string;

  /** Dry run mode - don't save changes */
  dryRun: boolean;
}

/**
 * Default batch review options
 */
export const DEFAULT_BATCH_OPTIONS: BatchReviewOptions = {
  batchSize: 50,
  concurrency: 5,
  priorityOrder: 'lowest_confidence',
  autoApplyThreshold: 0.9,
  modelId: 'claude-sonnet-4-20250514',
  dryRun: false,
};

/**
 * Result of a batch review operation
 */
export interface BatchReviewResult {
  /** Total pages processed */
  totalProcessed: number;

  /** Pages approved without changes */
  approved: number;

  /** Pages with corrections applied */
  corrected: number;

  /** Pages flagged for human review */
  flagged: number;

  /** Pages that failed processing */
  failed: number;

  /** Total corrections made */
  totalCorrections: {
    added: number;
    removed: number;
    modified: number;
  };

  /** Common issues found */
  commonIssues: Array<{ type: AgentIssueType; count: number }>;

  /** Total processing time in milliseconds */
  totalTimeMs: number;

  /** Average time per page in milliseconds */
  avgTimePerPageMs: number;

  /** New URLs discovered for bootstrapping */
  discoveredUrls: DiscoveredUrl[];

  /** Error messages for failed pages */
  errors: Array<{ pageId: string; error: string }>;
}

// ============================================================================
// Token & Span Types (shared between review-logic and correction-generator)
// ============================================================================

/**
 * A token with its annotation data, used for review
 */
export interface ReviewableToken {
  index: number;
  text: string;
  tagName: string;
  label: BIOTag;
  xpath: string | null;
  linkHref?: string | null;
  precedingText?: string | null;
  followingText?: string | null;
}

/**
 * A contiguous span of tokens sharing the same entity label
 */
export interface LabeledSpan {
  entityType: EntityType;
  startIndex: number;
  endIndex: number;
  text: string;
  tokens: ReviewableToken[];
}

// ============================================================================
// Validation Rules
// ============================================================================

/**
 * Validation rule for an entity type
 */
export interface EntityValidationRule {
  /** Entity type this rule applies to */
  entityType: EntityType;

  /** Minimum text length */
  minLength?: number;

  /** Maximum text length */
  maxLength?: number;

  /** Minimum numeric value */
  minValue?: number;

  /** Maximum numeric value */
  maxValue?: number;

  /** Patterns that invalidate the entity */
  invalidPatterns?: RegExp[];

  /** Patterns that validate the entity */
  validPatterns?: RegExp[];

  /** Requires label pattern context (e.g., "Author:") */
  requirePatternContext?: boolean;

  /** Valid page types for this entity */
  validPageTypes?: PageType[];

  /** Entities that conflict with this one */
  conflictsWith?: EntityType[];

  /** Must have sentences (for summaries) */
  requireSentences?: boolean;

  /** Custom validation function */
  customValidator?: (text: string, context: ValidationContext) => ValidationResult;
}

/**
 * Context provided to validators
 */
export interface ValidationContext {
  /** The token being validated */
  tokenText: string;

  /** Surrounding token texts */
  surroundingTokens: string[];

  /** Detected page type */
  pageType: PageType;

  /** Source type (fandom, wikipedia, etc.) */
  sourceType: AnnotationSourceType;

  /** Page URL */
  url: string;

  /** Text before the token */
  precedingText?: string;

  /** Text after the token */
  followingText?: string;
}

/**
 * Result of validation
 */
export interface ValidationResult {
  /** Whether the entity is valid */
  isValid: boolean;

  /** Confidence in the validation (0-1) */
  confidence: number;

  /** Issue if invalid */
  issue?: ReviewIssue;

  /** Suggested correction if invalid */
  suggestedCorrection?: LabelCorrection;
}

// ============================================================================
// Review Queue
// ============================================================================

/**
 * A page queued for agent review
 */
export interface ReviewQueueItem {
  /** Page ID */
  pageId: string;

  /** Page URL */
  url: string;

  /** Source type */
  sourceType: AnnotationSourceType;

  /** Current status */
  status: AnnotationStatus;

  /** Current confidence score */
  confidence: number | null;

  /** Priority score (higher = more important) */
  priority: number;

  /** Reason for prioritization */
  priorityReason: string;

  /** Queued timestamp */
  queuedAt: Date;
}

/**
 * Statistics about the review queue
 */
export interface ReviewQueueStats {
  /** Total pages pending review */
  totalPending: number;

  /** Breakdown by source type */
  bySourceType: Record<AnnotationSourceType, number>;

  /** Breakdown by confidence range */
  byConfidenceRange: {
    low: number;      // < 0.5
    medium: number;   // 0.5 - 0.8
    high: number;     // > 0.8
  };

  /** Average confidence of pending pages */
  avgConfidence: number;

  /** Estimated processing time (ms) */
  estimatedTimeMs: number;
}
