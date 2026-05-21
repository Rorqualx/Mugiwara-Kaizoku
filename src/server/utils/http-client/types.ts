/**
 * HTTP Client Types Module
 *
 * Foundation types, interfaces, and error classes for the HTTP client system.
 * All other http-client modules import from this file.
 *
 * Extracted from: httpClient.ts
 */

import type { AsyncResult } from '@/utils/async-result';

import type { RateLimitConfig } from '../rateLimit';
import type { ResponseType } from 'axios';

// ============================================================================
// Error Classes
// ============================================================================

/**
 * Custom error class for API errors with retry support
 */
export class ApiError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public code?: string,
    public context?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'ApiError';
  }

  /**
   * Determines if the error is retryable based on status code
   */
  isRetryable(): boolean {
    // Network errors and certain status codes are retryable
    return (
      !this.statusCode ||
      this.statusCode >= 500 ||
      this.statusCode === 429 || // Too Many Requests
      this.statusCode === 408 // Request Timeout
    );
  }
}

// ============================================================================
// Type Aliases
// ============================================================================

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS';
export type ErrorContext = Record<string, unknown>;

// ============================================================================
// Auth Types
// ============================================================================

/**
 * Authentication configuration for HTTP clients
 */
export interface AuthConfig {
  type: 'basic' | 'bearer' | 'apiKey';
  credentials?: { username: string; password: string };
  token?: string;
  apiKey?: string;
  apiKeyHeader?: string;
}

/**
 * Authentication manager interface for handling auth headers and params
 */
export interface AuthManager {
  getAuthHeaders(): Record<string, string>;
  getAuthQueryParams(): Record<string, string>;
}

// ============================================================================
// Client Configuration
// ============================================================================

/**
 * HTTP client configuration options
 */
export interface HttpClientConfig {
  baseURL: string;
  headers?: Record<string, string>;
  timeout?: number;
  auth?: AuthConfig;
  rateLimit?: RateLimitConfig;
  retry?: {
    maxRetries: number;
    retryDelay: number;
    retryableStatusCodes: number[];
    retryableErrors?: string[];
  };
  validateStatus?: (status: number) => boolean;
  responseType?: ResponseType;
  paramsSerializer?: (params: Record<string, unknown>) => string;
  notifyOnError?: boolean;
}

// ============================================================================
// Request/Response Types
// ============================================================================

/**
 * HTTP request options
 */
export interface RequestOptions {
  method: HttpMethod;
  path: string;
  params?: Record<string, unknown>;
  data?: unknown;
  headers?: Record<string, string>;
  timeout?: number;
  signal?: AbortSignal;
  responseType?: ResponseType;
  validateStatus?: (status: number) => boolean;
  retries?: number; // Current retry count (for internal use)
  auth?: {
    username: string;
    password: string;
  };
}

/**
 * HTTP client response
 *
 * Represents the response from an HTTP request with standard fields
 * and additional fields needed by specific API clients.
 */
export interface HttpClientResponse<T = unknown> {
  data: T;
  status: number;
  statusText: string;
  headers: Record<string, string>;
  config: RequestOptions;
  // Auth token for OAuth responses
  access_token?: string;
  // Client-specific data (for backward compatibility)
  clientSpecific?: Record<string, unknown>;
}

// ============================================================================
// HttpClient Interface
// ============================================================================

/**
 * HTTP client interface
 */
export interface HttpClient {
  /**
   * Makes a request with the specified options
   */
  request<T = unknown>(options: RequestOptions): Promise<HttpClientResponse<T>>;

  /**
   * Makes a request with the specified options, returning an AsyncResult
   */
  requestAsync<T = unknown>(
    options: RequestOptions
  ): Promise<AsyncResult<HttpClientResponse<T>, Error>>;

  /**
   * Makes a GET request
   */
  get<T = unknown>(
    path: string,
    options?: Omit<RequestOptions, 'method' | 'path'>
  ): Promise<HttpClientResponse<T>>;

  /**
   * Makes a GET request, returning an AsyncResult
   */
  getAsync<T = unknown>(
    path: string,
    options?: Omit<RequestOptions, 'method' | 'path'>
  ): Promise<AsyncResult<HttpClientResponse<T>, Error>>;

  /**
   * Makes a POST request
   */
  post<T = unknown>(
    path: string,
    data?: unknown,
    options?: Omit<RequestOptions, 'method' | 'path' | 'data'>
  ): Promise<HttpClientResponse<T>>;

  /**
   * Makes a POST request, returning an AsyncResult
   */
  postAsync<T = unknown>(
    path: string,
    data?: unknown,
    options?: Omit<RequestOptions, 'method' | 'path' | 'data'>
  ): Promise<AsyncResult<HttpClientResponse<T>, Error>>;

  /**
   * Makes a PUT request
   */
  put<T = unknown>(
    path: string,
    data?: unknown,
    options?: Omit<RequestOptions, 'method' | 'path' | 'data'>
  ): Promise<HttpClientResponse<T>>;

  /**
   * Makes a PUT request, returning an AsyncResult
   */
  putAsync<T = unknown>(
    path: string,
    data?: unknown,
    options?: Omit<RequestOptions, 'method' | 'path' | 'data'>
  ): Promise<AsyncResult<HttpClientResponse<T>, Error>>;

  /**
   * Makes a DELETE request
   */
  delete<T = unknown>(
    path: string,
    options?: Omit<RequestOptions, 'method' | 'path'>
  ): Promise<HttpClientResponse<T>>;

  /**
   * Makes a DELETE request, returning an AsyncResult
   */
  deleteAsync<T = unknown>(
    path: string,
    options?: Omit<RequestOptions, 'method' | 'path'>
  ): Promise<AsyncResult<HttpClientResponse<T>, Error>>;

  /**
   * Makes a PATCH request
   */
  patch<T = unknown>(
    path: string,
    data?: unknown,
    options?: Omit<RequestOptions, 'method' | 'path' | 'data'>
  ): Promise<HttpClientResponse<T>>;

  /**
   * Makes a PATCH request, returning an AsyncResult
   */
  patchAsync<T = unknown>(
    path: string,
    data?: unknown,
    options?: Omit<RequestOptions, 'method' | 'path' | 'data'>
  ): Promise<AsyncResult<HttpClientResponse<T>, Error>>;

  /**
   * Sets a header for future requests
   */
  setHeader(name: string, value: string): void;

  /**
   * Sets the base URL for future requests
   */
  setBaseURL(baseURL: string): void;

  /**
   * Gets the full URL for a request with the specified options
   */
  getUri(options?: Omit<RequestOptions, 'method'>): string;

  /**
   * Updates multiple headers at once
   */
  updateHeaders?(headers: Record<string, string>): void;

  /**
   * Removes a header
   */
  removeHeader?(name: string): void;

  /**
   * Default values used by the client
   */
  defaults?: {
    headers: Record<string, string>;
    baseURL?: string;
  };

  /**
   * Disposes of the client and frees resources
   */
  dispose(): AsyncResult<void, Error>;

  /**
   * Checks if the client has been disposed
   */
  isDisposed(): boolean;
}
