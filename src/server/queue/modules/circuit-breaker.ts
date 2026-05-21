/**
 * Circuit Breaker for Job Queue
 *
 * Tracks failures per job type/payload pattern and prevents re-queuing
 * jobs that repeatedly fail. This prevents resource waste on jobs that
 * are doomed to fail (e.g., scanning non-existent volumes).
 *
 * @module server/queue/modules/circuit-breaker
 */

import { logger } from '@/utils/logger';

// ============================================================================
// Types
// ============================================================================

export interface CircuitBreakerConfig {
  /** Number of failures before circuit opens (default: 5) */
  failureThreshold: number;
  /** Time in ms before circuit resets after opening (default: 5 min) */
  cooldownPeriod: number;
  /** Optional function to extract a key from job payload */
  patternExtractor?: (jobType: string, payload: unknown) => string;
}

interface CircuitState {
  failures: number;
  lastFailure: number;
  isOpen: boolean;
  firstFailure: number;
}

const DEFAULT_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 5,
  cooldownPeriod: 5 * 60 * 1000, // 5 minutes
};

// ============================================================================
// Circuit Breaker Implementation
// ============================================================================

/**
 * Circuit breaker to prevent repeatedly queuing jobs that fail
 */
export class CircuitBreaker {
  private readonly config: CircuitBreakerConfig;
  private readonly circuits: Map<string, CircuitState> = new Map();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(config: Partial<CircuitBreakerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };

    // Cleanup stale circuits every 10 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanupStaleCircuits();
    }, 10 * 60 * 1000);
  }

  /**
   * Generate a key for tracking failures
   */
  private getKey(jobType: string, payload: unknown): string {
    if (this.config.patternExtractor) {
      return this.config.patternExtractor(jobType, payload);
    }

    // Default: extract path from library scan jobs, otherwise use job type only
    if (jobType === 'library_scan' && payload && typeof payload === 'object') {
      const p = payload as Record<string, unknown>;
      if (typeof p['path'] === 'string') {
        return `${jobType}:path:${p['path']}`;
      }
      if (typeof p['libraryId'] === 'number') {
        return `${jobType}:library:${p['libraryId']}`;
      }
    }

    return `${jobType}:generic`;
  }

  /**
   * Check if circuit is open (should reject new jobs)
   */
  isOpen(jobType: string, payload: unknown): boolean {
    const key = this.getKey(jobType, payload);
    const state = this.circuits.get(key);

    if (!state) {
      return false;
    }

    // Check if cooldown has passed
    if (state.isOpen) {
      const elapsed = Date.now() - state.lastFailure;
      if (elapsed >= this.config.cooldownPeriod) {
        // Reset circuit after cooldown
        logger.info('Circuit breaker reset after cooldown', { key, cooldownMs: elapsed });
        this.circuits.delete(key);
        return false;
      }
      return true;
    }

    return false;
  }

  /**
   * Record a failure for a job
   */
  recordFailure(jobType: string, payload: unknown, error?: string): void {
    const key = this.getKey(jobType, payload);
    const now = Date.now();

    const state = this.circuits.get(key) ?? {
      failures: 0,
      lastFailure: now,
      isOpen: false,
      firstFailure: now,
    };

    state.failures++;
    state.lastFailure = now;

    // Check if we should open the circuit
    if (state.failures >= this.config.failureThreshold && !state.isOpen) {
      state.isOpen = true;
      logger.warn('Circuit breaker opened', {
        key,
        failures: state.failures,
        threshold: this.config.failureThreshold,
        cooldownMs: this.config.cooldownPeriod,
        error,
      });
    }

    this.circuits.set(key, state);
  }

  /**
   * Record a success - resets the circuit
   */
  recordSuccess(jobType: string, payload: unknown): void {
    const key = this.getKey(jobType, payload);
    if (this.circuits.has(key)) {
      logger.debug('Circuit breaker reset on success', { key });
      this.circuits.delete(key);
    }
  }

  /**
   * Manually reset a circuit
   */
  reset(jobType: string, payload: unknown): void {
    const key = this.getKey(jobType, payload);
    this.circuits.delete(key);
    logger.info('Circuit breaker manually reset', { key });
  }

  /**
   * Reset all circuits
   */
  resetAll(): void {
    const count = this.circuits.size;
    this.circuits.clear();
    logger.info('All circuit breakers reset', { count });
  }

  /**
   * Get circuit state for debugging
   */
  getState(jobType: string, payload: unknown): CircuitState | null {
    const key = this.getKey(jobType, payload);
    return this.circuits.get(key) ?? null;
  }

  /**
   * Get all open circuits
   */
  getOpenCircuits(): Array<{ key: string; state: CircuitState }> {
    const open: Array<{ key: string; state: CircuitState }> = [];
    for (const [key, state] of this.circuits) {
      if (state.isOpen) {
        open.push({ key, state });
      }
    }
    return open;
  }

  /**
   * Get stats for monitoring
   */
  getStats(): { totalCircuits: number; openCircuits: number; keys: string[] } {
    const keys = Array.from(this.circuits.keys());
    const openCount = Array.from(this.circuits.values()).filter((s) => s.isOpen).length;
    return {
      totalCircuits: this.circuits.size,
      openCircuits: openCount,
      keys,
    };
  }

  /**
   * Cleanup stale circuits that have been closed for a while
   */
  private cleanupStaleCircuits(): void {
    const now = Date.now();
    const staleThreshold = this.config.cooldownPeriod * 2;
    let cleaned = 0;

    for (const [key, state] of this.circuits) {
      const elapsed = now - state.lastFailure;
      if (elapsed > staleThreshold) {
        this.circuits.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      logger.debug('Cleaned up stale circuit breakers', { count: cleaned });
    }
  }

  /**
   * Stop the cleanup interval
   */
  stop(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

/** Global circuit breaker instance for job queue */
export const jobCircuitBreaker = new CircuitBreaker({
  failureThreshold: 5,
  cooldownPeriod: 5 * 60 * 1000, // 5 minutes
});
