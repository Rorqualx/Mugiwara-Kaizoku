/**
 * Universal Import Wizard Utilities Module
 *
 * Shared helper functions and type definitions for type guards
 * used across all universal import wizard modules.
 *
 * Extracted from: universal-import-wizard.ts
 *
 * @module UniversalImportWizardUtils
 * @category TypeGuards
 * @subcategory Kapowarr
 */

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Check if a property exists and has the correct type
 */
export function hasPropertyType(
  obj: Record<string, unknown>,
  key: string,
  type: 'string' | 'number' | 'boolean' | 'array'
): boolean {
  if (!(key in obj)) return false;

  const value = obj[key];
  switch (type) {
    case 'string': return typeof value === 'string';
    case 'number': return typeof value === 'number';
    case 'boolean': return typeof value === 'boolean';
    case 'array': return Array.isArray(value);
    default: return false;
  }
}

/**
 * Check if a property exists and is an array of strings
 */
export function isStringArray(obj: Record<string, unknown>, key: string): boolean {
  if (!(key in obj)) return false;
  const value = obj[key];
  return Array.isArray(value) && value.every(item => typeof item === 'string');
}

/**
 * Check if a property exists and is an array
 */
export function isArray(obj: Record<string, unknown>, key: string): boolean {
  if (!(key in obj)) return false;
  return Array.isArray(obj[key]);
}

/**
 * Check if property exists (for optional properties)
 */
export function propertyExists(obj: Record<string, unknown>, key: string): boolean {
  return key in obj;
}

/**
 * Check if property exists and is a string
 */
export function isString(obj: Record<string, unknown>, key: string): boolean {
  return hasPropertyType(obj, key, 'string');
}

/**
 * Check if property exists and is a number
 */
export function isNumber(obj: Record<string, unknown>, key: string): boolean {
  return hasPropertyType(obj, key, 'number');
}

/**
 * Check if property exists and is a boolean
 */
export function isBoolean(obj: Record<string, unknown>, key: string): boolean {
  return hasPropertyType(obj, key, 'boolean');
}

/**
 * Check if property exists and is an array of specific type
 */
export function isTypedArray<T>(
  obj: Record<string, unknown>,
  key: string,
  typeGuard: (item: unknown) => item is T
): boolean {
  if (!(key in obj)) return false;
  const value = obj[key];
  return Array.isArray(value) && value.every(typeGuard);
}

/**
 * Check if object is not null and is an object type
 */
export function isObject(obj: unknown): obj is Record<string, unknown> {
  return typeof obj === 'object' && obj !== null;
}

/**
 * Create a type guard for optional properties with type checking
 */
export function createOptionalPropertyGuard(
  obj: Record<string, unknown>,
  key: string,
  type: 'string' | 'number' | 'boolean' | 'array'
): boolean {
  return !(key in obj) || hasPropertyType(obj, key, type);
}

/**
 * Create a type guard for optional string array properties
 */
export function createOptionalStringArrayGuard(
  obj: Record<string, unknown>,
  key: string
): boolean {
  return !(key in obj) || isStringArray(obj, key);
}

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Type for property validation configuration
 */
export type PropertyValidation = {
  key: string;
  type: 'string' | 'number' | 'boolean' | 'array';
  required: boolean;
};

/**
 * Type for array property validation configuration
 */
export type ArrayPropertyValidation = {
  key: string;
  itemType: 'string' | 'number' | 'boolean';
  required: boolean;
};

/**
 * Type for validation result
 */
export type ValidationResult = {
  isValid: boolean;
  errors: string[];
};

// ============================================================================
// Validation Utilities
// ============================================================================

/**
 * Validate an object against a set of property validations
 */
export function validateProperties(
  obj: Record<string, unknown>,
  validations: PropertyValidation[]
): ValidationResult {
  const errors: string[] = [];

  for (const validation of validations) {
    const { key, type, required } = validation;

    if (required && !(key in obj)) {
      errors.push(`Required property '${key}' is missing`);
      continue;
    }

    if (key in obj && !hasPropertyType(obj, key, type)) {
      errors.push(`Property '${key}' has incorrect type, expected ${type}`);
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Validate array properties
 */
export function validateArrayProperties(
  obj: Record<string, unknown>,
  validations: ArrayPropertyValidation[]
): ValidationResult {
  const errors: string[] = [];

  for (const validation of validations) {
    const { key, itemType, required } = validation;

    if (required && !(key in obj)) {
      errors.push(`Required array property '${key}' is missing`);
      continue;
    }

    if (key in obj) {
      const value = obj[key];
      if (!Array.isArray(value)) {
        errors.push(`Property '${key}' is not an array`);
      } else if (itemType === 'string' && !value.every(item => typeof item === 'string')) {
        errors.push(`Array property '${key}' contains non-string items`);
      }
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}