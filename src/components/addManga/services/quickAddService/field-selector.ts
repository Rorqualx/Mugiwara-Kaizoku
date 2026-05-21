/**
 * Quick Add Service - Field Selector
 *
 * Handles field value selection from multiple providers based on user preferences.
 * Uses smart matching and fallback logic to find valid values.
 *
 * @module components/addManga/services/quickAddService/field-selector
 */

import { findBestMatchingResult } from '@/components/addManga/utils/result-matching';
import { getMetadataField } from '@/components/addManga/utils/typeGuards';
import type { ExtendedMangaSearchResult } from '@/types/search.types';
import { DEFAULT_FIELD_PRIORITIES, METADATA_FIELDS } from '@/types/search.types';
import { logger } from '@/utils/logger';


import { INVALID_STATUS_VALUES, NUMERIC_FIELDS } from './types';

import type { FieldSelection, FieldSelectionMap } from './types';

// ============================================================================
// Field Validation
// ============================================================================

/**
 * Check if a field value is valid and should be used
 * Returns false for: null, undefined, empty strings, "UNKNOWN" status, 0 for numeric fields
 *
 * @param fieldName - Name of the field being validated
 * @param value - Value to validate
 * @returns True if value is valid
 */
export function isValidFieldValue(fieldName: string, value: unknown): boolean {
  // Null or undefined is invalid
  if (value === null || value === undefined) {
    return false;
  }

  // Empty string is invalid
  if (value === '') {
    return false;
  }

  // For status field, check for "UNKNOWN" values
  if (fieldName === 'status' && typeof value === 'string') {
    if (INVALID_STATUS_VALUES.has(value)) {
      return false;
    }
  }

  // For numeric fields, 0 is typically invalid (means no data)
  if (NUMERIC_FIELDS.has(fieldName) && typeof value === 'number') {
    if (value === 0) {
      return false;
    }
  }

  // For array fields, empty arrays are invalid
  if (Array.isArray(value) && value.length === 0) {
    return false;
  }

  return true;
}

// ============================================================================
// Field Value Extraction
// ============================================================================

/**
 * Try to get field value from user's explicitly selected result
 */
function getFieldFromUserSelection(
  fieldName: string,
  provider: string,
  userSelectedMetadata?: Record<string, unknown>
): unknown | null {
  const normalizedProvider = provider.toLowerCase();
  const userSelection = userSelectedMetadata?.[provider] ?? userSelectedMetadata?.[normalizedProvider];

  if (!userSelection || typeof userSelection !== 'object') {
    return null;
  }

  const value = getMetadataField(userSelection as Record<string, unknown>, fieldName);
  if (value === undefined || value === null) {
    return null;
  }

  logger.debug('[field-selector] Got field value from USER SELECTION', {
    fieldName,
    provider,
    normalizedProvider,
    value: typeof value === 'string' ? value.substring(0, 50) : value
  });
  return value;
}

/**
 * Try to get field value via smart matching from provider results
 */
function getFieldFromMatching(
  fieldName: string,
  provider: string,
  searchResult: ExtendedMangaSearchResult,
  providerResults: ExtendedMangaSearchResult[]
): unknown | null {
  const matchResult = findBestMatchingResult(searchResult, providerResults, provider, {
    useProviderIds: true,
    useNormalizedTitle: true,
    useAlternativeTitles: true,
    similarityThreshold: 0.7,
    fallbackToFirst: true
  });

  if (!matchResult) {
    return null;
  }

  const value = getMetadataField(matchResult.result as Record<string, unknown>, fieldName);
  if (value === undefined || value === null) {
    return null;
  }

  logger.debug('[field-selector] Got field value from provider via matching', {
    fieldName,
    provider,
    matchStrategy: matchResult.strategy,
    confidence: matchResult.confidence,
    matchTitle: matchResult.result.title
  });
  return value;
}

/**
 * Get field value from provider results using smart matching
 *
 * PRIORITY ORDER:
 * 1. User's explicitly selected result for this provider (highest priority)
 * 2. Smart matching (ID, title, similarity)
 * 3. Primary search result fallback
 */
export function getFieldValue(
  fieldName: string,
  provider: string,
  searchResult: ExtendedMangaSearchResult,
  allSearchResults: Record<string, ExtendedMangaSearchResult[]> | undefined,
  userSelectedMetadata?: Record<string, unknown>
): unknown {
  // PRIORITY 1: Check user's explicit selection
  const userValue = getFieldFromUserSelection(fieldName, provider, userSelectedMetadata);
  if (userValue !== null) {
    return userValue;
  }

  // PRIORITY 2: Try smart matching from provider results
  const providerResults = allSearchResults?.[provider];
  if (providerResults && providerResults.length > 0) {
    const matchedValue = getFieldFromMatching(fieldName, provider, searchResult, providerResults);
    if (matchedValue !== null) {
      return matchedValue;
    }
  }

  // PRIORITY 3: Fallback to primary search result
  logger.debug('[field-selector] Using fallback to primary result for field', {
    fieldName,
    provider,
    primaryTitle: searchResult.title
  });
  return getMetadataField(searchResult as Record<string, unknown>, fieldName);
}

// ============================================================================
// Single Field Selection
// ============================================================================

/**
 * Get the reason why a value is invalid
 */
function getInvalidReason(value: unknown): string {
  if (value === null || value === undefined) return 'null/undefined';
  if (value === '') return 'empty string';
  if (value === 'UNKNOWN') return 'UNKNOWN status';
  if (value === 0) return 'zero value';
  return 'other';
}

/**
 * Select value for a single field from providers in priority order
 */
function selectFieldValue(
  fieldName: string,
  priorityList: string[],
  searchResult: ExtendedMangaSearchResult,
  allSearchResults: Record<string, ExtendedMangaSearchResult[]> | undefined,
  userSelectedMetadata?: Record<string, unknown>
): FieldSelection | null {
  for (const provider of priorityList) {
    const value = getFieldValue(
      fieldName,
      provider,
      searchResult,
      allSearchResults,
      userSelectedMetadata
    );

    if (isValidFieldValue(fieldName, value)) {
      logger.debug('[field-selector] Field value selected', {
        field: fieldName,
        provider,
        valueType: typeof value,
        priorityIndex: priorityList.indexOf(provider)
      });
      return { source: provider, value };
    }

    logger.debug('[field-selector] Skipping invalid value from provider', {
      field: fieldName,
      provider,
      value,
      reason: getInvalidReason(value)
    });
  }

  logger.debug('[field-selector] No valid value found for field', {
    field: fieldName,
    providersChecked: priorityList.length
  });
  return null;
}

// ============================================================================
// Field Selection Construction
// ============================================================================

/**
 * Construct field selections based on preferences
 *
 * Iterates through the provider priority list for each field until a valid value is found.
 * This ensures fallback to the next provider if the preferred one has invalid data
 * (e.g., "UNKNOWN" status, null values, 0 for numeric fields).
 *
 * IMPORTANT: Uses userSelectedMetadata to prioritize user's explicit selections
 * (e.g., when user selects a specific ComicVine edition, use that edition's metadata).
 *
 * @param searchResult - Primary search result
 * @param allSearchResults - All search results from all providers
 * @param preferences - User's field provider preferences
 * @param userSelectedMetadata - User's explicitly selected metadata for providers
 * @returns Map of field names to their selected values and sources
 */
export function constructFieldSelections(
  searchResult: ExtendedMangaSearchResult,
  allSearchResults: Record<string, ExtendedMangaSearchResult[]> | undefined,
  preferences: Record<string, string[]>,
  userSelectedMetadata?: Record<string, unknown>
): FieldSelectionMap {
  const fieldSelections: FieldSelectionMap = {};

  for (const field of METADATA_FIELDS) {
    const priorityList = preferences[field.value] ??
                        DEFAULT_FIELD_PRIORITIES[field.value] ??
                        ['anilist'];

    const selection = selectFieldValue(
      field.value,
      priorityList,
      searchResult,
      allSearchResults,
      userSelectedMetadata
    );

    if (selection) {
      fieldSelections[field.value] = selection;
    }
  }

  return fieldSelections;
}
