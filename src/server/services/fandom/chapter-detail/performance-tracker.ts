/**
 * Chapter Detail Service - Performance Tracker
 *
 * Tracks performance metrics and dynamically adjusts request rates
 * based on server response times and error rates.
 *
 * Features:
 * - Adaptive rate limiting (batch size and delay adjustment)
 * - Performance telemetry (response times, throughput, percentiles)
 * - Error rate tracking
 * - Cache hit tracking
 * - Detailed logging for monitoring
 *
 * @module chapter-detail/performance-tracker
 */

import { logger } from '@/utils/logger';

import { PERFORMANCE_DEFAULTS } from './constants';

import type { PerformanceTelemetry } from './types';

/**
 * Performance Tracker for Chapter Detail Service
 *
 * Implements adaptive rate limiting and comprehensive performance monitoring
 * for batch chapter detail fetching operations.
 *
 * Rate Adjustment Strategy:
 * - Increases load when server responds quickly and errors are low
 * - Decreases load when errors increase or response times degrade
 * - Uses exponential backoff for error recovery
 *
 * @example
 * ```typescript
 * const tracker = new PerformanceTracker();
 * tracker.initTelemetry(100); // Start tracking 100 requests
 *
 * // During batch processing
 * tracker.recordBatch(batchSize, batchDuration);
 * tracker.adjustRate(avgResponseTime, hadErrors);
 *
 * // After completion
 * tracker.finalizeTelemetry();
 * const metrics = tracker.getTelemetry();
 * ```
 */
export class PerformanceTracker {
  // Current rate settings (dynamically adjusted)
  private currentBatchSize: number = PERFORMANCE_DEFAULTS.batchSize;
  private currentDelayMs: number = PERFORMANCE_DEFAULTS.delayMs;

  // Performance tracking
  private recentResponseTimes: number[] = [];
  private allResponseTimes: number[] = [];
  private errorRate = 0;
  private consecutiveErrors = 0;

  // Telemetry
  private telemetry: PerformanceTelemetry | null = null;

  /**
   * Get current batch size (dynamically adjusted: 10-100 requests)
   */
  getBatchSize(): number {
    return this.currentBatchSize;
  }

  /**
   * Get current delay between batches (dynamically adjusted: 25-500ms)
   */
  getDelayMs(): number {
    return this.currentDelayMs;
  }

  /**
   * Get performance telemetry (null if not initialized)
   */
  getTelemetry(): PerformanceTelemetry | null {
    return this.telemetry;
  }

  /**
   * Initialize telemetry for new batch operation
   * @param totalRequests - Total number of requests to track
   */
  initTelemetry(totalRequests: number): void {
    this.telemetry = {
      startTime: Date.now(),
      totalRequests,
      successfulRequests: 0,
      failedRequests: 0,
      cacheHits: 0,
      batchSizes: [],
      delays: [],
      circuitBreakerTrips: 0
    };
    this.allResponseTimes = [];
  }

  /**
   * Record successful request
   */
  recordSuccess(): void {
    if (this.telemetry) {
      this.telemetry.successfulRequests++;
    }
  }

  /**
   * Record failed request
   * @param isCircuitBreaker - Whether failure was due to circuit breaker
   */
  recordFailure(isCircuitBreaker: boolean = false): void {
    if (this.telemetry) {
      this.telemetry.failedRequests++;
      if (isCircuitBreaker) {
        this.telemetry.circuitBreakerTrips++;
      }
    }
  }

  /**
   * Record cache hit
   */
  recordCacheHit(): void {
    if (this.telemetry) {
      this.telemetry.cacheHits++;
    }
  }

  /**
   * Record batch execution
   * @param batchSize - Number of requests in the batch
   * @param duration - Total duration of batch execution (milliseconds)
   */
  recordBatch(batchSize: number, duration: number): void {
    if (this.telemetry) {
      this.telemetry.batchSizes.push(batchSize);
      this.telemetry.delays.push(this.currentDelayMs);
    }

    const avgTimePerRequest = duration / batchSize;
    this.allResponseTimes.push(avgTimePerRequest);
  }

  /**
   * Dynamically adjust rate based on server response
   *
   * Implements adaptive rate limiting based on:
   * - Response times (slow = reduce load, fast = increase load)
   * - Error rates (high errors = back off aggressively)
   * - Consecutive failures (circuit breaker-like behavior)
   *
   * Adjustment Rules:
   * - High errors (3+ consecutive or 30%+ rate): Reduce batch 50%, increase delay 2x
   * - Slow responses (>5s): Reduce batch 25%, increase delay 1.5x
   * - Fast & stable (<1s, <10% errors): Increase batch 10%, reduce delay 10%
   *
   * @param responseTime - Average response time for the request (milliseconds)
   * @param hasError - Whether the request had errors
   */
  adjustRate(responseTime: number, hasError: boolean): void {
    // Track response times (keep last 10 for moving average)
    this.recentResponseTimes.push(responseTime);
    if (this.recentResponseTimes.length > 10) {
      this.recentResponseTimes.shift();
    }

    // Update error tracking
    if (hasError) {
      this.consecutiveErrors++;
      this.errorRate = Math.min(1, this.errorRate + 0.1);
    } else {
      this.consecutiveErrors = 0;
      this.errorRate = Math.max(0, this.errorRate - 0.05);
    }

    // Calculate average response time
    const avgResponseTime = this.recentResponseTimes.reduce((a, b) => a + b, 0) / this.recentResponseTimes.length;

    // Adjust batch size and delay based on performance
    if (this.consecutiveErrors >= 3 || this.errorRate > 0.3) {
      // Too many errors - back off aggressively
      this.currentBatchSize = Math.max(10, Math.floor(this.currentBatchSize * 0.5));
      this.currentDelayMs = Math.min(500, this.currentDelayMs * 2);
      logger.warn(`High error rate detected. Reducing batch size to ${this.currentBatchSize}, increasing delay to ${this.currentDelayMs}ms`);
    } else if (avgResponseTime > 5000) {
      // Server is slow - reduce load
      this.currentBatchSize = Math.max(20, Math.floor(this.currentBatchSize * 0.75));
      this.currentDelayMs = Math.min(300, Math.floor(this.currentDelayMs * 1.5));
      logger.info(`Slow server response (${avgResponseTime.toFixed(0)}ms). Adjusting batch size to ${this.currentBatchSize}`);
    } else if (avgResponseTime < 1000 && this.errorRate < 0.1) {
      // Server is fast and stable - increase load
      this.currentBatchSize = Math.min(100, Math.floor(this.currentBatchSize * 1.1));
      this.currentDelayMs = Math.max(25, Math.floor(this.currentDelayMs * 0.9));
      logger.debug(`Good performance. Increasing batch size to ${this.currentBatchSize}`);
    }
  }

  /**
   * Finalize telemetry with calculated metrics
   *
   * Calculates percentiles (p95, p99), averages, throughput, and logs detailed telemetry.
   */
  finalizeTelemetry(): void {
    if (!this.telemetry) return;

    this.telemetry.endTime = Date.now();

    // Calculate percentiles and averages
    if (this.allResponseTimes.length > 0) {
      const sorted = [...this.allResponseTimes].sort((a, b) => a - b);
      this.telemetry.avgResponseTime = sorted.reduce((a, b) => a + b, 0) / sorted.length;

      const p95Index = Math.floor(sorted.length * 0.95);
      const p99Index = Math.floor(sorted.length * 0.99);

      const p95Value = sorted[p95Index];
      const p99Value = sorted[p99Index];

      if (p95Value !== undefined) {
        this.telemetry.p95ResponseTime = p95Value;
      }
      if (p99Value !== undefined) {
        this.telemetry.p99ResponseTime = p99Value;
      }

      const durationSeconds = (this.telemetry.endTime - this.telemetry.startTime) / 1000;
      this.telemetry.throughput = this.telemetry.totalRequests / durationSeconds;
    }

    // Log detailed telemetry
    logger.info('🎯 Performance Telemetry:', {
      duration: `${((this.telemetry.endTime - this.telemetry.startTime) / 1000).toFixed(2)}s`,
      totalRequests: this.telemetry.totalRequests,
      successful: this.telemetry.successfulRequests,
      failed: this.telemetry.failedRequests,
      cacheHits: `${this.telemetry.cacheHits} (${((this.telemetry.cacheHits / this.telemetry.totalRequests) * 100).toFixed(1)}%)`,
      throughput: `${this.telemetry.throughput?.toFixed(1)} req/s`,
      avgResponseTime: `${this.telemetry.avgResponseTime?.toFixed(0)}ms`,
      p95ResponseTime: `${this.telemetry.p95ResponseTime?.toFixed(0)}ms`,
      p99ResponseTime: `${this.telemetry.p99ResponseTime?.toFixed(0)}ms`,
      avgBatchSize: (this.telemetry.batchSizes.reduce((a, b) => a + b, 0) / this.telemetry.batchSizes.length).toFixed(1),
      circuitBreakerTrips: this.telemetry.circuitBreakerTrips
    });
  }
}
