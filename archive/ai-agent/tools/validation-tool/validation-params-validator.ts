/**
 * Validation Parameters Validator
 *
 * Parameter validation for the validation tool.
 */

import { createSuccessResult, createErrorResult } from '@/utils/async-result';
import type { AsyncResult } from '@/utils/async-result';

import type { ValidationToolParams } from './validation-tool-types';

/**
 * Validate tool parameters
 */
export function validateParams(params: unknown): AsyncResult<ValidationToolParams, Error> {
  if (!params || typeof params !== 'object') {
    return createErrorResult(new Error('Parameters must be an object'));
  }

  const { validationType, data, threshold } = params as Partial<ValidationToolParams>;

  if (!validationType || typeof validationType !== 'string') {
    return createErrorResult(new Error('validationType parameter is required and must be a string'));
  }

  const validTypes = ['provider_match', 'chapter_title', 'volume_map', 'data_quality'];
  if (!validTypes.includes(validationType)) {
    return createErrorResult(new Error(`validationType must be one of: ${validTypes.join(', ')}`));
  }

  if (data === undefined) {
    return createErrorResult(new Error('data parameter is required'));
  }

  if (threshold !== undefined && typeof threshold !== 'number') {
    return createErrorResult(new Error('threshold parameter must be a number'));
  }

  return createSuccessResult({ validationType, data, threshold: threshold ?? 0.3 });
}