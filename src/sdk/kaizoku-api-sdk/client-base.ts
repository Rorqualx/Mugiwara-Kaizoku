/**
 * Kaizoku API SDK - Client Base
 *
 * Core HTTP client functionality with request handling, retries,
 * and interceptors. Refactored from kaizoku-api-sdk.ts to reduce
 * complexity (51->20) and improve type safety.
 */

import { ApiError } from './api-error';
import {
  toError,
  getErrorMessage,
  safeJsonParse,
  isApiErrorResponse,
  type ApiErrorResponse,
} from './utils';

import type { KaizokuApiConfig } from './types';

// ============================================================================
// Internal Types
// ============================================================================

interface RequestOptions {
  body?: unknown;
  query?: Record<string, unknown>;
  signal?: AbortSignal;
}

interface ParsedErrorResponse {
  message: string;
  code: string;
  details?: unknown;
}

interface ExecuteRequestContext {
  method: string;
  path: string;
  url: URL;
  requestOptions: RequestInit;
}

// ============================================================================
// Helper Functions (reduce complexity)
// ============================================================================

/**
 * Build URL with query parameters
 */
function buildRequestUrl(
  baseUrl: string,
  path: string,
  query?: Record<string, unknown>
): URL {
  const url = new URL(path, baseUrl);

  if (query) {
    appendQueryParams(url, query);
  }

  return url;
}

/**
 * Append query parameters to URL
 */
function appendQueryParams(url: URL, query: Record<string, unknown>): void {
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined) {
      if (Array.isArray(value)) {
        value.forEach((v) => url.searchParams.append(key, String(v)));
      } else {
        url.searchParams.set(key, String(value));
      }
    }
  });
}

/**
 * Parse error response from API
 */
function parseErrorResponse(
  data: unknown,
  status: number
): ParsedErrorResponse {
  if (isApiErrorResponse(data) && data.error) {
    return {
      message: data.error.message ?? `Request failed with status ${status}`,
      code: data.error.code ?? 'UNKNOWN_ERROR',
      details: data.error.details,
    };
  }

  return {
    message: `Request failed with status ${status}`,
    code: 'UNKNOWN_ERROR',
    details: undefined,
  };
}

/**
 * Determine if error is retryable
 */
function isRetryableError(error: Error): boolean {
  if (error instanceof ApiError) {
    // Don't retry client errors (4xx)
    return error.statusCode < 400 || error.statusCode >= 500;
  }

  // Don't retry abort errors
  if (error.name === 'AbortError') {
    return false;
  }

  return true;
}

/**
 * Wait with exponential backoff
 */
function waitForRetry(baseDelay: number, attempt: number): Promise<void> {
  const delay = baseDelay * Math.pow(2, attempt);
  return new Promise<void>((resolve) => {
    setTimeout(resolve, delay);
  });
}

/**
 * Calculate retry delay for logging
 */
function calculateRetryDelay(baseDelay: number, attempt: number): number {
  return baseDelay * Math.pow(2, attempt);
}

// ============================================================================
// Client Base Class
// ============================================================================

export class KaizokuApiClientBase {
  protected config: Required<
    Omit<KaizokuApiConfig, 'interceptors' | 'logger' | 'headers'>
  >;
  protected interceptors: KaizokuApiConfig['interceptors'];
  protected logger: KaizokuApiConfig['logger'];
  protected customHeaders: Record<string, string>;
  protected abortControllers: Map<string, AbortController> = new Map();

  constructor(config: KaizokuApiConfig) {
    const { interceptors, logger, headers, ...restConfig } = config;
    this.config = {
      timeout: 30000,
      retryAttempts: 3,
      retryDelay: 1000,
      ...restConfig,
    };
    this.interceptors = interceptors;
    this.logger = logger;
    this.customHeaders = headers ?? {};
  }

  /**
   * Make an API request with retries
   */
  protected async request<T>(
    method: string,
    path: string,
    options?: RequestOptions
  ): Promise<T> {
    const url = buildRequestUrl(this.config.baseUrl, path, options?.query);
    let requestOptions = this.buildRequestInit(method, options);

    // Apply request interceptor
    requestOptions = await this.applyRequestInterceptor(requestOptions);

    // Execute with retries
    const context: ExecuteRequestContext = {
      method,
      path,
      url,
      requestOptions,
    };
    return this.executeWithRetries<T>(context);
  }

  /**
   * Build RequestInit object
   */
  private buildRequestInit(
    method: string,
    options?: RequestOptions
  ): RequestInit {
    const headers: HeadersInit = {
      'X-API-Key': this.config.apiKey,
      'Content-Type': 'application/json',
      ...this.customHeaders,
    };

    const requestInit: RequestInit = { method, headers };

    if (options?.signal !== undefined) {
      requestInit.signal = options.signal;
    }

    if (options?.body) {
      requestInit.body = JSON.stringify(options.body);
    }

    return requestInit;
  }

  /**
   * Apply request interceptor
   */
  private async applyRequestInterceptor(
    requestOptions: RequestInit
  ): Promise<RequestInit> {
    if (!this.interceptors?.request) {
      return requestOptions;
    }

    try {
      return await this.interceptors.request(requestOptions);
    } catch (error: unknown) {
      const errorMessage = getErrorMessage(error);
      this.logger?.error?.('Request interceptor error', errorMessage);
      throw new Error(errorMessage);
    }
  }

  /**
   * Execute request with retry logic
   */
  private async executeWithRetries<T>(
    context: ExecuteRequestContext
  ): Promise<T> {
    return this.executeAttempt<T>(context, 0, null);
  }

  /**
   * Execute a single attempt with recursive retry
   */
  private async executeAttempt<T>(
    context: ExecuteRequestContext,
    attempt: number,
    previousError: Error | null
  ): Promise<T> {
    // Check if we've exhausted all attempts
    if (attempt >= this.config.retryAttempts) {
      this.logger?.error?.(
        `${context.method} ${context.path} failed after ${this.config.retryAttempts} attempts`
      );
      throw previousError ?? new Error('Request failed');
    }

    try {
      return await this.executeSingleRequest<T>(context, attempt);
    } catch (error: unknown) {
      const handledError = await this.handleRequestError(
        error,
        context,
        attempt
      );

      // Check if we should retry
      if (!isRetryableError(handledError)) {
        throw handledError;
      }

      // Wait before retrying (except on last attempt)
      if (attempt < this.config.retryAttempts - 1) {
        const delay = calculateRetryDelay(this.config.retryDelay, attempt);
        this.logger?.debug?.(`Retrying in ${delay}ms...`);
        await waitForRetry(this.config.retryDelay, attempt);
      }

      // Recursive call for next attempt
      return this.executeAttempt<T>(context, attempt + 1, handledError);
    }
  }

  /**
   * Handle request error with interceptor
   */
  private async handleRequestError(
    error: unknown,
    context: ExecuteRequestContext,
    attempt: number
  ): Promise<Error> {
    let lastError = toError(error);

    // Apply error interceptor
    if (this.interceptors?.error) {
      try {
        lastError = await this.interceptors.error(lastError);
      } catch (interceptorError: unknown) {
        this.logger?.error?.(
          'Error interceptor failed',
          getErrorMessage(interceptorError)
        );
      }
    }

    this.logger?.warn?.(
      `${context.method} ${context.path} failed (attempt ${attempt + 1})`,
      lastError
    );

    return lastError;
  }

  /**
   * Execute a single request attempt
   */
  private async executeSingleRequest<T>(
    context: ExecuteRequestContext,
    attempt: number
  ): Promise<T> {
    const { method, path, url, requestOptions } = context;
    this.logger?.debug?.(`${method} ${url}`, { attempt: attempt + 1 });

    // Create timeout controller
    const timeoutId = this.createTimeoutHandler(requestOptions.signal);

    try {
      const response = await this.fetchWithInterceptor(url, requestOptions);
      clearTimeout(timeoutId);

      // Handle error responses
      if (!response.ok) {
        await this.throwApiError(response);
      }

      // Parse and return successful response
      const data = (await response.json()) as T;
      this.logger?.info?.(`${method} ${path} succeeded`);
      return data;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Fetch with response interceptor
   */
  private async fetchWithInterceptor(
    url: URL,
    requestOptions: RequestInit
  ): Promise<Response> {
    let response = await fetch(url.toString(), requestOptions);

    // Apply response interceptor
    response = await this.applyResponseInterceptor(response);

    return response;
  }

  /**
   * Throw ApiError from error response
   */
  private async throwApiError(response: Response): Promise<never> {
    const errorData = await safeJsonParse<ApiErrorResponse>(response);
    const parsedError = parseErrorResponse(errorData, response.status);
    throw new ApiError(
      parsedError.message,
      parsedError.code,
      response.status,
      parsedError.details
    );
  }

  /**
   * Create timeout handler
   */
  private createTimeoutHandler(
    signal?: AbortSignal | null
  ): ReturnType<typeof setTimeout> {
    return setTimeout(() => {
      if (signal && !signal.aborted) {
        this.abortControllersForSignal(signal);
      }
    }, this.config.timeout);
  }

  /**
   * Abort controllers matching signal
   */
  private abortControllersForSignal(signal: AbortSignal): void {
    this.abortControllers.forEach((controller) => {
      if (controller.signal === signal) {
        controller.abort();
      }
    });
  }

  /**
   * Apply response interceptor
   */
  private async applyResponseInterceptor(response: Response): Promise<Response> {
    if (!this.interceptors?.response) {
      return response;
    }

    try {
      return await this.interceptors.response(response);
    } catch (error: unknown) {
      const errorMessage = getErrorMessage(error);
      this.logger?.error?.('Response interceptor error', errorMessage);
      throw new Error(errorMessage);
    }
  }

  /**
   * Cancel a request
   */
  public cancelRequest(requestId: string): void {
    const controller = this.abortControllers.get(requestId);
    if (controller) {
      controller.abort();
      this.abortControllers.delete(requestId);
    }
  }

  /**
   * Create a cancellable request
   */
  protected createCancellableRequest<T>(
    requestId: string,
    requestFn: (signal: AbortSignal) => Promise<T>
  ): Promise<T> {
    this.cancelRequest(requestId);

    const controller = new AbortController();
    this.abortControllers.set(requestId, controller);

    return requestFn(controller.signal).finally(() => {
      this.abortControllers.delete(requestId);
    });
  }
}
