/**
 * API Response Utilities
 *
 * This module provides utilities for type-safe handling of API responses and errors.
 * It includes functions for standardizing response formats, error handling, and
 * data validation. These utilities help maintain consistent error handling across
 * the application and provide better type safety for API interactions.
 *
 * @module utils/api-response
 */
/**
 * Standard API response structure with success flag and typed data/error
 */
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    message: string;
    code?: string;
    details?: unknown;
  };
}
/**
 * Creates a successful API response with typed data
 *
 * @template T Type of the response data
 * @param {T} data The response data
 * @returns {ApiResponse<T>} Standardized successful response
 *
 * @example
 * ```ts
 * return createSuccessResponse({ user: { id: 1, name: 'John' } });
 * ```
 */
export function createSuccessResponse<T>(data: T): ApiResponse<T> {
  return {
    success: true,
    data
  };
}
/**
 * Creates an error API response with detailed error information
 *
 * @template T Type of the expected data (included for type consistency)
 * @param {string} message Error message
 * @param {string} [code] Optional error code
 * @param {unknown} [details] Optional error details
 * @returns {ApiResponse<T>} Standardized error response
 *
 * @example
 * ```ts
 * return createErrorResponse<User>('User not found', 'NOT_FOUND');
 * ```
 */
export function createErrorResponse<T>(message: string, code?: string, details?: unknown): ApiResponse<T> {
  const error: {
    message: string;
    code?: string;
    details?: unknown;
  } = { message };
  if (code !== undefined) {
    error.code = code;
  }
  if (details !== undefined) {
    error.details = details;
  }
  return {
    success: false,
    error
  };
}
/**
 * Type guard to check if an API response is successful
 *
 * @template T Type of the expected data
 * @param {ApiResponse<T>} response The API response to check
 * @returns {response is ApiResponse<T> & { success: true, data: T }} Type guard for successful responses
 *
 * @example
 * ```ts
 * if (isSuccessResponse(response)) {
 *   // response.data is guaranteed to exist and be of type T
 *   processData(response.data);
 * }
 * ```
 */
export function isSuccessResponse<T>(response: ApiResponse<T>): response is ApiResponse<T> & {
  success: true;
  data: T;
} {
  return response.success === true && response.data !== undefined;
}
/**
 * Type guard to check if an API response is an error
 *
 * @template T Type of the expected data
 * @param {ApiResponse<T>} response The API response to check
 * @returns {response is ApiResponse<T> & { success: false, error: { message: string } }} Type guard for error responses
 *
 * @example
 * ```ts
 * if (isErrorResponse(response)) {
 *   // response.error is guaranteed to exist
 *   showError(response.error instanceof Error ? response.error.message : String(response.error));
 * }
 * ```
 */
export function isErrorResponse<T>(response: ApiResponse<T>): response is ApiResponse<T> & {
  success: false;
  error: {
    message: string;
  };
} {
  return response.success === false && response.error !== undefined;
}
/**
 * Wraps a promise to return a standardized API response
 * Catches errors and converts them to error responses
 *
 * @template T Type of the expected data
 * @param {Promise<T>} promise The promise to wrap
 * @returns {Promise<ApiResponse<T>>} Promise that always resolves with an ApiResponse
 *
 * @example
 * ```ts
 * const response = await wrapApiResponse(fetchUserData(userId));
 * if (isSuccessResponse(response)) {
 *   return response.data;
 * } else {
 *   handleError(response.error);
 * }
 * ```
 */
export async function wrapApiResponse<T>(promise: Promise<T>): Promise<ApiResponse<T>> {
  try {
    const data = await promise;
    return createSuccessResponse(data);
  }
  catch (error: unknown) {
    const message = error instanceof Error ? (error instanceof Error ? error.message : String(error)) : 'Unknown error occurred';
    return createErrorResponse<T>(message, error instanceof Error ? (error instanceof Error ? error["name"] : String(error)) : 'UNKNOWN_ERROR', error);
  }
}
/**
 * Maps an API response from one type to another using a transformation function
 *
 * @template T Type of the source data
 * @template R Type of the result data
 * @param {ApiResponse<T>} response The source API response
 * @param {(data: T) => R} transform Function to transform the data
 * @returns {ApiResponse<R>} Transformed API response
 *
 * @example
 * ```ts
 * const userResponse = await fetchUser(userId);
 * const profileResponse = mapApiResponse(
 *   userResponse,
 *   user => ({ name: user["name"], avatar: user.profilePic })
 * );
 * ```
 */
export function mapApiResponse<T, R>(response: ApiResponse<T>, transform: (data: T) => R): ApiResponse<R> {
  if (isSuccessResponse(response)) {
    try {
      const transformed = transform(response.data);
      return createSuccessResponse(transformed);
    }
    catch (error: unknown) {
      const message = error instanceof Error ? (error instanceof Error ? error.message : String(error)) : 'Error transforming data';
      return createErrorResponse<R>(message, 'TRANSFORM_ERROR', error);
    }
  }
  // If it's an error response, preserve the error but change the generic type
  // Safe error code extraction
  const errorCode = response.error && 'code' in response.error && typeof response.error.code === 'string'
    ? response.error.code
    : undefined;

  return createErrorResponse<R>(response.error?.message ?? 'Unknown error', errorCode, response.error?.details);
}
/**
 * Extracts data from a successful API response or throws for error responses
 * Useful for functions that should handle errors at call site
 *
 * @template T Type of the expected data
 * @param {ApiResponse<T>} response The API response
 * @returns {T} The data from a successful response
 * @throws {Error} If response is an error
 *
 * @example
 * ```ts
 * try {
 *   const userData = extractApiData(await fetchUser(userId));
 *   // userData is guaranteed to be of type T
 * } catch (error) {
 *   handleError(error);
 * }
 * ```
 */
export function extractApiData<T>(response: ApiResponse<T>): T {
  if (isSuccessResponse(response)) {
    return response.data;
  }
  // Create error with proper message and cause
  const errorMessage = response.error?.message ?? 'Failed to extract data from API response';
  const error = response.error?.details
    ? new Error(errorMessage, { cause: response.error.details })
    : new Error(errorMessage);
  throw error;
}