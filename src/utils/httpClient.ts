/**
 * HTTP Client Utilities
 * Common HTTP client functions and configurations
 */

import axios from 'axios';

import { AppError } from './error-handling';

import type { AxiosInstance, AxiosRequestConfig, CreateAxiosDefaults} from 'axios';

/**
 * Extended AxiosRequestConfig with retry tracking
 */
interface ExtendedRequestConfig extends AxiosRequestConfig {
  _retry?: boolean;
  _retryCount?: number;
}

/**
 * Axios error structure
 */
interface AxiosErrorLike {
  config?: ExtendedRequestConfig;
  response?: {
    data?: {
      message?: string;
    };
  };
  request?: unknown;
  message?: string;
}

/**
 * Type guard to check if error is an Axios-like error
 */
function isAxiosErrorLike(error: unknown): error is AxiosErrorLike {
  return (
    typeof error === 'object' &&
    error !== null &&
    ('config' in error || 'response' in error || 'request' in error)
  );
}

export interface HttpClientConfig {
  baseURL?: string;
  timeout?: number;
  headers?: Record<string, string>;
  retry?: {
    maxAttempts?: number;
    delay?: number;
    shouldRetry?: (error: unknown) => boolean;
  };
}

export interface RequestOptions extends AxiosRequestConfig {
  retryAttempts?: number;
  retryDelay?: number;
}

export class HttpClient {
  private client: AxiosInstance;
  private config: HttpClientConfig;
  constructor(config: HttpClientConfig = {}) {
    this.config = config;
    const axiosConfig: CreateAxiosDefaults = {
      timeout: config.timeout || 30000,
      headers: config.headers ?? {}
    };
    if (config.baseURL !== undefined) {
      axiosConfig.baseURL = config.baseURL;
    }
    this.client = axios.create(axiosConfig);
    this.setupInterceptors();
  }

  private setupInterceptors(): void {
    // Request interceptor
    this.client.interceptors.request.use(
      (config) => {
        // Add any request modifications here
        return config;
      },
      (error: unknown) => {
        return Promise.reject(error instanceof Error ? error : new Error(String(error)));
      }
    );
    // Response interceptor
    this.client.interceptors.response.use(
      (response) => response,
      async (error: unknown) => {
        if (!isAxiosErrorLike(error) || error.config === undefined) {
          return Promise.reject(new Error(this.transformError(error).message));
        }

        const originalRequest = error.config;
        // Retry logic
        if (this.config.retry !== undefined && !originalRequest._retry) {
          const { maxAttempts = 3, delay = 1000, shouldRetry } = this.config.retry;
          originalRequest._retryCount = originalRequest._retryCount ?? 0;
          if (
          originalRequest._retryCount < maxAttempts && (
          shouldRetry === undefined || shouldRetry(error)))
          {
            originalRequest._retry = true;
            originalRequest._retryCount++;
            await new Promise((resolve) => { void setTimeout(resolve, delay); });
            return this.client(originalRequest);
          }
        }

        return Promise.reject(new Error(this.transformError(error).message));
      }
    );
  }

  private transformError(error: unknown): AppError {
    if (isAxiosErrorLike(error)) {
      if (error.response) {
        // Server responded with error
        return new AppError(
          error.response.data?.message ?? (error instanceof Error ? error.message : String(error)),
          { operation: 'http-request', service: 'http-client' }
        );
      } else if (error.request) {
        // Request made but no response
        return new AppError('No response from server', { operation: 'http-request', service: 'http-client' });
      }
    }

    // Request setup error or non-Axios error
    return new AppError((error instanceof Error ? error.message : String(error)), { operation: 'http-request', service: 'http-client' });
  }

  async get<T = unknown>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.get<T>(url, config);
    return response.data;
  }

  async post<T = unknown>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.post<T>(url, data, config);
    return response.data;
  }

  async put<T = unknown>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.put<T>(url, data, config);
    return response.data;
  }

  async delete<T = unknown>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.delete<T>(url, config);
    return response.data;
  }

  async patch<T = unknown>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.patch<T>(url, data, config);
    return response.data;
  }

  getAxiosInstance(): AxiosInstance {
    return this.client;
  }
}

// Create default client
export const httpClient = new HttpClient();
// Export convenience functions
export const get = httpClient.get.bind(httpClient);
export const post = httpClient.post.bind(httpClient);
export const put = httpClient.put.bind(httpClient);
export const del = httpClient.delete.bind(httpClient);
export const patch = httpClient.patch.bind(httpClient);
export default HttpClient;