/**
 * Core Type Definitions for Kapowarr Type Guards
 *
 * This file contains shared type definitions and interfaces used across
 * all Kapowarr type guard modules to ensure consistency and type safety.
 *
 * @module TypeGuardTypes
 * @category TypeGuards
 * @subcategory Kapowarr
 */

/**
 * Base type guard result interface
 */
export interface TypeGuardResult<T> {
  isValid: boolean;
  value?: T;
  errors?: string[];
}

/**
 * Validation options for type guards
 */
export interface TypeGuardOptions {
  /** Whether to allow partial validation (missing optional fields) */
  allowPartial?: boolean;
  /** Whether to include detailed error messages */
  includeErrors?: boolean;
  /** Custom validation rules */
  customRules?: Record<string, (value: unknown) => boolean>;
}

/**
 * Common validation patterns used across type guards
 */
export const ValidationPatterns = {
  /** Validates a string is not empty */
  nonEmptyString: (value: unknown): value is string =>
    typeof value === 'string' && value.trim().length > 0,

  /** Validates a number is positive */
  positiveNumber: (value: unknown): value is number =>
    typeof value === 'number' && value >= 0,

  /** Validates a number is an integer */
  integer: (value: unknown): value is number =>
    typeof value === 'number' && Number.isInteger(value),

  /** Validates an array contains only strings */
  stringArray: (value: unknown): value is string[] =>
    Array.isArray(value) && value.every(item => typeof item === 'string'),

  /** Validates an array contains only numbers */
  numberArray: (value: unknown): value is number[] =>
    Array.isArray(value) && value.every(item => typeof item === 'number'),

  /** Validates a boolean value */
  boolean: (value: unknown): value is boolean =>
    typeof value === 'boolean',

  /** Validates a date string in ISO format */
  isoDate: (value: unknown): value is string =>
    typeof value === 'string' && !isNaN(Date.parse(value)),
} as const;

/**
 * Common error messages for type guard failures
 */
export const ErrorMessages = {
  NOT_OBJECT: 'Value is not an object',
  NULL_VALUE: 'Value is null',
  MISSING_REQUIRED_FIELD: (field: string) => `Missing required field: ${field}`,
  INVALID_FIELD_TYPE: (field: string, expected: string) =>
    `Field '${field}' has invalid type, expected: ${expected}`,
  INVALID_ARRAY_ELEMENT: (field: string) =>
    `Array '${field}' contains invalid elements`,
} as const;

/**
 * Helper type for creating type-safe record validations
 */
export type FieldValidator = {
  required?: boolean;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array' | 'any';
  validator?: (value: unknown) => boolean;
  arrayElementType?: 'string' | 'number' | 'boolean' | 'object';
};

/**
 * Schema definition for object validation
 */
export type ObjectSchema = Record<string, FieldValidator>;

/**
 * Result of schema validation
 */
export interface SchemaValidationResult {
  isValid: boolean;
  errors: string[];
  missingFields: string[];
  invalidFields: string[];
}