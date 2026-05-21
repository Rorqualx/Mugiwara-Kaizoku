// import { logger } from '../utils/logger';

import { toErrorType } from './async-result';

/**
 * Retry utility with exponential backoff
 */
export interface RetryOptions {
  maxAttempts?: number;
  delay?: number;
  maxDelay?: number;
  factor?: number;
  onRetry?: (error: Error, attempt: number) => void;
}
export async function withRetry<T>(fn: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
  const { maxAttempts = 3, delay = 1000, maxDelay = 10000, factor = 2, onRetry } = options;
  let lastError: Error | undefined;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      // eslint-disable-next-line no-await-in-loop -- Retry logic requires sequential execution
      return await fn();
    }
    catch (error: unknown) {
      lastError = toErrorType<Error>(error);
      if (attempt === maxAttempts) {
        throw lastError;
      }
      if (onRetry) {
        onRetry(lastError, attempt);
      }
      const waitTime = Math.min(delay * Math.pow(factor, attempt - 1), maxDelay);
      // eslint-disable-next-line no-await-in-loop -- Retry delay requires sequential execution
      await new Promise((resolve) => { void setTimeout(resolve, waitTime); });
    }
  }
  throw lastError ?? new Error('Retry failed: all attempts exhausted');
}
export function createRetryableFunction<T extends (...args: unknown[]) => Promise<unknown>>(fn: T, options?: RetryOptions): T {
  return (async (...args: Parameters<T>) => {
    return withRetry(() => fn(...args), options);
  }) as T;
}
export function getProviderRetryConfig(provider: string): RetryOptions {
  // Return specific retry configurations for different providers
  switch (provider) {
    case 'anilist':
      return {
        maxAttempts: 3,
        delay: 1000,
        maxDelay: 5000,
        factor: 2
      };
    case 'comicvine':
      return {
        maxAttempts: 2,
        delay: 2000,
        maxDelay: 10000,
        factor: 2
      };
    case 'fandom':
    case 'wikipedia':
      return {
        maxAttempts: 3,
        delay: 500,
        maxDelay: 3000,
        factor: 1.5
      };
    default:
      return {
        maxAttempts: 3,
        delay: 1000,
        maxDelay: 5000,
        factor: 2
      };
  }
}