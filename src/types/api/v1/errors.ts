// Re-export API error types from utils
export { ApiError as BaseApiError } from '@/utils/error-handling';

export interface ApiError {
  code: string;
  message: string;
  details?: unknown;
}

export class ValidationError extends Error {
  constructor(message: string, public details?: unknown) {
    super(message);
    this["name"] = 'ValidationError';
  }
}

export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this["name"] = 'NotFoundError';
  }
}

export class UnauthorizedError extends Error {
  constructor(message: string) {
    super(message);
    this["name"] = 'UnauthorizedError';
  }
}

export class ApiPermissionError extends Error {
  constructor(message: string) {
    super(message);
    this["name"] = 'ApiPermissionError';
  }
}

export class ApiNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this["name"] = 'ApiNotFoundError';
  }
}
