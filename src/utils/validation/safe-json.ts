/**
 * Safe JSON Utilities
 *
 * This file provides utilities for safely parsing and validating JSON data.
 */
import { getErrorMessage } from '@/utils/errors/helpers';
import { logger } from '@/utils/logger';

import { validateSchema } from './schema-validation';

import type { ValidationResult, ValidationSchema } from './schema-validation';
/**
 * Result of a safe JSON parse operation
 */
export type JsonParseResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };
/**
 * Safely parse a JSON string without throwing exceptions
 */
export function safeParseJson<T>(jsonString: string): JsonParseResult<T> {
    try {
        const parsed: unknown = JSON.parse(jsonString);
        return {
            success: true,
            data: parsed as T
        };
    }
    catch (error: unknown) {
        const errorMessage = getErrorMessage(error);
        return {
            success: false,
            error: `JSON parse error: ${errorMessage}`
        };
    }
}
/**
 * Result of parseAndValidateJson with validation result
 */
export type ParseAndValidateResult<T> =
  | { success: true; data: T; validationResult: ValidationResult }
  | { success: false; error: string; validationResult?: ValidationResult | undefined };

/**
 * Parse and validate JSON against a schema
 */
export function parseAndValidateJson<T>(jsonString: string, schema: ValidationSchema): ParseAndValidateResult<T> {
    const parseResult = safeParseJson<T>(jsonString);
    if (!parseResult.success) {
        return parseResult;
    }
    const validationResult = validateSchema(parseResult.data, schema);
    if (!validationResult.valid) {
        return {
            success: false,
            error: 'Validation failed',
            validationResult
        };
    }
    return {
        success: true,
        data: parseResult.data,
        validationResult
    };
}
/**
 * Safely stringify an object to JSON
 */
export function safeStringifyJson(data: unknown, space?: number): string {
    try {
        return JSON.stringify(data, null, space);
    }
    catch (error: unknown) {
        const errorMessage = getErrorMessage(error);
        logger.error('JSON stringify error:', errorMessage);
        return '';
    }
}
/**
 * Parse JSON safely with a type guard
 */
export function parseJsonWithTypeGuard<T>(jsonString: string, typeGuard: (value: unknown) => value is T): JsonParseResult<T> {
    const parseResult = safeParseJson<unknown>(jsonString);
    if (!parseResult.success) {
        return parseResult as JsonParseResult<T>;
    }
    if (!typeGuard(parseResult.data)) {
        return {
            success: false,
            error: 'Data does not match expected type'
        };
    }
    return {
        success: true,
        data: parseResult.data as T
    };
}
