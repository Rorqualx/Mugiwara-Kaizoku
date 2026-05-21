/**
 * Type Guards for Kapowarr Selector Validation
 *
 * This module provides type-safe validation for Kapowarr selector objects,
 * including WebsiteSourceSelectors and related selector types.
 *
 * @module SelectorTypeGuards
 * @category TypeGuards
 * @subcategory Kapowarr
 */

import type { WebsiteSourceSelectors } from '@/types/adapters/native-download-types';
import {
  DANGEROUS_SELECTOR_PATTERNS,
  CSS_SELECTOR_PATTERN
} from '@/utils/validation/selector-constants';

import { createTypeGuard, validateObjectSchema } from './core';

import type { ObjectSchema } from './core/types';

/**
 * Schema definition for WebsiteSourceSelectors validation
 */
const WebsiteSourceSelectorsSchema: ObjectSchema = {
  // Search result fields
  searchResultItem: { type: 'string', required: false },
  searchResultTitle: { type: 'string', required: false },
  searchResultUrl: { type: 'string', required: false },
  searchResultCover: { type: 'string', required: false },

  // Manga details fields
  detailsTitle: { type: 'string', required: false },
  detailsCover: { type: 'string', required: false },
  detailsDescription: { type: 'string', required: false },
  detailsAuthor: { type: 'string', required: false },
  detailsGenres: { type: 'string', required: false },
  detailsStatus: { type: 'string', required: false },

  // Chapter list fields
  chapterItem: { type: 'string', required: false },
  chapterTitle: { type: 'string', required: false },
  chapterNumber: { type: 'string', required: false },
  chapterUrl: { type: 'string', required: false },
  chapterDate: { type: 'string', required: false },

  // Download link fields
  downloadPageItem: { type: 'string', required: false },
  downloadDirectLink: { type: 'string', required: false },
  downloadButton: { type: 'string', required: false },
};

/**
 * Type guard for WebsiteSourceSelectors
 */
export const isWebsiteSourceSelectors = createTypeGuard<WebsiteSourceSelectors>(
  WebsiteSourceSelectorsSchema,
  { includeErrors: true }
);

/**
 * Validates WebsiteSourceSelectors with detailed error reporting
 */
export function validateWebsiteSourceSelectors(
  obj: unknown
): { isValid: boolean; errors: string[]; missingFields: string[]; invalidFields: string[] } {
  return validateObjectSchema(obj, WebsiteSourceSelectorsSchema, { includeErrors: true });
}

/**
 * Validates that WebsiteSourceSelectors has at least one valid selector
 */
export function hasValidSelectors(obj: unknown): obj is WebsiteSourceSelectors {
  if (!isWebsiteSourceSelectors(obj)) {
    return false;
  }

  const selectors = obj as WebsiteSourceSelectors;

  // Check if at least one selector field has a value
  return Object.values(selectors).some(value =>
    typeof value === 'string' && value.trim().length > 0
  );
}

/**
 * Validates a CSS selector string.
 * Uses shared security patterns from @/utils/validation/selectors.
 */
export function isValidCssSelector(value: unknown): value is string {
  if (typeof value !== 'string') {
    return false;
  }

  const trimmed = value.trim();

  // Basic CSS selector validation
  if (trimmed.length === 0) {
    return false;
  }

  // Check for valid CSS selector patterns using shared constant
  if (!CSS_SELECTOR_PATTERN.test(trimmed)) {
    return false;
  }

  // Additional safety checks using shared dangerous patterns
  const dangerousPatterns = DANGEROUS_SELECTOR_PATTERNS.map(p => p.pattern);

  return !dangerousPatterns.some(pattern => pattern.test(trimmed));
}

/**
 * Validates a selector configuration object
 */
export function isValidSelectorConfig(obj: unknown): obj is Record<string, unknown> {
  if (typeof obj !== 'object' || obj === null) {
    return false;
  }

  const config = obj as Record<string, unknown>;

  // Check for required selector properties
  const hasCss = typeof config['css'] === 'string';
  const hasXpath = typeof config['xpath'] === 'string';

  if (!hasCss && !hasXpath) {
    return false;
  }

  // Validate extract type
  const extract = config['extract'];
  if (typeof extract !== 'string' || !['text', 'attribute', 'html'].includes(extract)) {
    return false;
  }

  // Validate attribute if extract is 'attribute'
  if (extract === 'attribute' && typeof config['attribute'] !== 'string') {
    return false;
  }

  return true;
}

/**
 * Extracts CSS selector from a selector configuration object
 */
export function extractCssSelector(selector: unknown): string | undefined {
  if (!isValidSelectorConfig(selector)) {
    return undefined;
  }

  const selectorObj = selector as Record<string, unknown>;
  const cssSelector = selectorObj['css'];

  if (typeof cssSelector === 'string' && isValidCssSelector(cssSelector)) {
    return cssSelector;
  }

  return undefined;
}

/**
 * Validates selector builder selectors structure
 */
export function isValidSelectorBuilderSelectors(obj: unknown): obj is Record<string, unknown> {
  if (typeof obj !== 'object' || obj === null) {
    return false;
  }

  const selectors = obj as Record<string, unknown>;

  // Check for expected selector sections
  const expectedSections = ['searchResults', 'mangaDetails', 'chapterList', 'downloadLinks'];

  return expectedSections.some(section =>
    section in selectors &&
    typeof selectors[section] === 'object' &&
    selectors[section] !== null
  );
}

/**
 * Type guard for selector transformation result
 */
export function isPartialWebsiteSourceSelectors(obj: unknown): obj is Partial<WebsiteSourceSelectors> {
  if (typeof obj !== 'object' || obj === null) {
    return false;
  }

  const selectors = obj as Record<string, unknown>;

  // Check that all properties are either undefined or valid CSS selectors
  return Object.entries(selectors).every(([key, value]) => {
    if (value === undefined) {
      return true;
    }

    if (typeof value !== 'string') {
      return false;
    }

    // Validate that the key is a valid WebsiteSourceSelectors property
    const validKeys = Object.keys(WebsiteSourceSelectorsSchema);
    if (!validKeys.includes(key)) {
      return false;
    }

    return isValidCssSelector(value);
  });
}

/**
 * Validates JSON string containing selector configuration
 */
export function parseSelectorJson(jsonString: string): { success: true; data: unknown } | { success: false; error: string } {
  try {
    const parsed: unknown = JSON.parse(jsonString);
    return { success: true, data: parsed };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown JSON parsing error'
    };
  }
}

/**
 * Validates and parses selector configuration from JSON
 */
export function validateAndParseSelectors(jsonString: string):
  | { success: true; selectors: WebsiteSourceSelectors }
  | { success: false; error: string; validationErrors?: string[] } {

  const parseResult = parseSelectorJson(jsonString);
  if (!parseResult.success) {
    return { success: false, error: parseResult.error };
  }

  const validationResult = validateWebsiteSourceSelectors(parseResult.data);
  if (!validationResult.isValid) {
    return {
      success: false,
      error: 'Invalid selector configuration',
      validationErrors: validationResult.errors
    };
  }

  if (!hasValidSelectors(parseResult.data)) {
    return {
      success: false,
      error: 'No valid selectors found in configuration'
    };
  }

  return {
    success: true,
    selectors: parseResult.data as WebsiteSourceSelectors
  };
}