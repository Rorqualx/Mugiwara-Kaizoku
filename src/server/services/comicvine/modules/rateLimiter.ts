/**
 * ComicVine API Rate Limiter
 * 
 * Implements strict rate limiting to comply with ComicVine's 200 requests/hour limit
 * and prevent IP blocks that last 24-72 hours.
 */

import { logger } from '@/utils/logger';

/**
 * Rate limit state for a specific resource
 */
interface RateLimitState {
  requestsThisHour: number;
  hourStartTime: number;
  lastRequestTime: number;
  backoffMultiplier: number;
  blockedUntil?: number;
  requestTimes: number[]; // Track individual request times for sliding window
}

/**
 * ComicVine rate limiter configuration
 */
export interface RateLimiterConfig {
  maxRequestsPerHour?: number;
  minDelayMs?: number;
  safeDelayMs?: number;
  maxDelayMs?: number;
  warningThreshold?: number; // Percentage of limit to trigger warnings
}

/**
 * ComicVine API Rate Limiter
 * 
 * Enforces strict rate limiting to prevent IP blocks:
 * - 200 requests per hour per resource
 * - Minimum 1 second between requests
 * - Recommended 2-3 seconds between requests
 * - Increases delay as limit approaches
 */
export class ComicVineRateLimiter {
  private state: Map<string, RateLimitState> = new Map();
  private globalState: RateLimitState;
  
  // Configuration with strict defaults based on guide
  private readonly MAX_REQUESTS_PER_HOUR: number;
  private readonly MIN_DELAY_MS: number;
  private readonly SAFE_DELAY_MS: number;
  private readonly MAX_DELAY_MS: number;
  private readonly WARNING_THRESHOLD: number;
  
  // Calculated values
  private readonly MS_PER_HOUR = 3600000;
  private readonly REQUESTS_PER_SECOND: number;
  
  constructor(config: RateLimiterConfig = {}) {
    this.MAX_REQUESTS_PER_HOUR = config.maxRequestsPerHour ?? 200;
    this.MIN_DELAY_MS = config.minDelayMs ?? 1000; // 1 second minimum
    this.SAFE_DELAY_MS = config.safeDelayMs ?? 2000; // 2 seconds recommended
    this.MAX_DELAY_MS = config.maxDelayMs ?? 5000; // 5 seconds when near limit
    this.WARNING_THRESHOLD = config.warningThreshold ?? 0.75; // Warn at 75% of limit
    
    // Calculate safe request rate
    this.REQUESTS_PER_SECOND = this.MAX_REQUESTS_PER_HOUR / 3600;
    
    // Initialize global state
    this.globalState = this.createInitialState();
    
    logger.info('ComicVine rate limiter initialized', {
      maxRequestsPerHour: this.MAX_REQUESTS_PER_HOUR,
      minDelayMs: this.MIN_DELAY_MS,
      safeDelayMs: this.SAFE_DELAY_MS,
      maxDelayMs: this.MAX_DELAY_MS
    });
  }
  
  /**
   * Create initial state for a resource
   */
  private createInitialState(): RateLimitState {
    return {
      requestsThisHour: 0,
      hourStartTime: Date.now(),
      lastRequestTime: 0,
      backoffMultiplier: 1,
      requestTimes: []
    };
  }
  
  /**
   * Get or create state for a resource
   */
  private getState(resource: string): RateLimitState {
    // Special case for 'global' - always use globalState
    if (resource === 'global') {
      return this.globalState;
    }

    if (!this.state.has(resource)) {
      this.state.set(resource, this.createInitialState());
    }
    const state = this.state.get(resource);
    if (!state) {
      throw new Error(`Failed to get or create state for resource: ${resource}`);
    }
    return state;
  }
  
  /**
   * Clean up old request times (older than 1 hour)
   */
  private cleanOldRequests(state: RateLimitState, now: number): void {
    const oneHourAgo = now - this.MS_PER_HOUR;
    state.requestTimes = state.requestTimes.filter(time => time > oneHourAgo);
    state.requestsThisHour = state.requestTimes.length;
  }
  
  /**
   * Calculate the required delay before the next request
   */
  public getDelayMs(resource: string = 'global'): number {
    const state = this.getState(resource);
    const now = Date.now();
    
    // Clean up old requests
    this.cleanOldRequests(state, now);
    
    // If blocked, return time until unblock
    if (state.blockedUntil && state.blockedUntil > now) {
      return state.blockedUntil - now;
    }
    
    // Calculate usage percentage
    const usagePercentage = state.requestsThisHour / this.MAX_REQUESTS_PER_HOUR;
    
    // Determine delay based on usage
    let delay: number;
    
    if (usagePercentage >= 0.95) {
      // At 95% of limit, use maximum delay
      delay = this.MAX_DELAY_MS;
    } else if (usagePercentage >= this.WARNING_THRESHOLD) {
      // Between warning threshold and 95%, scale up delay
      const scale = (usagePercentage - this.WARNING_THRESHOLD) / (0.95 - this.WARNING_THRESHOLD);
      delay = this.SAFE_DELAY_MS + (this.MAX_DELAY_MS - this.SAFE_DELAY_MS) * scale;
    } else if (usagePercentage >= 0.5) {
      // Between 50% and warning threshold, use safe delay
      delay = this.SAFE_DELAY_MS;
    } else {
      // Under 50%, use minimum delay
      delay = this.MIN_DELAY_MS;
    }
    
    // Apply backoff multiplier if we've been rate limited
    delay *= state.backoffMultiplier;
    
    // Ensure minimum time since last request
    const timeSinceLastRequest = now - state.lastRequestTime;
    if (timeSinceLastRequest < delay) {
      delay = delay - timeSinceLastRequest;
    } else {
      delay = 0; // Can proceed immediately
    }
    
    return Math.max(0, Math.round(delay));
  }
  
  /**
   * Acquire a slot for making a request
   * Waits if necessary to comply with rate limits
   */
  public async acquireSlot(resource: string = 'global'): Promise<void> {
    const state = this.getState(resource);
    const globalState = this.globalState;
    const now = Date.now();
    
    // Clean up old requests
    this.cleanOldRequests(state, now);
    this.cleanOldRequests(globalState, now);
    
    // Check if we're at the limit
    if (state.requestsThisHour >= this.MAX_REQUESTS_PER_HOUR) {
      const oldestRequest = state.requestTimes[0];
      if (oldestRequest === undefined) {
        // If no requests in array, reset and continue
        state.requestsThisHour = 0;
      } else {
        const waitTime = (oldestRequest + this.MS_PER_HOUR) - now;

        logger.warn('Rate limit reached for resource, waiting', {
          resource,
          requestsThisHour: state.requestsThisHour,
          waitTimeMs: waitTime
        });

        await this.sleep(waitTime);
        // Recursive call to re-check after waiting
        return this.acquireSlot(resource);
      }
    }
    
    // Check global limit as well
    if (globalState.requestsThisHour >= this.MAX_REQUESTS_PER_HOUR) {
      const oldestRequest = globalState.requestTimes[0];
      if (oldestRequest === undefined) {
        // If no requests in array, reset and continue
        globalState.requestsThisHour = 0;
      } else {
        const waitTime = (oldestRequest + this.MS_PER_HOUR) - now;

        logger.warn('Global rate limit reached, waiting', {
          requestsThisHour: globalState.requestsThisHour,
          waitTimeMs: waitTime
        });

        await this.sleep(waitTime);
        return this.acquireSlot(resource);
      }
    }
    
    // Calculate and apply delay
    const delay = this.getDelayMs(resource);
    if (delay > 0) {
      logger.debug('Rate limiter applying delay', {
        resource,
        delayMs: delay,
        requestsThisHour: state.requestsThisHour,
        usagePercentage: (state.requestsThisHour / this.MAX_REQUESTS_PER_HOUR * 100).toFixed(1) + '%'
      });
      
      await this.sleep(delay);
    }
    
    // Record the request
    const requestTime = Date.now();
    state.requestTimes.push(requestTime);
    state.requestsThisHour++;
    state.lastRequestTime = requestTime;
    
    // Also record in global state (but not if resource IS 'global' to avoid double counting)
    if (resource !== 'global') {
      globalState.requestTimes.push(requestTime);
      globalState.requestsThisHour++;
      globalState.lastRequestTime = requestTime;
    }
    
    // Log warning if approaching limit
    if (state.requestsThisHour >= this.MAX_REQUESTS_PER_HOUR * this.WARNING_THRESHOLD) {
      logger.warn('Approaching rate limit for resource', {
        resource,
        requestsThisHour: state.requestsThisHour,
        limit: this.MAX_REQUESTS_PER_HOUR,
        percentage: (state.requestsThisHour / this.MAX_REQUESTS_PER_HOUR * 100).toFixed(1) + '%'
      });
    }
  }
  
  /**
   * Handle a rate limit error from the API
   * Increases backoff and potentially blocks requests
   */
  public handleRateLimitError(resource: string = 'global', retryAfterSeconds?: number): void {
    const state = this.getState(resource);
    const now = Date.now();
    
    // Increase backoff multiplier
    state.backoffMultiplier = Math.min(state.backoffMultiplier * 2, 10);
    
    // If retry-after header is provided, use it
    if (retryAfterSeconds) {
      state.blockedUntil = now + (retryAfterSeconds * 1000);
    } else {
      // Default to 1 hour block
      state.blockedUntil = now + this.MS_PER_HOUR;
    }
    
    logger.error('Rate limit error detected, blocking requests', {
      resource,
      backoffMultiplier: state.backoffMultiplier,
      blockedUntil: new Date(state.blockedUntil).toISOString(),
      blockDurationMs: state.blockedUntil - now
    });
  }
  
  /**
   * Reset the backoff multiplier after successful requests
   */
  public resetBackoff(resource: string = 'global'): void {
    const state = this.getState(resource);
    
    if (state.backoffMultiplier > 1) {
      state.backoffMultiplier = Math.max(1, state.backoffMultiplier * 0.9);
      logger.debug('Reducing backoff multiplier', {
        resource,
        newMultiplier: state.backoffMultiplier
      });
    }
  }
  
  /**
   * Get current usage statistics
   */
  public getStats(resource?: string): {
    requestsThisHour: number;
    limit: number;
    usagePercentage: number;
    nextResetTime: Date;
    isBlocked: boolean;
    currentDelay: number;
  } {
    const state = resource === 'global' || !resource ? this.globalState : this.getState(resource);
    const now = Date.now();
    
    this.cleanOldRequests(state, now);

    const oldestRequest = state.requestTimes[0] ?? now;
    const nextResetTime = new Date(oldestRequest + this.MS_PER_HOUR);
    
    return {
      requestsThisHour: state.requestsThisHour,
      limit: this.MAX_REQUESTS_PER_HOUR,
      usagePercentage: (state.requestsThisHour / this.MAX_REQUESTS_PER_HOUR) * 100,
      nextResetTime,
      isBlocked: !!(state.blockedUntil && state.blockedUntil > now),
      currentDelay: this.getDelayMs(resource || 'global')
    };
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
   * Reset all rate limiting state (useful for testing)
   */
  public reset(): void {
    this.state.clear();
    this.globalState = this.createInitialState();
    logger.info('Rate limiter state reset');
  }
}