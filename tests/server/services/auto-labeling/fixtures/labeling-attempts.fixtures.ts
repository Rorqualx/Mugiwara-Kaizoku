/**
 * Labeling Attempt Fixtures
 *
 * Complete LabelingAttempt objects for integration and metrics tests.
 *
 * @module tests/auto-labeling/fixtures/labeling-attempts
 */

import { ErrorCategory } from '@/server/services/auto-labeling/types';

import type {
  LabelingAttempt,
  LabelingMetrics,
  AggregatedMetrics,
  FailureDetails,
  FailureAnalysis,
  IterationResult,
  IterationConfig,
  ImprovementSuggestion,
} from '@/server/services/auto-labeling/types';

import {
  SAMPLED_PAGE_FANDOM,
  SAMPLED_PAGE_WIKIPEDIA,
  SAMPLED_PAGE_COMICVINE,
  SAMPLED_PAGE_VOLUMES,
} from './training-data.fixtures';

import {
  EXTRACTED_ENTITIES_COMPLETE,
  EXTRACTED_ENTITIES_MINIMAL,
  EXTRACTED_ENTITIES_EMPTY,
  EXPECTED_ENTITIES_COMPLETE,
  EXPECTED_ENTITIES_MINIMAL,
  EXPECTED_ENTITIES_EMPTY,
  MATCH_EXACT_TITLE,
  MATCH_EXACT_AUTHOR,
  EXTRACTED_TITLE,
  EXTRACTED_AUTHOR,
  EXPECTED_TITLE,
  EXPECTED_AUTHOR,
} from './entities.fixtures';

// ============================================================================
// Labeling Metrics Fixtures
// ============================================================================

export const METRICS_PERFECT: LabelingMetrics = {
  truePositives: 5,
  falsePositives: 0,
  falseNegatives: 0,
  precision: 1.0,
  recall: 1.0,
  f1: 1.0,
  byEntityType: {
    TITLE: { entityType: 'TITLE' as const, truePositives: 1, falsePositives: 0, falseNegatives: 0, precision: 1.0, recall: 1.0, f1: 1.0 },
    AUTHOR: { entityType: 'AUTHOR' as const, truePositives: 1, falsePositives: 0, falseNegatives: 0, precision: 1.0, recall: 1.0, f1: 1.0 },
    STATUS: { entityType: 'STATUS' as const, truePositives: 1, falsePositives: 0, falseNegatives: 0, precision: 1.0, recall: 1.0, f1: 1.0 },
    VOLUME_COUNT: { entityType: 'VOLUME_COUNT' as const, truePositives: 1, falsePositives: 0, falseNegatives: 0, precision: 1.0, recall: 1.0, f1: 1.0 },
    CHAPTER_COUNT: { entityType: 'CHAPTER_COUNT' as const, truePositives: 1, falsePositives: 0, falseNegatives: 0, precision: 1.0, recall: 1.0, f1: 1.0 },
  },
  matches: [MATCH_EXACT_TITLE, MATCH_EXACT_AUTHOR],
  unmatchedExtracted: [],
  unmatchedExpected: [],
};

export const METRICS_PARTIAL: LabelingMetrics = {
  truePositives: 2,
  falsePositives: 1,
  falseNegatives: 3,
  precision: 0.667,
  recall: 0.4,
  f1: 0.5,
  byEntityType: {
    TITLE: { entityType: 'TITLE' as const, truePositives: 1, falsePositives: 0, falseNegatives: 0, precision: 1.0, recall: 1.0, f1: 1.0 },
    AUTHOR: { entityType: 'AUTHOR' as const, truePositives: 1, falsePositives: 0, falseNegatives: 0, precision: 1.0, recall: 1.0, f1: 1.0 },
    STATUS: { entityType: 'STATUS' as const, truePositives: 0, falsePositives: 0, falseNegatives: 1, precision: 0, recall: 0, f1: 0 },
    GENRE: { entityType: 'GENRE' as const, truePositives: 0, falsePositives: 1, falseNegatives: 2, precision: 0, recall: 0, f1: 0 },
  },
  matches: [MATCH_EXACT_TITLE, MATCH_EXACT_AUTHOR],
  unmatchedExtracted: [EXTRACTED_TITLE],
  unmatchedExpected: [EXPECTED_TITLE, EXPECTED_AUTHOR],
};

export const METRICS_ZERO: LabelingMetrics = {
  truePositives: 0,
  falsePositives: 0,
  falseNegatives: 5,
  precision: 0,
  recall: 0,
  f1: 0,
  byEntityType: {},
  matches: [],
  unmatchedExtracted: [],
  unmatchedExpected: EXPECTED_ENTITIES_MINIMAL,
};

export const METRICS_HIGH_PRECISION: LabelingMetrics = {
  truePositives: 3,
  falsePositives: 0,
  falseNegatives: 7,
  precision: 1.0,
  recall: 0.3,
  f1: 0.46,
  byEntityType: {},
  matches: [],
  unmatchedExtracted: [],
  unmatchedExpected: [],
};

export const METRICS_HIGH_RECALL: LabelingMetrics = {
  truePositives: 8,
  falsePositives: 5,
  falseNegatives: 2,
  precision: 0.615,
  recall: 0.8,
  f1: 0.696,
  byEntityType: {},
  matches: [],
  unmatchedExtracted: [],
  unmatchedExpected: [],
};

// ============================================================================
// Labeling Attempt Fixtures - Success Cases
// ============================================================================

export const ATTEMPT_SUCCESS_PERFECT: LabelingAttempt = {
  page: SAMPLED_PAGE_FANDOM,
  success: true,
  extractedEntities: EXTRACTED_ENTITIES_COMPLETE,
  expectedEntities: EXPECTED_ENTITIES_COMPLETE,
  metrics: METRICS_PERFECT,
  durationMs: 1500,
  timestamp: new Date('2025-01-01T12:00:00Z'),
};

export const ATTEMPT_SUCCESS_PARTIAL: LabelingAttempt = {
  page: SAMPLED_PAGE_WIKIPEDIA,
  success: true,
  extractedEntities: EXTRACTED_ENTITIES_MINIMAL,
  expectedEntities: EXPECTED_ENTITIES_MINIMAL,
  metrics: METRICS_PARTIAL,
  durationMs: 2000,
  timestamp: new Date('2025-01-01T12:01:00Z'),
};

export const ATTEMPT_SUCCESS_MINIMAL: LabelingAttempt = {
  page: SAMPLED_PAGE_VOLUMES,
  success: true,
  extractedEntities: [EXTRACTED_TITLE, EXTRACTED_AUTHOR],
  expectedEntities: [EXPECTED_TITLE, EXPECTED_AUTHOR],
  metrics: {
    truePositives: 2,
    falsePositives: 0,
    falseNegatives: 0,
    precision: 1.0,
    recall: 1.0,
    f1: 1.0,
    byEntityType: {
      TITLE: { entityType: 'TITLE' as const, truePositives: 1, falsePositives: 0, falseNegatives: 0, precision: 1.0, recall: 1.0, f1: 1.0 },
      AUTHOR: { entityType: 'AUTHOR' as const, truePositives: 1, falsePositives: 0, falseNegatives: 0, precision: 1.0, recall: 1.0, f1: 1.0 },
    },
    matches: [MATCH_EXACT_TITLE, MATCH_EXACT_AUTHOR],
    unmatchedExtracted: [],
    unmatchedExpected: [],
  },
  durationMs: 1200,
  timestamp: new Date('2025-01-01T12:02:00Z'),
};

// ============================================================================
// Labeling Attempt Fixtures - Failure Cases
// ============================================================================

export const ATTEMPT_FAILURE_FETCH: LabelingAttempt = {
  page: SAMPLED_PAGE_FANDOM,
  success: false,
  error: 'Failed to fetch: ECONNREFUSED',
  errorCategory: ErrorCategory.FETCH_ERROR,
  extractedEntities: EXTRACTED_ENTITIES_EMPTY,
  expectedEntities: EXPECTED_ENTITIES_EMPTY,
  metrics: null,
  durationMs: 500,
  timestamp: new Date('2025-01-01T12:03:00Z'),
};

export const ATTEMPT_FAILURE_GROUND_TRUTH: LabelingAttempt = {
  page: SAMPLED_PAGE_WIKIPEDIA,
  success: false,
  error: 'No media found for AniList ID 99999',
  errorCategory: ErrorCategory.GROUND_TRUTH_ERROR,
  extractedEntities: EXTRACTED_ENTITIES_MINIMAL,
  expectedEntities: EXPECTED_ENTITIES_EMPTY,
  metrics: null,
  durationMs: 800,
  timestamp: new Date('2025-01-01T12:04:00Z'),
};

export const ATTEMPT_FAILURE_TIMEOUT: LabelingAttempt = {
  page: SAMPLED_PAGE_COMICVINE,
  success: false,
  error: 'Operation timed out after 30000ms',
  errorCategory: ErrorCategory.TIMEOUT,
  extractedEntities: EXTRACTED_ENTITIES_EMPTY,
  expectedEntities: EXPECTED_ENTITIES_EMPTY,
  metrics: null,
  durationMs: 30000,
  timestamp: new Date('2025-01-01T12:05:00Z'),
};

export const ATTEMPT_FAILURE_PARSE: LabelingAttempt = {
  page: SAMPLED_PAGE_FANDOM,
  success: false,
  error: 'Invalid HTML: Cheerio failed to parse',
  errorCategory: ErrorCategory.PARSE_ERROR,
  extractedEntities: EXTRACTED_ENTITIES_EMPTY,
  expectedEntities: EXPECTED_ENTITIES_MINIMAL,
  metrics: null,
  durationMs: 600,
  timestamp: new Date('2025-01-01T12:06:00Z'),
};

export const ATTEMPT_FAILURE_NO_CONTENT: LabelingAttempt = {
  page: SAMPLED_PAGE_VOLUMES,
  success: false,
  error: 'Page has no extractable content',
  errorCategory: ErrorCategory.NO_CONTENT,
  extractedEntities: EXTRACTED_ENTITIES_EMPTY,
  expectedEntities: EXPECTED_ENTITIES_MINIMAL,
  metrics: null,
  durationMs: 400,
  timestamp: new Date('2025-01-01T12:07:00Z'),
};

export const ATTEMPT_FAILURE_STRUCTURE = {
  page: SAMPLED_PAGE_FANDOM,
  success: false,
  error: 'Structure not recognized by static analyzer',
  errorCategory: ErrorCategory.STRUCTURE_NOT_RECOGNIZED,
  extractedEntities: EXTRACTED_ENTITIES_EMPTY,
  expectedEntities: EXPECTED_ENTITIES_MINIMAL,
  metrics: null,
  staticAnalysis: {
    tables: { totalCount: 0, infoboxCount: 0, dataTableCount: 0 },
    lists: { totalCount: 0, nestedLists: 0, definitionLists: 0 },
    headers: { h1Count: 1, h2Count: 0, h3Count: 0, deepestLevel: 1 },
    recommendedParser: { primary: 'generic', confidence: 0.3, alternatives: [] },
  },
  durationMs: 700,
  timestamp: new Date('2025-01-01T12:08:00Z'),
} as unknown as LabelingAttempt;

export const ATTEMPT_FAILURE_PARSER: LabelingAttempt = {
  page: SAMPLED_PAGE_WIKIPEDIA,
  success: false,
  error: 'Parser selection failed',
  errorCategory: ErrorCategory.PARSER_SELECTION_FAILED,
  extractedEntities: EXTRACTED_ENTITIES_EMPTY,
  expectedEntities: EXPECTED_ENTITIES_MINIMAL,
  metrics: null,
  durationMs: 900,
  timestamp: new Date('2025-01-01T12:09:00Z'),
};

export const ATTEMPT_FAILURE_EXTRACTION = {
  page: SAMPLED_PAGE_FANDOM,
  success: false,
  error: 'Entity extraction failed',
  errorCategory: ErrorCategory.ENTITY_EXTRACTION_FAILED,
  extractedEntities: EXTRACTED_ENTITIES_EMPTY,
  expectedEntities: EXPECTED_ENTITIES_MINIMAL,
  metrics: null,
  parserResult: {
    success: false,
    confidence: 0.4,
    error: 'Extraction failed',
    structureType: 'volume-list',
  },
  durationMs: 1100,
  timestamp: new Date('2025-01-01T12:10:00Z'),
} as unknown as LabelingAttempt;

export const ATTEMPT_FAILURE_PATTERN = {
  page: SAMPLED_PAGE_FANDOM,
  success: false,
  error: 'Pattern mismatch',
  errorCategory: ErrorCategory.PATTERN_MISMATCH,
  extractedEntities: EXTRACTED_ENTITIES_EMPTY,
  expectedEntities: EXPECTED_ENTITIES_MINIMAL,
  metrics: null,
  bootstrapResult: {
    spans: [],
    confidence: 0.6,
    tokens: [],
  },
  durationMs: 850,
  timestamp: new Date('2025-01-01T12:11:00Z'),
} as unknown as LabelingAttempt;

export const ATTEMPT_FAILURE_CONFIDENCE = {
  page: SAMPLED_PAGE_COMICVINE,
  success: false,
  error: 'Confidence too low (35%)',
  errorCategory: ErrorCategory.CONFIDENCE_TOO_LOW,
  extractedEntities: EXTRACTED_ENTITIES_EMPTY,
  expectedEntities: EXPECTED_ENTITIES_MINIMAL,
  metrics: null,
  parserResult: {
    success: true,
    confidence: 0.35,
    data: {},
  },
  durationMs: 950,
  timestamp: new Date('2025-01-01T12:12:00Z'),
} as unknown as LabelingAttempt;

export const ATTEMPT_FAILURE_UNKNOWN: LabelingAttempt = {
  page: SAMPLED_PAGE_FANDOM,
  success: false,
  error: 'Unknown error occurred',
  errorCategory: ErrorCategory.UNKNOWN,
  extractedEntities: EXTRACTED_ENTITIES_EMPTY,
  expectedEntities: EXPECTED_ENTITIES_MINIMAL,
  metrics: null,
  durationMs: 500,
  timestamp: new Date('2025-01-01T12:13:00Z'),
};

// ============================================================================
// Failure Details Fixtures
// ============================================================================

export const FAILURE_DETAILS_FETCH: FailureDetails = {
  category: ErrorCategory.FETCH_ERROR,
  message: 'Failed to fetch: ECONNREFUSED',
  suggestion: 'Check URL validity and network connectivity. Consider adding retry logic.',
};

export const FAILURE_DETAILS_PARSER: FailureDetails = {
  category: ErrorCategory.PARSER_SELECTION_FAILED,
  message: 'Parser selection failed',
  suggestion: 'Review parser selection logic. Consider adding a new parser pattern for this page structure.',
  selectedParser: 'volume-list',
  recommendedParser: 'chapter-list',
};

export const FAILURE_DETAILS_STRUCTURE: FailureDetails = {
  category: ErrorCategory.STRUCTURE_NOT_RECOGNIZED,
  message: 'Structure not recognized',
  suggestion: 'Add new structure detection patterns to static analyzer for this page layout.',
  confidenceLevel: 0.3,
};

// ============================================================================
// Aggregated Metrics Fixtures
// ============================================================================

export const AGGREGATED_METRICS_GOOD: AggregatedMetrics = {
  totalAttempts: 10,
  successfulAttempts: 8,
  avgPrecision: 0.85,
  avgRecall: 0.78,
  avgF1: 0.81,
  microPrecision: 0.87,
  microRecall: 0.76,
  microF1: 0.81,
  byEntityType: {
    TITLE: { entityType: 'TITLE' as const, truePositives: 8, falsePositives: 0, falseNegatives: 0, precision: 1.0, recall: 1.0, f1: 1.0 },
    AUTHOR: { entityType: 'AUTHOR' as const, truePositives: 7, falsePositives: 1, falseNegatives: 1, precision: 0.875, recall: 0.875, f1: 0.875 },
  },
};

export const AGGREGATED_METRICS_POOR: AggregatedMetrics = {
  totalAttempts: 10,
  successfulAttempts: 3,
  avgPrecision: 0.45,
  avgRecall: 0.3,
  avgF1: 0.36,
  microPrecision: 0.42,
  microRecall: 0.28,
  microF1: 0.34,
  byEntityType: {},
};

export const AGGREGATED_METRICS_EMPTY: AggregatedMetrics = {
  totalAttempts: 5,
  successfulAttempts: 0,
  avgPrecision: 0,
  avgRecall: 0,
  avgF1: 0,
  microPrecision: 0,
  microRecall: 0,
  microF1: 0,
  byEntityType: {},
};

// ============================================================================
// Failure Analysis Fixtures
// ============================================================================

export const FAILURE_ANALYSIS_MIXED: FailureAnalysis = {
  totalFailures: 7,
  byCategory: {
    [ErrorCategory.FETCH_ERROR]: { count: 2, percentage: 28.6, examples: [FAILURE_DETAILS_FETCH] },
    [ErrorCategory.STRUCTURE_NOT_RECOGNIZED]: { count: 2, percentage: 28.6, examples: [FAILURE_DETAILS_STRUCTURE] },
    [ErrorCategory.PARSER_SELECTION_FAILED]: { count: 1, percentage: 14.3, examples: [FAILURE_DETAILS_PARSER] },
    [ErrorCategory.TIMEOUT]: { count: 1, percentage: 14.3, examples: [] },
    [ErrorCategory.UNKNOWN]: { count: 1, percentage: 14.3, examples: [] },
    [ErrorCategory.ENTITY_EXTRACTION_FAILED]: { count: 0, percentage: 0, examples: [] },
    [ErrorCategory.PATTERN_MISMATCH]: { count: 0, percentage: 0, examples: [] },
    [ErrorCategory.CONFIDENCE_TOO_LOW]: { count: 0, percentage: 0, examples: [] },
    [ErrorCategory.GROUND_TRUTH_ERROR]: { count: 0, percentage: 0, examples: [] },
    [ErrorCategory.PARSE_ERROR]: { count: 0, percentage: 0, examples: [] },
    [ErrorCategory.NO_CONTENT]: { count: 0, percentage: 0, examples: [] },
  },
  commonPatterns: [
    { pattern: 'FETCH_ERROR:fandom:CHAPTERS', count: 2, affectedPages: ['21-fandom-CHAPTERS'], suggestedFix: 'Add retry logic' },
  ],
  failedPageIds: ['21-fandom-CHAPTERS', '21-wikipedia-MANGA_PAGE'],
};

// ============================================================================
// Iteration Config Fixtures
// ============================================================================

export const ITERATION_CONFIG_DEFAULT: IterationConfig = {
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
    sources: ['fandom'],
  },
};

export const ITERATION_CONFIG_MINIMAL: IterationConfig = {
  sampleSize: 5,
  targetF1: 0.7,
  maxIterations: 10,
  minMatchConfidence: 0.5,
  parallel: false,
  concurrency: 1,
  pageTimeoutMs: 15000,
  saveResults: false,
  outputDir: '/tmp/test-iterations',
};

// ============================================================================
// Improvement Suggestion Fixtures
// ============================================================================

export const SUGGESTION_HIGH_PRIORITY: ImprovementSuggestion = {
  id: 'sug-001',
  priority: 'critical',
  category: 'parser',
  title: 'Add volume list parser for Fandom',
  description: 'Many pages fail because the volume list structure is not recognized.',
  expectedImpact: 0.15,
  affectedFiles: ['src/server/services/auto-labeling/parser-bridge/fandom-extractor.ts'],
  relatedErrors: [ErrorCategory.PARSER_SELECTION_FAILED, ErrorCategory.STRUCTURE_NOT_RECOGNIZED],
  affectedPageCount: 25,
};

export const SUGGESTION_MEDIUM_PRIORITY: ImprovementSuggestion = {
  id: 'sug-002',
  priority: 'medium',
  category: 'confidence',
  title: 'Lower confidence threshold for genre extraction',
  description: 'Genre extraction has low confidence but is often correct.',
  expectedImpact: 0.05,
  relatedErrors: [ErrorCategory.CONFIDENCE_TOO_LOW],
  affectedPageCount: 10,
};

// ============================================================================
// Iteration Result Fixtures
// ============================================================================

export const ITERATION_RESULT_SUCCESS: IterationResult = {
  iterationNumber: 1,
  timestamp: new Date('2025-01-01T12:00:00Z'),
  config: ITERATION_CONFIG_DEFAULT,
  sampledPages: [SAMPLED_PAGE_FANDOM, SAMPLED_PAGE_WIKIPEDIA],
  attempts: [ATTEMPT_SUCCESS_PERFECT, ATTEMPT_SUCCESS_PARTIAL],
  metrics: AGGREGATED_METRICS_GOOD,
  failures: {
    totalFailures: 0,
    byCategory: {} as FailureAnalysis['byCategory'],
    commonPatterns: [],
    failedPageIds: [],
  },
  suggestions: [],
  durationMs: 5000,
  targetMet: false,
};

export const ITERATION_RESULT_MIXED: IterationResult = {
  iterationNumber: 2,
  timestamp: new Date('2025-01-01T13:00:00Z'),
  config: ITERATION_CONFIG_DEFAULT,
  sampledPages: [SAMPLED_PAGE_FANDOM, SAMPLED_PAGE_WIKIPEDIA, SAMPLED_PAGE_COMICVINE],
  attempts: [ATTEMPT_SUCCESS_PERFECT, ATTEMPT_FAILURE_FETCH, ATTEMPT_FAILURE_TIMEOUT],
  metrics: AGGREGATED_METRICS_POOR,
  failures: FAILURE_ANALYSIS_MIXED,
  suggestions: [SUGGESTION_HIGH_PRIORITY],
  durationMs: 35000,
  targetMet: false,
};

// ============================================================================
// Test Collections
// ============================================================================

/**
 * Collection of all success attempts.
 */
export const SUCCESS_ATTEMPTS: LabelingAttempt[] = [
  ATTEMPT_SUCCESS_PERFECT,
  ATTEMPT_SUCCESS_PARTIAL,
  ATTEMPT_SUCCESS_MINIMAL,
];

/**
 * Collection of all failure attempts.
 */
export const FAILURE_ATTEMPTS: LabelingAttempt[] = [
  ATTEMPT_FAILURE_FETCH,
  ATTEMPT_FAILURE_GROUND_TRUTH,
  ATTEMPT_FAILURE_TIMEOUT,
  ATTEMPT_FAILURE_PARSE,
  ATTEMPT_FAILURE_NO_CONTENT,
  ATTEMPT_FAILURE_STRUCTURE,
  ATTEMPT_FAILURE_PARSER,
  ATTEMPT_FAILURE_EXTRACTION,
  ATTEMPT_FAILURE_PATTERN,
  ATTEMPT_FAILURE_CONFIDENCE,
  ATTEMPT_FAILURE_UNKNOWN,
];

/**
 * Mixed collection of success and failure attempts.
 */
export const MIXED_ATTEMPTS: LabelingAttempt[] = [
  ATTEMPT_SUCCESS_PERFECT,
  ATTEMPT_SUCCESS_PARTIAL,
  ATTEMPT_FAILURE_FETCH,
  ATTEMPT_FAILURE_TIMEOUT,
  ATTEMPT_FAILURE_STRUCTURE,
];

/**
 * All error categories for testing.
 */
export const ALL_ERROR_CATEGORIES: ErrorCategory[] = Object.values(ErrorCategory);
