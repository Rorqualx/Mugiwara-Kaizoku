/**
 * Common API Type Guards
 *
 * Type guards for common API patterns and utilities
 */

import { isString, isNumber, isBoolean, isObject, isArray } from '../index';

/**
 * Check if value is a valid API response object
 */
export function isApiResponse<T>(value: unknown): value is { data: T; success: boolean } {
  return (
    isObject(value) &&
    'data' in value &&
    'success' in value &&
    isBoolean(value['success'])
  );
}

/**
 * Check if value is a valid API error response
 */
export function isApiErrorResponse(value: unknown): value is { error: string; code?: string } {
  return (
    isObject(value) &&
    'error' in value &&
    isString(value['error'])
  );
}

/**
 * Check if value is a valid paginated API response
 */
export function isPaginatedResponse<T>(value: unknown): value is {
  data: T[];
  total: number;
  page: number;
  pageSize: number
} {
  return (
    isObject(value) &&
    'data' in value &&
    isArray(value['data']) &&
    'total' in value &&
    isNumber(value['total']) &&
    'page' in value &&
    isNumber(value['page']) &&
    'pageSize' in value &&
    isNumber(value['pageSize'])
  );
}

/**
 * Check if value is a valid API request options object
 */
export function isApiRequestOptions(value: unknown): value is {
  method?: string;
  headers?: Record<string, string>;
  body?: unknown;
  timeout?: number;
} {
  return (
    isObject(value) &&
    (!('method' in value) || isString(value['method'])) &&
    (!('headers' in value) || isObject(value['headers'])) &&
    (!('timeout' in value) || isNumber(value['timeout']))
  );
}

/**
 * Check if value is a valid HTTP status code
 */
export function isHttpStatusCode(value: unknown): value is number {
  return isNumber(value) && value >= 100 && value < 600;
}