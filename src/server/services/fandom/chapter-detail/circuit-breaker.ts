/**
 * Chapter Detail Service - Circuit Breaker
 *
 * Implements the circuit breaker pattern for fault tolerance.
 * Prevents cascading failures by temporarily stopping requests
 * when the Fandom service is unhealthy.
 *
 * Circuit breaker states:
 * - CLOSED: Normal operation, requests are allowed
 * - OPEN: Service is failing, reject all requests immediately
 * - HALF_OPEN: Testing if service has recovered, allow limited requests
 *
 * The circuit opens after a threshold of consecutive failures,
 * then transitions to HALF_OPEN after a timeout period to test recovery.
 * If recovery tests succeed, the circuit closes. If they fail, it reopens.
 *
 * @module chapter-detail/circuit-breaker
 */

import { logger } from '@/utils/logger';

import { CIRCUIT_BREAKER_CONFIG } from './constants';
import { CircuitState } from './types';

/**
 * Circuit Breaker Implementation
 *
 * Protects against cascading failures by tracking request success/failure
 * and automatically opening the circuit when failure threshold is exceeded.
 *
 * @example
 * ```typescript
 * const breaker = new CircuitBreaker();
 *
 * // Before making request
 * if (!breaker.check()) {
 *   console.log('Circuit is open, skipping request');
 *   return null;
 * }
 *
 * // After request completes
 * try {
 *   const result = await fetchData();
 *   breaker.update(true); // Success
 *   return result;
 * } catch (error) {
 *   breaker.update(false); // Failure
 *   throw error;
 * }
 * ```
 */
export class CircuitBreaker {
  /** Current circuit state */
  private state: CircuitState = CircuitState.CLOSED;

  /** Count of consecutive failures */
  private failures = 0;

  /** Count of consecutive successes (in HALF_OPEN state) */
  private successes = 0;

  /** Timestamp when circuit was opened (milliseconds since epoch) */
  private openTime = 0;

  /** Number of failures before opening circuit */
  private readonly threshold = CIRCUIT_BREAKER_CONFIG.threshold;

  /** Milliseconds to wait before testing recovery */
  private readonly timeout = CIRCUIT_BREAKER_CONFIG.timeout;

  /** Number of successes needed to close circuit */
  private readonly recoveryThreshold = CIRCUIT_BREAKER_CONFIG.recoveryThreshold;

  /**
   * Get current circuit breaker state
   *
   * @returns Current state (CLOSED, OPEN, or HALF_OPEN)
   */
  getState(): CircuitState {
    return this.state;
  }

  /**
   * Check if circuit breaker allows request
   *
   * Determines whether a request should be allowed based on circuit state.
   * In OPEN state, checks if timeout has elapsed and transitions to HALF_OPEN if so.
   *
   * @returns true if request is allowed, false if circuit is open
   */
  check(): boolean {
    switch (this.state) {
      case CircuitState.OPEN:
        // Check if timeout has passed
        if (Date.now() - this.openTime > this.timeout) {
          logger.info('Circuit breaker: Moving to HALF_OPEN state');
          this.state = CircuitState.HALF_OPEN;
          this.successes = 0;
          return true; // Allow limited requests
        }
        return false; // Reject request

      case CircuitState.HALF_OPEN:
        // Allow limited requests to test recovery
        return true;

      case CircuitState.CLOSED:
      default:
        return true; // Normal operation
    }
  }

  /**
   * Update circuit breaker state based on request result
   *
   * Records success or failure and transitions state accordingly:
   * - On success in HALF_OPEN: Increment success counter, close if threshold reached
   * - On success in CLOSED/OPEN: Reset failure counter
   * - On failure in HALF_OPEN: Immediately reopen circuit
   * - On failure in CLOSED: Increment failure counter, open if threshold reached
   *
   * @param success - Whether the request succeeded
   */
  update(success: boolean): void {
    if (success) {
      this.failures = 0;
      if (this.state === CircuitState.HALF_OPEN) {
        this.successes++;
        if (this.successes >= this.recoveryThreshold) {
          logger.info('Circuit breaker: Service recovered, closing circuit');
          this.state = CircuitState.CLOSED;
        }
      }
    } else {
      this.failures++;
      this.successes = 0;
      if (this.state === CircuitState.HALF_OPEN) {
        // Failed during recovery test - reopen immediately
        logger.warn('Circuit breaker: Recovery test failed, reopening circuit');
        this.state = CircuitState.OPEN;
        this.openTime = Date.now();
      } else if (this.failures >= this.threshold) {
        // Too many failures - open circuit
        logger.error(`Circuit breaker: Opening circuit after ${this.failures} failures`);
        this.state = CircuitState.OPEN;
        this.openTime = Date.now();
      }
    }
  }

  /**
   * Reset circuit breaker to closed state
   *
   * Manually resets all counters and closes the circuit.
   * Use this for administrative operations or after fixing underlying issues.
   */
  reset(): void {
    this.state = CircuitState.CLOSED;
    this.failures = 0;
    this.successes = 0;
    this.openTime = 0;
    logger.info('Circuit breaker: Manually reset to CLOSED state');
  }
}
