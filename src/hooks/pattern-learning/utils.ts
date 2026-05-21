/**
 * Pattern Learning Utilities Module
 *
 * Shared helper functions, type definitions, and validation schemas
 * used across all pattern learning modules.
 *
 * Extracted from: usePatternLearning.ts (lines 1-171)
 */

import { logger } from '@/utils/logger';
import { isObject, isNumber, isString } from '@/utils/type-guards';

// ============================================================================
// Type Definitions
// ============================================================================

export interface ExtractedData {
  title?: string;
  description?: string;
  author?: string[];
  chapters?: number;
  volumes?: number;
  status?: string;
  [key: string]: unknown;
}

export interface CorrectionFeedback {
  corrections: Record<string, unknown>;
  userConfidence: number;
  teachingMode: boolean;
  url: string;
  patternsUsed: string[];
  originalConfidence: number;
}

export interface PatternFeedback {
  patternId: string;
  url: string;
  field: string;
  accepted: boolean;
  userValue: unknown;
  suggestedValue: unknown;
  confidence: number;
  timestamp: Date;
}

export interface PatternCorrection {
  url: string;
  field: string;
  originalValue: unknown;
  correctedValue: unknown;
  confidence: number;
  patternId?: string;
  timestamp: Date;
}

export interface LearningMetrics {
  totalCorrections: number;
  improvementRate: number;
  averageConfidence: number;
  patternsLearned: number;
  lastTrainingDate: Date | null;
}

export interface PatternSuggestion {
  field: string;
  suggestedValue: unknown;
  confidence: number;
  reason: string;
}

// API Response Types
export interface MetricsResponse {
  totalCorrections: number;
  improvementRate: number;
  averageConfidence: number;
  patternsLearned: number;
  lastTrainingDate: string | null;
}

export interface SubmitCorrectionResponse {
  improvement: number;
}

export interface BatchCorrectionResponse {
  processed: number;
  successRate: number;
}

export interface TrainingResponse {
  patternsLearned: number;
}

export interface WebSocketMessage {
  type: string;
  pattern?: string;
  progress?: number;
  message?: string;
  patternId?: string;
  version?: number;
}

export interface ConfidenceResponse {
  confidence: number;
}

// ============================================================================
// Type Guard Functions
// ============================================================================

export function isMetricsResponse(value: unknown): value is MetricsResponse {
  return isObject(value) &&
    'totalCorrections' in value && isNumber(value['totalCorrections']) &&
    'improvementRate' in value && isNumber(value['improvementRate']) &&
    'averageConfidence' in value && isNumber(value['averageConfidence']) &&
    'patternsLearned' in value && isNumber(value['patternsLearned']);
}

export function isSubmitCorrectionResponse(value: unknown): value is SubmitCorrectionResponse {
  return isObject(value) && 'improvement' in value && isNumber(value['improvement']);
}

export function isBatchCorrectionResponse(value: unknown): value is BatchCorrectionResponse {
  return isObject(value) &&
    'processed' in value && isNumber(value['processed']) &&
    'successRate' in value && isNumber(value['successRate']);
}

export function isTrainingResponse(value: unknown): value is TrainingResponse {
  return isObject(value) && 'patternsLearned' in value && isNumber(value['patternsLearned']);
}

export function isWebSocketMessage(value: unknown): value is WebSocketMessage {
  return isObject(value) && 'type' in value && isString(value['type']);
}

export function isConfidenceResponse(value: unknown): value is ConfidenceResponse {
  return isObject(value) && 'confidence' in value && isNumber(value['confidence']);
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Safely access property on unknown object
 */
export function safeGet(obj: unknown, key: string): unknown {
  if (obj && typeof obj === 'object' && key in obj) {
    return (obj as Record<string, unknown>)[key];
  }
  return undefined;
}

/**
 * Convert unknown error to Error instance
 */
export function handleError(error: unknown): Error {
  if (error instanceof Error) {
    return error;
  }
  return new Error(String(error));
}

/**
 * Validate corrections before submission
 */
export function validateCorrections(
  original: ExtractedData,
  corrected: ExtractedData
): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Check for required fields
  if (!corrected["title"] || (typeof corrected["title"] === 'string' && corrected["title"].trim().length === 0)) {
    errors.push('Title is required');
  }

  // Validate numeric fields
  if (typeof corrected["chapters"] === 'number' && corrected["chapters"] < 0) {
    errors.push('Chapters must be positive');
  }
  if (typeof corrected.volumes === 'number' && corrected.volumes < 0) {
    errors.push('Volumes must be positive');
  }

  // Check for meaningful corrections
  const hasChanges = Object.keys(corrected).some(
    (key) => JSON.stringify(corrected[key]) !== JSON.stringify(original[key])
  );
  if (!hasChanges) {
    errors.push('No corrections were made');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Process WebSocket message data
 */
export function processWebSocketMessage(rawData: unknown): WebSocketMessage | null {
  if (!isWebSocketMessage(rawData)) {
    logger.error('Invalid WebSocket message format', { data: rawData });
    return null;
  }
  return rawData;
}

/**
 * Convert LearningMetrics to MetricsResponse format
 */
export function convertMetricsToResponse(metrics: LearningMetrics): MetricsResponse {
  return {
    totalCorrections: metrics.totalCorrections,
    improvementRate: metrics.improvementRate,
    averageConfidence: metrics.averageConfidence,
    patternsLearned: metrics.patternsLearned,
    lastTrainingDate: metrics.lastTrainingDate?.toISOString() ?? null
  };
}
