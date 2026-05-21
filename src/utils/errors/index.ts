/**
 * Error System Exports
 * 
 * Central export point for all error-related utilities and classes.
 */

// Base error system
export {
  BaseError,
  isBaseError,
  isError,
  getErrorMessage,
  getErrorStack
} from './base-error';
export type { ErrorContext } from './base-error';

// Domain-specific errors
export {
  ValidationError,
  NotFoundError,
  AuthenticationError,
  AuthorizationError,
  DatabaseError,
  ExternalApiError,
  QueueError,
  FileSystemError,
  NetworkError,
  ConfigurationError,
  BusinessLogicError,
  RateLimitError,
  ConflictError,
  TimeoutError,
  IntegrationError
} from './domain-errors';