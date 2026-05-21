/**
 * Kaizoku API SDK - Custom Error Class
 *
 * Error class for API-specific errors with code and status information.
 *
 * Extracted from: kaizoku-api-sdk.ts (lines 1073-1083)
 */

/**
 * Custom error class for API errors
 */
export class ApiError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number,
    public details?: unknown
  ) {
    super(message);
    this.name = 'ApiError';
  }
}
