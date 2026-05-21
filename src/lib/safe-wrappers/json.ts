/**
 * Safe JSON Parsing Utilities
 *
 * This module provides safe wrappers for JSON operations that prevent
 * runtime errors and provide proper type safety. Use these instead of
 * direct JSON.parse() calls to avoid unsafe type assertions.
 *
 * @module safe-wrappers/json
 * @security Prevents JSON parsing errors from crashing the application
 * @security Validates data structure before use
 *
 * @example
 * // Before (unsafe):
 * const data = JSON.parse(str) as MyType;
 *
 * // After (safe):
 * const result = safeJSONParse<MyType>(str);
 * if (result.success) {
 *   console.log(result.data);
 * }
 */

import { z } from 'zod';

import { getErrorMessage } from '@/utils/errors/helpers';
import { isError } from '@/utils/type-guards';

// ============================================================================
// Basic JSON Parsing
// ============================================================================

/**
 * Result type for successful JSON parsing
 */
export interface ParseSuccess<T> {
  success: true;
  data: T;
}

/**
 * Result type for failed JSON parsing
 */
export interface ParseFailure {
  success: false;
  error: string;
  originalInput?: string;
}

/**
 * Union type for parse results
 */
export type ParseResult<T> = ParseSuccess<T> | ParseFailure;

/**
 * Safely parse JSON string without throwing errors
 *
 * @param json - The JSON string to parse
 * @returns Result object with success flag and data or error
 *
 * @example
 * const result = safeJSONParse<UserData>(jsonString);
 * if (result.success) {
 *   console.log(result.data.name);
 * } else {
 *   logger.error('Parse failed:', result.error);
 * }
 */
export function safeJSONParse<T = unknown>(json: string): ParseResult<T> {
  try {
    const data = JSON.parse(json) as T;
    return { success: true, data };
  } catch (error) {
    return {
      success: false,
      error: getErrorMessage(error),
      originalInput: json.slice(0, 100), // Include first 100 chars for debugging
    };
  }
}

/**
 * Safely parse JSON with Zod schema validation
 *
 * @param json - The JSON string to parse
 * @param schema - Zod schema to validate against
 * @returns Result object with validated data or error
 *
 * @example
 * const result = safeJSONParseWithSchema(jsonString, UserSchema);
 * if (result.success) {
 *   // data is now validated and typed
 *   console.log(result.data.name);
 * } else {
 *   logger.error('Validation failed:', result.error);
 * }
 */
export function safeJSONParseWithSchema<T>(
  json: string,
  schema: z.ZodSchema<T>,
): ParseResult<T> {
  const parseResult = safeJSONParse(json);
  if (!parseResult.success) {
    return parseResult;
  }

  try {
    const data = schema.parse(parseResult.data);
    return { success: true, data };
  } catch (error) {
    return {
      success: false,
      error: isError(error) ? error.message : 'Validation failed',
    };
  }
}

/**
 * Safely parse JSON with detailed Zod validation errors
 *
 * @param json - The JSON string to parse
 * @param schema - Zod schema to validate against
 * @returns Result object with data or detailed error information
 *
 * @example
 * const result = safeJSONParseWithDetailedErrors(jsonString, UserSchema);
 * if (result.success) {
 *   console.log(result.data);
 * } else {
 *   console.log('Validation issues:', result.issues);
 * }
 */
export function safeJSONParseWithDetailedErrors<T>(
  json: string,
  schema: z.ZodSchema<T>,
):
  | ParseSuccess<T>
  | (ParseFailure & { issues?: z.ZodIssue[]; zodError?: z.ZodError }) {
  const parseResult = safeJSONParse(json);
  if (!parseResult.success) {
    return parseResult;
  }

  const validated = schema.safeParse(parseResult.data);

  if (validated.success) {
    return { success: true, data: validated.data };
  }

  return {
    success: false,
    error: 'Validation failed',
    issues: validated.error.issues,
    zodError: validated.error,
  };
}

// ============================================================================
// JSON Stringification
// ============================================================================

/**
 * Safely stringify a value to JSON without throwing errors
 *
 * @param value - The value to stringify
 * @param pretty - Whether to format with indentation (default: false)
 * @returns JSON string or empty string if stringification fails
 *
 * @example
 * const jsonString = safeStringify(userData);
 * if (jsonString) {
 *   await saveToFile(jsonString);
 * }
 */
export function safeStringify(value: unknown, pretty = false): string {
  try {
    return pretty ? JSON.stringify(value, null, 2) : JSON.stringify(value);
  } catch {
    return '';
  }
}

/**
 * Safely stringify with result object
 *
 * @param value - The value to stringify
 * @param pretty - Whether to format with indentation (default: false)
 * @returns Result object with JSON string or error
 *
 * @example
 * const result = safeStringifyWithResult(userData);
 * if (result.success) {
 *   await saveToFile(result.data);
 * } else {
 *   logger.error('Stringify failed:', result.error);
 * }
 */
export function safeStringifyWithResult(
  value: unknown,
  pretty = false,
): ParseResult<string> {
  try {
    const data = pretty ? JSON.stringify(value, null, 2) : JSON.stringify(value);
    return { success: true, data };
  } catch (error) {
    return {
      success: false,
      error: getErrorMessage(error),
    };
  }
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Parse JSON or return default value
 *
 * @param json - The JSON string to parse
 * @param defaultValue - Value to return if parsing fails
 * @returns Parsed data or default value
 *
 * @example
 * const config = parseJSONOrDefault(configString, DEFAULT_CONFIG);
 */
export function parseJSONOrDefault<T>(json: string, defaultValue: T): T {
  const result = safeJSONParse<T>(json);
  return result.success ? result.data : defaultValue;
}

/**
 * Parse JSON with schema or return default value
 *
 * @param json - The JSON string to parse
 * @param schema - Zod schema to validate against
 * @param defaultValue - Value to return if parsing/validation fails
 * @returns Validated data or default value
 *
 * @example
 * const user = parseJSONWithSchemaOrDefault(
 *   userString,
 *   UserSchema,
 *   DEFAULT_USER
 * );
 */
export function parseJSONWithSchemaOrDefault<T>(
  json: string,
  schema: z.ZodSchema<T>,
  defaultValue: T,
): T {
  const result = safeJSONParseWithSchema(json, schema);
  return result.success ? result.data : defaultValue;
}

/**
 * Parse JSON or return null (useful for optional data)
 *
 * @param json - The JSON string to parse
 * @returns Parsed data or null
 *
 * @example
 * const optionalData = parseJSONOrNull<UserData>(jsonString);
 * if (optionalData !== null) {
 *   console.log(optionalData);
 * }
 */
export function parseJSONOrNull<T>(json: string): T | null {
  const result = safeJSONParse<T>(json);
  return result.success ? result.data : null;
}

/**
 * Parse JSON with schema or return null
 *
 * @param json - The JSON string to parse
 * @param schema - Zod schema to validate against
 * @returns Validated data or null
 *
 * @example
 * const user = parseJSONWithSchemaOrNull(userString, UserSchema);
 * if (user !== null) {
 *   console.log(user.name);
 * }
 */
export function parseJSONWithSchemaOrNull<T>(
  json: string,
  schema: z.ZodSchema<T>,
): T | null {
  const result = safeJSONParseWithSchema(json, schema);
  return result.success ? result.data : null;
}

// ============================================================================
// Type Guard for Parse Results
// ============================================================================

/**
 * Type guard to check if a parse result is successful
 *
 * @param result - The parse result to check
 * @returns True if the result is successful
 *
 * @example
 * const result = safeJSONParse(jsonString);
 * if (isParseSuccess(result)) {
 *   console.log(result.data);
 * }
 */
export function isParseSuccess<T>(
  result: ParseResult<T>,
): result is ParseSuccess<T> {
  return result.success === true;
}

/**
 * Type guard to check if a parse result is a failure
 *
 * @param result - The parse result to check
 * @returns True if the result is a failure
 */
export function isParseFailure<T>(
  result: ParseResult<T>,
): result is ParseFailure {
  return result.success === false;
}

// ============================================================================
// Advanced Parsing
// ============================================================================

/**
 * Parse multiple JSON strings in parallel
 *
 * @param jsonStrings - Array of JSON strings to parse
 * @returns Array of parse results
 *
 * @example
 * const results = parseManyJSON([json1, json2, json3]);
 * const successfulResults = results.filter(isParseSuccess);
 */
export function parseManyJSON<T = unknown>(
  jsonStrings: string[],
): ParseResult<T>[] {
  return jsonStrings.map((json) => safeJSONParse<T>(json));
}

/**
 * Parse nested JSON (JSON string containing JSON strings)
 *
 * @param json - JSON string that may contain nested JSON
 * @param depth - Maximum depth to parse (default: 2)
 * @returns Parse result with nested data
 *
 * @example
 * const result = parseNestedJSON('{"data": "{\\"nested\\": true}"}');
 * if (result.success) {
 *   console.log(result.data.data.nested);
 * }
 */
export function parseNestedJSON<T = unknown>(
  json: string,
  depth = 2,
): ParseResult<T> {
  let currentResult = safeJSONParse<T>(json);

  for (let i = 0; i < depth - 1; i++) {
    if (!currentResult.success) {
      break;
    }

    if (typeof currentResult.data === 'string') {
      currentResult = safeJSONParse<T>(currentResult.data);
    } else {
      break;
    }
  }

  return currentResult;
}

/**
 * Parse JSON from Buffer
 *
 * @param buffer - Buffer containing JSON data
 * @param encoding - Character encoding (default: 'utf-8')
 * @returns Parse result
 *
 * @example
 * const result = parseJSONFromBuffer(buffer);
 * if (result.success) {
 *   console.log(result.data);
 * }
 */
export function parseJSONFromBuffer<T = unknown>(
  buffer: Buffer,
  encoding: 'utf-8' | 'ascii' | 'utf8' | 'utf16le' | 'base64' | 'latin1' | 'binary' | 'hex' = 'utf-8',
): ParseResult<T> {
  try {
    const json = buffer.toString(encoding);
    return safeJSONParse<T>(json);
  } catch (error) {
    return {
      success: false,
      error: getErrorMessage(error),
    };
  }
}
