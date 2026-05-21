/**
 * Retry Manager with Circuit Breaker
 * 
 * Provides resilience patterns for the unified parser system including:
 * - Exponential backoff retry logic
 * - Circuit breaker pattern
 * - Request queuing
 * - Rate limiting
 */

import { EventEmitter } from 'events';

// ============================================================================
// Types
// ============================================================================

export interface RetryOptions {
  maxRetries?: number;
  initialDelay?: number;
  maxDelay?: number;
  backoffMultiplier?: number;
  jitter?: boolean;
  retryOn?: (error: unknown) => boolean;
  onRetry?: (attempt: number, error: unknown) => void;
}

export interface CircuitBreakerOptions {
  threshold?: number;
  timeout?: number;
  resetTimeout?: number;
  monitoringPeriod?: number;
  onOpen?: (failures: number) => void;
  onClose?: () => void;
  onHalfOpen?: () => void;
}

export interface RateLimitOptions {
  maxRequests?: number;
  windowMs?: number;
  maxBurst?: number;
  onLimit?: () => void;
}

export interface QueueOptions {
  maxSize?: number;
  maxConcurrency?: number;
  timeout?: number;
  priority?: boolean;
}

export enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN'
}

interface QueueItem<T> {
  id: string;
  fn: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (error: unknown) => void;
  priority: number;
  timestamp: number;
  retries: number;
}

// ============================================================================
// Retry Manager Implementation
// ============================================================================

export class RetryManager extends EventEmitter {
  private circuitState: CircuitState = CircuitState.CLOSED;
  private failures: number = 0;
  private lastFailureTime: number = 0;
  private successCount: number = 0;
  private requestQueue: QueueItem<unknown>[] = [];
  private activeRequests: Map<string, QueueItem<unknown>> = new Map();
  private rateLimitBuckets: Map<string, number[]> = new Map();
  private monitoringIntervals: NodeJS.Timeout[] = [];
  private metrics: {
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    retriedRequests: number;
    queuedRequests: number;
    circuitOpenCount: number;
    rateLimitedCount: number;
  };

  constructor(
    private retryOptions: RetryOptions = {},
    private circuitBreakerOptions: CircuitBreakerOptions = {},
    private rateLimitOptions: RateLimitOptions = {},
    private queueOptions: QueueOptions = {}
  ) {
    super();
    
    // Default retry options
    this.retryOptions = {
      maxRetries: 3,
      initialDelay: 1000,
      maxDelay: 30000,
      backoffMultiplier: 2,
      jitter: true,
      ...retryOptions
    };

    // Default circuit breaker options
    this.circuitBreakerOptions = {
      threshold: 5,
      timeout: 60000,
      resetTimeout: 30000,
      monitoringPeriod: 120000,
      ...circuitBreakerOptions
    };

    // Default rate limit options
    this.rateLimitOptions = {
      maxRequests: 100,
      windowMs: 60000,
      maxBurst: 10,
      ...rateLimitOptions
    };

    // Default queue options
    this.queueOptions = {
      maxSize: 1000,
      maxConcurrency: 5,
      timeout: 30000,
      priority: false,
      ...queueOptions
    };

    this.metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      retriedRequests: 0,
      queuedRequests: 0,
      circuitOpenCount: 0,
      rateLimitedCount: 0
    };

    // Start monitoring
    this.startMonitoring();
  }

  /**
   * Execute a function with retry logic and circuit breaker
   */
  async execute<T>(
    fn: () => Promise<T>,
    options: Partial<RetryOptions> = {}
  ): Promise<T> {
    this.metrics.totalRequests++;

    // Check circuit breaker
    if (!this.canExecute()) {
      this.metrics.circuitOpenCount++;
      throw new Error(`Circuit breaker is ${this.circuitState}`);
    }

    // Check rate limit
    if (!this.checkRateLimit()) {
      this.metrics.rateLimitedCount++;
      if (this.queueOptions.maxSize && this.requestQueue.length < this.queueOptions.maxSize) {
        return this.enqueue(fn);
      }
      throw new Error('Rate limit exceeded');
    }

    // Execute with retry
    return this.executeWithRetry(fn, { ...this.retryOptions, ...options });
  }

  /**
   * Execute with retry logic
   */
  private async executeWithRetry<T>(
    fn: () => Promise<T>,
    options: RetryOptions,
    attempt: number = 0
  ): Promise<T> {
    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error: unknown) {const errorMessage = error instanceof Error ? error.message : String(error);
this.onFailure(errorMessage);

      // Check if we should retry
      if (attempt >= (options.maxRetries ?? 3)) {
        this.metrics.failedRequests++;
        throw new Error(errorMessage);
      }

      // Check if error is retryable
      if (options.retryOn && !options.retryOn(error)) {
        this.metrics.failedRequests++;
        throw error;
      }

      // Calculate delay with exponential backoff
      const delay = this.calculateDelay(attempt, options);
      
      // Call retry callback
      if (options.onRetry) {
        options.onRetry(attempt + 1, error);
      }

      this.metrics.retriedRequests++;
      this.emit('retry', { attempt: attempt + 1, delay, error });

      // Wait and retry
      await this.sleep(delay);
      return this.executeWithRetry(fn, options, attempt + 1);
    }
  }

  /**
   * Enqueue a request
   */
  private async enqueue<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      const item: QueueItem<T> = {
        id: this.generateId(),
        fn,
        resolve,
        reject,
        priority: 0,
        timestamp: Date.now(),
        retries: 0
      };

      (this.requestQueue as QueueItem<T>[]).push(item);
      this.metrics.queuedRequests++;
      this.emit('queued', { id: item["id"], queueSize: this.requestQueue.length });

      void this.processQueue();
    });
  }

  /**
   * Process queued requests
   */
  private async processQueue(): Promise<void> {
    // Check if we can process more requests
    if (this.activeRequests.size >= (this.queueOptions.maxConcurrency ?? 5)) {
      return;
    }

    // Get next item from queue
    const item = this.requestQueue.shift();
    if (!item) {
      return;
    }

    // Check timeout
    if (Date.now() - item.timestamp > (this.queueOptions.timeout ?? 30000)) {
      item.reject(new Error('Queue timeout'));
      this.emit('timeout', { id: item["id"] });
      void this.processQueue();
      return;
    }

    // Process the item
    this.activeRequests.set(item["id"], item);
    
    try {
      const result = await this.execute(item.fn);
      item.resolve(result);
      this.emit('completed', { id: item["id"] });
    } catch (error: unknown) {const errorMessage = error instanceof Error ? error.message : String(error);
item.reject(errorMessage);
      this.emit('failed', { id: item["id"], errorMessage });
    } finally {
      this.activeRequests.delete(item["id"]);
      void this.processQueue();
    }
  }

  /**
   * Check if request can be executed (circuit breaker)
   */
  private canExecute(): boolean {
    switch (this.circuitState) {
      case CircuitState.CLOSED:
        return true;
      
      case CircuitState.OPEN:
        // Check if enough time has passed to try again
        if (Date.now() - this.lastFailureTime > (this.circuitBreakerOptions.resetTimeout ?? 30000)) {
          this.circuitState = CircuitState.HALF_OPEN;
          if (this.circuitBreakerOptions.onHalfOpen) {
            this.circuitBreakerOptions.onHalfOpen();
          }
          this.emit('circuit-half-open');
          return true;
        }
        return false;
      
      case CircuitState.HALF_OPEN:
        return true;
      
      default:
        return true;
    }
  }

  /**
   * Check rate limit
   */
  private checkRateLimit(bucket: string = 'default'): boolean {
    const now = Date.now();
    const windowMs = this.rateLimitOptions.windowMs ?? 60000;
    const MAX_BUCKETS = 500;

    // Get or create bucket
    let timestamps = this.rateLimitBuckets.get(bucket) ?? [];

    // Remove old timestamps
    timestamps = timestamps.filter(t => now - t < windowMs);

    // Check if limit exceeded
    if (timestamps.length >= (this.rateLimitOptions.maxRequests ?? 100)) {
      return false;
    }

    // Enforce max bucket count — evict oldest bucket if at capacity
    if (!this.rateLimitBuckets.has(bucket) && this.rateLimitBuckets.size >= MAX_BUCKETS) {
      const oldestKey = this.rateLimitBuckets.keys().next().value;
      if (oldestKey !== undefined) {
        this.rateLimitBuckets.delete(oldestKey);
      }
    }

    // Add current timestamp
    timestamps.push(now);
    this.rateLimitBuckets.set(bucket, timestamps);

    return true;
  }

  /**
   * Handle successful execution
   */
  private onSuccess(): void {
    this.metrics.successfulRequests++;
    this.successCount++;
    
    if (this.circuitState === CircuitState.HALF_OPEN) {
      // Close circuit after successful request in half-open state
      this.circuitState = CircuitState.CLOSED;
      this.failures = 0;
      if (this.circuitBreakerOptions.onClose) {
        this.circuitBreakerOptions.onClose();
      }
      this.emit('circuit-closed');
    }
  }

  /**
   * Handle failed execution
   */
  private onFailure(_error: unknown): void {
    this.failures++;
    this.lastFailureTime = Date.now();
    
    // Check if we should open the circuit
    if (this.failures >= (this.circuitBreakerOptions.threshold ?? 5)) {
      if (this.circuitState !== CircuitState.OPEN) {
        this.circuitState = CircuitState.OPEN;
        if (this.circuitBreakerOptions.onOpen) {
          this.circuitBreakerOptions.onOpen(this.failures);
        }
        this.emit('circuit-open', { failures: this.failures });
      }
    }
    
    // If in half-open state, reopen the circuit
    if (this.circuitState === CircuitState.HALF_OPEN) {
      this.circuitState = CircuitState.OPEN;
      this.emit('circuit-open', { failures: this.failures });
    }
  }

  /**
   * Calculate retry delay with exponential backoff
   */
  private calculateDelay(attempt: number, options: RetryOptions): number {
    const initialDelay = options.initialDelay ?? 1000;
    const maxDelay = options.maxDelay ?? 30000;
    const multiplier = options.backoffMultiplier ?? 2;
    
    // Calculate exponential delay
    let delay = initialDelay * Math.pow(multiplier, attempt);
    
    // Apply max delay cap
    delay = Math.min(delay, maxDelay);
    
    // Add jitter if enabled
    if (options.jitter) {
      const jitter = Math.random() * delay * 0.1; // 10% jitter
      delay = delay + jitter;
    }
    
    return Math.floor(delay);
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => {
      setTimeout(resolve, ms);
    });
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Start monitoring and cleanup
   */
  private startMonitoring(): void {
    // Periodic cleanup of rate limit buckets
    this.monitoringIntervals.push(setInterval(() => {
      const now = Date.now();
      const windowMs = this.rateLimitOptions.windowMs ?? 60000;

      this.rateLimitBuckets.forEach((timestamps, bucket) => {
        const filtered = timestamps.filter(t => now - t < windowMs);
        if (filtered.length === 0) {
          this.rateLimitBuckets.delete(bucket);
        } else {
          this.rateLimitBuckets.set(bucket, filtered);
        }
      });
    }, 60000)); // Clean up every minute

    // Reset circuit breaker metrics periodically
    this.monitoringIntervals.push(setInterval(() => {
      const monitoringPeriod = this.circuitBreakerOptions.monitoringPeriod ?? 120000;
      if (Date.now() - this.lastFailureTime > monitoringPeriod) {
        this.failures = Math.max(0, this.failures - 1);
      }
    }, 30000)); // Check every 30 seconds
  }

  /**
   * Get current metrics
   */
  getMetrics(): {
    circuitState: CircuitState;
    queueSize: number;
    activeRequests: number;
    failures: number;
    successRate: number;
    [key: string]: unknown;
  } {
    return {
      ...this.metrics,
      circuitState: this.circuitState,
      queueSize: this.requestQueue.length,
      activeRequests: this.activeRequests.size,
      failures: this.failures,
      successRate: this.metrics.totalRequests > 0
        ? this.metrics.successfulRequests / this.metrics.totalRequests
        : 0
    };
  }

  /**
   * Reset circuit breaker
   */
  resetCircuit(): void {
    this.circuitState = CircuitState.CLOSED;
    this.failures = 0;
    this.lastFailureTime = 0;
    this.emit('circuit-reset');
  }

  /**
   * Clear queue
   */
  clearQueue(): void {
    const count = this.requestQueue.length;
    this.requestQueue.forEach(item => {
      item.reject(new Error('Queue cleared'));
    });
    this.requestQueue = [];
    this.emit('queue-cleared', { count });
  }

  /**
   * Destroy the manager and release all resources.
   * Clears monitoring intervals, rate limit buckets, and event listeners.
   */
  destroy(): void {
    for (const interval of this.monitoringIntervals) {
      clearInterval(interval);
    }
    this.monitoringIntervals = [];
    this.rateLimitBuckets.clear();
    this.activeRequests.clear();
    this.requestQueue = [];
    this.removeAllListeners();
  }

  /**
   * Update options dynamically
   */
  updateOptions(options: {
    retry?: Partial<RetryOptions>;
    circuitBreaker?: Partial<CircuitBreakerOptions>;
    rateLimit?: Partial<RateLimitOptions>;
    queue?: Partial<QueueOptions>;
  }): void {
    if (options.retry) {
      Object.assign(this.retryOptions, options.retry);
    }
    if (options.circuitBreaker) {
      Object.assign(this.circuitBreakerOptions, options.circuitBreaker);
    }
    if (options.rateLimit) {
      Object.assign(this.rateLimitOptions, options.rateLimit);
    }
    if (options.queue) {
      Object.assign(this.queueOptions, options.queue);
    }
    this.emit('options-updated', options);
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a retry manager with default settings
 */
export function createRetryManager(options?: {
  retry?: Partial<RetryOptions>;
  circuitBreaker?: Partial<CircuitBreakerOptions>;
  rateLimit?: Partial<RateLimitOptions>;
  queue?: Partial<QueueOptions>;
}): RetryManager {
  return new RetryManager(
    options?.retry,
    options?.circuitBreaker,
    options?.rateLimit,
    options?.queue
  );
}

/**
 * Create a retry wrapper function
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options?: RetryOptions
): Promise<T> {
  const manager = new RetryManager(options);
  try {
    return await manager.execute(fn);
  } finally {
    manager.destroy();
  }
}

/**
 * Create a circuit breaker wrapper
 */
export async function withCircuitBreaker<T>(
  fn: () => Promise<T>,
  options?: CircuitBreakerOptions
): Promise<T> {
  const manager = new RetryManager({}, options);
  try {
    return await manager.execute(fn);
  } finally {
    manager.destroy();
  }
}