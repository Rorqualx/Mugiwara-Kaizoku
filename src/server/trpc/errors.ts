/**
 * tRPC Error Handling Utilities
 * 
 * Centralized error handling with TRPCError.
 * Provides consistent error codes and messages across all procedures.
 * 
 * @module server/trpc/errors
 */

import { TRPCError } from '@trpc/server';

import { logger } from '@/utils/logger';

import type { TRPC_ERROR_CODE_KEY } from '@trpc/server/rpc';

/**
 * Custom error codes for application-specific errors
 */
export const CUSTOM_ERROR_CODES = {
  // Resource errors
  RESOURCE_EXISTS: 'RESOURCE_EXISTS',
  RESOURCE_LOCKED: 'RESOURCE_LOCKED',
  RESOURCE_EXPIRED: 'RESOURCE_EXPIRED',

  // Validation errors
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  INVALID_INPUT: 'INVALID_INPUT',
  MISSING_REQUIRED: 'MISSING_REQUIRED',

  // Auth errors
  SESSION_EXPIRED: 'SESSION_EXPIRED',
  INSUFFICIENT_PERMISSIONS: 'INSUFFICIENT_PERMISSIONS',
  ACCOUNT_DISABLED: 'ACCOUNT_DISABLED',

  // Rate limiting
  RATE_LIMITED: 'RATE_LIMITED',
  QUOTA_EXCEEDED: 'QUOTA_EXCEEDED',

  // External service errors
  EXTERNAL_SERVICE_ERROR: 'EXTERNAL_SERVICE_ERROR',
  UPSTREAM_ERROR: 'UPSTREAM_ERROR',

  // Database errors
  DATABASE_ERROR: 'DATABASE_ERROR',
  TRANSACTION_FAILED: 'TRANSACTION_FAILED',
} as const;

export type CustomErrorCode = typeof CUSTOM_ERROR_CODES[keyof typeof CUSTOM_ERROR_CODES];

/**
 * Error factory functions for common scenarios
 */
export const TRPCErrors = {
  /**
   * Resource not found
   */
  notFound: (resource: string, id?: string | number): TRPCError => {
    const message = id
      ? `${resource} with ID ${id} not found`
      : `${resource} not found`;

    return new TRPCError({
      code: 'NOT_FOUND',
      message,
    });
  },

  /**
   * Bad request with validation details
   */
  badRequest: (message: string, details?: unknown): TRPCError => {
    return new TRPCError({
      code: 'BAD_REQUEST',
      message,
      cause: details,
    });
  },

  /**
   * Unauthorized access
   */
  unauthorized: (message = 'You must be logged in to access this resource'): TRPCError => {
    return new TRPCError({
      code: 'UNAUTHORIZED',
      message,
    });
  },

  /**
   * Forbidden - authenticated but not authorized
   */
  forbidden: (message = 'You do not have permission to perform this action'): TRPCError => {
    return new TRPCError({
      code: 'FORBIDDEN',
      message,
    });
  },

  /**
   * Conflict - resource already exists
   */
  conflict: (resource: string, field?: string, value?: unknown): TRPCError => {
    const message = field && value
      ? `${resource} with ${field} '${value}' already exists`
      : `${resource} already exists`;

    return new TRPCError({
      code: 'CONFLICT',
      message,
    });
  },

  /**
   * Precondition failed
   */
  preconditionFailed: (message: string): TRPCError => {
    return new TRPCError({
      code: 'PRECONDITION_FAILED',
      message,
    });
  },

  /**
   * Too many requests
   */
  tooManyRequests: (limit?: number, window?: string): TRPCError => {
    const message = limit && window
      ? `Rate limit exceeded. Maximum ${limit} requests per ${window}`
      : 'Rate limit exceeded';

    return new TRPCError({
      code: 'TOO_MANY_REQUESTS',
      message,
    });
  },

  /**
   * Internal server error with logging
   */
  internal: (message: string, error?: unknown): TRPCError => {
    // Log the actual error for debugging
    if (error) {
      logger.error('Internal server error:', error);
    }

    // Return generic message to client
    return new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: process.env.NODE_ENV === 'development'
        ? message
        : 'An internal error occurred',
      cause: process.env.NODE_ENV === 'development' ? error : undefined,
    });
  },

  /**
   * Service unavailable
   */
  unavailable: (service?: string): TRPCError => {
    const message = service
      ? `${service} is currently unavailable`
      : 'Service temporarily unavailable';

    return new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message,
    });
  },

  /**
   * Timeout error
   */
  timeout: (operation?: string): TRPCError => {
    const message = operation
      ? `${operation} timed out`
      : 'Request timed out';

    return new TRPCError({
      code: 'TIMEOUT',
      message,
    });
  },

  /**
   * Parse error
   */
  parseError: (field?: string): TRPCError => {
    const message = field
      ? `Failed to parse ${field}`
      : 'Failed to parse request';

    return new TRPCError({
      code: 'PARSE_ERROR',
      message,
    });
  },

  /**
   * Method not supported
   */
  methodNotSupported: (method: string): TRPCError => {
    return new TRPCError({
      code: 'METHOD_NOT_SUPPORTED',
      message: `Method ${method} is not supported`,
    });
  },
};

/**
 * Convert any error to TRPCError
 * 
 * @param error - Any error object
 * @param fallbackCode - Fallback error code if not determinable
 * @returns TRPCError instance
 */
export function toTRPCError(
  error: unknown,
  fallbackCode: TRPC_ERROR_CODE_KEY = 'INTERNAL_SERVER_ERROR'
): TRPCError {
  // Already a TRPCError
  if (error instanceof TRPCError) {
    return error;
  }

  // Standard Error with message
  if (error instanceof Error) {
    // Check for specific error types
    if (error["name"] === 'ValidationError') {
      return TRPCErrors.badRequest(error.message, error);
    }
    
    if (error["name"] === 'NotFoundError') {
      return TRPCErrors.notFound(error.message);
    }
    
    if (error["name"] === 'UnauthorizedError') {
      return TRPCErrors.unauthorized(error.message);
    }
    
    if (error["name"] === 'ForbiddenError') {
      return TRPCErrors.forbidden(error.message);
    }
    
    if (error["name"] === 'ConflictError') {
      return TRPCErrors.conflict(error.message);
    }
    
    // Default to internal error
    return TRPCErrors.internal(error.message, error);
  }

  // String error
  if (typeof error === 'string') {
    return new TRPCError({
      code: fallbackCode,
      message: error,
    });
  }

  // Unknown error type
  return TRPCErrors.internal('An unexpected error occurred', error);
}

/**
 * Error handler wrapper for procedures
 * 
 * Wraps async functions to catch and convert errors to TRPCError
 * 
 * @example
 * ```ts
 * const myProcedure = publicProcedure
 *   .mutation(handleErrors(async ({ input }) => {
 *     // Your logic here
 *     throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Something went wrong'
    }); // Will be converted to TRPCError
 *   }));
 * ```
 */
export function handleErrors<T extends (...args: unknown[]) => Promise<unknown>>(
  fn: T
): T {
  return (async (...args: Parameters<T>) => {
    try {
      return await fn(...args);
    } catch (error: unknown) {
      throw toTRPCError(error);
    }
  }) as T;
}

/**
 * Validate and throw if condition is false
 * 
 * @param condition - Condition to check
 * @param errorOrMessage - TRPCError or error message
 */
export function assertCondition(
  condition: unknown,
  errorOrMessage: TRPCError | string
): asserts condition {
  if (!condition) {
    if (typeof errorOrMessage === 'string') {
      throw TRPCErrors.badRequest(errorOrMessage);
    }
    throw errorOrMessage;
  }
}

/**
 * Assert that a value exists (not null or undefined)
 * 
 * @param value - Value to check
 * @param resource - Resource name for error message
 */
export function assertExists<T>(
  value: T | null | undefined,
  resource: string
): asserts value is T {
  if (value === null) {
    throw TRPCErrors.notFound(resource);
  }
}

/**
 * Assert user is authenticated
 *
 * @param user - User object from context
 */
export function assertAuthenticated(
  user: unknown
): asserts user {
  if (!user) {
    throw TRPCErrors.unauthorized();
  }
}

/**
 * Assert user has required role
 * 
 * @param user - User object from context
 * @param role - Required role
 */
export function assertRole(
  user: unknown,
  role: string
): void {
  assertAuthenticated(user);

  if (typeof user === 'object' && 'role' in user) {
    const userWithRole = user as { role: string };
    if (userWithRole.role !== role) {
      throw TRPCErrors.forbidden(`This action requires ${role} role`);
    }
  } else {
    throw TRPCErrors.forbidden(`This action requires ${role} role`);
  }
}

/**
 * Export all utilities
 */
export default {
  ...TRPCErrors,
  toTRPCError,
  handleErrors,
  assertCondition,
  assertExists,
  assertAuthenticated,
  assertRole,
  CUSTOM_ERROR_CODES,
};