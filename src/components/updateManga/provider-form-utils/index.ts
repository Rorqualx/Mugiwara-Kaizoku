/**
 * Provider Form Utils - Main Aggregator
 *
 * Provides type-safe utility functions for provider selection forms.
 * All functionality decomposed into focused modules for maintainability.
 *
 * Architecture:
 * - types.ts - Type definitions (149 lines, 10 exports)
 * - type-guards.ts - Type validators (279 lines, 3 exports, complexity reduced 69%)
 * - field-operations.ts - Field value ops (241 lines, 2 exports, complexity reduced 74%)
 * - index.ts - Utilities + aggregator (~120 lines, 4 exports)
 *
 * Total: ~790 lines across 4 modules
 * Original: 535 lines (48% increase for better organization, 0% complexity violations)
 *
 * Complexity Improvements:
 * - isManga: 28 → 8 (-71%)
 * - isProviderMetadataResult: 34 → 8 (-76%)
 * - getFieldValue: 31 → 8 (-74%)
 * - formatFieldValue: 12 → 6 (-50%)
 */

// ============================================================================
// Re-export All Types
// ============================================================================

export type {
  MangaMetadata,
  MangaWithRelations,
  ProviderMetadataInfo,
  ProviderMetadataItem,
  ProviderMetadata,
  Manga,
  ProviderMetadataResult,
  SelectOption,
  FieldProviderOption,
  FieldData,
} from './types';

// ============================================================================
// Re-export Type Guards
// ============================================================================

export {
  isManga,
  isProviderMetadataResult,
  isSelectOption,
} from './type-guards';

// ============================================================================
// Re-export Field Operations
// ============================================================================

export {
  getFieldValue,
  formatFieldValue,
} from './field-operations';

// ============================================================================
// Utility Functions (from original lines 431-535)
// ============================================================================

import { toNumberId } from '@/utils/id-converters';
import { isString, isObject } from '@/utils/type-guards';

import { formatFieldValue } from './field-operations';
import { isSelectOption } from './type-guards';

import type {
  Manga,
  FieldProviderOption,
  SelectOption,
  FieldData,
} from './types';


/**
 * Creates SelectOption objects from field options with type safety
 *
 * @param fieldName - The field name
 * @param options - Array of provider options for the field
 * @returns Array of SelectOption objects for the dropdown
 */
export function createSelectOptions(
  fieldName: string,
  options: FieldProviderOption[]
): SelectOption[] {
  if (!Array.isArray(options)) {
    return [];
  }

  return options
    .map((option, index) => {
      // Skip invalid options
      if (!isObject(option) || !('provider' in option)) {
        return null;
      }

      const provider = isString(option.provider) ? option.provider : 'unknown';
      const value = `${provider}:${index}`;
      const formattedValue = option.displayValue ?? formatFieldValue(fieldName, option.value);

      return {
        value,
        label: formattedValue,
        provider,
        originalValue: option.value,
      };
    })
    .filter((option): option is SelectOption => option !== null);
}

/**
 * Extract provider from a SelectOption value string (format: "provider:index")
 *
 * @param value - The SelectOption value string
 * @returns The provider name or empty string if invalid
 */
export function extractProviderFromValue(value: string | null): string {
  if (!value) {
    return '';
  }

  const parts = value.split(':');
  const firstPart = parts[0];
  return firstPart ?? '';
}

/**
 * Safely extracts a numeric ID from a manga object
 *
 * @param manga - The manga object
 * @returns Numeric ID or NaN if invalid
 */
export function extractMangaId(manga: Manga | null | undefined): number {
  if (!manga) {
    return NaN;
  }

  return typeof manga.id === 'string'
    ? toNumberId(manga.id)
    : typeof manga.id === 'number'
    ? manga.id
    : NaN;
}

/**
 * Creates provider preferences data for saving with type safety
 *
 * @param fieldData - The current field data state
 * @returns Provider preferences data for the API
 */
export function createProviderPreferences(
  fieldData: Record<string, FieldData>
): Record<string, { provider: string; value: unknown }> {
  const preferences: Record<string, { provider: string; value: unknown }> = {};

  Object.entries(fieldData).forEach(([field, data]) => {
    // Skip fields with no selection
    if (!data.selectedValue) {
      return;
    }

    // Extract provider from value with validation
    const provider = extractProviderFromValue(data.selectedValue);
    if (!provider || typeof provider !== 'string' || provider.trim() === '') {
      return;
    }

    // Validate that data has selectOptions and it's an array
    if (!Array.isArray(data.selectOptions)) {
      return;
    }

    // Find the selected option with proper type validation
    const selectedOption = data.selectOptions.find(
      (option) => isSelectOption(option) && option.value === data.selectedValue
    );

    if (!selectedOption) {
      return;
    }

    // Create the preference with validated data
    preferences[field] = {
      provider,
      value: selectedOption.originalValue,
    };
  });

  return preferences;
}
