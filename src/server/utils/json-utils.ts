/**
 * Safe JSON Parsing Utilities
 *
 * Provides secure JSON parsing with Zod validation to prevent:
 * - Runtime errors from invalid JSON
 * - Type confusion attacks
 * - Prototype pollution
 * - Unvalidated data flowing through the application
 *
 * OWASP A03:2021 - Injection Prevention
 *
 * @module json-utils
 */

import { z } from 'zod';

import type { AsyncResult } from '@/utils/async-result';
import { createSuccessResult, createErrorResult } from '@/utils/async-result';
import { logger } from '@/utils/logging';

/**
 * Safely parse JSON with Zod validation
 *
 * This function provides defense-in-depth against injection attacks:
 * 1. Catches JSON parsing errors (malformed JSON)
 * 2. Validates structure with Zod schema (type safety)
 * 3. Returns AsyncResult for explicit error handling
 *
 * @param jsonString - JSON string to parse (from external source)
 * @param schema - Zod schema to validate against
 * @param context - Optional context for logging (e.g., API endpoint, file path)
 * @returns AsyncResult with parsed and validated data, or error
 *
 * @example
 * ```typescript
 * const userSchema = z.object({
 *   id: z.number(),
 *   username: z.string(),
 *   email: z.string().email()
 * });
 *
 * const result = safeJsonParse(requestBody, userSchema, { source: 'user-api' });
 * if (result.isErr()) {
 *   logger.error('Invalid user data', { error: result.error });
 *   return res.status(400).json({ error: 'Invalid request' });
 * }
 *
 * const user = result.value; // Fully typed and validated
 * ```
 */
export function safeJsonParse<T>(
  jsonString: string,
  schema: z.ZodSchema<T>,
  context?: { source?: string; identifier?: string }
): AsyncResult<T, Error> {
  try {
    // Step 1: Parse JSON (may throw SyntaxError)
    const parsed: unknown = JSON.parse(jsonString);

    // Step 2: Validate with Zod schema (may throw ZodError)
    const validated = schema.parse(parsed);

    return createSuccessResult(validated);
  } catch (error) {
    // Distinguish between parsing errors and validation errors
    if (error instanceof z.ZodError) {
      const validationError = new Error(
        `JSON validation failed: ${error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}`
      );

      logger.warn('JSON validation failed', {
        context,
        errors: error.errors,
        jsonLength: jsonString.length
      });

      return createErrorResult(validationError);
    }

    if (error instanceof SyntaxError) {
      const parseError = new Error(`Invalid JSON syntax: ${error.message}`);

      logger.warn('JSON parsing failed', {
        context,
        error: error.message,
        jsonPreview: jsonString.substring(0, 100) // First 100 chars for debugging
      });

      return createErrorResult(parseError);
    }

    // Unexpected error
    logger.error('Unexpected error in safeJsonParse', {
      context,
      error: error instanceof Error ? error.message : String(error)
    });

    return createErrorResult(error instanceof Error ? error : new Error(String(error)));
  }
}

/**
 * Parse JSON with fallback value (for non-critical data)
 *
 * Use this when:
 * - Data is optional or has reasonable defaults
 * - Validation failure should not block the operation
 * - Performance is critical (no AsyncResult overhead)
 *
 * DO NOT use for:
 * - User authentication data
 * - Financial transactions
 * - Access control decisions
 * - Database queries
 *
 * @param jsonString - JSON string to parse
 * @param fallback - Fallback value if parsing fails
 * @param context - Optional context for logging
 * @returns Parsed value or fallback
 *
 * @example
 * ```typescript
 * // User preferences (non-critical)
 * const preferences = parseJsonWithFallback(
 *   storedPrefs,
 *   { theme: 'dark', language: 'en' },
 *   { source: 'user-preferences' }
 * );
 * ```
 */
export function parseJsonWithFallback<T>(
  jsonString: string,
  fallback: T,
  context?: { source?: string }
): T {
  try {
    return JSON.parse(jsonString) as T;
  } catch (error) {
    logger.debug('JSON parsing failed, using fallback', {
      context,
      error: error instanceof Error ? error.message : String(error)
    });

    return fallback;
  }
}

/**
 * Safely parse JSON array with validation for each element
 *
 * Useful for processing lists from external sources where individual
 * items might be invalid but shouldn't fail the entire operation.
 *
 * @param jsonString - JSON string containing an array
 * @param itemSchema - Zod schema for each array item
 * @param options - Parsing options
 * @returns AsyncResult with validated array and list of skipped items
 *
 * @example
 * ```typescript
 * const mangaSchema = z.object({ id: z.number(), title: z.string() });
 * const result = safeJsonParseArray(apiResponse, mangaSchema, { skipInvalid: true });
 *
 * if (result.isErr()) {
 *   return; // Critical parse error
 * }
 *
 * const { validItems, skippedCount } = result.value;
 * logger.info(`Parsed ${validItems.length} items, skipped ${skippedCount}`);
 * ```
 */
export function safeJsonParseArray<T>(
  jsonString: string,
  itemSchema: z.ZodSchema<T>,
  options?: {
    skipInvalid?: boolean; // Continue parsing even if some items fail
    maxItems?: number; // Limit array size (DoS prevention)
    context?: { source?: string };
  }
): AsyncResult<{ validItems: T[]; skippedCount: number }, Error> {
  try {
    // Parse JSON
    const parsed: unknown = JSON.parse(jsonString);

    // Ensure it's an array
    if (!Array.isArray(parsed)) {
      return createErrorResult(new Error('Expected JSON array'));
    }

    // Check max items limit (DoS prevention)
    if (options?.maxItems && parsed.length > options.maxItems) {
      logger.warn('JSON array exceeds max items limit', {
        context: options.context,
        arrayLength: parsed.length,
        maxItems: options.maxItems
      });

      return createErrorResult(new Error(`Array exceeds maximum size of ${options.maxItems} items`));
    }

    const validItems: T[] = [];
    let skippedCount = 0;

    // Validate each item
    for (let i = 0; i < parsed.length; i++) {
      try {
        const validatedItem = itemSchema.parse(parsed[i]);
        validItems.push(validatedItem);
      } catch (error) {
        if (options?.skipInvalid) {
          skippedCount++;
          logger.debug('Skipped invalid array item', {
            context: options.context,
            index: i,
            error: error instanceof z.ZodError ? error.errors : String(error)
          });
        } else {
          // Fail fast if skipInvalid is false
          return createErrorResult(new Error(`Item at index ${i} failed validation: ${
            error instanceof z.ZodError ? error.errors[0]?.message : String(error)
          }`));
        }
      }
    }

    if (skippedCount > 0) {
      logger.info('JSON array parsing completed with skipped items', {
        context: options?.context,
        validItems: validItems.length,
        skippedCount,
        totalItems: parsed.length
      });
    }

    return createSuccessResult({ validItems, skippedCount });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return createErrorResult(new Error(`Invalid JSON syntax: ${error.message}`));
    }

    return createErrorResult(error instanceof Error ? error : new Error(String(error)));
  }
}

/**
 * Safely stringify objects for JSON output
 *
 * Handles circular references and BigInt values that would cause
 * JSON.stringify to throw errors.
 *
 * @param value - Value to stringify
 * @param options - Stringify options
 * @returns JSON string or error
 *
 * @example
 * ```typescript
 * const result = safeJsonStringify(complexObject, { pretty: true });
 * if (result.isErr()) {
 *   logger.error('Failed to stringify', { error: result.error });
 *   return '{}';
 * }
 * return result.value;
 * ```
 */
export function safeJsonStringify(
  value: unknown,
  options?: {
    pretty?: boolean;
    maxDepth?: number;
  }
): AsyncResult<string, Error> {
  try {
    const seen = new WeakSet();
    let depth = 0;
    const maxDepth = options?.maxDepth ?? 10;

    const replacer = (_key: string, val: unknown): unknown => {
      // Handle BigInt
      if (typeof val === 'bigint') {
        return val.toString();
      }

      // Handle circular references
      if (typeof val === 'object' && val !== null) {
        // Check depth limit
        depth++;
        if (depth > maxDepth) {
          return '[Max Depth Reached]';
        }

        if (seen.has(val)) {
          return '[Circular Reference]';
        }
        seen.add(val);
      }

      return val;
    };

    const jsonString = options?.pretty
      ? JSON.stringify(value, replacer, 2)
      : JSON.stringify(value, replacer);

    return createSuccessResult(jsonString);
  } catch (error) {
    logger.error('JSON stringification failed', {
      error: error instanceof Error ? error.message : String(error)
    });

    return createErrorResult(error instanceof Error ? error : new Error(String(error)));
  }
}
