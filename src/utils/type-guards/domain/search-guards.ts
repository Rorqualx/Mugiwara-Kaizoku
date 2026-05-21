/**
 * Search Type Guards
 *
 * Type guards for search domain types
 */

import { isString, isNumber, isObject, isArray } from '../index';

/**
 * Check if value is a valid search result
 */
export function isSearchResult(value: unknown): value is {
  id: string | number;
  title: string;
  description?: string;
  coverImage?: string;
  provider: string;
  score?: number;
  metadata?: Record<string, unknown>;
} {
  return (
    isObject(value) &&
    'id' in value &&
    (isString(value['id']) || isNumber(value['id'])) &&
    'title' in value &&
    isString(value['title']) &&
    (!('description' in value) || isString(value['description'])) &&
    (!('coverImage' in value) || isString(value['coverImage'])) &&
    'provider' in value &&
    isString(value['provider']) &&
    (!('score' in value) || isNumber(value['score'])) &&
    (!('metadata' in value) || isObject(value['metadata']))
  );
}

/**
 * Check if value is a valid search query
 */
export function isSearchQuery(value: unknown): value is {
  query: string;
  filters?: Record<string, unknown>;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
} {
  return (
    isObject(value) &&
    'query' in value &&
    isString(value['query']) &&
    (!('filters' in value) || isObject(value['filters'])) &&
    (!('sortBy' in value) || isString(value['sortBy'])) &&
    (!('sortOrder' in value) || (isString(value['sortOrder']) && ['asc', 'desc'].includes(value['sortOrder']))) &&
    (!('limit' in value) || isNumber(value['limit'])) &&
    (!('offset' in value) || isNumber(value['offset']))
  );
}

/**
 * Check if value is a valid search filter
 */
export function isSearchFilter(value: unknown): value is {
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
 * Check if value is a valid search response
 */
export function isSearchResponse(value: unknown): value is {
  results: unknown[];
  total: number;
  page: number;
  pageSize: number;
  query: string;
} {
  return (
    isObject(value) &&
    'results' in value &&
    isArray(value['results']) &&
    'total' in value &&
    isNumber(value['total']) &&
    'page' in value &&
    isNumber(value['page']) &&
    'pageSize' in value &&
    isNumber(value['pageSize']) &&
    'query' in value &&
    isString(value['query'])
  );
}

/**
 * Check if value is a valid search suggestion
 */
export function isSearchSuggestion(value: unknown): value is {
  text: string;
  type: 'title' | 'author' | 'genre' | 'publisher';
  score: number;
} {
  return (
    isObject(value) &&
    'text' in value &&
    isString(value['text']) &&
    'type' in value &&
    isString(value['type']) &&
    ['title', 'author', 'genre', 'publisher'].includes(value['type']) &&
    'score' in value &&
    isNumber(value['score'])
  );
}