/**
 * Type-Safe External API Client
 *
 * This module provides utilities for making type-safe external API calls
 * with automatic Zod schema validation.
 *
 * Benefits:
 * - Runtime validation of external data
 * - Type safety from external APIs
 * - Clear error messages for invalid responses
 * - Consistent error handling
 *
 * @example
 * ```typescript
 * import { fetchJSON } from '@/lib/api-client';
 * import { AniListMediaSchema } from '@/lib/schemas';
 *
 * const data = await fetchJSON({
 *   url: 'https://graphql.anilist.co',
 *   method: 'POST',
 *   body: { query: '...' },
 *   schema: AniListMediaSchema,
 * });
 * // data is now typed and validated!
 * ```
 *
 * @module api-client
 */

import { z } from 'zod';

import { logger } from '@/utils/logger';

/**
 * Options for fetchJSON
 */
export interface FetchJSONOptions<T extends z.ZodTypeAny> {
  /** URL to fetch from */
  url: string;
  /** HTTP method */
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  /** Request headers */
  headers?: Record<string, string>;
  /** Request body (will be JSON stringified) */
  body?: unknown;
  /** Zod schema to validate response */
  schema: T;
  /** Optional timeout in milliseconds */
  timeout?: number;
  /** Whether to log validation errors (default: true) */
  logValidationErrors?: boolean;
}

/**
 * Type-safe fetch error
 */
export class FetchJSONError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly validationError?: z.ZodError,
    public readonly originalError?: unknown
  ) {
    super(message);
    this.name = 'FetchJSONError';
  }
}

/**
 * Make a type-safe JSON API call with Zod validation
 *
 * This function fetches JSON data from an external API and validates it
 * against a Zod schema, ensuring runtime type safety.
 *
 * @param options - Fetch options including URL, method, headers, body, and schema
 * @returns Validated and typed response data
 * @throws {FetchJSONError} If request fails or validation fails
 *
 * @example
 * ```typescript
 * // Basic usage
 * const data = await fetchJSON({
 *   url: 'https://api.example.com/manga/123',
 *   schema: MangaSchema,
 * });
 *
 * // POST request
 * const result = await fetchJSON({
 *   url: 'https://api.example.com/manga',
 *   method: 'POST',
 *   body: { title: 'One Piece' },
 *   schema: MangaSchema,
 *   headers: { 'Authorization': `Bearer ${token}` },
 * });
 * ```
 */
export async function fetchJSON<T extends z.ZodTypeAny>(
  options: FetchJSONOptions<T>
): Promise<z.output<T>> {
  const {
    url,
    method = 'GET',
    headers = {},
    body,
    schema,
    timeout = 30000,
    logValidationErrors = true,
  } = options;

  try {
    // Create abort controller for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      // Make request
      const fetchOptions: RequestInit = {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
        signal: controller.signal,
      };

      if (body) {
        fetchOptions.body = JSON.stringify(body);
      }

      const response = await fetch(url, fetchOptions);

      clearTimeout(timeoutId);

      // Check HTTP status
      if (!response.ok) {
        throw new FetchJSONError(
          `HTTP ${response.status}: ${response.statusText}`,
          response.status
        );
      }

      // Parse JSON
      const rawData: unknown = await response.json();

      // Validate with Zod schema
      const parseResult = schema.safeParse(rawData);

      if (!parseResult.success) {
        if (logValidationErrors) {
          logger.error('[fetchJSON] Validation failed', {
            url,
            errors: parseResult.error.errors,
            rawData: JSON.stringify(rawData).substring(0, 500), // Log first 500 chars
          });
        }

        throw new FetchJSONError(
          'Response validation failed',
          response.status,
          parseResult.error
        );
      }

      // Type narrowing: parseResult.success === true guarantees parseResult.data is Output
      // However, TypeScript-ESLint doesn't recognize this narrowing, so we use explicit typing
      // This is safe because Zod's safeParse guarantees Output type when success === true
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return -- Zod's type system uses any internally, but validation guarantees type safety
      return parseResult.data as z.output<T>;
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (error: unknown) {
    // Handle abort errors
    if (error instanceof Error && error.name === 'AbortError') {
      throw new FetchJSONError(`Request timeout after ${timeout}ms`, undefined, undefined, error);
    }

    // Re-throw FetchJSONError as-is
    if (error instanceof FetchJSONError) {
      throw error;
    }

    // Wrap other errors
    throw new FetchJSONError(
      error instanceof Error ? error.message : 'Unknown error',
      undefined,
      undefined,
      error
    );
  }
}

/**
 * Make a type-safe GraphQL query with Zod validation
 *
 * Convenience wrapper around fetchJSON for GraphQL APIs.
 *
 * @param options - GraphQL query options
 * @returns Validated and typed response data
 *
 * @example
 * ```typescript
 * const data = await fetchGraphQL({
 *   url: 'https://graphql.anilist.co',
 *   query: `
 *     query ($id: Int) {
 *       Media(id: $id, type: MANGA) {
 *         title { romaji }
 *       }
 *     }
 *   `,
 *   variables: { id: 123 },
 *   schema: AniListMediaQueryResponseSchema,
 * });
 * ```
 */
export async function fetchGraphQL<T extends z.ZodTypeAny>(
  options: Omit<FetchJSONOptions<T>, 'method' | 'body'> & {
    query: string;
    variables?: Record<string, unknown>;
  }
): Promise<z.output<T>> {
  const { query, variables, ...rest } = options;

  return fetchJSON({
    ...rest,
    method: 'POST',
    body: {
      query,
      variables,
    },
  });
}

/**
 * Lenient version of fetchJSON that returns null on validation errors
 *
 * Useful for non-critical data where you want to gracefully handle failures.
 *
 * @param options - Fetch options
 * @returns Validated data or null if validation fails
 *
 * @example
 * ```typescript
 * const data = await fetchJSONLenient({
 *   url: 'https://api.example.com/optional-data',
 *   schema: DataSchema,
 * });
 *
 * if (data) {
 *   // Use validated data
 * } else {
 *   // Handle failure gracefully
 * }
 * ```
 */
export async function fetchJSONLenient<T extends z.ZodTypeAny>(
  options: FetchJSONOptions<T>
): Promise<z.output<T> | null> {
  try {
    const result = await fetchJSON(options);
    // Result is already properly typed from fetchJSON
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return -- fetchJSON already validated with Zod
    return result;
  } catch (error: unknown) {
    if (error instanceof FetchJSONError && error.validationError) {
      logger.warn('[fetchJSONLenient] Validation failed, returning null', {
        url: options.url,
        error: error.message,
      });
      return null;
    }
    throw error;
  }
}
