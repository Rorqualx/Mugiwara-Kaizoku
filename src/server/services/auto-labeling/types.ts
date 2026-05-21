/**
 * Auto-Labeling Improvement System Types
 *
 * Defines types for the iterative auto-labeling improvement system that
 * samples pages, runs parsers, measures accuracy, and identifies failures.
 *
 * @module auto-labeling/types
 */

import type { EntityType } from '@/server/ml/features/dom-linearizer';
import type { AutoQualityResult } from '@/server/ml/quality/auto-scorer';
import type { BootstrapResult } from '@/server/ml/training/bootstrap-labeler/types';
import type { StaticAnalysisResult } from '@/server/services/fandom/adaptive/static-analyzer';
import type { AdaptiveParseResult, StructureType } from '@/server/services/fandom/adaptive/types';

// ============================================================================
// Training Data Types
// ============================================================================

/**
 * Discovered URL type from training data CSV.
 */
export type DiscoveredUrlType =
  | 'CHAPTERS'
  | 'VOLUMES'
  | 'CHAPTERS_VOLUMES'
  | 'MANGA_PAGE'
  | 'ARCS'
  | 'CATEGORY'
  | 'GALLERY_SECTION'
  | 'OTHER';

/**
 * Parsed discovered URL with type and URL.
 */
export interface DiscoveredUrl {
  type: DiscoveredUrlType;
  url: string;
  /** Optional category name for CATEGORY type URLs */
  categoryName?: string;
}

/**
 * Raw row from the training data CSV.
 */
export interface TrainingDataRow {
  Title: string;
  AniListID: string;
  WikipediaURL: string;
  FandomURL: string;
  ComicVineID: string;
  FandomDiscoveredURLs: string;
  WikipediaDiscoveredURLs: string;
  ComicVineDiscoveredURLs: string;
}

/**
 * Parsed training data entry with structured discovered URLs.
 */
export interface TrainingEntry {
  title: string;
  anilistId: number | null;
  wikipediaUrl: string | null;
  fandomUrl: string | null;
  comicVineId: string | null;
  fandomDiscoveredUrls: DiscoveredUrl[];
  wikipediaDiscoveredUrls: DiscoveredUrl[];
  comicVineDiscoveredUrls: DiscoveredUrl[];
}

/**
 * Filter criteria for sampling training data.
 */
export interface SamplingFilters {
  /** Only include entries with AniList ID */
  requireAnilistId?: boolean;
  /** Only include entries with Fandom discovered URLs */
  requireFandomUrls?: boolean;
  /** Only include entries with Wikipedia discovered URLs */
  requireWikipediaUrls?: boolean;
  /** Filter by discovered URL types */
  urlTypes?: DiscoveredUrlType[];
  /** Exclude specific AniList IDs (already processed) */
  excludeAnilistIds?: number[];
  /** Include ONLY these specific AniList IDs (for targeted iterations) */
  includeAnilistIds?: number[];
  /** Include only specific sources */
  sources?: Array<'fandom' | 'wikipedia' | 'comicvine'>;
}

// ============================================================================
// Sampled Page Types
// ============================================================================

/**
 * A page sampled from training data for labeling attempt.
 */
export interface SampledPage {
  /** Unique identifier for this sample (anilistId-source-urlType) */
  id: string;
  /** Original title from training data */
  title: string;
  /** AniList ID for ground truth fetch */
  anilistId: number;
  /** Source of the page (fandom, wikipedia, comicvine) */
  source: 'fandom' | 'wikipedia' | 'comicvine';
  /** The URL to fetch and label */
  url: string;
  /** Type of the discovered URL */
  urlType: DiscoveredUrlType;
  /** Base wiki URL (without path) */
  baseUrl: string | null;
}

// ============================================================================
// Entity Extraction Types
// ============================================================================

/**
 * An extracted entity from labeling.
 */
export interface ExtractedEntity {
  /** Entity type (TITLE, AUTHOR, etc.) */
  type: EntityType;
  /** Extracted value */
  value: string;
  /** Normalized value for comparison */
  normalizedValue: string;
  /** Confidence score (0-1) */
  confidence: number;
  /** Source of extraction */
  source: 'bootstrap' | 'parser' | 'static_analysis' | 'merged';
  /** Token indices if from bootstrap labeler */
  tokenIndices?: number[];
}

/**
 * Expected entity from ground truth (AniList).
 */
export interface ExpectedEntity {
  type: EntityType;
  value: string;
  normalizedValue: string;
  /** Whether this entity is required (must be found) */
  required: boolean;
}

// ============================================================================
// Labeling Attempt Types
// ============================================================================

/**
 * Result of a single labeling attempt on a page.
 */
export interface LabelingAttempt {
  /** The page that was sampled */
  page: SampledPage;
  /** Whether the attempt was successful */
  success: boolean;
  /** Error message if failed */
  error?: string;
  /** Error category for analysis */
  errorCategory?: ErrorCategory;
  /** Extracted entities */
  extractedEntities: ExtractedEntity[];
  /** Expected entities from ground truth */
  expectedEntities: ExpectedEntity[];
  /** Metrics for this attempt */
  metrics: LabelingMetrics | null;
  /** Bootstrap labeler result (if run) */
  bootstrapResult?: BootstrapResult;
  /** Parser result (if run) */
  parserResult?: AdaptiveParseResult;
  /** Static analysis result (if run) */
  staticAnalysis?: StaticAnalysisResult;
  /** Quality score */
  qualityResult?: AutoQualityResult;
  /** Time taken in milliseconds */
  durationMs: number;
  /** Timestamp of the attempt */
  timestamp: Date;
}

// ============================================================================
// Metrics Types
// ============================================================================

/**
 * Precision/Recall/F1 metrics for entity extraction.
 */
export interface LabelingMetrics {
  /** True positives count */
  truePositives: number;
  /** False positives count */
  falsePositives: number;
  /** False negatives count */
  falseNegatives: number;
  /** Precision = TP / (TP + FP) */
  precision: number;
  /** Recall = TP / (TP + FN) */
  recall: number;
  /** F1 = 2 * (P * R) / (P + R) */
  f1: number;
  /** Per-entity-type breakdown */
  byEntityType: Record<string, EntityTypeMetrics>;
  /** Matched entity pairs */
  matches: EntityMatch[];
  /** Unmatched extracted entities (false positives) */
  unmatchedExtracted: ExtractedEntity[];
  /** Unmatched expected entities (false negatives) */
  unmatchedExpected: ExpectedEntity[];
}

/**
 * Metrics for a specific entity type.
 */
export interface EntityTypeMetrics {
  entityType: EntityType;
  truePositives: number;
  falsePositives: number;
  falseNegatives: number;
  precision: number;
  recall: number;
  f1: number;
}

/**
 * A matched pair of extracted and expected entities.
 */
export interface EntityMatch {
  extracted: ExtractedEntity;
  expected: ExpectedEntity;
  /** Similarity score (0-1) */
  similarity: number;
  /** Match type (exact, fuzzy, partial) */
  matchType: 'exact' | 'fuzzy' | 'partial';
}

/**
 * Aggregated metrics across multiple attempts.
 */
export interface AggregatedMetrics {
  /** Number of attempts included */
  totalAttempts: number;
  /** Number of successful attempts */
  successfulAttempts: number;
  /** Average precision */
  avgPrecision: number;
  /** Average recall */
  avgRecall: number;
  /** Average F1 */
  avgF1: number;
  /** Micro-averaged metrics (pooled counts) */
  microPrecision: number;
  microRecall: number;
  microF1: number;
  /** Per-entity-type averages */
  byEntityType: Record<string, EntityTypeMetrics>;
}

// ============================================================================
// Error Classification Types
// ============================================================================

/**
 * Error categories for failure analysis.
 */
export enum ErrorCategory {
  /** Wrong parser was chosen for the page structure */
  PARSER_SELECTION_FAILED = 'PARSER_SELECTION_FAILED',
  /** Page structure not recognized by static analyzer */
  STRUCTURE_NOT_RECOGNIZED = 'STRUCTURE_NOT_RECOGNIZED',
  /** Structure found but entity extraction failed */
  ENTITY_EXTRACTION_FAILED = 'ENTITY_EXTRACTION_FAILED',
  /** Bootstrap pattern didn't match expected format */
  PATTERN_MISMATCH = 'PATTERN_MISMATCH',
  /** Extraction confidence too low */
  CONFIDENCE_TOO_LOW = 'CONFIDENCE_TOO_LOW',
  /** Page fetch/HTTP error */
  FETCH_ERROR = 'FETCH_ERROR',
  /** Ground truth fetch failed */
  GROUND_TRUTH_ERROR = 'GROUND_TRUTH_ERROR',
  /** HTML parsing error */
  PARSE_ERROR = 'PARSE_ERROR',
  /** Page has no extractable content */
  NO_CONTENT = 'NO_CONTENT',
  /** Timeout during processing */
  TIMEOUT = 'TIMEOUT',
  /** Unknown error */
  UNKNOWN = 'UNKNOWN',
}

/**
 * Detailed failure information.
 */
export interface FailureDetails {
  category: ErrorCategory;
  message: string;
  /** Suggested fix for this failure */
  suggestion?: string;
  /** Specific patterns or selectors that failed */
  failedPatterns?: string[];
  /** Parser that was selected (if any) */
  selectedParser?: string;
  /** Recommended parser based on analysis */
  recommendedParser?: string;
  /** Structure type detected (if any) */
  detectedStructure?: StructureType;
  /** Confidence level of failed operation */
  confidenceLevel?: number;
}

// ============================================================================
// Iteration Types
// ============================================================================

/**
 * Configuration for an iteration run.
 */
export interface IterationConfig {
  /** Number of pages to sample per iteration */
  sampleSize: number;
  /** Sampling filters */
  filters?: SamplingFilters;
  /** Target F1 score to stop iterations */
  targetF1: number;
  /** Maximum iterations before stopping */
  maxIterations: number;
  /** Minimum confidence for entity matches */
  minMatchConfidence: number;
  /** Enable parallel processing */
  parallel: boolean;
  /** Concurrency limit for parallel processing */
  concurrency: number;
  /** Timeout per page in milliseconds */
  pageTimeoutMs: number;
  /** Whether to save results to file */
  saveResults: boolean;
  /** Output directory for results */
  outputDir: string;
  /** Random seed for reproducible sampling */
  seed?: number;
}

/**
 * Default iteration configuration.
 */
export const DEFAULT_ITERATION_CONFIG: IterationConfig = {
  sampleSize: 10,
  targetF1: 0.85,
  maxIterations: 100,
  minMatchConfidence: 0.6,
  parallel: true,
  concurrency: 3,
  pageTimeoutMs: 30000,
  saveResults: true,
  outputDir: 'data/auto-labeling/iterations',
  filters: {
    requireAnilistId: true,
    requireFandomUrls: true,
    // Start with MANGA_PAGE to test series-level extraction against series-level ground truth
    // Phase 2: Expand to VOLUMES, CHAPTERS after adding page-type-aware expected entities
    urlTypes: ['MANGA_PAGE'],
    sources: ['fandom'],
  },
};

/**
 * Result of a single iteration.
 */
export interface IterationResult {
  /** Iteration number */
  iterationNumber: number;
  /** Timestamp of the iteration */
  timestamp: Date;
  /** Configuration used */
  config: IterationConfig;
  /** Pages sampled */
  sampledPages: SampledPage[];
  /** Labeling attempts */
  attempts: LabelingAttempt[];
  /** Aggregated metrics */
  metrics: AggregatedMetrics;
  /** Failure analysis */
  failures: FailureAnalysis;
  /** Improvement suggestions */
  suggestions: ImprovementSuggestion[];
  /** Total duration in milliseconds */
  durationMs: number;
  /** Whether target was met */
  targetMet: boolean;
}

/**
 * Analysis of failures across an iteration.
 */
export interface FailureAnalysis {
  /** Total number of failures */
  totalFailures: number;
  /** Failures by category */
  byCategory: Record<ErrorCategory, FailureCategoryAnalysis>;
  /** Most common failure patterns */
  commonPatterns: FailurePattern[];
  /** Pages that failed */
  failedPageIds: string[];
}

/**
 * Analysis of a specific failure category.
 */
export interface FailureCategoryAnalysis {
  count: number;
  percentage: number;
  examples: FailureDetails[];
}

/**
 * Common failure pattern detected.
 */
export interface FailurePattern {
  pattern: string;
  count: number;
  affectedPages: string[];
  suggestedFix: string;
}

// ============================================================================
// Improvement Types
// ============================================================================

/**
 * Priority levels for improvements.
 */
export type ImprovementPriority = 'critical' | 'high' | 'medium' | 'low';

/**
 * A suggested improvement based on failure analysis.
 */
export interface ImprovementSuggestion {
  /** Unique identifier */
  id: string;
  /** Priority level */
  priority: ImprovementPriority;
  /** Category of the improvement */
  category: 'parser' | 'pattern' | 'structure' | 'confidence' | 'threshold';
  /** Title of the suggestion */
  title: string;
  /** Detailed description */
  description: string;
  /** Expected impact on F1 score */
  expectedImpact: number;
  /** Files that need to be modified */
  affectedFiles?: string[];
  /** Related error categories */
  relatedErrors: ErrorCategory[];
  /** Number of pages this would fix */
  affectedPageCount: number;
}

// ============================================================================
// Progress Tracking Types
// ============================================================================

/**
 * Progress report across iterations.
 */
export interface ProgressReport {
  /** Total iterations run */
  totalIterations: number;
  /** Best F1 achieved */
  bestF1: number;
  /** Current F1 */
  currentF1: number;
  /** F1 trend (positive = improving) */
  f1Trend: number;
  /** Iterations history (last N) */
  history: IterationSummary[];
  /** Active improvement suggestions */
  activeSuggestions: ImprovementSuggestion[];
  /** Regressions detected */
  regressions: Regression[];
  /** Estimated iterations to target */
  estimatedIterationsToTarget: number | null;
}

/**
 * Summary of an iteration for history.
 */
export interface IterationSummary {
  iterationNumber: number;
  timestamp: Date;
  f1: number;
  precision: number;
  recall: number;
  successRate: number;
  topError: ErrorCategory;
  durationMs: number;
}

/**
 * A detected regression in accuracy.
 */
export interface Regression {
  /** Iteration where regression was detected */
  iterationNumber: number;
  /** Metric that regressed */
  metric: 'f1' | 'precision' | 'recall';
  /** Previous value */
  previousValue: number;
  /** Current value */
  currentValue: number;
  /** Likely cause */
  likelyCause?: string;
}

// ============================================================================
// Entity Type Targets
// ============================================================================

/**
 * Target F1 scores by entity type.
 */
export const ENTITY_TYPE_TARGETS: Partial<Record<EntityType, number>> = {
  TITLE: 0.95,
  AUTHOR: 0.85,
  STATUS: 0.80,
  VOLUME_COUNT: 0.75,
  CHAPTER_COUNT: 0.75,
  GENRE: 0.70,
  SERIES_SUMMARY: 0.70,
  PUBLISHER: 0.70,
  DEMOGRAPHIC: 0.75,
  RELEASE_DATE: 0.70,
};

// ============================================================================
// Agent Ground Truth Types
// ============================================================================

/**
 * Ground truth extracted by an agent analyzing the actual wiki page.
 * Unlike AniList ground truth (which only has ~10 entity types),
 * agent ground truth can cover all 30+ entity types visible on the page.
 */
export interface AgentGroundTruth {
  /** URL of the page analyzed */
  pageUrl: string;
  /** Type of the page (MANGA_PAGE, VOLUMES, etc.) */
  pageType: DiscoveredUrlType;
  /** Source wiki (fandom, wikipedia, comicvine) */
  source: 'fandom' | 'wikipedia' | 'comicvine';
  /** Entities extracted by the agent */
  entities: ExpectedEntity[];
  /** When the ground truth was extracted */
  extractedAt: Date;
  /** Model used for extraction */
  agentModel: string;
  /** Overall confidence in the extraction (0-1) */
  confidence: number;
  /** Optional: Raw agent response for debugging */
  rawResponse?: string | undefined;
}

/**
 * Issue type for failure analysis.
 */
export type IssueType = 'missed' | 'wrong_value' | 'noise' | 'low_confidence';

/**
 * A detailed improvement suggestion based on failure analysis.
 */
export interface DetailedImprovementSuggestion {
  /** Entity type this suggestion applies to */
  entityType: EntityType;
  /** Type of issue detected */
  issue: IssueType;
  /** Pattern or selector that caused the issue */
  pattern: string;
  /** Suggested fix description */
  suggestedFix: string;
  /** Example failures */
  examples: Array<{
    /** Expected value from ground truth */
    expected: string;
    /** Extracted value (or null if missed) */
    extracted: string | null;
    /** Page URL where this occurred */
    page: string;
  }>;
  /** Impact score (0-1) based on frequency and importance */
  impactScore: number;
  /** Files that may need modification */
  affectedFiles?: string[];
}

/**
 * Detailed metrics for agent-driven iteration.
 */
export interface AgentIterationMetrics {
  /** Overall metrics aggregated across all pages */
  overall: AggregatedMetrics;
  /** Metrics broken down by source (fandom, wikipedia, comicvine) */
  bySource: Record<string, AggregatedMetrics>;
  /** Metrics broken down by page type (MANGA_PAGE, VOLUMES, etc.) */
  byPageType: Record<string, AggregatedMetrics>;
  /** Metrics broken down by entity type */
  byEntityType: Record<string, EntityTypeMetrics>;
}

/**
 * Result of an agent-driven iteration.
 * Extends the basic IterationResult with agent-specific data.
 */
export interface AgentIterationResult {
  /** Unique identifier for this iteration */
  iterationId: string;
  /** When the iteration ran */
  timestamp: Date;
  /** Configuration used */
  config: IterationConfig;
  /** Pages sampled for this iteration */
  samples: SampledPage[];
  /** Ground truths extracted by agents */
  groundTruths: AgentGroundTruth[];
  /** Labeling attempts with results */
  attempts: LabelingAttempt[];
  /** Detailed metrics */
  metrics: AgentIterationMetrics;
  /** Detailed improvement suggestions */
  improvements: DetailedImprovementSuggestion[];
  /** Total duration in milliseconds */
  durationMs: number;
  /** Whether the target F1 was achieved */
  targetMet: boolean;
  /** Summary statistics */
  summary: {
    totalPages: number;
    successfulPages: number;
    failedPages: number;
    cachedGroundTruths: number;
    freshGroundTruths: number;
  };
}

/**
 * Cache entry for agent ground truth.
 * Used to avoid re-extracting ground truth for the same URL.
 */
export interface GroundTruthCacheEntry {
  /** URL as the cache key */
  url: string;
  /** The cached ground truth */
  groundTruth: AgentGroundTruth;
  /** When this entry was cached */
  cachedAt: Date;
  /** Cache version (for invalidation) */
  version: number;
}

/**
 * Configuration for agent ground truth extraction.
 */
export interface AgentGroundTruthConfig {
  /** Concurrency limit for parallel agent extraction */
  concurrency: number;
  /** Timeout per page in milliseconds */
  timeoutMs: number;
  /** Model to use for extraction */
  model: 'sonnet' | 'haiku' | 'opus';
  /** Whether to use cached ground truth if available */
  useCache: boolean;
  /** Cache directory path */
  cacheDir: string;
  /** Maximum HTML size to send to agent (chars) */
  maxHtmlSize: number;
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Type guard for DiscoveredUrlType.
 */
export function isDiscoveredUrlType(value: unknown): value is DiscoveredUrlType {
  const validTypes: DiscoveredUrlType[] = [
    'CHAPTERS',
    'VOLUMES',
    'CHAPTERS_VOLUMES',
    'MANGA_PAGE',
    'ARCS',
    'CATEGORY',
    'GALLERY_SECTION',
    'OTHER',
  ];
  return typeof value === 'string' && validTypes.includes(value as DiscoveredUrlType);
}

/**
 * Type guard for ErrorCategory.
 */
export function isErrorCategory(value: unknown): value is ErrorCategory {
  return typeof value === 'string' && Object.values(ErrorCategory).includes(value as ErrorCategory);
}

/**
 * Type guard for SampledPage.
 */
export function isSampledPage(value: unknown): value is SampledPage {
  if (typeof value !== 'object' || value === null) return false;
  const page = value as Partial<SampledPage>;
  return (
    typeof page.id === 'string' &&
    typeof page.title === 'string' &&
    typeof page.anilistId === 'number' &&
    typeof page.source === 'string' &&
    typeof page.url === 'string'
  );
}

/**
 * Type guard for LabelingAttempt.
 */
export function isLabelingAttempt(value: unknown): value is LabelingAttempt {
  if (typeof value !== 'object' || value === null) return false;
  const attempt = value as Partial<LabelingAttempt>;
  return (
    typeof attempt.success === 'boolean' &&
    isSampledPage(attempt.page) &&
    Array.isArray(attempt.extractedEntities)
  );
}
