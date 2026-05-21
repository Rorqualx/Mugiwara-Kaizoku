/**
 * Validation Data Handlers
 *
 * Data-specific validation functions for the validation tool.
 */

import { createSuccessResult, createErrorResult } from '@/utils/async-result';
import type { AsyncResult } from '@/utils/async-result';

import {
  validateProviderMatch,
  isValidChapterTitle,
  validateAndFixChapterVolumeMap,
  validateDataQuality,
} from './validation-helpers';

/**
 * Validate provider match data
 */
export function validateProviderMatchData(data: unknown, threshold: number): AsyncResult<Record<string, unknown>, Error> {
  if (!Array.isArray(data) || data.length !== 2 || typeof data[0] !== 'string' || typeof data[1] !== 'string') {
    return createErrorResult(new Error('data for provider_match must be [title1: string, title2: string]'));
  }
  const [title1, title2] = data as [string, string];
  const validationResult = validateProviderMatch(title1, title2, threshold);
  return createSuccessResult({
    validationType: 'provider_match',
    data: { title1, title2 },
    threshold,
    ...validationResult,
  });
}

/**
 * Validate chapter title data
 */
export function validateChapterTitleData(data: unknown): AsyncResult<Record<string, unknown>, Error> {
  if (typeof data !== 'string') {
    return createErrorResult(new Error('data for chapter_title must be a string'));
  }
  const validationResult = isValidChapterTitle(data);
  return createSuccessResult({
    validationType: 'chapter_title',
    data,
    ...validationResult,
  });
}

/**
 * Validate volume map data
 */
export function validateVolumeMapData(data: unknown): AsyncResult<Record<string, unknown>, Error> {
  if (!data || typeof data !== 'object') {
    return createErrorResult(new Error('data for volume_map must be an object Record<number, number>'));
  }

  // Validate it's a proper Record<number, number>
  const map = data as Record<string, unknown>;
  const chapterVolumeMap: Record<number, number> = {};
  for (const [key, value] of Object.entries(map)) {
    const chNum = Number(key);
    const volNum = Number(value);
    if (isNaN(chNum) || isNaN(volNum)) {
      return createErrorResult(new Error(`Invalid chapter or volume number: key=${key}, value=${value}`));
    }
    chapterVolumeMap[chNum] = volNum;
  }

  const validationResult = validateAndFixChapterVolumeMap(chapterVolumeMap);
  return createSuccessResult({
    validationType: 'volume_map',
    data: chapterVolumeMap,
    ...validationResult,
  });
}

/**
 * Validate data quality data
 */
export function validateDataQualityData(data: unknown): AsyncResult<Record<string, unknown>, Error> {
  if (!data || typeof data !== 'object') {
    return createErrorResult(new Error('data for data_quality must be an object'));
  }

  const qualityData = data as {
    unlinkedChapterCount?: number;
    volumeRanges?: Array<{ number: number; chapterStart: number | null; chapterEnd: number | null }>;
  };

  const validationResult = validateDataQuality(qualityData);
  return createSuccessResult({
    validationType: 'data_quality',
    data: qualityData,
    ...validationResult,
  });
}