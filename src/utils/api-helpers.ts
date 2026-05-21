/**
 * API Helper Utilities
 * Common functions for API error handling and responses
 */

export class ApiError extends Error {
  statusCode: number;
  code?: string;
  details?: unknown;
  constructor(message: string, statusCode: number = 500, code?: string, details?: unknown) {
    super(message);
    this["name"] = 'ApiError';
    this.statusCode = statusCode;
    if (code !== undefined) this.code = code;
    if (details !== undefined) this.details = details;
  }
}

export class ApiAuthenticationError extends ApiError {
  constructor(message: string = 'Authentication failed') {
    super(message, 401, 'AUTHENTICATION_ERROR');
  }
}

export class ApiPermissionError extends ApiError {
  constructor(message: string = 'Permission denied') {
    super(message, 403, 'PERMISSION_ERROR');
  }
}

export class ApiValidationError extends ApiError {
  constructor(message: string = 'Validation failed') {
    super(message, 400, 'VALIDATION_ERROR');
  }
}

export function createApiErrorResponse(error: Error | ApiError): {
  error: {
    message: string;
    code?: string;
    statusCode: number;
    details?: unknown;
  };
} {
  if (error instanceof ApiError) {
    return {
      error: {
        message: error instanceof Error ? error.message : String(error),
        code: error instanceof Error ? error.message : String(error),
        statusCode: error.statusCode,
        details: error.details
      }
    };
  }

  return {
    error: {
      message: error instanceof Error ? error.message : String(error),
      statusCode: 500
    }
  };
}

export function getErrorStatusCode(error: Error | ApiError): number {
  if (error instanceof ApiError) {
    return error.statusCode;
  }
  return 500;
}

// Retry utility
export interface RetryConfig {
  maxAttempts?: number;
  delay?: number;
  backoff?: number;
  onRetry?: (attempt: number, error: Error) => void;
}

export async function retryWithBackoff<T>(
fn: () => Promise<T>,
config: RetryConfig = {})
: Promise<T> {
  const {
    maxAttempts = 3,
    delay = 1000,
    backoff = 2,
    onRetry
  } = config;
  let lastError: Error | undefined;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      // eslint-disable-next-line no-await-in-loop -- Sequential execution required for retry logic
      return await fn();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      lastError = new Error(errorMessage);
      if (attempt < maxAttempts) {
        const waitTime = delay * Math.pow(backoff, attempt - 1);
        if (onRetry) {
          onRetry(attempt, lastError);
        }
        // eslint-disable-next-line no-await-in-loop -- Intentional delay between retry attempts
        await new Promise((resolve) => { void setTimeout(resolve, waitTime); });
      }
    }
  }

  throw lastError ?? new Error('Retry failed');
}