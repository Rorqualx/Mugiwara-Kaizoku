/**
 * Provider Wrapper Module
 *
 * Wraps metadata providers with health monitoring, circuit breaking,
 * rate limiting, and caching capabilities.
 *
 * Features:
 * - Automatic health checks with configurable intervals
 * - Circuit breaker pattern with exponential backoff
 * - Request metrics tracking (response time, error rate)
 * - Integration with rate limiting and caching
 *
 * Extracted from: provider-registry.ts (lines 117-352)
 * ESLint Fix: Line 348 - no-promise-executor-return
 */

import type { AsyncResult } from '@/utils/async-result';
import { createErrorResult } from '@/utils/async-result';
import { logger } from '@/utils/logging';

import { createCacheManager, type UnifiedCacheManager } from '../caching';
import { createRateLimiter, type RateLimiter } from '../rateLimit';

import {
  ProviderStatus,
  type MetadataProviderInterface,
  type ProviderConfig,
  type ProviderHealth
} from './types';

/**
 * Provider wrapper with health monitoring and circuit breaking
 */
export class ProviderWrapper {
  private provider: MetadataProviderInterface;
  private config: ProviderConfig;
  private health: ProviderHealth;
  private rateLimiter?: RateLimiter;
  private cacheManager?: UnifiedCacheManager;
  private circuitBreakerOpenUntil?: number;
  private healthCheckTimer?: NodeJS.Timeout;

  constructor(provider: MetadataProviderInterface, config: ProviderConfig) {
    this.provider = provider;
    this.config = config;
    this.health = {
      status: ProviderStatus.REGISTERED,
      uptime: 0,
      lastCheck: Date.now(),
      consecutiveFailures: 0,
      averageResponseTime: 0,
      errorRate: 0,
      requestCount: 0,
      circuitBreakerOpen: false
    };

    // Initialize infrastructure if capabilities support it
    if (provider.capabilities.rateLimit) {
      this.rateLimiter = createRateLimiter(config.type as 'anilist' | 'mangadex' | 'comicvine' | 'fandom' | 'wikipedia', {
        name: `${config.name}-limiter`
      });
    }

    if (provider.capabilities.caching) {
      this.cacheManager = createCacheManager(config.type as 'anilist' | 'mangadex' | 'comicvine' | 'fandom' | 'wikipedia', {
        name: `${config.name}-cache`
      });
    }
  }

  /**
   * Initialize the provider and start health checks
   */
  async initialize(): Promise<void> {
    try {
      this.health.status = ProviderStatus.INITIALIZING;
      await this.provider.initialize(this.config);
      this.health.status = ProviderStatus.READY;
      this.startHealthChecks();
    } catch (error: unknown) {
      this.health.status = ProviderStatus.UNHEALTHY;
      this.health.lastError = error instanceof Error ? error.message : String(error);
      throw error;
    }
  }

  /**
   * Shutdown the provider and cleanup resources
   */
  async shutdown(): Promise<void> {
    this.stopHealthChecks();
    this.health.status = ProviderStatus.DISABLED;
    if (this.cacheManager) {
      // Cache doesn't have a shutdown method, just clear it
      this.cacheManager.clear();
    }

    await this.provider.shutdown();
  }

  /**
   * Execute an operation with health checks, rate limiting, and circuit breaking
   */
  async execute<T>(
    operation: () => Promise<AsyncResult<T, Error>>,
    _operationName: string
  ): Promise<AsyncResult<T, Error>> {
    // Check circuit breaker
    if (this.isCircuitBreakerOpen()) {
      return createErrorResult(
        new Error(`Circuit breaker open for ${this.config.name}`)
      );
    }

    // Check if provider is healthy
    if (this.health.status === ProviderStatus.UNHEALTHY ||
        this.health.status === ProviderStatus.DISABLED) {
      return createErrorResult(
        new Error(`Provider ${this.config.name} is ${this.health.status}`)
      );
    }

    // Apply rate limiting if available
    if (this.rateLimiter) {
      await this.rateLimiter.waitIfNeeded();
    }

    const startTime = Date.now();
    try {
      // Execute with timeout
      const result = await this.withTimeout(operation(), this.config.timeout);

      // Update metrics
      this.updateMetrics(true, Date.now() - startTime);

      // Mark rate limit request complete
      if (this.rateLimiter) {
        this.rateLimiter.requestComplete();
      }

      return result;
    } catch (error: unknown) {
      // Update metrics
      this.updateMetrics(false, Date.now() - startTime);

      // Mark rate limit request complete
      if (this.rateLimiter) {
        this.rateLimiter.requestComplete();
      }

      // Check if should open circuit breaker
      this.checkCircuitBreaker();
      return createErrorResult(
        error instanceof Error ? error : new Error('Unknown error')
      );
    }
  }

  /**
   * Get the underlying provider instance
   */
  getProvider(): MetadataProviderInterface {
    return this.provider;
  }

  /**
   * Get the provider configuration
   */
  getConfig(): ProviderConfig {
    return this.config;
  }

  /**
   * Get current health metrics
   */
  getHealth(): ProviderHealth {
    return { ...this.health };
  }

  /**
   * Get the cache manager if available
   */
  getCacheManager(): UnifiedCacheManager | undefined {
    return this.cacheManager;
  }

  /**
   * Get the rate limiter if available
   */
  getRateLimiter(): RateLimiter | undefined {
    return this.rateLimiter;
  }

  private startHealthChecks(): void {
    if (this.config.healthCheckInterval <= 0) return;

    this.healthCheckTimer = setInterval(() => {
      void (async () => {
        try {
          const healthy = await this.provider.healthCheck();
          if (healthy) {
            this.health.consecutiveFailures = 0;
            this.health.status = ProviderStatus.READY;
            this.closeCircuitBreaker();
          } else {
            this.health.consecutiveFailures++;
            this.checkCircuitBreaker();
          }
        } catch (error: unknown) {
          this.health.consecutiveFailures++;
          this.health.lastError = error instanceof Error ? error.message : String(error);
          this.checkCircuitBreaker();
        }

        this.health.lastCheck = Date.now();
      })();
    }, this.config.healthCheckInterval);
  }

  private stopHealthChecks(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      delete (this as unknown as { healthCheckTimer?: NodeJS.Timeout }).healthCheckTimer;
    }
  }

  private updateMetrics(success: boolean, responseTime: number): void {
    this.health.requestCount++;

    // Update average response time
    this.health.averageResponseTime =
      (this.health.averageResponseTime * (this.health.requestCount - 1) + responseTime) /
      this.health.requestCount;

    // Update error rate
    if (!success) {
      this.health.consecutiveFailures++;
      this.health.errorRate =
        (this.health.errorRate * (this.health.requestCount - 1) + 1) /
        this.health.requestCount;
    } else {
      this.health.consecutiveFailures = 0;
      this.health.errorRate =
        (this.health.errorRate * (this.health.requestCount - 1)) /
        this.health.requestCount;
    }

    // Update uptime
    this.health.uptime = Date.now() - this.health.lastCheck;
  }

  private checkCircuitBreaker(): void {
    if (this.health.consecutiveFailures >= this.config.circuitBreakerThreshold) {
      this.openCircuitBreaker();
    }
  }

  private openCircuitBreaker(): void {
    const backoffMs = Math.min(
      60000 * Math.pow(2, Math.floor(this.health.consecutiveFailures / this.config.circuitBreakerThreshold)),
      300000 // Max 5 minutes
    );
    this.circuitBreakerOpenUntil = Date.now() + backoffMs;
    this.health.circuitBreakerOpen = true;
    this.health.status = ProviderStatus.UNHEALTHY;

    logger.warn(`Circuit breaker opened for ${this.config.name}`, {
      consecutiveFailures: this.health.consecutiveFailures,
      backoffMs
    });
  }

  private closeCircuitBreaker(): void {
    delete (this as unknown as { circuitBreakerOpenUntil?: number }).circuitBreakerOpenUntil;
    this.health.circuitBreakerOpen = false;

    if (this.health.errorRate < 0.1) {
      this.health.status = ProviderStatus.READY;
    } else {
      this.health.status = ProviderStatus.DEGRADED;
    }
  }

  private isCircuitBreakerOpen(): boolean {
    if (!this.circuitBreakerOpenUntil) return false;

    if (Date.now() > this.circuitBreakerOpenUntil) {
      // Try to close circuit breaker
      this.closeCircuitBreaker();
      return false;
    }

    return true;
  }

  /**
   * Execute promise with timeout
   * ESLint Fix: Added braces to promise executor to avoid returning setTimeout result
   */
  private async withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        setTimeout(() => reject(new Error('Operation timeout')), timeoutMs);
      })
    ]);
  }
}
