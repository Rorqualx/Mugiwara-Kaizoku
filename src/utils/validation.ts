/**
 * API Response Validation Utilities
 * 
 * This module provides utilities for validating API responses at runtime,
 * ensuring that data conforms to expected shapes before type casting.
 * 
 * For type guards, import from /utils/type-guards directly.
 */

import { logger } from './logging';
import { 
  isObject, 
  isArray, 
  isString, 
  isNumber,
  hasProperty
} from './type-guards';

/**
 * Validate that a response has the expected shape
 * @param response The response to validate
 * @param requiredFields Array of field names that must be present
 * @returns True if valid, false otherwise
 */
export function validateResponse(
  response: unknown,
  requiredFields: string[]
): response is Record<string, unknown> {
  if (!isObject(response)) {
    logger.error('Response is not an object');
    return false;
  }

  for (const field of requiredFields) {
    if (!hasProperty(response, field)) {
      logger.error(`Response missing required field: ${field}`);
      return false;
    }
  }

  return true;
}

/**
 * Validate array response
 * @param response The response to validate
 * @returns True if response is an array
 */
export function validateArrayResponse(response: unknown): response is unknown[] {
  if (!isArray(response)) {
    logger.error('Response is not an array');
    return false;
  }
  return true;
}

/**
 * Safely extract a string field from an object
 * @param obj The object to extract from
 * @param field The field name
 * @param defaultValue Default value if field is not a string
 */
export function extractString(
  obj: unknown,
  field: string,
  defaultValue = ''
): string {
  if (!isObject(obj) || !hasProperty(obj, field)) {
    return defaultValue;
  }
  
  const value = obj[field];
  return isString(value) ? value : defaultValue;
}

/**
 * Safely extract a number field from an object
 * @param obj The object to extract from
 * @param field The field name
 * @param defaultValue Default value if field is not a number
 */
export function extractNumber(
  obj: unknown,
  field: string,
  defaultValue = 0
): number {
  if (!isObject(obj) || !hasProperty(obj, field)) {
    return defaultValue;
  }
  
  const value = obj[field];
  return isNumber(value) ? value : defaultValue;
}

/**
 * Safely extract an array field from an object
 * @param obj The object to extract from
 * @param field The field name
 * @param defaultValue Default value if field is not an array
 */
export function extractArray<T = unknown>(
  obj: unknown,
  field: string,
  defaultValue: T[] = []
): T[] {
  if (!isObject(obj) || !hasProperty(obj, field)) {
    return defaultValue;
  }
  
  const value = obj[field];
  return isArray(value) ? value as T[] : defaultValue;
}