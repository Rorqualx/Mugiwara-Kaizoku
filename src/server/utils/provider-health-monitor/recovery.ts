/**
 * Provider Health Monitor - Recovery Strategies
 *
 * Automated recovery strategies for unhealthy providers.
 *
 * Strategies:
 * - RESTART: Attempt to restart the provider
 * - THROTTLE: Reduce load on degraded provider
 * - CIRCUIT_BREAK: Open circuit breaker for failing provider
 * - FALLBACK: Switch to fallback provider
 * - DISABLE: Disable critically failing provider
 *
 * Extracted from: provider-health-monitor.ts (lines 530-603)
 */

import { EventEmitter } from 'events';

import { ProviderStatus } from '@prisma/client';

import { logger } from '@/utils/logging';



import { providerRegistry } from '../provider-registry';

import {
  RecoveryStrategy,
  AlertSeverity,
  type HealthMetrics
} from './types';

/**
 * Check if auto-recovery is needed
 *
 * @param metrics - Current health metrics
 * @param recoveryStrategies - Configuration for recovery strategies
 * @returns Recovery strategy to execute, or null
 */
export function checkAutoRecovery(
  metrics: HealthMetrics,
  recoveryStrategies: {
    DEGRADED: RecoveryStrategy;
    UNHEALTHY: RecoveryStrategy;
  }
): RecoveryStrategy | null {
  // Only attempt recovery for degraded or unhealthy states
  if (metrics.status === ProviderStatus.DEGRADED || metrics.status === ProviderStatus.UNHEALTHY) {
    const strategy = metrics.status === ProviderStatus.DEGRADED
      ? recoveryStrategies.DEGRADED
      : recoveryStrategies.UNHEALTHY;

    if (strategy !== RecoveryStrategy.NONE) {
      return strategy;
    }
  }

  return null;
}

/**
 * Execute recovery strategy
 *
 * @param providerId - Provider identifier
 * @param strategy - Recovery strategy to execute
 * @param emitter - Event emitter for notifications
 * @param createAlertFn - Function to create alerts
 */
export async function executeRecoveryStrategy(
  providerId: string,
  strategy: RecoveryStrategy,
  emitter: EventEmitter,
  createAlertFn: (providerId: string, severity: AlertSeverity, type: string, message: string) => void
): Promise<void> {
  logger.info(`Executing recovery strategy ${strategy} for ${providerId}`);

  switch (strategy) {
    case RecoveryStrategy.RESTART: {
      // Attempt to restart the provider
      await restartProvider(providerId, createAlertFn);
      break;
    }

    case RecoveryStrategy.THROTTLE: {
      // Reduce load on the provider
      throttleProvider(providerId, createAlertFn);
      break;
    }

    case RecoveryStrategy.CIRCUIT_BREAK: {
      // Open circuit breaker
      openCircuitBreaker(providerId, createAlertFn);
      break;
    }

    case RecoveryStrategy.FALLBACK: {
      // Switch to fallback provider
      activateFallback(providerId, createAlertFn);
      break;
    }

    case RecoveryStrategy.DISABLE: {
      // Disable the provider
      await disableProvider(providerId, createAlertFn);
      break;
    }

    case RecoveryStrategy.NONE:
    default: {
      // No recovery action needed
      logger.debug(`No recovery action for strategy: ${strategy}`);
      break;
    }
  }

  emitter.emit('recovery-executed', { providerId, strategy });
}

/**
 * Restart unhealthy provider
 */
export async function restartProvider(
  providerId: string,
  createAlertFn: (providerId: string, severity: AlertSeverity, type: string, message: string) => void
): Promise<void> {
  try {
    const provider = providerRegistry.getProvider(providerId);
    if (provider) {
      await providerRegistry.unregister(providerId);
      // Re-register would need to be done externally
      createAlertFn(providerId, AlertSeverity.INFO, 'provider-restarted',
        'Provider restarted due to health issues');
    }
  } catch (error: unknown) {
    logger.error(`Failed to restart provider ${providerId}:`, error);
  }
}

/**
 * Throttle degraded provider
 */
export function throttleProvider(
  providerId: string,
  createAlertFn: (providerId: string, severity: AlertSeverity, type: string, message: string) => void
): void {
  // Implement throttling logic
  createAlertFn(providerId, AlertSeverity.INFO, 'provider-throttled',
    'Provider throttled due to degraded performance');
}

/**
 * Open circuit breaker
 */
export function openCircuitBreaker(
  providerId: string,
  createAlertFn: (providerId: string, severity: AlertSeverity, type: string, message: string) => void
): void {
  // Circuit breaker is handled in the provider wrapper
  createAlertFn(providerId, AlertSeverity.WARNING, 'circuit-breaker-open',
    'Circuit breaker opened due to health issues');
}

/**
 * Activate fallback provider
 */
export function activateFallback(
  providerId: string,
  createAlertFn: (providerId: string, severity: AlertSeverity, type: string, message: string) => void
): void {
  // Fallback logic would be implemented in the registry
  createAlertFn(providerId, AlertSeverity.INFO, 'fallback-activated',
    'Fallback provider activated');
}

/**
 * Disable critically failing provider
 */
export async function disableProvider(
  providerId: string,
  createAlertFn: (providerId: string, severity: AlertSeverity, type: string, message: string) => void
): Promise<void> {
  try {
    await providerRegistry.unregister(providerId);
    createAlertFn(providerId, AlertSeverity.ERROR, 'provider-disabled',
      'Provider disabled due to critical health issues');
  } catch (error: unknown) {
    logger.error(`Failed to disable provider ${providerId}:`, error);
  }
}
