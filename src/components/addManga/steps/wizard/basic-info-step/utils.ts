/**
 * BasicInfoStep Utilities
 *
 * Helper functions for the BasicInfoStep wizard component.
 * Extracted from BasicInfoStep.tsx to support component decomposition.
 *
 * @module components/addManga/steps/wizard/basic-info-step/utils
 */

import { isRecord, hasProperty } from '@/lib/type-guards';

import type { Logger } from './types';

/**
 * Safely extract a string property from an unknown object
 *
 * @param obj - Object to extract from
 * @param key - Property key to extract
 * @returns String value if exists and is string, undefined otherwise
 */
export function getStringProp(obj: unknown, key: string): string | undefined {
  if (!isRecord(obj) || !hasProperty(obj, key)) return undefined;
  const value = obj[key];
  return typeof value === 'string' ? value : undefined;
}

/**
 * Safely extract a number property from an unknown object
 *
 * @param obj - Object to extract from
 * @param key - Property key to extract
 * @returns Number value if exists and is number, undefined otherwise
 */
export function getNumberProp(obj: unknown, key: string): number | undefined {
  if (!isRecord(obj) || !hasProperty(obj, key)) return undefined;
  const value = obj[key];
  return typeof value === 'number' ? value : undefined;
}

/**
 * Safely extract an array property from an unknown object
 *
 * @param obj - Object to extract from
 * @param key - Property key to extract
 * @returns Array value if exists and is array, undefined otherwise
 */
export function getArrayProp(obj: unknown, key: string): unknown[] | undefined {
  if (!isRecord(obj) || !hasProperty(obj, key)) return undefined;
  const value = obj[key];
  return Array.isArray(value) ? value : undefined;
}

/**
 * Process search results from provider - handle both array and wrapped results
 *
 * @param results - Raw search results from provider
 * @returns Processed array of results
 */
export function processProviderSearchResults(results: unknown): unknown[] {
  if (Array.isArray(results)) {
    return results;
  }

  if (isRecord(results)) {
    const resultsArray = getArrayProp(results, "results");
    const dataArray = getArrayProp(results, "data");
    return resultsArray ?? dataArray ?? [];
  }

  return [];
}

/**
 * Log Fandom-specific result details for debugging
 *
 * @param results - Fandom search results
 * @param logger - Logger instance
 */
export function logFandomSearchResults(results: unknown[], logger: Logger): void {
  logger.info(`[BasicInfoStep] Fandom raw search results:`, {
    isArray: Array.isArray(results),
    resultsType: typeof results,
    resultsKeys: isRecord(results) ? Object.keys(results) : 'not object',
    firstResult: Array.isArray(results) && results.length > 0 ? results[0] : null
  });

  if (Array.isArray(results) && results.length > 0) {
    const firstResult = results[0];
    const firstResultMetadata = isRecord(firstResult) ? firstResult["metadata"] : undefined;
    const description = getStringProp(firstResult, "description");
    logger.info(`[BasicInfoStep] Fandom first result details:`, {
      title: getStringProp(firstResult, "title"),
      hasMetadata: !!firstResultMetadata,
      metadataKeys: isRecord(firstResultMetadata) ? Object.keys(firstResultMetadata) : [],
      volumes: isRecord(firstResult) ? firstResult["volumes"] : undefined,
      chapters: isRecord(firstResult) ? firstResult["chapters"] : undefined,
      description: description ? description.substring(0, 100) : ''
    });
  }
}
