/**
 * API Request Type Guards
 *
 * Type guards for API request types and validation
 */

import { isString, isNumber, isObject, isArray } from '../index';

/**
 * Check if value is a valid search request
 */
export function isSearchRequest(value: unknown): value is {
  query: string;
  limit?: number;
  offset?: number;
  filters?: Record<string, unknown>;
} {
  return (
    isObject(value) &&
    'query' in value &&
    isString(value['query']) &&
    (!('limit' in value) || isNumber(value['limit'])) &&
    (!('offset' in value) || isNumber(value['offset'])) &&
    (!('filters' in value) || isObject(value['filters']))
  );
}

/**
 * Check if value is a valid pagination request
 */
export function isPaginationRequest(value: unknown): value is {
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
} {
  return (
    isObject(value) &&
    (!('page' in value) || isNumber(value['page'])) &&
    (!('pageSize' in value) || isNumber(value['pageSize'])) &&
    (!('sortBy' in value) || isString(value['sortBy'])) &&
    (!('sortOrder' in value) || (isString(value['sortOrder']) && ['asc', 'desc'].includes(value['sortOrder'])))
  );
}

/**
 * Check if value is a valid filter request
 */
export function isFilterRequest(value: unknown): value is {
  field: string;
  operator: string;
  value: unknown;
} {
  return (
    isObject(value) &&
    'field' in value &&
    isString(value['field']) &&
    'operator' in value &&
    isString(value['operator']) &&
    'value' in value
  );
}

/**
 * Check if value is a valid batch request
 */
export function isBatchRequest<T>(value: unknown): value is {
  items: T[];
  operation: string;
} {
  return (
    isObject(value) &&
    'items' in value &&
    isArray(value['items']) &&
    'operation' in value &&
    isString(value['operation'])
  );
}

/**
 * Check if value is a valid file upload request
 */
export function isFileUploadRequest(value: unknown): value is {
  file: unknown;
  fileName?: string;
  contentType?: string;
} {
  return (
    isObject(value) &&
    'file' in value &&
    (!('fileName' in value) || isString(value['fileName'])) &&
    (!('contentType' in value) || isString(value['contentType']))
  );
}