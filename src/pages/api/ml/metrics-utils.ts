/**
 * ML Metrics API Utilities
 * 
 * Shared helper functions, type definitions, and validation utilities
 * used across ML metrics API handlers.
 * 
 * Extracted from: src/pages/api/ml/metrics.ts
 */

import type { ModelType } from '@/server/config/ml-config';

import type { NextApiResponse } from 'next';


// ============================================================================
// Request Body Types
// ============================================================================

/**
 * Feedback request body structure
 */
export interface FeedbackRequestBody {
  predictionId?: unknown;
  correct?: unknown;
  actualValue?: unknown;
  feedback?: unknown;
}

/**
 * Record request body structure
 */
export interface RecordRequestBody {
  modelType?: unknown;
  modelVersion?: unknown;
  inputHash?: unknown;
  confidence?: unknown;
  inferenceTime?: unknown;
  prediction?: unknown;
  metadata?: unknown;
}

// ============================================================================
// Validation Helpers
// ============================================================================

/**
 * Safely extract string value from unknown object
 */
export function safeGetString(obj: unknown, key: string): string | undefined {
  if (obj && typeof obj === 'object' && key in obj) {
    const value = (obj as Record<string, unknown>)[key];
    return typeof value === 'string' ? value : undefined;
  }
  return undefined;
}

/**
 * Safely extract boolean value from unknown object
 */
export function safeGetBoolean(obj: unknown, key: string): boolean | undefined {
  if (obj && typeof obj === 'object' && key in obj) {
    const value = (obj as Record<string, unknown>)[key];
    return typeof value === 'boolean' ? value : undefined;
  }
  return undefined;
}

/**
 * Safely extract number value from unknown object
 */
export function safeGetNumber(obj: unknown, key: string): number | undefined {
  if (obj && typeof obj === 'object' && key in obj) {
    const value = (obj as Record<string, unknown>)[key];
    return typeof value === 'number' ? value : undefined;
  }
  return undefined;
}

/**
 * Safely extract object value from unknown object
 */
export function safeGetObject(obj: unknown, key: string): Record<string, unknown> | undefined {
  if (obj && typeof obj === 'object' && key in obj) {
    const value = (obj as Record<string, unknown>)[key];
    return typeof value === 'object' && value !== null ? value as Record<string, unknown> : undefined;
  }
  return undefined;
}

// ============================================================================
// Response Formatters
// ============================================================================

/**
 * Response helpers
 */
export function createSuccessResponse(res: NextApiResponse, message: string): void {
  res.status(200).json({
    success: true,
    message
  });
}

export function createErrorResponse(res: NextApiResponse, error: string, statusCode = 400): void {
  res.status(statusCode).json({ error });
}

/**
 * Create validation error response for missing required fields
 */
export function createValidationErrorResponse(res: NextApiResponse, missingFields: string[]): void {
  createErrorResponse(res, `Missing required fields: ${missingFields.join(', ')}`, 400);
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Check if value is a valid ModelType
 */
export function isValidModelType(value: unknown): value is ModelType {
  return typeof value === 'string' && ['classification', 'regression', 'clustering'].includes(value);
}

/**
 * Check if value is a valid record (object with string keys)
 */
export function isValidRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
