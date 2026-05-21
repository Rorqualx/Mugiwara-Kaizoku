/**
 * Error Recovery Logic
 *
 * Provides recovery strategies and retry mechanisms for error handling.
 * Implements sequential strategy execution with early return pattern.
 *
 * Extracted from: ErrorHandler.ts (lines 359-566, 640-644)
 */

import type { ParserError, RecoveryStrategy } from './types';
import type { MetricsCollector } from '../monitoring/MetricsCollector';
import type { EventEmitter } from 'events';



// ============================================================================
// Types
// ============================================================================

/**
 * Result of a recovery attempt
 */
export interface RecoveryResult {
  success: boolean;
  result?: unknown;
}

// ============================================================================
// Recovery Strategy Execution
// ============================================================================

/**
 * Try a single recovery strategy
 *
 * This is extracted to avoid no-await-in-loop violations in attemptRecovery.
 * Each strategy attempt is fully independent and can be awaited in isolation.
 */
async function tryRecoveryStrategy(
  strategy: RecoveryStrategy,
  error: ParserError,
  emitter: EventEmitter,
  metrics?: MetricsCollector
): Promise<RecoveryResult> {
  try {
    emitter.emit('recovery-attempt', { error, strategy: strategy.type });

    const result = await strategy.action();

    emitter.emit('recovery-success', { error, strategy: strategy.type, result });

    if (metrics) {
      metrics.increment('parser.recovery.success', 1, {
        type: error.type,
        strategy: strategy.type
      });
    }

    return { success: true, result };
  } catch (recoveryError: unknown) {
    const errorMessage = recoveryError instanceof Error ? recoveryError.message : String(recoveryError);
    emitter.emit('recovery-failure', {
      error,
      strategy: strategy.type,
      errorMessage
    });

    if (metrics) {
      metrics.increment('parser.recovery.failure', 1, {
        type: error.type,
        strategy: strategy.type
      });
    }

    return { success: false };
  }
}

/**
 * Attempt recovery from error using available strategies
 *
 * Strategies are tried sequentially until one succeeds (early return).
 * This pattern is acceptable for no-await-in-loop because:
 * 1. Strategies MUST be tried sequentially (not parallel) - each builds on previous failure
 * 2. Loop exits early on first success (early return pattern)
 * 3. Each iteration is independent (extracted to tryRecoveryStrategy)
 *
 * @param error - The error to recover from
 * @param strategies - Array of recovery strategies to try
 * @param emitter - Event emitter for recovery events
 * @param metrics - Optional metrics collector
 * @returns Recovery result with success status and optional result
 */
export async function attemptRecovery(
  error: ParserError,
  strategies: RecoveryStrategy[],
  emitter: EventEmitter,
  metrics?: MetricsCollector
): Promise<RecoveryResult> {
  for (const strategy of strategies) {
    // eslint-disable-next-line no-await-in-loop -- Sequential execution required to try strategies in order and early-return on first success
    const result = await tryRecoveryStrategy(strategy, error, emitter, metrics);
    if (result.success) {
      return result;  // Early return on success
    }
  }

  return { success: false };
}

// ============================================================================
// Recovery Strategy Builders
// ============================================================================

/**
 * Get recovery strategies for a specific error
 *
 * @param error - The error to get strategies for
 * @param customStrategies - Map of custom recovery strategies
 * @returns Array of recovery strategies (custom + default)
 */
export function getRecoveryStrategies(
  error: ParserError,
  customStrategies: Map<string, RecoveryStrategy[]>
): RecoveryStrategy[] {
  const key = `${error.type}-${error.source ?? ''}`;
  const custom = customStrategies.get(key) ?? [];
  const defaults = getDefaultStrategies(error);

  return [...custom, ...defaults];
}

/**
 * Get default recovery strategies based on error type
 *
 * Each error type has specific recovery strategies that make sense
 * for that failure mode.
 *
 * @param error - The error to get default strategies for
 * @returns Array of default recovery strategies
 */
export function getDefaultStrategies(error: ParserError): RecoveryStrategy[] {
  const strategies: RecoveryStrategy[] = [];

  switch (error.type) {
    case 'NETWORK_ERROR':
      strategies.push({
        type: 'retry',
        action: async () => {
          await delay(1000);
          return 'retry';
        },
        description: 'Retry after delay'
      });
      break;

    case 'CACHE_ERROR':
      strategies.push({
        type: 'fallback',
        action: () => Promise.resolve('bypass-cache'),
        description: 'Bypass cache and fetch directly'
      });
      break;

    case 'PARSE_ERROR':
      strategies.push({
        type: 'fallback',
        action: () => Promise.resolve('alternative-parser'),
        description: 'Use alternative parsing strategy'
      });
      break;

    case 'RATE_LIMIT_ERROR':
      strategies.push({
        type: 'retry',
        action: async () => {
          await delay(error.retryAfter ?? 60000);
          return 'retry';
        },
        description: 'Wait for rate limit reset'
      });
      break;

    default:
      // No specific recovery strategy for this error type
      break;
  }

  // Always add skip as last resort
  strategies.push({
    type: 'skip',
    action: () => Promise.resolve(null),
    description: 'Skip this operation'
  });

  return strategies;
}

/**
 * Setup default recovery strategies for common error patterns
 *
 * Adds strategies to the provided map for wildcard patterns.
 * These are global strategies that apply to all sources.
 *
 * @param strategies - Map to add default strategies to
 */
export function setupDefaultRecoveryStrategies(
  strategies: Map<string, RecoveryStrategy[]>
): void {
  // Network error recovery with backoff
  addRecoveryStrategy(strategies, 'NETWORK_ERROR-*', {
    type: 'retry',
    action: async () => {
      await delay(2000);
      return 'retry-with-backoff';
    },
    description: 'Retry with exponential backoff'
  });

  // Cache error recovery - bypass cache layer
  addRecoveryStrategy(strategies, 'CACHE_ERROR-*', {
    type: 'fallback',
    action: () => Promise.resolve('bypass-cache'),
    description: 'Bypass cache layer'
  });

  // Memory error recovery - switch to streaming
  addRecoveryStrategy(strategies, 'MEMORY_ERROR-*', {
    type: 'fallback',
    action: () => Promise.resolve('use-streaming'),
    description: 'Switch to streaming parser'
  });
}

/**
 * Add a recovery strategy to the map
 *
 * Helper to add strategies while maintaining the map structure.
 *
 * @param strategies - Map to add strategy to
 * @param pattern - Pattern key (e.g., "NETWORK_ERROR-*")
 * @param strategy - Strategy to add
 */
function addRecoveryStrategy(
  strategies: Map<string, RecoveryStrategy[]>,
  pattern: string,
  strategy: RecoveryStrategy
): void {
  if (!strategies.has(pattern)) {
    strategies.set(pattern, []);
  }
  const existing = strategies.get(pattern);
  if (existing) {
    existing.push(strategy);
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Delay helper for retry strategies
 *
 * @param ms - Milliseconds to delay
 * @returns Promise that resolves after the delay
 */
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => {
    setTimeout(resolve, ms);
  });
}
