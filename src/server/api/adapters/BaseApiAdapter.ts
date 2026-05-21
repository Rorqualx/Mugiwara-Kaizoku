/**
 * Base API Adapter
 * 
 * This module provides the base class for API adapters following the project's adapter pattern.
 * All API resource adapters extend this base class to ensure consistent behavior.
 */

import type { ApiConfig, ApiRequest, ApiAuth, RateLimitStatus } from '@/types/api/common';
import type { AsyncResult} from '@/utils/async-result';
import { createSuccessResult, createErrorResult, isSuccess, isError } from '@/utils/async-result'
import { logger } from '@/utils/logger';

import { ApiCache } from '../services/apiCache';
import { RateLimiter } from '../services/apiRateLimit';

/**
 * Base API Adapter abstract class
 * 
 * Provides common functionality for API adapters including:
 * - Authentication
 * - Rate limiting
 * - Caching
 * - Error handling
 * - Logging
 */
export abstract class BaseApiAdapter<TConfig extends ApiConfig> {
  protected readonly config: TConfig;
  protected readonly rateLimiter: RateLimiter;
  protected readonly cache: ApiCache;
  protected readonly logger = logger;

  constructor(config: TConfig) {
    this.config = config;
    this.rateLimiter = new RateLimiter({
      windowMs: 60000, // 1 minute
      maxRequests: config.rateLimit?.requests?.perMinute ?? 60,
    });
    this.cache = new ApiCache({
      ttl: config.cache?.ttl ?? 300000, // 5 minutes default
      maxSize: config.cache?.maxSize ?? 100, // 100MB default
    });
  }

  /**
   * Authenticate API request (private AsyncResult method)
   */
  private async _authenticate(request: ApiRequest): Promise<AsyncResult<ApiAuth, Error>> {
    try {
      const apiKey = this.extractApiKey(request);
      if (!apiKey) {
        return createErrorResult(new Error('API key required'));
      }

      const authResult = await this.validateApiKey(apiKey);
      if (!authResult) {
        return createErrorResult(new Error('Invalid API key'));
      }

      return createSuccessResult(authResult);
    } catch (error: unknown) {
      return createErrorResult(
        error instanceof Error ? error : new Error('Authentication failed')
      );
    }
  }

  /**
   * Authenticate API request (public throwing method)
   */
  public async authenticate(request: ApiRequest): Promise<ApiAuth> {
    const result = await this._authenticate(request);
    
    if (isSuccess(result)) {
      return result.data;
    }
    
    if (isError(result)) {
      throw result.error;
    }
    
    throw new Error('Unknown authentication state');
  }

  /**
   * Check rate limit (private AsyncResult method)
   */
  private async _checkRateLimit(apiKey: string): Promise<AsyncResult<RateLimitStatus, Error>> {
    try {
      const result = await this.rateLimiter.check(apiKey);
      
      if (isError(result)) {
        return result;
      }
      
      if (isSuccess(result) && result.data.exceeded) {
        return createErrorResult(
          new Error(`Rate limit exceeded. Retry after ${result.data.retryAfter}s`)
        );
      }

      return result;
    } catch (error: unknown) {
      return createErrorResult(
        error instanceof Error ? error : new Error('Rate limit check failed')
      );
    }
  }

  /**
   * Check rate limit (public throwing method)
   */
  public async checkRateLimit(apiKey: string): Promise<RateLimitStatus> {
    const result = await this._checkRateLimit(apiKey);
    
    if (isSuccess(result)) {
      return result.data;
    }
    
    if (isError(result)) {
      throw result.error;
    }
    
    throw new Error('Unknown rate limit state');
  }

  /**
   * Extract API key from request
   */
  protected extractApiKey(request: ApiRequest): string | undefined {
    const apiKey = request.headers?.['x-api-key'];

    if (Array.isArray(apiKey)) {
      return apiKey[0] as string;
    }

    return apiKey as string | undefined;
  }

  /**
   * Create error with context
   */
  protected createError(message: string, originalError?: unknown): Error {
    const errorMessage = originalError instanceof Error 
      ? `${message}: ${originalError.message}`
      : message;
    
    const error = new Error(errorMessage);
    if (originalError instanceof Error && originalError.stack) {
      error.stack = originalError.stack;
    }
    
    return error;
  }

  /**
   * Log with context
   */
  protected log(message: string, data?: unknown): void {
    this.logger.info(message, {
      adapter: this.constructor["name"],
      data,
    });
  }

  /**
   * Validate API key - must be implemented by subclasses
   */
  protected abstract validateApiKey(key: string): Promise<ApiAuth | null>;

  /**
   * Clean up resources
   */
  public dispose(): void {
    this.rateLimiter.dispose();
    this.cache.clear();
  }
}