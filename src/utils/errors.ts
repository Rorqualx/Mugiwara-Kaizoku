/**
 * Re-export error classes and utilities from error-handling module
 *
 * This file serves as a convenience re-export to maintain backward compatibility
 * with existing imports that expect errors to be at this location.
 */

export {
  // Error classes
  ValidationError,
  AppError,
  ApiError,
  NotFoundError,
  AuthenticationError,

  // Error utilities
  getErrorMessage,
  withErrorHandling,
  withAsyncResultErrorHandling,
  createContextualError,
  createApiError,
  createValidationError,
  createNotFoundError,
  createAuthenticationError,

  // Type guards
  isAppError,
  isApiError,
  isValidationError,
  isNotFoundError,
  isAuthenticationError,

  // Response validation utilities
  isValidResponse,
  validateArrayItems,
  createResponseValidator,
  createContextualErrorCreator,

  // Types
  type ErrorContext,
  type OperationContext,
} from './error-handling';