/**
 * WebSocket Error Types
 *
 * Structured error types for WebSocket operations with proper error codes
 * and metadata for logging and client communication.
 *
 * @module types/websocket-errors
 */

// ============================================================================
// Base WebSocket Error
// ============================================================================

export abstract class WebSocketError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly retryable: boolean;
  public readonly metadata?: Record<string, unknown>;

  constructor(
    message: string,
    code: string,
    statusCode: number,
    retryable: boolean = false,
    metadata?: Record<string, unknown>
  ) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.statusCode = statusCode;
    this.retryable = retryable;
    // Apply exactOptionalPropertyTypes pattern: only assign if metadata is defined
    if (metadata !== undefined) {
      this.metadata = metadata;
    }

    // Maintain proper stack trace
    Error.captureStackTrace(this, this.constructor);
  }

  /**
   * Convert to JSON for client transmission
   */
  public toJSON(): Record<string, unknown> {
    return {
      error: {
        type: this.name,
        code: this.code,
        message: this.message,
        retryable: this.retryable,
        ...(this.metadata && { metadata: this.metadata }),
      },
    };
  }

  /**
   * Convert to WebSocket close code and reason
   */
  public toCloseFrame(): { code: number; reason: string } {
    // WebSocket close codes: https://www.rfc-editor.org/rfc/rfc6455#section-7.4.1
    return {
      code: this.getWebSocketCloseCode(),
      reason: this.message.substring(0, 123), // Max 123 bytes for close reason
    };
  }

  /**
   * Get appropriate WebSocket close code
   */
  protected getWebSocketCloseCode(): number {
    // Map HTTP-like status codes to WebSocket close codes
    if (this.statusCode === 401 || this.statusCode === 403) {
      return 1008; // Policy Violation
    }
    if (this.statusCode === 429) {
      return 1013; // Try Again Later
    }
    if (this.statusCode >= 400 && this.statusCode < 500) {
      return 1002; // Protocol Error
    }
    if (this.statusCode >= 500) {
      return 1011; // Internal Error
    }
    return 1000; // Normal Closure
  }
}

// ============================================================================
// Authentication & Authorization Errors
// ============================================================================

export class WebSocketAuthError extends WebSocketError {
  constructor(message: string = 'Authentication failed', metadata?: Record<string, unknown>) {
    super(message, 'WS_AUTH_FAILED', 401, false, metadata);
  }
}

export class WebSocketInvalidApiKeyError extends WebSocketAuthError {
  constructor(metadata?: Record<string, unknown>) {
    super('Invalid or expired API key', { ...metadata, reason: 'invalid_api_key' });
  }
}

export class WebSocketMissingApiKeyError extends WebSocketAuthError {
  constructor(metadata?: Record<string, unknown>) {
    super('API key required in x-api-key header', { ...metadata, reason: 'missing_api_key' });
  }
}

export class WebSocketInvalidSessionError extends WebSocketAuthError {
  constructor(metadata?: Record<string, unknown>) {
    super('Invalid or expired session', { ...metadata, reason: 'invalid_session' });
  }
}

export class WebSocketUnauthorizedError extends WebSocketError {
  constructor(message: string = 'Unauthorized', metadata?: Record<string, unknown>) {
    super(message, 'WS_UNAUTHORIZED', 403, false, metadata);
  }
}

// ============================================================================
// Rate Limiting Errors
// ============================================================================

export class WebSocketRateLimitError extends WebSocketError {
  public readonly limit: number;
  public readonly remaining: number;
  public readonly resetAt: Date;

  constructor(
    limit: number,
    remaining: number,
    resetAt: Date,
    message?: string,
    metadata?: Record<string, unknown>
  ) {
    const defaultMessage = `Rate limit exceeded. Try again in ${Math.ceil((resetAt.getTime() - Date.now()) / 1000)}s`;
    super(message ?? defaultMessage, 'WS_RATE_LIMIT', 429, true, {
      ...metadata,
      limit,
      remaining,
      resetAt: resetAt.toISOString(),
      retryAfter: Math.ceil((resetAt.getTime() - Date.now()) / 1000),
    });

    this.limit = limit;
    this.remaining = remaining;
    this.resetAt = resetAt;
  }

  protected getWebSocketCloseCode(): number {
    return 1013; // Try Again Later
  }
}

// ============================================================================
// Channel Errors
// ============================================================================

export class WebSocketChannelError extends WebSocketError {
  constructor(
    message: string,
    code: string = 'WS_CHANNEL_ERROR',
    statusCode: number = 400,
    retryable: boolean = false,
    metadata?: Record<string, unknown>
  ) {
    super(message, code, statusCode, retryable, metadata);
  }
}

export class WebSocketInvalidChannelError extends WebSocketChannelError {
  constructor(channel: string, metadata?: Record<string, unknown>) {
    super(`Invalid channel: ${channel}`, 'WS_INVALID_CHANNEL', 400, false, {
      ...metadata,
      channel,
    });
  }
}

export class WebSocketChannelNotFoundError extends WebSocketChannelError {
  constructor(channel: string, metadata?: Record<string, unknown>) {
    super(`Channel not found: ${channel}`, 'WS_CHANNEL_NOT_FOUND', 404, false, {
      ...metadata,
      channel,
    });
  }
}

export class WebSocketChannelAccessDeniedError extends WebSocketChannelError {
  constructor(channel: string, metadata?: Record<string, unknown>) {
    super(`Access denied to channel: ${channel}`, 'WS_CHANNEL_ACCESS_DENIED', 403, false, {
      ...metadata,
      channel,
    });
  }
}

export class WebSocketAlreadySubscribedError extends WebSocketChannelError {
  constructor(channel: string, metadata?: Record<string, unknown>) {
    super(`Already subscribed to channel: ${channel}`, 'WS_ALREADY_SUBSCRIBED', 409, false, {
      ...metadata,
      channel,
    });
  }
}

export class WebSocketNotSubscribedError extends WebSocketChannelError {
  constructor(channel: string, metadata?: Record<string, unknown>) {
    super(`Not subscribed to channel: ${channel}`, 'WS_NOT_SUBSCRIBED', 400, false, {
      ...metadata,
      channel,
    });
  }
}

// ============================================================================
// Message Errors
// ============================================================================

export class WebSocketMessageError extends WebSocketError {
  constructor(
    message: string,
    code: string = 'WS_MESSAGE_ERROR',
    statusCode: number = 400,
    retryable: boolean = false,
    metadata?: Record<string, unknown>
  ) {
    super(message, code, statusCode, retryable, metadata);
  }
}

export class WebSocketInvalidMessageError extends WebSocketMessageError {
  constructor(reason: string, metadata?: Record<string, unknown>) {
    super(`Invalid message: ${reason}`, 'WS_INVALID_MESSAGE', 400, false, {
      ...metadata,
      reason,
    });
  }
}

export class WebSocketMessageTooLargeError extends WebSocketMessageError {
  constructor(size: number, maxSize: number, metadata?: Record<string, unknown>) {
    super(`Message too large: ${size} bytes (max: ${maxSize})`, 'WS_MESSAGE_TOO_LARGE', 413, false, {
      ...metadata,
      size,
      maxSize,
    });
  }
}

export class WebSocketInvalidPayloadError extends WebSocketMessageError {
  constructor(reason: string, metadata?: Record<string, unknown>) {
    super(`Invalid payload: ${reason}`, 'WS_INVALID_PAYLOAD', 400, false, {
      ...metadata,
      reason,
    });
  }
}

// ============================================================================
// Routing Errors
// ============================================================================

export class WebSocketRoutingError extends WebSocketError {
  constructor(
    message: string,
    code: string = 'WS_ROUTING_ERROR',
    metadata?: Record<string, unknown>
  ) {
    super(message, code, 500, true, metadata);
  }
}

export class WebSocketNoActiveServersError extends WebSocketRoutingError {
  constructor(metadata?: Record<string, unknown>) {
    super('No active servers available', 'WS_NO_ACTIVE_SERVERS', metadata);
  }
}

export class WebSocketMessageRoutingFailedError extends WebSocketRoutingError {
  constructor(channel: string, targetServer: string, metadata?: Record<string, unknown>) {
    super(`Failed to route message to server: ${targetServer}`, 'WS_ROUTING_FAILED', {
      ...metadata,
      channel,
      targetServer,
    });
  }
}

// ============================================================================
// Connection Errors
// ============================================================================

export class WebSocketConnectionError extends WebSocketError {
  constructor(
    message: string,
    code: string = 'WS_CONNECTION_ERROR',
    statusCode: number = 500,
    retryable: boolean = true,
    metadata?: Record<string, unknown>
  ) {
    super(message, code, statusCode, retryable, metadata);
  }
}

export class WebSocketConnectionLimitError extends WebSocketConnectionError {
  constructor(limit: number, metadata?: Record<string, unknown>) {
    super(`Connection limit reached: ${limit}`, 'WS_CONNECTION_LIMIT', 429, false, {
      ...metadata,
      limit,
    });
  }
}

export class WebSocketServerDrainingError extends WebSocketConnectionError {
  constructor(metadata?: Record<string, unknown>) {
    super('Server is draining, please reconnect', 'WS_SERVER_DRAINING', 503, true, metadata);
  }

  protected getWebSocketCloseCode(): number {
    return 1001; // Going Away
  }
}

export class WebSocketConnectionTimedOutError extends WebSocketConnectionError {
  constructor(timeout: number, metadata?: Record<string, unknown>) {
    super(`Connection timed out after ${timeout}ms`, 'WS_CONNECTION_TIMEOUT', 408, true, {
      ...metadata,
      timeout,
    });
  }
}

// ============================================================================
// Database Errors
// ============================================================================

export class WebSocketDatabaseError extends WebSocketError {
  constructor(
    message: string = 'Database operation failed',
    code: string = 'WS_DB_ERROR',
    metadata?: Record<string, unknown>
  ) {
    super(message, code, 500, true, metadata);
  }
}

export class WebSocketConnectionPersistenceError extends WebSocketDatabaseError {
  constructor(operation: string, metadata?: Record<string, unknown>) {
    super(`Failed to persist connection: ${operation}`, 'WS_PERSIST_FAILED', {
      ...metadata,
      operation,
    });
  }
}

export class WebSocketSubscriptionPersistenceError extends WebSocketDatabaseError {
  constructor(operation: string, metadata?: Record<string, unknown>) {
    super(`Failed to persist subscription: ${operation}`, 'WS_SUBSCRIPTION_PERSIST_FAILED', {
      ...metadata,
      operation,
    });
  }
}

// ============================================================================
// Validation Errors
// ============================================================================

export class WebSocketValidationError extends WebSocketError {
  constructor(
    message: string,
    field?: string,
    metadata?: Record<string, unknown>
  ) {
    super(message, 'WS_VALIDATION_ERROR', 400, false, {
      ...metadata,
      ...(field && { field }),
    });
  }
}

// ============================================================================
// Type Guards
// ============================================================================

export function isWebSocketError(error: unknown): error is WebSocketError {
  return error instanceof WebSocketError;
}

export function isRateLimitError(error: unknown): error is WebSocketRateLimitError {
  return error instanceof WebSocketRateLimitError;
}

export function isAuthError(error: unknown): error is WebSocketAuthError {
  return error instanceof WebSocketAuthError || error instanceof WebSocketUnauthorizedError;
}

export function isChannelError(error: unknown): error is WebSocketChannelError {
  return error instanceof WebSocketChannelError;
}

export function isRetryable(error: unknown): boolean {
  return isWebSocketError(error) && error.retryable;
}

// ============================================================================
// Error Factory
// ============================================================================

export class WebSocketErrorFactory {
  /**
   * Create error from unknown error type
   */
  static from(error: unknown, metadata?: Record<string, unknown>): WebSocketError {
    if (isWebSocketError(error)) {
      return error;
    }

    if (error instanceof Error) {
      return new WebSocketMessageError(error.message, 'WS_ERROR', 500, false, {
        ...metadata,
        originalError: error.name,
        stack: error.stack,
      });
    }

    return new WebSocketMessageError(
      String(error),
      'WS_UNKNOWN_ERROR',
      500,
      false,
      metadata
    );
  }

  /**
   * Create rate limit error from rate limit result
   */
  static rateLimitExceeded(
    limit: number,
    remaining: number,
    resetAt: Date,
    type?: string
  ): WebSocketRateLimitError {
    return new WebSocketRateLimitError(limit, remaining, resetAt, undefined, {
      type,
    });
  }
}
