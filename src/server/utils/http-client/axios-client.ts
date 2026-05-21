/**
 * Axios HTTP Client Implementation
 *
 * HTTP client using axios with rate limiting, retries, and auth support.
 * The requestAsync method has been decomposed into helper functions
 * for maintainability and ESLint compliance.
 *
 * Extracted from: httpClient.ts
 */

import axios, { AxiosHeaders } from 'axios';

import type { AsyncResult } from '@/utils/async-result';
import {
  createSuccessResult,
  createErrorResult,
  isSuccess,
  isError,
  isLoading,
  createLoadingResult,
  createIdleResult
} from '@/utils/async-result';

import { createRateLimiter } from '../rateLimit';

import { createAuthManager } from './auth';
import { ApiError } from './types';

import type { RateLimiter } from '../rate-limit';
import type {
  HttpClient,
  HttpClientConfig,
  HttpClientResponse,
  RequestOptions,
  AuthManager
} from './types';
import type { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';

// =============================================================================
// Private Helper Types
// =============================================================================

/**
 * Axios error shape for type narrowing
 */
interface AxiosErrorShape {
  response?: {
    data?: { message?: string };
    status?: number;
  };
  message?: string;
}

// =============================================================================
// Axios HTTP Client Implementation
// =============================================================================

/**
 * Axios-based HTTP client implementation
 *
 * Features:
 * - Rate limiting with configurable strategies
 * - Automatic retry with exponential backoff
 * - Authentication (Basic, Bearer, API Key)
 * - Request abort handling
 * - AsyncResult pattern support
 */
export class AxiosHttpClient implements HttpClient {
  private client: AxiosInstance;
  private config: HttpClientConfig;
  private authManager: AuthManager | null = null;
  private rateLimiter: RateLimiter | null = null;
  private defaultHeaders: Record<string, string> = {};
  private disposed = false;
  private abortControllers: AbortController[] = [];

  constructor(config: HttpClientConfig) {
    this.config = config;
    this.client = axios.create({
      baseURL: config.baseURL,
      timeout: config.timeout ?? 30000,
      headers: config.headers ?? {},
      validateStatus: config.validateStatus ?? ((status: number) => status >= 200 && status < 300),
      responseType: config.responseType ?? 'json'
    });

    if (config.auth) {
      this.authManager = createAuthManager(config.auth);
    }

    if (config.rateLimit) {
      this.rateLimiter = createRateLimiter(config.rateLimit);
    }

    this.defaultHeaders = { ...(config.headers ?? {}) };
    this.setupRequestInterceptor();
  }

  // ===========================================================================
  // Private Helper Methods - Request Building
  // ===========================================================================

  /**
   * Sets up request interceptor for authentication
   */
  private setupRequestInterceptor(): void {
    this.client.interceptors.request.use((requestConfig) => {
      if (!this.authManager) return requestConfig;

      const authHeaders = this.authManager.getAuthHeaders();
      const headers = new AxiosHeaders(requestConfig.headers);

      Object.entries(authHeaders).forEach(([key, value]) => {
        headers.set(key, value);
      });

      const authParams = this.authManager.getAuthQueryParams();
      if (Object.keys(authParams).length > 0) {
        const existingParams = (requestConfig.params ?? {}) as Record<string, unknown>;
        const newParams: Record<string, unknown> = { ...existingParams, ...authParams };
        return { ...requestConfig, headers, params: newParams };
      }

      return { ...requestConfig, headers };
    });
  }

  /**
   * Builds axios request configuration from options
   */
  private buildRequestConfig(options: RequestOptions, signal: AbortSignal): AxiosRequestConfig {
    const headersObj = { ...this.defaultHeaders, ...options.headers };
    const headers = new AxiosHeaders();

    Object.entries(headersObj).forEach(([key, value]) => {
      headers.set(key, value);
    });

    return {
      method: options.method,
      url: options.path,
      ...(options.params ? { params: options.params } : {}),
      ...(options.data !== undefined ? { data: options.data } : {}),
      headers,
      ...(options.timeout ?? this.config.timeout
        ? { timeout: options.timeout ?? this.config.timeout }
        : {}),
      signal,
      ...(options.responseType ?? this.config.responseType
        ? { responseType: options.responseType ?? this.config.responseType }
        : {}),
      ...(options.validateStatus ?? this.config.validateStatus
        ? { validateStatus: options.validateStatus ?? this.config.validateStatus }
        : {}),
      ...(options.auth ? { auth: options.auth } : {})
    };
  }

  // ===========================================================================
  // Private Helper Methods - Response Transformation
  // ===========================================================================

  /**
   * Converts axios response headers to Record<string, string>
   */
  private extractResponseHeaders(response: AxiosResponse<unknown>): Record<string, string> {
    const responseHeaders: Record<string, string> = {};
    const headers = response.headers;

    Object.entries(headers).forEach(([key, value]) => {
      if (typeof value === 'string') {
        responseHeaders[key] = value;
      } else if (Array.isArray(value)) {
        responseHeaders[key] = value.join(', ');
      } else if (value !== null && value !== undefined) {
        responseHeaders[key] = String(value);
      }
    });

    return responseHeaders;
  }

  /**
   * Extracts access_token from response data if present
   */
  private extractAccessToken<T>(data: T): string | undefined {
    if (typeof data !== 'object' || data === null) {
      return undefined;
    }
    if (!('access_token' in data)) {
      return undefined;
    }
    const dataWithToken = data as Record<string, unknown>;
    if (typeof dataWithToken['access_token'] === 'string') {
      return dataWithToken['access_token'];
    }
    return undefined;
  }

  /**
   * Extracts client-specific backward compatibility data
   */
  private extractClientSpecificData<T>(data: T): Record<string, unknown> | undefined {
    if (!data || typeof data !== 'object') return undefined;

    const backwardCompatProps = ['result', 'arguments', 'errors'];
    const clientSpecific: Record<string, unknown> = {};
    const dataRecord = data as Record<string, unknown>;

    for (const prop of backwardCompatProps) {
      if (prop in dataRecord) {
        clientSpecific[prop] = dataRecord[prop];
      }
    }

    return Object.keys(clientSpecific).length > 0 ? clientSpecific : undefined;
  }

  /**
   * Transforms axios response to HttpClientResponse
   */
  private transformResponse<T>(
    response: AxiosResponse<T>,
    options: RequestOptions
  ): HttpClientResponse<T> {
    const clientResponse: HttpClientResponse<T> = {
      data: response.data,
      status: response.status,
      statusText: response.statusText,
      headers: this.extractResponseHeaders(response),
      config: options
    };

    const accessToken = this.extractAccessToken(response.data);
    if (accessToken) {
      clientResponse.access_token = accessToken;
    }

    const clientSpecific = this.extractClientSpecificData(response.data);
    if (clientSpecific) {
      clientResponse.clientSpecific = clientSpecific;
    }

    return clientResponse;
  }

  // ===========================================================================
  // Private Helper Methods - Error Handling & Retry
  // ===========================================================================

  /**
   * Creates an ApiError from an axios error
   */
  private createApiError(error: unknown): ApiError {
    const axiosError = error as AxiosErrorShape;
    return new ApiError(
      axiosError.response?.data?.message ?? axiosError.message ?? 'Request failed',
      axiosError.response?.status
    );
  }

  /**
   * Checks if retry should be attempted
   */
  private shouldRetry(apiError: ApiError, options: RequestOptions): boolean {
    return (
      apiError.isRetryable() &&
      this.config.retry !== undefined &&
      (options.retries ?? 0) < this.config.retry.maxRetries
    );
  }

  /**
   * Calculates delay for retry with exponential backoff
   */
  private calculateRetryDelay(retryCount: number): number {
    const retryConfig = this.config.retry;
    if (!retryConfig) {
      return 1000; // Default 1 second if no retry config
    }
    return retryConfig.retryDelay * Math.pow(2, retryCount - 1);
  }

  /**
   * Waits for the specified delay
   */
  private async waitForDelay(delay: number): Promise<void> {
    await new Promise<void>((resolve) => {
      setTimeout(resolve, delay);
    });
  }

  /**
   * Retries a failed request with exponential backoff
   */
  private async retryRequest<T>(
    options: RequestOptions
  ): Promise<AsyncResult<HttpClientResponse<T>, Error>> {
    const retryCount = (options.retries ?? 0) + 1;
    const delay = this.calculateRetryDelay(retryCount);

    await this.waitForDelay(delay);

    const retryResult = await this.requestAsync<T>({
      ...options,
      retries: retryCount
    });

    if (isSuccess(retryResult)) {
      return createSuccessResult(retryResult.data);
    }
    if (isError(retryResult)) {
      return createErrorResult(retryResult.error);
    }
    if (isLoading(retryResult)) {
      return createLoadingResult();
    }
    return createIdleResult();
  }

  // ===========================================================================
  // Private Helper Methods - Abort Controller Management
  // ===========================================================================

  /**
   * Adds an abort controller to the tracking list
   */
  private addAbortController(controller: AbortController): void {
    this.abortControllers.push(controller);
  }

  /**
   * Removes an abort controller from the tracking list
   */
  private removeAbortController(controller: AbortController): void {
    const index = this.abortControllers.indexOf(controller);
    if (index !== -1) {
      this.abortControllers.splice(index, 1);
    }
  }

  // ===========================================================================
  // Public Methods - Core Request
  // ===========================================================================

  /**
   * Makes an HTTP request with AsyncResult pattern
   */
  async requestAsync<T = unknown>(
    options: RequestOptions
  ): Promise<AsyncResult<HttpClientResponse<T>, Error>> {
    if (this.disposed) {
      return createErrorResult(new Error('HTTP client has been disposed'));
    }

    // Apply rate limiting
    if (this.rateLimiter) {
      try {
        await this.rateLimiter.acquire();
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return createErrorResult(new Error(errorMessage));
      }
    }

    // Setup abort controller
    const abortController = new AbortController();
    this.addAbortController(abortController);
    const signal = options.signal ?? abortController.signal;

    try {
      const requestConfig = this.buildRequestConfig(options, signal);
      const response = await this.client.request<T>(requestConfig);

      if (this.rateLimiter) {
        this.rateLimiter.updateFromResponse(response);
      }

      this.removeAbortController(abortController);
      return createSuccessResult(this.transformResponse(response, options));
    } catch (error: unknown) {
      this.removeAbortController(abortController);

      const apiError = this.createApiError(error);

      if (this.shouldRetry(apiError, options)) {
        return this.retryRequest<T>(options);
      }

      return createErrorResult<HttpClientResponse<T>, Error>(apiError);
    }
  }

  /**
   * Makes an HTTP request (throws on error)
   */
  async request<T = unknown>(options: RequestOptions): Promise<HttpClientResponse<T>> {
    const result = await this.requestAsync<T>(options);
    if (isSuccess(result)) {
      return result.data;
    }
    if (isError(result)) {
      throw result.error;
    }
    throw new Error(`Unexpected AsyncResult state: ${result.status}`);
  }

  // ===========================================================================
  // Public Methods - Convenience HTTP Methods
  // ===========================================================================

  async get<T = unknown>(
    path: string,
    options?: Omit<RequestOptions, 'method' | 'path'>
  ): Promise<HttpClientResponse<T>> {
    return this.request<T>({ method: 'GET', path, ...options });
  }

  async getAsync<T = unknown>(
    path: string,
    options?: Omit<RequestOptions, 'method' | 'path'>
  ): Promise<AsyncResult<HttpClientResponse<T>, Error>> {
    return this.requestAsync<T>({ method: 'GET', path, ...options });
  }

  async post<T = unknown>(
    path: string,
    data?: unknown,
    options?: Omit<RequestOptions, 'method' | 'path' | 'data'>
  ): Promise<HttpClientResponse<T>> {
    return this.request<T>({ method: 'POST', path, data, ...options });
  }

  async postAsync<T = unknown>(
    path: string,
    data?: unknown,
    options?: Omit<RequestOptions, 'method' | 'path' | 'data'>
  ): Promise<AsyncResult<HttpClientResponse<T>, Error>> {
    return this.requestAsync<T>({ method: 'POST', path, data, ...options });
  }

  async put<T = unknown>(
    path: string,
    data?: unknown,
    options?: Omit<RequestOptions, 'method' | 'path' | 'data'>
  ): Promise<HttpClientResponse<T>> {
    return this.request<T>({ method: 'PUT', path, data, ...options });
  }

  async putAsync<T = unknown>(
    path: string,
    data?: unknown,
    options?: Omit<RequestOptions, 'method' | 'path' | 'data'>
  ): Promise<AsyncResult<HttpClientResponse<T>, Error>> {
    return this.requestAsync<T>({ method: 'PUT', path, data, ...options });
  }

  async delete<T = unknown>(
    path: string,
    options?: Omit<RequestOptions, 'method' | 'path'>
  ): Promise<HttpClientResponse<T>> {
    return this.request<T>({ method: 'DELETE', path, ...options });
  }

  async deleteAsync<T = unknown>(
    path: string,
    options?: Omit<RequestOptions, 'method' | 'path'>
  ): Promise<AsyncResult<HttpClientResponse<T>, Error>> {
    return this.requestAsync<T>({ method: 'DELETE', path, ...options });
  }

  async patch<T = unknown>(
    path: string,
    data?: unknown,
    options?: Omit<RequestOptions, 'method' | 'path' | 'data'>
  ): Promise<HttpClientResponse<T>> {
    return this.request<T>({ method: 'PATCH', path, data, ...options });
  }

  async patchAsync<T = unknown>(
    path: string,
    data?: unknown,
    options?: Omit<RequestOptions, 'method' | 'path' | 'data'>
  ): Promise<AsyncResult<HttpClientResponse<T>, Error>> {
    return this.requestAsync<T>({ method: 'PATCH', path, data, ...options });
  }

  // ===========================================================================
  // Public Methods - Header Management
  // ===========================================================================

  setHeader(name: string, value: string): void {
    this.defaultHeaders[name] = value;
  }

  updateHeaders(headers: Record<string, string>): void {
    this.defaultHeaders = { ...this.defaultHeaders, ...headers };
  }

  removeHeader(name: string): void {
    delete this.defaultHeaders[name];
  }

  // ===========================================================================
  // Public Methods - URL Management
  // ===========================================================================

  setBaseURL(baseURL: string): void {
    this.client.defaults.baseURL = baseURL;
  }

  getUri(options?: Omit<RequestOptions, 'method'>): string {
    return this.client.getUri({
      ...(options?.path ? { url: options.path } : {}),
      ...(options?.params ? { params: options.params } : {})
    });
  }

  // ===========================================================================
  // Public Methods - Lifecycle & State
  // ===========================================================================

  get defaults(): { headers: Record<string, string>; baseURL?: string } {
    return {
      headers: { ...this.defaultHeaders },
      ...(this.client.defaults.baseURL ? { baseURL: this.client.defaults.baseURL } : {})
    };
  }

  dispose(): AsyncResult<void, Error> {
    try {
      this.abortControllers.forEach((controller) => {
        try {
          controller.abort();
        } catch {
          // Continue even if individual aborts fail
        }
      });
      this.abortControllers = [];
      this.disposed = true;
      return createSuccessResult(undefined);
    } catch (error: unknown) {
      return createErrorResult(
        error instanceof Error
          ? error
          : new Error(`Failed to dispose HTTP client: ${String(error)}`)
      );
    }
  }

  isDisposed(): boolean {
    return this.disposed;
  }
}

// =============================================================================
// Factory Function
// =============================================================================

/**
 * Creates an HTTP client instance
 *
 * @param config - HTTP client configuration
 * @returns HTTP client instance
 */
export function createHttpClient(config: HttpClientConfig): HttpClient {
  return new AxiosHttpClient(config);
}
