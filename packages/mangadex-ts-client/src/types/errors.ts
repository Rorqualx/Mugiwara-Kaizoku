/**
 * Error types for the metadata system
 */

import { DataSource } from './common';

/** Base metadata error */
export class MetadataError extends Error {
  constructor(
    message: string,
    public readonly source?: DataSource,
    public override readonly cause?: unknown
  ) {
    super(message);
    this.name = 'MetadataError';
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, MetadataError);
    }
  }
}

/** API request error */
export class ApiError extends MetadataError {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly errors?: unknown[],
    public readonly requestId?: string,
    source?: DataSource
  ) {
    super(message, source);
    this.name = 'ApiError';
  }
}

/** Data validation error */
export class ValidationError extends MetadataError {
  constructor(
    message: string,
    public readonly field?: string,
    source?: DataSource
  ) {
    super(message, source);
    this.name = 'ValidationError';
  }
}

/** HTML scraping error */
export class ScrapingError extends MetadataError {
  constructor(
    message: string,
    public readonly url?: string,
    source?: DataSource
  ) {
    super(message, source);
    this.name = 'ScrapingError';
  }
}

/** Rate limit exceeded error */
export class RateLimitError extends MetadataError {
  constructor(
    message: string,
    public readonly retryAfterMs?: number,
    source?: DataSource
  ) {
    super(message, source);
    this.name = 'RateLimitError';
  }
}
