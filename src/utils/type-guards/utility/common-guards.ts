/**
 * Common Utility Type Guards
 *
 * Type guards for common utility patterns and shared functionality
 */

import { isString, isNumber, isBoolean, isObject } from '../index';

/**
 * Check if value is a valid configuration object
 */
export function isConfig(value: unknown): value is {
  enabled: boolean;
  debug?: boolean;
  timeout?: number;
  retries?: number;
} {
  return (
    isObject(value) &&
    'enabled' in value &&
    isBoolean(value['enabled']) &&
    (!('debug' in value) || isBoolean(value['debug'])) &&
    (!('timeout' in value) || isNumber(value['timeout'])) &&
    (!('retries' in value) || isNumber(value['retries']))
  );
}

/**
 * Check if value is a valid pagination configuration
 */
export function isPaginationConfig(value: unknown): value is {
  page: number;
  pageSize: number;
  total?: number;
} {
  return (
    isObject(value) &&
    'page' in value &&
    isNumber(value['page']) &&
    'pageSize' in value &&
    isNumber(value['pageSize']) &&
    (!('total' in value) || isNumber(value['total']))
  );
}

/**
 * Check if value is a valid sorting configuration
 */
export function isSortingConfig(value: unknown): value is {
  field: string;
  direction: 'asc' | 'desc';
} {
  return (
    isObject(value) &&
    'field' in value &&
    isString(value['field']) &&
    'direction' in value &&
    isString(value['direction']) &&
    ['asc', 'desc'].includes(value['direction'])
  );
}

/**
 * Check if value is a valid filter configuration
 */
export function isFilterConfig(value: unknown): value is {
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
 * Check if value is a valid logging configuration
 */
export function isLoggingConfig(value: unknown): value is {
  level: 'debug' | 'info' | 'warn' | 'error';
  enabled: boolean;
  format?: string;
} {
  return (
    isObject(value) &&
    'level' in value &&
    isString(value['level']) &&
    ['debug', 'info', 'warn', 'error'].includes(value['level']) &&
    'enabled' in value &&
    isBoolean(value['enabled']) &&
    (!('format' in value) || isString(value['format']))
  );
}

/**
 * Check if value is a valid error object
 */
export function isErrorObject(value: unknown): value is {
  message: string;
  code?: string | number;
  details?: unknown;
} {
  return (
    isObject(value) &&
    'message' in value &&
    isString(value['message']) &&
    (!('code' in value) || isString(value['code']) || isNumber(value['code'])) &&
    (!('details' in value) || true) // details can be any type
  );
}

/**
 * Check if value is a valid progress object
 */
export function isProgress(value: unknown): value is {
  current: number;
  total: number;
  percentage?: number;
  status?: string;
} {
  return (
    isObject(value) &&
    'current' in value &&
    isNumber(value['current']) &&
    'total' in value &&
    isNumber(value['total']) &&
    (!('percentage' in value) || isNumber(value['percentage'])) &&
    (!('status' in value) || isString(value['status']))
  );
}

/**
 * Check if value is a valid state object
 */
export function isState(value: unknown): value is {
  loading: boolean;
  error?: string;
  data?: unknown;
} {
  return (
    isObject(value) &&
    'loading' in value &&
    isBoolean(value['loading']) &&
    (!('error' in value) || isString(value['error'])) &&
    (!('data' in value) || true) // data can be any type
  );
}

/**
 * Check if value is a valid event object
 */
export function isEvent(value: unknown): value is {
  type: string;
  timestamp: string;
  data?: unknown;
} {
  return (
    isObject(value) &&
    'type' in value &&
    isString(value['type']) &&
    'timestamp' in value &&
    isString(value['timestamp']) &&
    (!('data' in value) || true) // data can be any type
  );
}