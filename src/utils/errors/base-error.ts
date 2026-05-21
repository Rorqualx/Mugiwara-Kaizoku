/**
 * Base Error System
 * 
 * Provides a standardized error hierarchy with context, tracking, and proper stack traces.
 * All application errors should extend from BaseError to ensure consistent error handling.
 */

export interface ErrorContext {
  userId?: string;
  requestId?: string;
  operation?: string;
  component?: string;
  metadata?: Record<string, unknown>;
  [key: string]: unknown; // Allow additional properties
}

/**
 * Base error class for all application errors
 * Provides consistent error structure with context and tracking
 */
export abstract class BaseError extends Error {
  public readonly timestamp: Date;
  public readonly id: string;
  
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 500,
    public readonly context?: ErrorContext,
    public readonly cause?: Error
  ) {
    super(message);
    this["name"] = this.constructor["name"];
    this.timestamp = new Date();
    this["id"] = this.generateErrorId();
    
    // Maintain proper stack trace
    Error.captureStackTrace(this, this.constructor);
    
    // If there's a cause, append its stack to ours
    if (cause?.stack) {
      this.stack = `${this.stack}\nCaused by: ${cause.stack}`;
    }
  }
  
  private generateErrorId(): string {
    return `${this["name"]}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
  
  /**
   * Check if error is of a specific type
   */
  is<T extends BaseError>(ErrorClass: new (...args: unknown[]) => T): this is T {
    return this instanceof ErrorClass;
  }
  
  /**
   * Convert error to JSON for logging/serialization
   */
  toJSON(): {
    id: string;
    name: string;
    message: string;
    code: string;
    statusCode: number;
    timestamp: Date;
    context: ErrorContext | undefined;
    stack: string | undefined;
    cause: { name: string; message: string; stack: string | undefined } | undefined;
  } {
    return {
      id: this["id"],
      name: this["name"],
      message: this.message,
      code: this.code,
      statusCode: this.statusCode,
      timestamp: this.timestamp,
      context: this.context,
      stack: this.stack,
      cause: this.cause ? {
        name: this.cause["name"],
        message: this.cause.message,
        stack: this.cause.stack
      } : undefined
    };
  }
  
  /**
   * Get a user-friendly error message (hides internal details in production)
   */
  getUserMessage(): string {
    if (process.env.NODE_ENV === 'production') {
      // In production, return a generic message for internal errors
      if (this.statusCode >= 500) {
        return 'An internal error occurred. Please try again later.';
      }
    }
    return this.message;
  }
}

/**
 * Type guard to check if an error is a BaseError
 */
export function isBaseError(error: unknown): error is BaseError {
  return error instanceof BaseError;
}

/**
 * Type guard to check if a value is an Error
 */
export function isError(error: unknown): error is Error {
  return error instanceof Error;
}

/**
 * Safely extract error message from unknown error type
 */
export function getErrorMessage(error: unknown): string {
  if (isBaseError(error)) {
    return error.getUserMessage();
  }
  if (isError(error)) {
    return (error instanceof Error ? error.message : String(error));
  }
  if (typeof error === 'string') {
    return error;
  }
  return 'An unknown error occurred';
}

/**
 * Safely extract error stack from unknown error type
 */
export function getErrorStack(error: unknown): string | undefined {
  if (isError(error)) {
    return (error instanceof Error ? error.stack : String(error));
  }
  return undefined;
}