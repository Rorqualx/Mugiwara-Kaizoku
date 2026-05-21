/**
 * Error Handling Utilities
 *
 * This module provides standardized error handling utilities for consistent
 * error management across the application. These utilities help with:
 *
 * - Type-safe error message extraction
 * - Adding context to errors
 * - Wrapping operations with standard error handling
 * - Integration with AsyncResult pattern
 *
 * @module utils/error-handling
 */
import type { AsyncResult} from '@/utils/async-result';
import { createSuccessResult, createErrorResult, toErrorType } from '@/utils/async-result';
import { logger } from '@/utils/logging';
/**
 * Helper function to safely convert a value to string or undefined
 * @param value - Any value to convert to string
 * @returns The value as string, or undefined if null/undefined or conversion fails
 */
export function safeStringOrUndefined(value: unknown): string | undefined {
  if (value === null)
  return undefined;
  if (typeof value === 'string')
  return value;
  try {
    return String(value);
  }
  catch (_error: unknown) {
    return undefined;
  }
}
/**
 * Base interface for all error context objects
 */
export interface ErrorContext {
  /** Name of the operation that failed */
  operation?: string;
  /** Service or component name where the error occurred */
  service?: string;
  /** ID of the resource being processed */
  resourceId?: string | number;
  /** Additional context fields */
  [key: string]: unknown;
}
/**
 * Context for async operation error handling
 */
export interface OperationContext extends ErrorContext {
  /** Name of the operation (required) */
  operationName: string;
  /** Service name (required) */
  serviceName: string;
}
/**
 * Base class for application-specific errors
 */
export class AppError extends Error {
  /** Error context information */
  context: ErrorContext;
  /**
   * Create a new application error
   *
   * @param message - Error message
   * @param context - Context information about the error
   */
  constructor(message: string, context: ErrorContext = {}) {
    super(message);
    this["name"] = this.constructor["name"];
    this.context = context;
    // Maintain proper stack trace in modern JS engines
    Error.captureStackTrace(this, this.constructor);
  }
  /**
   * Convert error to string with context
   * @override
   */
  override toString(): string {
    const contextStr = Object.entries(this.context).
    filter(([_, value]) => value !== undefined).
    map(([key, value]) => `${key}: ${value}`).
    join(', ');
    return `${this["name"]}: ${this.message}${contextStr ? ` (${contextStr})` : ''}`;
  }
}
/**
 * Error for API-related failures
 */
export class ApiError extends AppError {
  /** HTTP status code if available */
  statusCode?: number;
  /**
   * Create a new API error
   *
   * @param message - Error message
   * @param statusCode - HTTP status code
   * @param context - Error context
   */
  constructor(message: string, statusCode?: number, context: ErrorContext = {}) {
    super(message, context);
    if (statusCode !== undefined) {
      this.statusCode = statusCode;
    }
  }
}
/**
 * Error for validation failures
 */
export class ValidationError extends AppError {
  /** Validation errors by field */
  errors: Record<string, string[]>;
  /**
   * Create a new validation error
   *
   * @param message - Error message
   * @param errors - Validation errors by field
   * @param context - Error context
   */
  constructor(message: string, errors: Record<string, string[]> = {}, context: ErrorContext = {}) {
    super(message, context);
    this.errors = errors;
  }
}
/**
 * Error for resource not found
 */
export class NotFoundError extends AppError {
  /**
   * Create a new not found error
   *
   * @param resourceType - Type of resource not found
   * @param resourceId - ID of resource not found
   * @param context - Additional context
   */
  constructor(resourceType: string, resourceId: string | number, context: ErrorContext = {}) {
    super(`${resourceType} with ID ${resourceId} not found`, { ...context, resourceType, resourceId });
  }
}
/**
 * Error for authentication failures
 */
export class AuthenticationError extends AppError {
  /**
   * Create a new authentication error
   *
   * @param message - Error message
   * @param context - Error context
   */
  constructor(message: string, context: ErrorContext = {}) {
    super(message, { ...context, authError: true });
  }
}
/**
 * Type guard for AppError
 *
 * @param error - Error to check
 * @returns True if error is an AppError
 */
export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}
/**
 * Type guard for ApiError
 *
 * @param error - Error to check
 * @returns True if error is an ApiError
 */
export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}
/**
 * Type guard for ValidationError
 *
 * @param error - Error to check
 * @returns True if error is a ValidationError
 */
export function isValidationError(error: unknown): error is ValidationError {
  return error instanceof ValidationError;
}
/**
 * Type guard for NotFoundError
 *
 * @param error - Error to check
 * @returns True if error is a NotFoundError
 */
export function isNotFoundError(error: unknown): error is NotFoundError {
  return error instanceof NotFoundError;
}
/**
 * Type guard for AuthenticationError
 *
 * @param error - Error to check
 * @returns True if error is an AuthenticationError
 */
export function isAuthenticationError(error: unknown): error is AuthenticationError {
  return error instanceof AuthenticationError;
}
/**
 * Safely extracts error message with type checking
 *
 * @param error - Error object
 * @returns Extracted error message
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return (error instanceof Error ? error.message : String(error));
  }
  if (typeof error === 'string') {
    return error;
  }
  if (error === null) {
    return 'Null error';
  }
  if (error === undefined) {
    return 'Undefined error';
  }
  try {
    const errorStr = JSON.stringify(error);
    return `Error: ${errorStr}`;
  }
  catch (_e: unknown) {
return 'Unknown error (cannot convert to string)';
  }
}
/**
 * Creates an error with context information
 *
 * @param message - Error message
 * @param context - Error context
 * @returns Error with context
 */
export function createContextualError(message: string, context: ErrorContext = {}): AppError {
  return new AppError(message, context);
}
/**
 * Creates an API error with context
 *
 * @param message - Error message
 * @param statusCode - HTTP status code
 * @param context - Error context
 * @returns API error
 */
export function createApiError(message: string, statusCode?: number, context: ErrorContext = {}): ApiError {
  return new ApiError(message, statusCode, context);
}
/**
 * Creates a validation error with field errors
 *
 * @param message - Error message
 * @param errors - Validation errors by field
 * @param context - Error context
 * @returns Validation error
 */
export function createValidationError(message: string, errors: Record<string, string[]> = {}, context: ErrorContext = {}): ValidationError {
  return new ValidationError(message, errors, context);
}
/**
 * Creates a not found error
 *
 * @param resourceType - Type of resource not found
 * @param resourceId - ID of resource not found
 * @param context - Additional context
 * @returns Not found error
 */
export function createNotFoundError(resourceType: string, resourceId: string | number, context: ErrorContext = {}): NotFoundError {
  return new NotFoundError(resourceType, resourceId, context);
}
/**
 * Creates an authentication error
 *
 * @param message - Error message
 * @param context - Error context
 * @returns Authentication error
 */
export function createAuthenticationError(message: string, context: ErrorContext = {}): AuthenticationError {
  return new AuthenticationError(message, context);
}
/**
 * Wraps an async operation with standard error handling
 *
 * @param operation - Async operation to execute
 * @param context - Operation context
 * @returns Result of the operation
 * @throws AppError with context if operation fails
 */
export async function withErrorHandling<T>(operation: () => Promise<T>, context: OperationContext): Promise<T> {
  try {
    return await operation();
  }
  catch (error: unknown) {
logger.error(`Error in ${context.serviceName}.${context.operationName}:`, safeStringOrUndefined(error) ?? 'Unknown error');
    if (isAppError(error)) {
      // Preserve the original error type but add context
      error.context = { ...error.context, ...context };
      throw error;
    }
    throw createContextualError(`Operation ${context.operationName} failed: ${getErrorMessage(error)}`, context);
  }
}
/**
 * Wraps an async operation with AsyncResult error handling
 *
 * @param operation - Async operation to execute
 * @param context - Operation context
 * @returns AsyncResult with operation result or error
 */
export async function withAsyncResultErrorHandling<T, E extends Error = Error>(operation: () => Promise<T>, context: OperationContext): Promise<AsyncResult<T, E>> {
  try {
    const result = await operation();
    return createSuccessResult<T, E>(result);
  }
  catch (error: unknown) {
logger.error(`Error in ${context.serviceName}.${context.operationName}:`, safeStringOrUndefined(error) ?? 'Unknown error');
    let typedError: E;
    if (error instanceof Error) {
      // If it's already an Error instance, use it as the base
      if (isAppError(error)) {
        // Add context to existing AppError
        error.context = { ...error.context, ...context };
        typedError = toErrorType<E>(error);
      } else
      {
        // Convert standard Error to AppError with context
        typedError = toErrorType<E>(new AppError((error instanceof Error ? error.message : String(error)), { ...context, originalError: (error instanceof Error ? error["name"] : String(error)) }));
      }
    } else
    {
      // Create a new AppError for non-Error objects
      typedError = toErrorType<E>(new AppError(`Operation ${context.operationName} failed: ${getErrorMessage(error)}`, context));
    }
    return createErrorResult<T, E>(typedError);
  }
}
/**
 * Factory function to create contextual error creators for a service
 *
 * @param defaultContext - Default context to include in all errors
 * @returns Object with error creation functions
 */
/**
 * Checks if a value is a valid response object with expected properties
 *
 * @param response - Response to validate
 * @param requiredProps - Array of required property names
 * @returns Whether the response is valid
 */
export function isValidResponse<T>(response: unknown, requiredProps: (keyof T)[]): response is T {
  if (!response || typeof response !== 'object') {
    return false;
  }
  for (const prop of requiredProps) {
    if (!(prop in response)) {
      return false;
    }
  }
  return true;
}
/**
 * Validates array items in a response
 *
 * @param items - Array to validate
 * @param validator - Function to validate each item
 * @returns Whether all items are valid
 */
export function validateArrayItems<T>(items: unknown, validator: (item: unknown) => item is T): items is T[] {
  if (!Array.isArray(items)) {
    return false;
  }
  return items.every((item) => validator(item));
}
/**
 * Creates a validator function for API responses with consistent error handling
 *
 * @param requiredProps - Required properties for the response
 * @param transform - Optional function to transform the response
 * @returns Function that validates and transforms responses
 */
export function createResponseValidator<T, R = T>(requiredProps: (keyof T)[], transform?: (response: T) => R): (response: unknown) => AsyncResult<R, Error> {
  return (response: unknown): AsyncResult<R, Error> => {
    if (!isValidResponse<T>(response, requiredProps)) {
      return createErrorResult(new ValidationError('Invalid response format', { response: ['Missing required properties'] }));
    }
    try {
      const result = transform ? transform(response) : (response as T) as unknown as R;
      return createSuccessResult(result);
    }
    catch (error: unknown) {
      return createErrorResult(error instanceof Error ? error : new Error(getErrorMessage(error)));
    }
  };
}
export function createContextualErrorCreator(defaultContext: ErrorContext): {
  createError: (message: string, operation?: string, additionalContext?: ErrorContext) => AppError;
  createApiError: (message: string, statusCode?: number, additionalContext?: ErrorContext) => ApiError;
  createValidationError: (message: string, errors?: Record<string, string[]>, additionalContext?: ErrorContext) => ValidationError;
  createNotFoundError: (resourceId: string | number, additionalContext?: ErrorContext) => NotFoundError;
  withErrorHandling: <T>(operation: () => Promise<T>, operationName: string, additionalContext?: ErrorContext) => Promise<T>;
  withAsyncResultErrorHandling: <T, E extends Error = Error>(operation: () => Promise<T>, operationName: string, additionalContext?: ErrorContext) => Promise<AsyncResult<T, E>>;
} {
  return {
    /**
     * Creates a contextual error with service defaults
     */
    createError(message: string, operation?: string, additionalContext: ErrorContext = {}): AppError {
      return createContextualError(message, {
        ...defaultContext,
        ...(operation ? { operation } : {}),
        ...additionalContext
      });
    },
    /**
     * Creates an API error with service defaults
     */
    createApiError(message: string, statusCode?: number, additionalContext: ErrorContext = {}): ApiError {
      return createApiError(message, statusCode, {
        ...defaultContext,
        ...additionalContext
      });
    },
    /**
     * Creates a validation error with service defaults
     */
    createValidationError(message: string, errors: Record<string, string[]> = {}, additionalContext: ErrorContext = {}): ValidationError {
      return createValidationError(message, errors, {
        ...defaultContext,
        ...additionalContext
      });
    },
    /**
     * Creates a not found error with service defaults
     */
    createNotFoundError(resourceId: string | number, additionalContext: ErrorContext = {}): NotFoundError {
      return createNotFoundError((defaultContext["resourceType"] as string | undefined) ?? 'Resource', resourceId, {
        ...defaultContext,
        ...additionalContext
      });
    },
    /**
     * Wraps an operation with error handling using service defaults
     */
    withErrorHandling<T>(operation: () => Promise<T>, operationName: string, additionalContext: ErrorContext = {}): Promise<T> {
      return withErrorHandling(operation, {
        operationName,
        serviceName: (defaultContext.service as string | undefined) ?? 'UnknownService',
        ...defaultContext,
        ...additionalContext
      });
    },
    /**
     * Wraps an operation with AsyncResult error handling using service defaults
     */
    withAsyncResultErrorHandling<T, E extends Error = Error>(operation: () => Promise<T>, operationName: string, additionalContext: ErrorContext = {}): Promise<AsyncResult<T, E>> {
      return withAsyncResultErrorHandling<T, E>(operation, {
        operationName,
        serviceName: (defaultContext.service as string | undefined) ?? 'UnknownService',
        ...defaultContext,
        ...additionalContext
      });
    }
  };
}