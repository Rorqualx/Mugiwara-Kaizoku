/**
 * Pattern Recognition Utilities
 *
 * Shared helper functions, type guards, and utilities used across all
 * pattern recognition modules.
 *
 * Extracted from: PatternRecognitionEngine.ts
 * Date: 2025-11-20
 */

import type { PatternType } from '@/server/parsers/pattern-recognition/types';

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Type guard to check if a value is a Record
 * @param value - Value to check
 * @returns True if value is a non-null object
 */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * Validate if string is a valid PatternType
 * @param type - String to validate
 * @returns True if type is a valid PatternType
 */
export function isValidPatternType(type: string): type is PatternType {
  const validTypes: PatternType[] = [
    'volume',
    'chapter',
    'title',
    'author',
    'coverImage',
    'description',
    'metadata',
    'table',
    'gallery',
    'infobox',
  ];
  return validTypes.includes(type as PatternType);
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Extract number from text string
 * @param text - Text containing numeric value
 * @returns Extracted number or null if not found
 */
export function extractNumber(text: string): number | null {
  const match = text.match(/\d+(\.\d+)?/);
  return match ? parseFloat(match[0]) : null;
}

/**
 * Convert unknown error to Error instance
 * @param error - Unknown error value
 * @returns Error instance
 */
export function handleError(error: unknown): Error {
  if (error instanceof Error) {
    return error;
  }
  return new Error(String(error));
}

// ============================================================================
// Constants
// ============================================================================

/**
 * All valid pattern types
 */
export const VALID_PATTERN_TYPES: readonly PatternType[] = [
  'volume',
  'chapter',
  'title',
  'author',
  'coverImage',
  'description',
  'metadata',
  'table',
  'gallery',
  'infobox',
] as const;
