/**
 * Metadata Validation Functions
 *
 * This module contains validation functions that use the schemas to validate
 * metadata and chapter objects, providing detailed error information.
 */

import { z } from 'zod';

import { metadataSchema, chapterSchema } from './metadata-schemas';

/**
 * Types of validation errors
 */
export enum ValidationErrorType {
  MISSING_REQUIRED_FIELD = 'MISSING_REQUIRED_FIELD',
  INVALID_TYPE = 'INVALID_TYPE',
  INVALID_FORMAT = 'INVALID_FORMAT',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR'
}

/**
 * Validation error details
 */
export interface ValidationError {
  type: ValidationErrorType;
  field: string;
  message: string;
}

/**
 * Results of validation
 */
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

/**
 * Validates a metadata object against the schema
 *
 * @param metadata Metadata object to validate
 * @returns Validation result
 */
export function validateMetadata(metadata: unknown): ValidationResult {
  try {
    // Use type assertion to specify the return type
    const _parsedMetadata = metadataSchema.parse(metadata) as z.infer<typeof metadataSchema>;
    return { valid: true, errors: [] };
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      const errors = error.errors.map(err => {
        let type = ValidationErrorType.UNKNOWN_ERROR;

        const code = err.code;

        // Check if this is an invalid_type error with received property
        // Use safer type checking with bracket notation for index signature
        const errorRecord = err as unknown as Record<string, unknown>;
        const receivedValue = errorRecord['received'];
        if (code === 'invalid_type' && receivedValue === 'undefined') {
          type = ValidationErrorType.MISSING_REQUIRED_FIELD;
        } else if (code === 'invalid_type') {
          type = ValidationErrorType.INVALID_TYPE;
        } else if (code === 'invalid_string' || code === 'invalid_enum_value') {
          type = ValidationErrorType.INVALID_FORMAT;
        }

        return {
          type,
          field: err.path.join('.'),
          message: err.message
        };
      });

      return { valid: false, errors };
    }

    return {
      valid: false,
      errors: [{
        type: ValidationErrorType.UNKNOWN_ERROR,
        field: 'unknown',
        message: 'An unknown validation error occurred'
      }]
    };
  }
}

/**
 * Validates a chapter object against the schema
 *
 * @param chapter Chapter object to validate
 * @returns Validation result
 */
export function validateChapter(chapter: unknown): ValidationResult {
  try {
    // Use type assertion to specify the return type
    const _parsedChapter = chapterSchema.parse(chapter) as z.infer<typeof chapterSchema>;
    return { valid: true, errors: [] };
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      const errors = error.errors.map(err => {
        let type = ValidationErrorType.UNKNOWN_ERROR;

        const code = err.code;

        // Check if this is an invalid_type error with received property
        // Use safer type checking with bracket notation for index signature
        const errorRecord = err as unknown as Record<string, unknown>;
        const receivedValue = errorRecord['received'];
        if (code === 'invalid_type' && receivedValue === 'undefined') {
          type = ValidationErrorType.MISSING_REQUIRED_FIELD;
        } else if (code === 'invalid_type') {
          type = ValidationErrorType.INVALID_TYPE;
        } else if (code === 'invalid_string' || code === 'invalid_enum_value') {
          type = ValidationErrorType.INVALID_FORMAT;
        }

        return {
          type,
          field: err.path.join('.'),
          message: err.message
        };
      });

      return { valid: false, errors };
    }

    return {
      valid: false,
      errors: [{
        type: ValidationErrorType.UNKNOWN_ERROR,
        field: 'unknown',
        message: 'An unknown validation error occurred'
      }]
    };
  }
}