/**
 * BaseHttpClient - Consolidated base class for all HTTP clients
 * 
 * This abstract class provides the foundation for all API clients in the application,
 * consolidating common functionality that was previously duplicated across multiple base classes.
 * 
 * Features:
 * - Unified HTTP request handling
 * - Consistent AsyncResult pattern implementation  
 * - Centralized error transformation
 * - Common connection management
 * - Shared rate limiting and caching
 * - Standard resource disposal
 * 
 * This consolidation eliminates ~435 lines of duplicate code.
 */
import type {
  AsyncResult} from '@/utils/async-result';
import {
  createSuccessResult,
  createErrorResult,
  isSuccess,
  isError
} from '@/utils/async-result';
import { ApiError } from '@/utils/error-handling';
import { getErrorMessage } from '@/utils/errors';

// Re-export types from httpClient for convenience
import { createCache } from '../utils/caching';
import {
  createHttpClient,
  createAuthManager,
  createRateLimiter
} from '../utils/httpClient';
import { logger } from "../utils/logger";

// Import Cache types from caching module
import type { Cache, CacheConfig } from '../utils/caching';
import type {
  HttpClient,
  HttpClientConfig,
  RequestOptions,
  AuthConfig,
  AuthManager,
  RateLimitConfig,
  RateLimiter} from '../utils/httpClient';
/**
 * HTTP method types
 */
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS';
/**
 * Error context for detailed error reporting
 */
export interface ErrorContext {
  serviceName: string;
  operation: string;
  url?: string;
  method?: HttpMethod;
  requestData?: unknown;
  metadata?: Record<string, unknown>;
}
/**
 * Connection status interface
 */
export interface ConnectionStatus {
  connected: boolean;
  lastChecked?: Date;
  error?: string;
  version?: string;
  clientSpecific?: Record<string, unknown>;
}
/**
 * Base configuration for HTTP clients
 */
export interface BaseHttpClientConfig {
  baseURL: string;
  headers?: Record<string, string>;
  timeout?: number;
  auth?: AuthConfig;
  rateLimit?: RateLimitConfig;
  cache?: CacheConfig;
  retry?: {
    maxRetries: number;
    retryDelay: number;
    retryableStatusCodes: number[];
    retryableErrors?: string[];
  };
  validateStatus?: (status: number) => boolean;
  notifyOnError?: boolean;
}
/**
 * Abstract base class for all HTTP clients
 * @template TResource - The primary resource type that this client manages
 * @template TError - The specific error type for this client (defaults to Error)
 */
// eslint-disable-next-line @typescript-eslint/naming-convention
export abstract class BaseHttpClient<_TResource = unknown, TError extends Error = Error> {
  protected http: HttpClient;
  protected config: BaseHttpClientConfig;
  protected authManager: AuthManager | null = null;
  protected rateLimiter: RateLimiter | null = null;
  protected cache: Cache | null = null;
  protected _connectionStatus: ConnectionStatus = { connected: false };
  protected disposed: boolean = false;
  /**
   * Creates a new HTTP client
   * @param config - Client configuration
   */
  constructor(config: BaseHttpClientConfig) {
    this.config = config;
    // Create HTTP client with configuration
    // Use exactOptionalPropertyTypes pattern: only spread if value !== undefined
    const httpConfig: HttpClientConfig = {
      baseURL: config.baseURL,
      ...(config.headers !== undefined ? { headers: config.headers } : {}),
      ...(config.timeout !== undefined ? { timeout: config.timeout } : {}),
      ...(config.retry !== undefined ? { retry: config.retry } : {}),
      ...(config.validateStatus !== undefined ? { validateStatus: config.validateStatus } : {}),
      ...(config.notifyOnError !== undefined ? { notifyOnError: config.notifyOnError } : {})
    };
    this.http = createHttpClient(httpConfig);
    // Initialize optional features
    if (config.auth !== undefined) {
      this.authManager = createAuthManager(config.auth);
    }
    if (config.rateLimit !== undefined) {
      this.rateLimiter = createRateLimiter(config.rateLimit);
    }
    if (config.cache !== undefined) {
      this.cache = createCache(config.cache);
    }
  }
  /**
   * Gets the service name for error reporting and logging
   * Must be implemented by derived classes
   */
  protected abstract getServiceName(): string;
  /**
   * Pings the API to check if it's available
   * Must be implemented by derived classes
   */
  protected abstract ping(): Promise<void>;
  /**
   * CONSOLIDATED: Universal AsyncResult unwrapping method
   * Replaces duplicate patterns across all clients
   * 
   * @template T - The result type
   * @param asyncFn - Function that returns AsyncResult
   * @param methodName - Name of the method for error context
   * @returns Promise that resolves to the unwrapped result
   * @throws TError if the operation fails
   */
  protected async unwrapAsyncResult<T>(
    asyncFn: () => Promise<AsyncResult<T, TError>>,
    methodName: string
  ): Promise<T> {
    const result = await asyncFn();
    if (isSuccess(result)) {
      return result.data;
    }
    if (isError(result)) {
      throw result.error as Error;
    }
    // This should never happen with proper AsyncResult usage
    // Safe to access status since we've exhausted all valid AsyncResult states
    const resultWithStatus = result as { status: string };
    throw new Error(`Unknown AsyncResult state in ${methodName}: ${resultWithStatus.status}`);
  }
  /**
   * CONSOLIDATED: Execute async operation with consistent error handling
   * Template method for operations that need AsyncResult unwrapping
   * 
   * @template T - The result type
   * @param operation - Async operation to execute
   * @param operationName - Name for logging and error context
   * @returns Promise that resolves to the result
   */
  protected async executeAsyncOperation<T>(
    operation: () => Promise<AsyncResult<T, TError>>,
    operationName: string
  ): Promise<T> {
    try {
      return await this.unwrapAsyncResult(operation, operationName);
    } catch (error: unknown) {
  logger.error(`${this.getServiceName()}.${operationName} failed: ${getErrorMessage(error)}`);
      throw error;
    }
  }
  /**
   * CONSOLIDATED: Wrap async operation with AsyncResult
   * Template method for operations that need consistent AsyncResult wrapping
   * 
   * @template T - The result type
   * @param operation - Async operation to wrap
   * @param operationName - Name for logging and error context
   * @returns Promise that resolves to AsyncResult
   */
  protected async wrapAsyncOperation<T>(
    operation: () => Promise<T>,
    operationName: string
  ): Promise<AsyncResult<T, TError>> {
    try {
      const result = await operation();
      return createSuccessResult<T, TError>(result);
    } catch (error: unknown) {
      const transformedError = this.transformError(error, {
        serviceName: this.getServiceName(),
        operation: operationName
      });
      return createErrorResult<T, TError>(transformedError);
    }
  }
  /**
   * CONSOLIDATED: Transform errors with consistent context
   * Single implementation for all error transformation needs
   * 
   * @param error - The error to transform
   * @param context - Error context for detailed reporting
   * @returns Transformed error of type TError
   */
  protected transformError(error: unknown, context: ErrorContext): TError {
    // If it's already the correct error type, add context and return
    if (error instanceof Error && this.isErrorType(error)) {
      Object.assign(error, { context });
      return error;
    }
    // Create new ApiError with context
    const message = getErrorMessage(error) || "Unknown error";
    const apiError = new ApiError(
      `[${context.serviceName}] ${context.operation}: ${message}`
    );
    // Add all context information
    Object.assign(apiError, { context });
    // ApiError extends Error, so this is a safe cast when TError extends Error
    // Use double assertion pattern for strict type safety
    return apiError as unknown as TError;
  }
  /**
   * Type guard to check if an error is of type TError
   * Can be overridden by derived classes for specific error types
   */
  protected isErrorType(error: unknown): error is TError {
    return error instanceof Error;
  }
  /**
   * Makes an HTTP request with caching, rate limiting, and error handling
   * Core method that all HTTP operations go through
   * 
   * @template T - The response data type
   * @param options - Request options
   * @returns Promise that resolves to AsyncResult
   */
  protected async requestAsync<T = unknown>(
    options: RequestOptions
  ): Promise<AsyncResult<T, TError>> {
    if (this.disposed) {
      const disposedError = new Error(`${this.getServiceName()} client has been disposed`);
      return createErrorResult<T, TError>(disposedError as TError);
    }
    // Check cache for GET requests
    if (options.method === 'GET' && this.cache) {
      const cacheKey = this.getCacheKey(options);
      const cachedResponse = this.cache.get(cacheKey) as T;
      if (cachedResponse !== undefined) {
        return createSuccessResult<T, TError>(cachedResponse);
      }
    }
    try {
      // Apply rate limiting if configured
      if (this.rateLimiter) {
        await this.rateLimiter.acquire();
      }
      // Make the HTTP request
      const response = await this.http.requestAsync<T>(options);
      if (!isSuccess(response)) {
        if (isError(response)) {
          // Transform the error to TError type
          const transformedError = this.transformError(response.error, {
            serviceName: this.getServiceName(),
            operation: 'requestAsync',
            url: options.path,
            method: options.method as HttpMethod
          });
          return createErrorResult<T, TError>(transformedError);
        }
        const failedError = new Error(`Request failed with state: ${response["status"]}`);
        return createErrorResult<T, TError>(failedError as TError);
      }
      // Update rate limiter from response headers
      if (this.rateLimiter) {
        this.rateLimiter.updateFromResponse(response.data);
      }
      // Cache successful GET requests
      if (options.method === 'GET' && this.cache && response.data.data) {
        const cacheKey = this.getCacheKey(options);
        this.cache.set(cacheKey, response.data.data);
      }
      // Return the successful result
      const responseData = response.data.data || response.data;
      return createSuccessResult<T, TError>(responseData as T);
    } catch (error: unknown) {
      // Transform and return the error
      const transformedError = this.transformError(error, {
        serviceName: this.getServiceName(),
        operation: 'request',
        url: options.path,
        method: options.method as HttpMethod,
        requestData: options.data
      });
      return createErrorResult<T, TError>(transformedError);
    }
  }
  /**
   * Makes an HTTP request (backward compatibility)
   * @deprecated Use requestAsync for new code
   */
  protected async request<T = unknown>(options: RequestOptions): Promise<T> {
    return this.executeAsyncOperation(
      () => this.requestAsync<T>(options),
      'request'
    );
  }
  // HTTP method shortcuts with AsyncResult pattern
  protected async getAsync<T = unknown>(
    path: string,
    params?: Record<string, unknown>,
    options?: Omit<RequestOptions, 'method' | 'path' | 'params'>
  ): Promise<AsyncResult<T, TError>> {
    return this.requestAsync<T>({
      method: 'GET',
      path,
      ...(params !== undefined ? { params } : {}),
      ...options
    });
  }
  protected async postAsync<T = unknown>(
    path: string,
    data?: unknown,
    options?: Omit<RequestOptions, 'method' | 'path' | 'data'>
  ): Promise<AsyncResult<T, TError>> {
    // Invalidate cache for mutating operations
    if (this.cache) {
      this.cache.invalidateRelated('create');
    }
    return this.requestAsync<T>({
      method: 'POST',
      path,
      data,
      ...options
    });
  }
  protected async putAsync<T = unknown>(
    path: string,
    data?: unknown,
    options?: Omit<RequestOptions, 'method' | 'path' | 'data'>
  ): Promise<AsyncResult<T, TError>> {
    if (this.cache) {
      this.cache.invalidateRelated('update');
    }
    return this.requestAsync<T>({
      method: 'PUT',
      path,
      data,
      ...options
    });
  }
  protected async deleteAsync<T = unknown>(
    path: string,
    options?: Omit<RequestOptions, 'method' | 'path'>
  ): Promise<AsyncResult<T, TError>> {
    if (this.cache) {
      this.cache.invalidateRelated('delete');
    }
    return this.requestAsync<T>({
      method: 'DELETE',
      path,
      ...options
    });
  }
  protected async patchAsync<T = unknown>(
    path: string,
    data?: unknown,
    options?: Omit<RequestOptions, 'method' | 'path' | 'data'>
  ): Promise<AsyncResult<T, TError>> {
    if (this.cache) {
      this.cache.invalidateRelated('update');
    }
    return this.requestAsync<T>({
      method: 'PATCH',
      path,
      data,
      ...options
    });
  }
  // Backward compatibility methods (use executeAsyncOperation internally)
  protected async get<T = unknown>(
    path: string,
    params?: Record<string, unknown>,
    options?: Omit<RequestOptions, 'method' | 'path' | 'params'>
  ): Promise<T> {
    return this.executeAsyncOperation(
      () => this.getAsync<T>(path, params, options),
      'get'
    );
  }
  protected async post<T = unknown>(
    path: string,
    data?: unknown,
    options?: Omit<RequestOptions, 'method' | 'path' | 'data'>
  ): Promise<T> {
    return this.executeAsyncOperation(
      () => this.postAsync<T>(path, data, options),
      'post'
    );
  }
  protected async put<T = unknown>(
    path: string,
    data?: unknown,
    options?: Omit<RequestOptions, 'method' | 'path' | 'data'>
  ): Promise<T> {
    return this.executeAsyncOperation(
      () => this.putAsync<T>(path, data, options),
      'put'
    );
  }
  protected async delete<T = unknown>(
    path: string,
    options?: Omit<RequestOptions, 'method' | 'path'>
  ): Promise<T> {
    return this.executeAsyncOperation(
      () => this.deleteAsync<T>(path, options),
      'delete'
    );
  }
  protected async patch<T = unknown>(
    path: string,
    data?: unknown,
    options?: Omit<RequestOptions, 'method' | 'path' | 'data'>
  ): Promise<T> {
    return this.executeAsyncOperation(
      () => this.patchAsync<T>(path, data, options),
      'patch'
    );
  }
  /**
   * Gets a cache key for a request
   */
  protected getCacheKey(options: RequestOptions): string {
    const { path, params } = options;
    if (!params) return path;
    const sortedParams = Object.keys(params)
      .sort()
      .map(key => `${key}=${JSON.stringify(params[key])}`)
      .join('&');
    return `${path}?${sortedParams}`;
  }
  /**
   * Tests the connection to the API
   */
  public async testConnectionAsync(): Promise<AsyncResult<boolean, TError>> {
    try {
      await this.ping();
      this.updateConnectionStatus(true);
      return createSuccessResult<boolean, TError>(true);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.updateConnectionStatus(false, { error: errorMessage });
      const transformedError = this.transformError(error, {
        serviceName: this.getServiceName(),
        operation: 'testConnection'
      });
      return createErrorResult<boolean, TError>(transformedError);
    }
  }
  /**
   * Tests the connection (backward compatibility)
   */
  public async testConnection(): Promise<boolean> {
    try {
      await this.ping();
      this.updateConnectionStatus(true);
      return true;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.updateConnectionStatus(false, { error: errorMessage });
      return false;
    }
  }
  /**
   * Gets the current connection status
   */
  public get connectionStatus(): ConnectionStatus {
    return { ...this._connectionStatus };
  }
  /**
   * Updates the connection status
   */
  protected updateConnectionStatus(
    connected: boolean,
    options?: {
      version?: string;
      error?: string;
    }
  ): void {
    this._connectionStatus = {
      connected,
      lastChecked: new Date(),
      ...options
    };
  }
  /**
   * Disposes of the client and frees resources
   */
  public disposeAsync(): AsyncResult<void, TError> {
    if (this.disposed) {
      return createSuccessResult<void, TError>(undefined);
    }
    try {
      // Dispose HTTP client
      const result = this.http.dispose();
      if (isError(result)) {
        // Transform the error to TError type
        const transformedError = this.transformError(result.error, {
          serviceName: this.getServiceName(),
          operation: 'disposeHttpClient'
        });
        return createErrorResult<void, TError>(transformedError);
      }
      // Clear cache if present
      if (this.cache) {
        this.cache.clear();
      }
      this.disposed = true;
      return createSuccessResult<void, TError>(undefined);
    } catch (error: unknown) {
      const transformedError = this.transformError(error, {
        serviceName: this.getServiceName(),
        operation: 'dispose'
      });
      return createErrorResult<void, TError>(transformedError);
    }
  }
  /**
   * Disposes of the client (backward compatibility)
   */
  public dispose(): void {
    if (this.disposed) return;
    try {
      this.http.dispose();
      if (this.cache) {
        this.cache.clear();
      }
      this.disposed = true;
    } catch (error: unknown) {
      logger.error(`Failed to dispose ${this.getServiceName()} client: ${getErrorMessage(error)}`);
    }
  }
  /**
   * Checks if the client has been disposed
   */
  public isDisposed(): boolean {
    return this.disposed;
  }
}