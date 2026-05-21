/**
 * Runtime Validation Utilities for Selector Objects
 *
 * This module provides runtime validation functions for selector objects,
 * including comprehensive error handling and validation patterns.
 *
 * @module SelectorValidation
 * @category Validation
 * @subcategory Selectors
 */

import type { WebsiteSourceSelectors } from '@/types/adapters/native-download-types';
import {
  isWebsiteSourceSelectors,
  validateWebsiteSourceSelectors,
  isValidSelectorBuilderSelectors,
  parseSelectorJson,
} from '@/utils/type-guards/adapters/native-download/selectors';

// Re-export shared constants for backward compatibility
export {
  DANGEROUS_SELECTOR_PATTERNS,
  CSS_SELECTOR_PATTERN,
  hasDangerousPattern,
  getDangerousPatternRegexps,
  type DangerousSelectorPattern
} from './selector-constants';

// Import constants for use in this module
import {
  DANGEROUS_SELECTOR_PATTERNS,
  CSS_SELECTOR_PATTERN
} from './selector-constants';

/**
 * Validation result interface
 */
export interface SelectorValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  suggestions: string[];
  validSelectors: string[];
  invalidSelectors: string[];
}

/**
 * Validation options
 */
export interface SelectorValidationOptions {
  /** Whether to require at least one valid selector */
  requireAtLeastOne?: boolean;
  /** Whether to validate CSS selector syntax */
  validateCssSyntax?: boolean;
  /** Whether to check for dangerous patterns */
  checkSafety?: boolean;
  /** Whether to provide suggestions for improvement */
  provideSuggestions?: boolean;
}

/**
 * Default validation options
 */
const DEFAULT_VALIDATION_OPTIONS: Required<SelectorValidationOptions> = {
  requireAtLeastOne: true,
  validateCssSyntax: true,
  checkSafety: true,
  provideSuggestions: true
};

/**
 * Validates a single CSS selector with detailed error reporting
 */
export function validateCssSelector(
  selector: string,
  options: { checkSafety?: boolean } = {}
): { isValid: boolean; error?: string | undefined; suggestion?: string | undefined } {
  const { checkSafety = true } = options;

  if (typeof selector !== 'string') {
    return {
      isValid: false,
      error: 'Selector must be a string'
    };
  }

  const trimmed = selector.trim();

  if (trimmed.length === 0) {
    return {
      isValid: false,
      error: 'Selector cannot be empty'
    };
  }

  // Basic CSS selector validation using shared pattern
  if (!CSS_SELECTOR_PATTERN.test(trimmed)) {
    return {
      isValid: false,
      error: 'Invalid CSS selector syntax',
      suggestion: 'Use only valid CSS selector characters: letters, numbers, hyphens, underscores, brackets, colons, spaces, dots, hashes, and combinators'
    };
  }

  // Safety checks using shared dangerous patterns
  if (checkSafety) {
    for (const { pattern, error } of DANGEROUS_SELECTOR_PATTERNS) {
      if (pattern.test(trimmed)) {
        return {
          isValid: false,
          error: `${error} in selectors`
        };
      }
    }
  }

  // Performance suggestions
  const suggestions: string[] = [];

  if (trimmed.includes('*')) {
    suggestions.push('Avoid universal selector (*) for better performance');
  }

  if (trimmed.includes(' ')) {
    suggestions.push('Consider using more specific selectors to improve performance');
  }

  if (trimmed.startsWith('#')) {
    suggestions.push('ID selectors are very efficient');
  }

  return {
    isValid: true,
    suggestion: suggestions.length > 0 ? suggestions.join('; ') : undefined
  } as const;
}

/**
 * Validates WebsiteSourceSelectors with comprehensive error reporting
 */
export function validateSelectors(
  selectors: unknown,
  options: SelectorValidationOptions = {}
): SelectorValidationResult {
  const mergedOptions = { ...DEFAULT_VALIDATION_OPTIONS, ...options };
  const result: SelectorValidationResult = {
    isValid: true,
    errors: [],
    warnings: [],
    suggestions: [],
    validSelectors: [],
    invalidSelectors: []
  };

  // Basic type validation
  if (!isWebsiteSourceSelectors(selectors)) {
    const validationResult = validateWebsiteSourceSelectors(selectors);
    result.isValid = false;
    result.errors.push(...validationResult.errors);
    return result;
  }

  const selectorObj = selectors as WebsiteSourceSelectors;

  // Validate individual selectors
  Object.entries(selectorObj).forEach(([key, value]) => {
    if (value === undefined || value === null) {
      return; // Skip undefined/null values
    }

    if (typeof value !== 'string') {
      result.isValid = false;
      result.errors.push(`Selector '${key}' must be a string, got ${typeof value}`);
      result.invalidSelectors.push(key);
      return;
    }

    const trimmed = value.trim();
    if (trimmed.length === 0) {
      result.warnings.push(`Selector '${key}' is empty`);
      return;
    }

    const validation = validateCssSelector(trimmed, {
      checkSafety: mergedOptions.checkSafety
    });

    if (validation.isValid) {
      result.validSelectors.push(key);
      if (validation.suggestion) {
        result.suggestions.push(`${key}: ${validation.suggestion}`);
      }
    } else {
      result.isValid = false;
      result.errors.push(`Selector '${key}': ${validation.error}`);
      result.invalidSelectors.push(key);
    }
  });

  // Check if we have at least one valid selector
  if (mergedOptions.requireAtLeastOne && result.validSelectors.length === 0) {
    result.isValid = false;
    result.errors.push('No valid selectors found');
  }

  // Provide general suggestions
  if (mergedOptions.provideSuggestions) {
    if (result.validSelectors.length === 0) {
      result.suggestions.push('Add at least one valid CSS selector');
    }

    if (result.validSelectors.length > 0 && result.invalidSelectors.length > 0) {
      result.suggestions.push(`Fix invalid selectors: ${result.invalidSelectors.join(', ')}`);
    }

    // Check for common selector patterns
    const hasSearchSelectors = result.validSelectors.some(selector =>
      selector.startsWith('searchResult')
    );
    const hasDetailSelectors = result.validSelectors.some(selector =>
      selector.startsWith('details')
    );
    const hasChapterSelectors = result.validSelectors.some(selector =>
      selector.startsWith('chapter')
    );

    if (!hasSearchSelectors) {
      result.suggestions.push('Consider adding search result selectors for better search functionality');
    }
    if (!hasDetailSelectors) {
      result.suggestions.push('Consider adding manga detail selectors for better metadata extraction');
    }
    if (!hasChapterSelectors) {
      result.suggestions.push('Consider adding chapter selectors for chapter list extraction');
    }
  }

  return result;
}

/**
 * Validates selector builder selectors structure
 */
export function validateSelectorBuilderSelectors(
  selectors: unknown
): { isValid: boolean; errors: string[]; validSections: string[]; invalidSections: string[] } {
  const result = {
    isValid: true,
    errors: [] as string[],
    validSections: [] as string[],
    invalidSections: [] as string[]
  };

  if (!isValidSelectorBuilderSelectors(selectors)) {
    result.isValid = false;
    result.errors.push('Invalid selector builder structure');
    return result;
  }

  const selectorObj = selectors as Record<string, unknown>;
  const expectedSections = ['searchResults', 'mangaDetails', 'chapterList', 'downloadLinks'];

  expectedSections.forEach(section => {
    if (section in selectorObj) {
      const sectionData = selectorObj[section];
      if (typeof sectionData === 'object' && sectionData !== null) {
        result.validSections.push(section);
      } else {
        result.invalidSections.push(section);
        result.errors.push(`Section '${section}' must be an object`);
      }
    }
  });

  if (result.invalidSections.length > 0) {
    result.isValid = false;
  }

  return result;
}

/**
 * Creates a selector validator with custom options
 */
export function createSelectorValidator(options: SelectorValidationOptions = {}) {
  return (selectors: unknown): SelectorValidationResult => {
    return validateSelectors(selectors, options);
  };
}

/**
 * Validates and normalizes selector configuration
 */
export function normalizeSelectors(selectors: unknown):
  | { success: true; normalized: WebsiteSourceSelectors }
  | { success: false; error: string; validationResult: SelectorValidationResult } {

  const validationResult = validateSelectors(selectors);

  if (!validationResult.isValid) {
    return {
      success: false,
      error: 'Selector validation failed',
      validationResult
    };
  }

  // Normalize the selectors (trim whitespace, etc.)
  const normalized: WebsiteSourceSelectors = {};
  const selectorObj = selectors as Record<string, unknown>;

  Object.entries(selectorObj).forEach(([key, value]) => {
    if (typeof value === 'string') {
      normalized[key as keyof WebsiteSourceSelectors] = value.trim();
    } else if (value !== undefined && value !== null) {
      normalized[key as keyof WebsiteSourceSelectors] = String(value);
    }
  });

  return {
    success: true,
    normalized
  };
}

/**
 * Validates selector configuration from JSON with comprehensive error handling
 */
export function validateSelectorJson(
  jsonString: string,
  options: SelectorValidationOptions = {}
):
  | { success: true; selectors: WebsiteSourceSelectors; validationResult: SelectorValidationResult }
  | { success: false; error: string; validationResult?: SelectorValidationResult } {

  const parseResult = parseSelectorJson(jsonString);
  if (!parseResult.success) {
    return {
      success: false,
      error: `JSON parsing failed: ${parseResult.error}`
    };
  }

  const validationResult = validateSelectors(parseResult.data, options);

  if (!validationResult.isValid) {
    return {
      success: false,
      error: 'Selector validation failed',
      validationResult
    };
  }

  return {
    success: true,
    selectors: parseResult.data as WebsiteSourceSelectors,
    validationResult
  };
}