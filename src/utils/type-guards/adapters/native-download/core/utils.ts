/**
 * Core Utilities for Kapowarr Type Guards
 *
 * This file contains shared utility functions used across all Kapowarr
 * type guard modules to reduce code duplication and ensure consistency.
 *
 * @module TypeGuardUtils
 * @category TypeGuards
 * @subcategory Kapowarr
 */

import type {
  TypeGuardOptions,
  ObjectSchema,
  SchemaValidationResult,
  FieldValidator
} from './types';

/**
 * Validates the type of a field value
 */
function validateFieldType(value: unknown, expectedType: string): boolean {
  switch (expectedType) {
    case 'string':
      return typeof value === 'string';
    case 'number':
      return typeof value === 'number';
    case 'boolean':
      return typeof value === 'boolean';
    case 'object':
      return typeof value === 'object' && value !== null;
    case 'array':
      return Array.isArray(value);
    case 'any':
      return true;
    default:
      return false;
  }
}

/**
 * Validates array elements against a specified type
 */
function validateArrayElements(
  value: unknown[],
  elementType: string,
  field: string,
  options: TypeGuardOptions
): { isValid: boolean; invalidFields: string[]; errors: string[] } {
  const invalidElements = value.some(element => {
    switch (elementType) {
      case 'string':
        return typeof element !== 'string';
      case 'number':
        return typeof element !== 'number';
      case 'boolean':
        return typeof element !== 'boolean';
      case 'object':
        return typeof element !== 'object' || element === null;
      default:
        return false;
    }
  });

  if (invalidElements) {
    const errors = options.includeErrors
      ? [`Array '${field}' contains invalid elements, expected: ${elementType}`]
      : [];
    return {
      isValid: false,
      invalidFields: [field],
      errors
    };
  }

  return {
    isValid: true,
    invalidFields: [],
    errors: []
  };
}

/**
 * Runs custom validation on a field value
 */
function runCustomValidator(
  value: unknown,
  validator: (value: unknown) => boolean,
  field: string,
  options: TypeGuardOptions
): { isValid: boolean; invalidFields: string[]; errors: string[] } {
  if (!validator(value)) {
    const errors = options.includeErrors
      ? [`Field '${field}' failed custom validation`]
      : [];
    return {
      isValid: false,
      invalidFields: [field],
      errors
    };
  }

  return {
    isValid: true,
    invalidFields: [],
    errors: []
  };
}

/**
 * Validates a single field against its schema definition
 */
function validateField(
  candidate: Record<string, unknown>,
  field: string,
  validator: FieldValidator,
  options: TypeGuardOptions
): { isValid: boolean; errors: string[]; missingFields: string[]; invalidFields: string[] } {
  const value = candidate[field];
  const isPresent = field in candidate;

  // Check required fields
  if (validator.required && !isPresent) {
    const errors = options.includeErrors
      ? [`Missing required field: ${field}`]
      : [];
    return {
      isValid: false,
      errors,
      missingFields: [field],
      invalidFields: []
    };
  }

  // Skip validation for optional fields that are not present
  if (!isPresent) {
    return {
      isValid: true,
      errors: [],
      missingFields: [],
      invalidFields: []
    };
  }

  // Validate type
  const isValidType = validateFieldType(value, validator.type);
  if (!isValidType) {
    const errors = options.includeErrors
      ? [`Field '${field}' has invalid type, expected: ${validator.type}`]
      : [];
    return {
      isValid: false,
      errors,
      missingFields: [],
      invalidFields: [field]
    };
  }

  // Initialize result
  const result = {
    isValid: true,
    errors: [] as string[],
    missingFields: [] as string[],
    invalidFields: [] as string[]
  };

  // Validate array elements if specified
  if (validator.type === 'array' && validator.arrayElementType && Array.isArray(value)) {
    const arrayResult = validateArrayElements(value, validator.arrayElementType, field, options);
    if (!arrayResult.isValid) {
      result.isValid = false;
      result.invalidFields.push(...arrayResult.invalidFields);
      result.errors.push(...arrayResult.errors);
    }
  }

  // Run custom validator if provided
  if (validator.validator) {
    const customResult = runCustomValidator(value, validator.validator, field, options);
    if (!customResult.isValid) {
      result.isValid = false;
      result.invalidFields.push(...customResult.invalidFields);
      result.errors.push(...customResult.errors);
    }
  }

  return result;
}

/**
 * Validates an object against a schema definition
 */
export function validateObjectSchema(
  obj: unknown,
  schema: ObjectSchema,
  options: TypeGuardOptions = {}
): SchemaValidationResult {
  const result: SchemaValidationResult = {
    isValid: true,
    errors: [],
    missingFields: [],
    invalidFields: []
  };

  if (typeof obj !== 'object' || obj === null) {
    result.isValid = false;
    result.errors.push('Value is not an object');
    return result;
  }

  const candidate = obj as Record<string, unknown>;

  for (const [field, validator] of Object.entries(schema)) {
    const fieldResult = validateField(candidate, field, validator, options);
    if (!fieldResult.isValid) {
      result.isValid = false;
    }
    result.errors.push(...fieldResult.errors);
    result.missingFields.push(...fieldResult.missingFields);
    result.invalidFields.push(...fieldResult.invalidFields);
  }

  return result;
}

/**
 * Creates a type guard function from a schema definition
 */
export function createTypeGuard<T>(
  schema: ObjectSchema,
  options: TypeGuardOptions = {}
): (obj: unknown) => obj is T {
  return function (obj: unknown): obj is T {
    const result = validateObjectSchema(obj, schema, options);
    return result.isValid;
  };
}

/**
 * Validates that an object has all required properties
 */
export function hasRequiredProperties(
  obj: unknown,
  requiredProps: string[]
): obj is Record<string, unknown> {
  if (typeof obj !== 'object' || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;
  return requiredProps.every(prop => prop in candidate);
}

/**
 * Validates that an object has properties of specific types
 */
export function hasPropertiesOfType(
  obj: unknown,
  propTypes: Record<string, 'string' | 'number' | 'boolean' | 'object' | 'array'>
): boolean {
  if (typeof obj !== 'object' || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  for (const [prop, type] of Object.entries(propTypes)) {
    if (!(prop in candidate)) {
      return false;
    }

    const value = candidate[prop];
    let isValidType = false;

    switch (type) {
      case 'string':
        isValidType = typeof value === 'string';
        break;
      case 'number':
        isValidType = typeof value === 'number';
        break;
      case 'boolean':
        isValidType = typeof value === 'boolean';
        break;
      case 'object':
        isValidType = typeof value === 'object' && value !== null;
        break;
      case 'array':
        isValidType = Array.isArray(value);
        break;
      default:
        isValidType = false;
        break;
    }

    if (!isValidType) {
      return false;
    }
  }

  return true;
}

/**
 * Validates an array contains only elements of a specific type
 */
export function isArrayOfType<T>(
  arr: unknown,
  elementValidator: (item: unknown) => item is T
): arr is T[] {
  if (!Array.isArray(arr)) {
    return false;
  }

  return arr.every(elementValidator);
}

/**
 * Creates a type guard for optional fields
 */
export function createOptionalTypeGuard<T>(
  typeGuard: (value: unknown) => value is T
): (value: unknown) => value is T | undefined {
  return function (value: unknown): value is T | undefined {
    return value === undefined || typeGuard(value);
  };
}

/**
 * Validates a URL string
 */
export function isValidUrl(value: unknown): value is string {
  if (typeof value !== 'string') {
    return false;
  }

  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

/**
 * Validates an email string
 */
export function isValidEmail(value: unknown): value is string {
  if (typeof value !== 'string') {
    return false;
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(value);
}

/**
 * Validates a date string in ISO format
 */
export function isValidIsoDate(value: unknown): value is string {
  if (typeof value !== 'string') {
    return false;
  }

  const date = new Date(value);
  return !isNaN(date.getTime()) && value === date.toISOString();
}

/**
 * Creates a composite type guard that validates all provided guards
 */
export function createCompositeTypeGuard<T>(
  ...guards: Array<(value: unknown) => boolean>
): (value: unknown) => value is T {
  return function (value: unknown): value is T {
    return guards.every(guard => guard(value));
  };
}