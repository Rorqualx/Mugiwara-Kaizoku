/**
 * General Type Guards (Deprecated)
 * 
 * This file is maintained for backward compatibility only.
 * Please import type guards directly from /utils/type-guards instead.
 * 
 * @deprecated Use /utils/type-guards directly
 */

// Import from centralized location for backward compatibility
import type { AsyncResult } from '@/utils/async-result';
import {
  isObject,
  isString,
  hasProperty } from '@/utils/type-guards';

// Domain-specific type guards that should be moved to appropriate modules

/**
 * Check if a value is an AsyncResult
 * @deprecated Move to async-result module
 */
export function isAsyncResult<T = unknown, E = Error>(value: unknown): value is AsyncResult<T, E> {
  return (
    isObject(value) &&
    hasProperty(value, 'status') &&
    isString(value["status"]) &&
    ['idle', 'loading', 'success', 'error'].includes(value["status"]));

}

// For backward compatibility, re-export from centralized location
// These exports will be removed in a future version
export {
  isDefined,
  isNotNull,
  isPresent,
  isString,
  isNonEmptyString,
  isNumber,
  isBoolean,
  isObject,
  isArray,
  isFunction,
  isDate,
  isError,
  isPromise,
  isArrayOf,
  isStringArray,
  isNumberArray,
  hasProperty,
  hasPropertyOfType,
  hasRequiredProperties,
  isPlainObject,
  isEnum,
  isTruthy,
  isFalsy } from '@/utils/type-guards';