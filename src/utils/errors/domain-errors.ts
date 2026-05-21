/**
 * Domain-Specific Error Classes
 * 
 * Specialized error types for different domains within the application.
 * Each error type has specific properties and behaviors relevant to its domain.
 */

import { BaseError } from './base-error';

import type { ErrorContext } from './base-error';

/**
 * Validation errors for invalid input data
 */
export class ValidationError extends BaseError {
  constructor(
    message: string,
    public readonly field?: string,
    public readonly value?: unknown,
    context?: ErrorContext,
    cause?: Error
  ) {
    super(
      message,
      'VALIDATION_ERROR',
      400,
      { ...context, field, value },
      cause
    );
  }
}

/**
 * Resource not found errors
 */
export class NotFoundError extends BaseError {
  constructor(
    resource: string,
    id?: string | number,
    context?: ErrorContext
  ) {
    const message = id 
      ? `${resource} with id ${id} not found`
      : `${resource} not found`;
    
    super(
      message,
      'NOT_FOUND',
      404,
      { ...context, resource, resourceId: id ? String(id) : undefined }
    );
  }
}

/**
 * Authentication errors (not authenticated)
 */
export class AuthenticationError extends BaseError {
  constructor(
    message: string = 'Authentication required',
    context?: ErrorContext
  ) {
    super(message, 'AUTHENTICATION_ERROR', 401, context);
  }
}

/**
 * Authorization errors (authenticated but not authorized)
 */
export class AuthorizationError extends BaseError {
  constructor(
    message: string = 'Insufficient permissions',
    public readonly requiredPermission?: string,
    context?: ErrorContext
  ) {
    super(
      message,
      'AUTHORIZATION_ERROR',
      403,
      { ...context, requiredPermission }
    );
  }
}

/**
 * Database operation errors
 */
export class DatabaseError extends BaseError {
  constructor(
    message: string,
    public readonly operation: string,
    public readonly table?: string,
    context?: ErrorContext,
    cause?: Error
  ) {
    super(
      message,
      'DATABASE_ERROR',
      500,
      { ...context, operation, table },
      cause
    );
  }
  
  /**
   * Check if this is a unique constraint violation
   */
  isUniqueConstraintViolation(): boolean {
    return this.cause?.message.includes('Unique constraint') ?? false;
  }
  
  /**
   * Check if this is a foreign key constraint violation
   */
  isForeignKeyViolation(): boolean {
    return this.cause?.message.includes('Foreign key constraint') ?? false;
  }
}

/**
 * Options for ExternalApiError constructor
 */
interface ExternalApiErrorOptions {
  apiStatusCode?: number;
  apiResponse?: unknown;
  context?: ErrorContext;
  cause?: Error;
}

/**
 * External API errors
 */
export class ExternalApiError extends BaseError {
  public readonly apiStatusCode: number | undefined;
  public readonly apiResponse: unknown | undefined;

  constructor(
    public readonly service: string,
    message: string,
    options: ExternalApiErrorOptions = {}
  ) {
    const { apiStatusCode, apiResponse, context, cause } = options;
    super(
      `${service}: ${message}`,
      'EXTERNAL_API_ERROR',
      apiStatusCode && apiStatusCode >= 400 && apiStatusCode < 500 ? 400 : 502,
      { ...context, service, apiStatusCode, apiResponse },
      cause
    );
    this.apiStatusCode = apiStatusCode;
    this.apiResponse = apiResponse;
  }
  
  /**
   * Check if the error is retryable
   */
  isRetryable(): boolean {
    // 5xx errors and specific 4xx errors are retryable
    return (
      (this.apiStatusCode !== undefined && this.apiStatusCode >= 500) ||
      this.apiStatusCode === 429 || // Too Many Requests
      this.apiStatusCode === 408    // Request Timeout
    );
  }
}

/**
 * Options for QueueError constructor
 */
interface QueueErrorOptions {
  retryCount?: number;
  context?: ErrorContext;
  cause?: Error;
}

/**
 * Queue/Background job errors
 */
export class QueueError extends BaseError {
  public readonly retryCount: number | undefined;

  constructor(
    public readonly jobType: string,
    public readonly taskId: string,
    message: string,
    options: QueueErrorOptions = {}
  ) {
    const { retryCount, context, cause } = options;
    super(
      message,
      'QUEUE_ERROR',
      500,
      { ...context, jobType, taskId, retryCount },
      cause
    );
    this.retryCount = retryCount;
  }
  
  /**
   * Check if the task should be retried
   */
  shouldRetry(maxRetries: number = 3): boolean {
    return (this.retryCount ?? 0) < maxRetries;
  }
}

/**
 * File system errors
 */
export class FileSystemError extends BaseError {
  constructor(
    message: string,
    public readonly path: string,
    public readonly operation: 'read' | 'write' | 'delete' | 'create',
    context?: ErrorContext,
    cause?: Error
  ) {
    super(
      message,
      'FILESYSTEM_ERROR',
      500,
      { ...context, path, operation },
      cause
    );
  }
}

/**
 * Network errors
 */
export class NetworkError extends BaseError {
  constructor(
    message: string,
    public readonly url?: string,
    public readonly method?: string,
    context?: ErrorContext,
    cause?: Error
  ) {
    super(
      message,
      'NETWORK_ERROR',
      503,
      { ...context, url, method },
      cause
    );
  }
  
  /**
   * Check if this is a timeout error
   */
  isTimeout(): boolean {
    return this.message.toLowerCase().includes('timeout') ||
           (this.cause?.message.toLowerCase().includes('timeout') ?? false);
  }
}

/**
 * Configuration errors
 */
export class ConfigurationError extends BaseError {
  constructor(
    message: string,
    public readonly configKey?: string,
    context?: ErrorContext
  ) {
    super(
      message,
      'CONFIGURATION_ERROR',
      500,
      { ...context, configKey }
    );
  }
}

/**
 * Business logic errors
 */
export class BusinessLogicError extends BaseError {
  constructor(
    message: string,
    code: string,
    context?: ErrorContext
  ) {
    super(message, code, 400, context);
  }
}

/**
 * Rate limiting errors
 */
export class RateLimitError extends BaseError {
  constructor(
    message: string = 'Rate limit exceeded',
    public readonly retryAfter?: number,
    context?: ErrorContext
  ) {
    super(
      message,
      'RATE_LIMIT_ERROR',
      429,
      { ...context, retryAfter }
    );
  }
}

/**
 * Conflict errors (e.g., resource already exists)
 */
export class ConflictError extends BaseError {
  constructor(
    message: string,
    public readonly conflictingResource?: string,
    context?: ErrorContext
  ) {
    super(
      message,
      'CONFLICT_ERROR',
      409,
      { ...context, conflictingResource }
    );
  }
}

/**
 * Timeout errors
 */
export class TimeoutError extends BaseError {
  constructor(
    message: string,
    public readonly timeoutMs?: number,
    context?: ErrorContext
  ) {
    super(
      message,
      'TIMEOUT_ERROR',
      504,
      { ...context, timeoutMs }
    );
  }
}

/**
 * Integration errors for adapter/provider failures
 */
export class IntegrationError extends BaseError {
  constructor(
    public readonly integration: string,
    message: string,
    context?: ErrorContext,
    cause?: Error
  ) {
    super(
      `${integration}: ${message}`,
      'INTEGRATION_ERROR',
      502,
      { ...context, integration },
      cause
    );
  }
}