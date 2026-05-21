/**
 * Kaizoku API SDK Utilities
 *
 * Helper functions for type-safe operations and error handling.
 * Extracted from: kaizoku-api-sdk.ts
 */

/**
 * Type guard for checking if a value is a record
 */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * Safely extract error message from unknown error
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

/**
 * Convert unknown error to Error object
 */
export function toError(error: unknown): Error {
  if (error instanceof Error) {
    return error;
  }
  return new Error(String(error));
}

/**
 * Type-safe JSON parse with error handling
 */
export async function safeJsonParse<T>(
  response: Response
): Promise<T | Record<string, unknown>> {
  try {
    return (await response.json()) as T;
  } catch {
    return {};
  }
}

/**
 * API error response structure
 */
export interface ApiErrorResponse {
  error?: {
    message?: string;
    code?: string;
    details?: unknown;
  };
}

/**
 * Type guard for API error response
 */
export function isApiErrorResponse(value: unknown): value is ApiErrorResponse {
  if (!isRecord(value)) return false;
  if (!('error' in value)) return true; // empty object is valid
  const error = value['error'];
  if (error === null || error === undefined) return true;
  if (!isRecord(error)) return false;
  return true;
}
