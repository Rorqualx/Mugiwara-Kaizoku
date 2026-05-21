/**
 * Retry Utilities with Exponential Backoff
 * 
 * This module provides configurable retry logic with exponential backoff
 * for handling transient failures in API requests.
 * 
 * Features:
 * - Exponential backoff with configurable parameters
 * - Respect for Retry-After headers
 * - Customizable retry conditions
 * - Progress callbacks for monitoring
 * - Circuit breaker pattern support
 */

import { logger } from '@/utils/logger';

/**
 * HTTP error-like object with status code
 */
interface HttpErrorLike {
  status?: number;
  statusCode?: number;
  response?: {
    status?: number;
    statusCode?: number;
    headers?: Record<string, string | string[] | undefined>;
  };
  headers?: Record<string, string | string[] | undefined>;
}

/**
 * GraphQL error-like object
 */
interface GraphQLErrorLike {
  extensions?: {
    code?: string;
  };
  graphQLErrors?: Array<{
    extensions?: {
      code?: string;
    };
  }>;
  errors?: Array<{
    extensions?: {
      code?: string;
    };
  }>;
}

/**
 * Network error-like object
 */
interface NetworkErrorLike {
  code?: string;
  retryAfter?: number | string;
}

/**
 * Combined error type
 */
type ErrorLike = HttpErrorLike & GraphQLErrorLike & NetworkErrorLike;

/**
 * Type guard for error-like objects
 */
function isErrorLike(error: unknown): error is ErrorLike {
  return error !== null && typeof error === 'object';
}

/**
 * Configuration for retry behavior
 */
export interface RetryConfig {
  /**
   * Maximum number of retry attempts
   * @default 3
   */
  maxRetries?: number;
  
  /**
   * Initial delay in milliseconds before first retry
   * @default 1000
   */
  initialDelay?: number;
  
  /**
   * Maximum delay in milliseconds between retries
   * @default 30000
   */
  maxDelay?: number;
  
  /**
   * Factor to multiply delay by for each retry
   * @default 2
   */
  backoffFactor?: number;
  
  /**
   * HTTP status codes that should trigger a retry
   * @default [429, 503, 502, 504, 408]
   */
  retryableStatuses?: number[];
  
  /**
   * GraphQL error codes that should trigger a retry
   * @default ['RATE_LIMITED', 'INTERNAL_SERVER_ERROR', 'SERVICE_UNAVAILABLE']
   */
  retryableErrorCodes?: string[];
  
  /**
   * Whether to add random jitter to delay to prevent thundering herd
   * @default true
   */
  useJitter?: boolean;
  
  /**
   * Maximum jitter as a percentage of the delay (0.0 to 1.0)
   * @default 0.2
   */
  maxJitterFactor?: number;
  
  /**
   * Callback function called before each retry
   */
  onRetry?: (attempt: number, error: unknown, nextDelay: number) => void;
  
  /**
   * Callback function to determine if an error should be retried
   * Return false to stop retrying
   */
  shouldRetry?: (error: unknown, attempt: number) => boolean;
  
  /**
   * Enable debug logging
   * @default false
   */
  debug?: boolean;
}

/**
 * Default retry configuration
 */
export const DEFAULT_RETRY_CONFIG: Required<Omit<RetryConfig, 'onRetry' | 'shouldRetry'>> = {
  maxRetries: 3,
  initialDelay: 1000,
  maxDelay: 30000,
  backoffFactor: 2,
  retryableStatuses: [429, 503, 502, 504, 408],
  retryableErrorCodes: ['RATE_LIMITED', 'INTERNAL_SERVER_ERROR', 'SERVICE_UNAVAILABLE'],
  useJitter: true,
  maxJitterFactor: 0.2,
  debug: false
};

/**
 * Extracts status code from various error formats
 */
function getErrorStatus(error: unknown): number | undefined {
  if (!isErrorLike(error)) return undefined;
  return error.status ??
         error.response?.status ??
         error.statusCode ??
         error.response?.statusCode;
}

/**
 * Extracts GraphQL error code from error
 */
function getGraphQLErrorCode(error: unknown): string | undefined {
  if (!isErrorLike(error)) return undefined;
  return error.extensions?.code ??
         error.graphQLErrors?.[0]?.extensions?.code ??
         error.errors?.[0]?.extensions?.code;
}

/**
 * Extracts Retry-After header value in milliseconds
 */
function getRetryAfterMs(error: unknown): number | undefined {
  if (!isErrorLike(error)) return undefined;

  const retryAfter = error.headers?.['retry-after'] ??
                     error.response?.headers?.['retry-after'] ??
                     error.retryAfter;

  if (!retryAfter) return undefined;

  // If it's already a number, assume it's seconds
  if (typeof retryAfter === 'number') {
    return retryAfter * 1000;
  }

  // If it's a string number, parse as seconds
  if (typeof retryAfter === 'string' && /^\d+$/.test(retryAfter)) {
    return parseInt(retryAfter, 10) * 1000;
  }

  // If it's an HTTP date, calculate delay
  if (typeof retryAfter === 'string') {
    const retryDate = new Date(retryAfter);
    if (!isNaN(retryDate.getTime())) {
      return Math.max(0, retryDate.getTime() - Date.now());
    }
  }

  return undefined;
}

/**
 * Calculates delay with optional jitter
 */
function calculateDelay(
  baseDelay: number,
  useJitter: boolean,
  maxJitterFactor: number
): number {
  if (!useJitter) return baseDelay;
  
  // Add random jitter up to maxJitterFactor
  const jitter = Math.random() * maxJitterFactor * baseDelay;
  return Math.floor(baseDelay + jitter);
}

/**
 * Determines if an error should be retried based on configuration
 */
function isRetryableError(
  error: unknown,
  config: Required<Omit<RetryConfig, 'onRetry' | 'shouldRetry'>>,
  customShouldRetry?: (error: unknown, attempt: number) => boolean,
  attempt: number = 0
): boolean {
  // Check custom retry condition first
  if (customShouldRetry) {
    // If custom function explicitly returns false, don't retry
    if (customShouldRetry(error, attempt) === false) {
      return false;
    }
    // If true, continue with other checks below
  }
  
  // Check HTTP status codes
  const status = getErrorStatus(error);
  if (status) {
    // If we have a status code, only retry if it's in the retryable list
    return config.retryableStatuses.includes(status);
  }
  
  // Check GraphQL error codes
  const errorCode = getGraphQLErrorCode(error);
  if (errorCode && config.retryableErrorCodes.includes(errorCode)) {
    return true;
  }
  
  // Check for network errors (no response)
  if (isErrorLike(error)) {
    const code = error.code;
    if (code === 'ECONNABORTED' ||
        code === 'ECONNRESET' ||
        code === 'ETIMEDOUT' ||
        code === 'ENOTFOUND') {
      return true;
    }
  }
  
  // If no status code and not a network error, check if it's a generic error
  // For generic errors without status codes, we'll retry them by default
  // unless we have a custom shouldRetry that said no
  if (!status && !errorCode && error instanceof Error) {
    return true;
  }
  
  // Default: don't retry
  return false;
}

/**
 * Retries a function with exponential backoff
 * 
 * @param fn - The async function to retry
 * @param config - Retry configuration
 * @returns Promise that resolves to the function's result
 * @throws The last error if all retries fail
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  config: RetryConfig = {}
): Promise<T> {
  const fullConfig = { ...DEFAULT_RETRY_CONFIG, ...config };
  const { 
    maxRetries, 
    initialDelay, 
    maxDelay, 
    backoffFactor,
    useJitter,
    maxJitterFactor,
    onRetry,
    shouldRetry,
    debug
  } = fullConfig;
  
  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // Try to execute the function
      // eslint-disable-next-line no-await-in-loop -- Sequential retry attempts are intentional
      const result = await fn();
      
      // Success! Log if this was a retry
      if (attempt > 0 && debug) {
        logger.info('[Retry] Request succeeded after retry', {
          attempt,
          totalAttempts: attempt + 1
        });
      }
      
      return result;
    } catch (error: unknown) {
      lastError = error;
      
      // Check if we should retry
      const isRetryable = isRetryableError(error, fullConfig, shouldRetry, attempt);
      
      // If not retryable or we've exhausted retries, throw
      if (!isRetryable || attempt === maxRetries) {
        if (debug && attempt > 0) {
          logger.error('[Retry] All retry attempts failed', {
            attempts: attempt + 1,
            lastError: error instanceof Error ? error.message : String(error)
          });
        }
        throw error;
      }
      
      // Calculate delay for next retry
      let delay = initialDelay * Math.pow(backoffFactor, attempt);
      
      // Check for Retry-After header
      const retryAfterMs = getRetryAfterMs(error);
      if (retryAfterMs !== undefined) {
        delay = retryAfterMs;
        if (debug) {
          logger.info('[Retry] Using Retry-After header', {
            retryAfter: retryAfterMs / 1000
          });
        }
      }
      
      // Cap at maxDelay
      delay = Math.min(delay, maxDelay);
      
      // Apply jitter if configured
      delay = calculateDelay(delay, useJitter, maxJitterFactor);
      
      // Call retry callback if provided
      if (onRetry) {
        onRetry(attempt + 1, error, delay);
      }
      
      // Log retry attempt
      if (debug) {
        const status = getErrorStatus(error);
        const errorCode = getGraphQLErrorCode(error);
        
        logger.warn('[Retry] Request failed, will retry', {
          attempt: attempt + 1,
          maxRetries,
          delay: delay / 1000,
          status,
          errorCode,
          error: error instanceof Error ? error.message : String(error)
        });
      }
      
      // Wait before retrying
      // eslint-disable-next-line no-await-in-loop -- Delay between retries is intentional
      await new Promise(resolve => {
        setTimeout(resolve, delay);
      });
    }
  }
  
  // This should never be reached, but TypeScript needs it
  throw lastError;
}

/**
 * Creates a retry function with preset configuration
 * Useful for creating service-specific retry functions
 */
export function createRetryFunction(defaultConfig: RetryConfig): <T>(fn: () => Promise<T>, overrideConfig?: RetryConfig) => Promise<T> {
  return <T>(fn: () => Promise<T>, overrideConfig?: RetryConfig): Promise<T> => {
    return retryWithBackoff(fn, { ...defaultConfig, ...overrideConfig });
  };
}

/**
 * Circuit breaker state for preventing cascading failures
 */
export class CircuitBreaker {
  private failures: number = 0;
  private lastFailureTime: number = 0;
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';
  
  constructor(
    private readonly threshold: number = 5,
    private readonly timeout: number = 60000,
    private readonly onStateChange?: (state: string) => void
  ) {}
  
  /**
   * Records a success and potentially closes the circuit
   */
  public recordSuccess(): void {
    if (this.state === 'HALF_OPEN') {
      this.reset();
    }
  }
  
  /**
   * Records a failure and potentially opens the circuit
   */
  public recordFailure(): void {
    this.failures++;
    this.lastFailureTime = Date.now();
    
    if (this.failures >= this.threshold && this.state !== 'OPEN') {
      this.setState('OPEN');
    }
  }
  
  /**
   * Checks if a request should be allowed
   */
  public shouldAllowRequest(): boolean {
    if (this.state === 'CLOSED') return true;
    
    if (this.state === 'OPEN') {
      // Check if timeout has passed
      if (Date.now() - this.lastFailureTime > this.timeout) {
        this.setState('HALF_OPEN');
        return true;
      }
      return false;
    }
    
    // HALF_OPEN - allow one request to test
    return true;
  }
  
  /**
   * Resets the circuit breaker
   */
  public reset(): void {
    this.failures = 0;
    this.lastFailureTime = 0;
    this.setState('CLOSED');
  }
  
  /**
   * Gets current circuit breaker state
   */
  public getState(): string {
    return this.state;
  }
  
  private setState(state: 'CLOSED' | 'OPEN' | 'HALF_OPEN'): void {
    const oldState = this.state;
    this.state = state;
    
    if (oldState !== state && this.onStateChange) {
      this.onStateChange(state);
    }
  }
}

/**
 * Wraps a function with circuit breaker protection
 */
export function withCircuitBreaker<T>(
  fn: () => Promise<T>,
  circuitBreaker: CircuitBreaker
): Promise<T> {
  if (!circuitBreaker.shouldAllowRequest()) {
    return Promise.reject(new Error('Circuit breaker is OPEN'));
  }
  
  return fn()
    .then(result => {
      circuitBreaker.recordSuccess();
      return result;
    })
    .catch(error => {
      circuitBreaker.recordFailure();
      throw error;
    });
}