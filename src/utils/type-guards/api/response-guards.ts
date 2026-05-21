/**
 * API Response Type Guards
 *
 * Type guards for API response types and validation
 */

import { isString, isNumber, isBoolean, isObject, isArray } from '../index';

/**
 * Check if value is a valid success response
 */
export function isSuccessResponse<T>(value: unknown): value is { data: T; success: true } {
  return (
    isObject(value) &&
    'data' in value &&
    'success' in value &&
    value['success'] === true
  );
}

/**
 * Check if value is a valid error response
 */
export function isErrorResponse(value: unknown): value is { error: string; code?: string; success: false } {
  return (
    isObject(value) &&
    'error' in value &&
    isString(value['error']) &&
    'success' in value &&
    value['success'] === false
  );
}

/**
 * Check if value is a valid list response
 */
export function isListResponse<T>(value: unknown): value is { items: T[]; total: number } {
  return (
    isObject(value) &&
    'items' in value &&
    isArray(value['items']) &&
    'total' in value &&
    isNumber(value['total'])
  );
}

/**
 * Check if value is a valid metadata response
 */
export function isMetadataResponse(value: unknown): value is {
  metadata: Record<string, unknown>;
  timestamp: string;
} {
  return (
    isObject(value) &&
    'metadata' in value &&
    isObject(value['metadata']) &&
    'timestamp' in value &&
    isString(value['timestamp'])
  );
}

/**
 * Check if value is a valid validation response
 */
export function isValidationResponse(value: unknown): value is {
  valid: boolean;
  errors?: string[];
  warnings?: string[];
} {
  return (
    isObject(value) &&
    'valid' in value &&
    isBoolean(value['valid']) &&
    (!('errors' in value) || isArray(value['errors'])) &&
    (!('warnings' in value) || isArray(value['warnings']))
  );
}