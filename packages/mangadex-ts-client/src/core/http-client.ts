/**
 * Shared HTTP client with rate limiting and caching
 */

import axios, { AxiosInstance, AxiosRequestConfig, AxiosError } from 'axios';
import { RateLimiter } from './rate-limiter';
import { TTLCache } from './cache';
import { ApiError, RateLimitError } from '../types/errors';
import { DataSource } from '../types/common';

export interface HttpClientConfig {
  baseURL: string;
  timeout?: number;
  userAgent?: string;
  rateLimit?: {
    maxRequests: number;
    perMilliseconds: number;
  };
  cacheTtlMs?: number;
  maxCacheEntries?: number;
  source: DataSource;
  headers?: Record<string, string>;
}

export class HttpClient {
  private readonly axios: AxiosInstance;
  private readonly rateLimiter?: RateLimiter;
  private readonly cache: TTLCache<unknown>;
  private readonly source: DataSource;

  constructor(config: HttpClientConfig) {
    this.source = config.source;

    this.axios = axios.create({
      baseURL: config.baseURL,
      timeout: config.timeout ?? 30000,
      headers: {
        'User-Agent': config.userAgent ?? 'MangaDex-Metadata-Client/2.0.0',
        Accept: 'application/json',
        'Accept-Encoding': 'gzip, deflate',
        ...config.headers,
      },
      maxRedirects: 5,
      validateStatus: (status) => status >= 200 && status < 500,
    });

    if (config.rateLimit) {
      this.rateLimiter = new RateLimiter(
        config.rateLimit.maxRequests,
        config.rateLimit.perMilliseconds
      );

      this.axios.interceptors.request.use(async (reqConfig) => {
        if (this.rateLimiter) {
          await this.rateLimiter.waitIfNeeded();
        }
        return reqConfig;
      });
    }

    this.cache = new TTLCache({
      ttlMs: config.cacheTtlMs ?? 5 * 60 * 1000,
      maxEntries: config.maxCacheEntries ?? 500,
      enabled: true,
    });
  }

  async get<T>(url: string, config?: AxiosRequestConfig & { skipCache?: boolean }): Promise<T> {
    const cacheKey = `GET:${url}:${JSON.stringify(config?.params ?? {})}`;

    if (!config?.skipCache) {
      const cached = this.cache.get(cacheKey) as T | undefined;
      if (cached !== undefined) return cached;
    }

    const response = await this.request<T>({ ...config, method: 'GET', url });
    this.cache.set(cacheKey, response);
    return response;
  }

  async post<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
    return this.request<T>({ ...config, method: 'POST', url, data });
  }

  async request<T>(config: AxiosRequestConfig): Promise<T> {
    try {
      const response = await this.axios.request<T>(config);

      if (response.status === 429) {
        const retryAfter = Number(response.headers['retry-after'] ?? 60) * 1000;
        throw new RateLimitError(
          `Rate limit exceeded for ${this.source}`,
          retryAfter,
          this.source
        );
      }

      if (response.status >= 400) {
        throw new ApiError(
          `HTTP ${response.status}: ${config.url}`,
          response.status,
          undefined,
          response.headers['x-request-id'] as string | undefined,
          this.source
        );
      }

      return response.data;
    } catch (error) {
      if (error instanceof ApiError || error instanceof RateLimitError) {
        throw error;
      }

      if (axios.isAxiosError(error)) {
        const axiosErr = error as AxiosError;
        if (axiosErr.response) {
          throw new ApiError(
            `API request failed: ${axiosErr.message}`,
            axiosErr.response.status,
            undefined,
            axiosErr.response.headers['x-request-id'] as string | undefined,
            this.source
          );
        }
        throw new ApiError(
          `Network error: ${axiosErr.message}`,
          undefined,
          undefined,
          undefined,
          this.source
        );
      }

      throw new ApiError(
        `Unexpected error: ${error instanceof Error ? error.message : String(error)}`,
        undefined,
        undefined,
        undefined,
        this.source
      );
    }
  }

  clearCache(): void {
    this.cache.clear();
  }
}
