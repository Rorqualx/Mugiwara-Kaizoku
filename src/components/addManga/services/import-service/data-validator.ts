/**
 * Data Validator Module
 *
 * Handles validation of manga data before import.
 *
 * Extracted from: importService.ts (lines 484-517)
 */

import { logger } from '@/utils/logger';
import { getUnknownProperty } from '@/utils/type-guards/safe-access';

import { isRecord } from './utils';

import type { ValidationResult } from './utils';

/**
 * Validate manga data before import
 *
 * @param data - Manga data to validate
 * @returns Validation result with errors if any
 */
export function validateMangaData(data: unknown): ValidationResult {
  const errors: string[] = [];

  if (!isRecord(data)) {
    errors.push('Invalid data format');
    return { isValid: false, errors };
  }

  if (!getUnknownProperty(data, 'title')) {
    errors.push('Title is required');
  }

  if (!getUnknownProperty(data, 'coverImage')) {
    errors.push('Cover image is required');
  }

  if (!getUnknownProperty(data, 'provider')) {
    errors.push('Provider is required');
  }

  const volumes = getUnknownProperty(data, 'volumes');
  if (Array.isArray(volumes) && volumes.length === 0) {
    // This is just a warning, not an error
    logger.warn('No volumes selected for import');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}
