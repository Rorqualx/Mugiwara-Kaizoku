/**
 * Calendar Provider Health Monitor
 *
 * Monitors the health status of calendar providers and emits events
 * when providers become unhealthy or recover.
 *
 * @module server/services/calendar/CalendarProviderHealthMonitor
 */

import { createLogger } from '@/utils/logger';

import type {
  ProviderHealthInfo,
  ProviderHealthStatus,
  ProviderEvent,
  ProviderEventHandler,
  ICalendarProvider,
} from './types/calendar-provider.types';

const logger = createLogger('CalendarProviderHealthMonitor');

// ============================================================================
// Configuration
// ============================================================================

interface HealthMonitorConfig {
  /** Health check interval in milliseconds (default: 5 minutes) */
  checkIntervalMs: number;
  /** Number of consecutive failures before marking unhealthy (default: 3) */
  failureThreshold: number;
  /** Response time threshold in ms for degraded status (default: 5000) */
  degradedThresholdMs: number;
}

const DEFAULT_CONFIG: HealthMonitorConfig = {
  checkIntervalMs: 5 * 60 * 1000, // 5 minutes
  failureThreshold: 3,
  degradedThresholdMs: 5000,
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Safely invoke a health event handler
 */
function invokeHandler(handler: ProviderEventHandler, event: ProviderEvent): void {
  try {
    handler(event);
  } catch (error: unknown) {
    logger.error('Error in health event handler', {
      error: error instanceof Error ? error.message : String(error)
    });
  }
}

/**
 * Determine the event type based on status transition
 */
function determineEventType(
  newStatus: ProviderHealthStatus,
  previousStatus: ProviderHealthStatus | undefined
): ProviderEvent['type'] {
  if (newStatus === 'healthy' && previousStatus === 'unhealthy') {
    return 'provider:recovered';
  }
  if (newStatus === 'unhealthy') {
    return 'provider:unhealthy';
  }
  if (newStatus === 'degraded') {
    return 'provider:degraded';
  }
  if (newStatus === 'healthy') {
    return 'provider:healthy';
  }
  return 'provider:error';
}

/**
 * Create initial health info for a new provider
 */
function createInitialHealthInfo(): ProviderHealthInfo {
  return {
    status: 'unknown',
    lastCheck: new Date(),
    consecutiveFailures: 0,
    responseTime: null,
    lastSuccessTime: null,
  };
}

// ============================================================================
// Health Monitor Class
// ============================================================================

/**
 * Monitors calendar provider health and emits status events
 */
export class CalendarProviderHealthMonitor {
  private providers: Map<string, ICalendarProvider> = new Map();
  private healthStatus: Map<string, ProviderHealthInfo> = new Map();
  private eventHandlers: Set<ProviderEventHandler> = new Set();
  private checkInterval: ReturnType<typeof setInterval> | null = null;
  private config: HealthMonitorConfig;

  constructor(config: Partial<HealthMonitorConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Register a provider to be monitored
   */
  registerProvider(name: string, provider: ICalendarProvider): void {
    this.providers.set(name, provider);
    this.healthStatus.set(name, createInitialHealthInfo());
    logger.info(`Registered provider for health monitoring: ${name}`, { provider: name });
  }

  /**
   * Unregister a provider from monitoring
   */
  unregisterProvider(name: string): void {
    this.providers.delete(name);
    this.healthStatus.delete(name);
    logger.info(`Unregistered provider from health monitoring: ${name}`, { provider: name });
  }

  /**
   * Subscribe to health events
   */
  onHealthEvent(handler: ProviderEventHandler): () => void {
    this.eventHandlers.add(handler);
    return () => this.eventHandlers.delete(handler);
  }

  /**
   * Start health monitoring
   */
  start(): void {
    if (this.checkInterval !== null) {
      return; // Already running
    }

    logger.info('Starting health monitoring', {
      intervalMs: this.config.checkIntervalMs,
      providers: Array.from(this.providers.keys())
    });

    // Run initial check
    this.checkAllProviders();

    // Schedule periodic checks
    this.checkInterval = setInterval(() => {
      this.checkAllProviders();
    }, this.config.checkIntervalMs);
  }

  /**
   * Stop health monitoring
   */
  stop(): void {
    if (this.checkInterval !== null) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
      logger.info('Stopped health monitoring', {});
    }
  }

  /**
   * Get current health status for all providers
   */
  getAllHealth(): Map<string, ProviderHealthInfo> {
    return new Map(this.healthStatus);
  }

  /**
   * Get health status for a specific provider
   */
  getProviderHealth(name: string): ProviderHealthInfo | undefined {
    return this.healthStatus.get(name);
  }

  /**
   * Manually trigger a health check
   */
  triggerHealthCheck(): void {
    this.checkAllProviders();
  }

  /**
   * Check health of all registered providers
   */
  private checkAllProviders(): void {
    for (const [name, provider] of this.providers.entries()) {
      this.checkProvider(name, provider);
    }
  }

  /**
   * Check health of a single provider
   */
  private checkProvider(name: string, provider: ICalendarProvider): void {
    const previousHealth = this.healthStatus.get(name);
    const startTime = Date.now();

    try {
      const providerHealth = provider.getHealth();
      const responseTime = Date.now() - startTime;

      const newHealth = this.updateHealthStatus(name, previousHealth, {
        success: providerHealth.status === 'healthy',
        responseTime,
        providerHealth
      });

      this.emitIfStatusChanged(name, newHealth, previousHealth?.status);
    } catch (error: unknown) {
      const responseTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      const newHealth = this.updateHealthStatus(name, previousHealth, {
        success: false,
        responseTime,
        errorMessage
      });

      this.emitIfStatusChanged(name, newHealth, previousHealth?.status);
    }
  }

  /**
   * Emit event if status changed
   */
  private emitIfStatusChanged(
    name: string,
    newHealth: ProviderHealthInfo,
    previousStatus: ProviderHealthStatus | undefined
  ): void {
    if (previousStatus !== newHealth.status) {
      this.emitStatusChange(name, newHealth, previousStatus);
    }
  }

  /**
   * Update health status based on check results
   */
  private updateHealthStatus(
    name: string,
    previous: ProviderHealthInfo | undefined,
    result: {
      success: boolean;
      responseTime: number;
      providerHealth?: ProviderHealthInfo;
      errorMessage?: string;
    }
  ): ProviderHealthInfo {
    const now = new Date();
    const consecutiveFailures = result.success ? 0 : (previous?.consecutiveFailures ?? 0) + 1;

    const status = this.calculateStatus(result, consecutiveFailures, previous?.status);

    const health: ProviderHealthInfo = {
      status,
      lastCheck: now,
      consecutiveFailures,
      responseTime: result.responseTime,
      lastSuccessTime: result.success ? now : (previous?.lastSuccessTime ?? null),
    };

    // Only add errorMessage if it exists (avoid undefined with exactOptionalPropertyTypes)
    if (result.errorMessage !== undefined) {
      health.errorMessage = result.errorMessage;
    }

    this.healthStatus.set(name, health);
    return health;
  }

  /**
   * Calculate health status based on check results
   */
  private calculateStatus(
    result: { success: boolean; responseTime: number },
    consecutiveFailures: number,
    previousStatus: ProviderHealthStatus | undefined
  ): ProviderHealthStatus {
    if (!result.success && consecutiveFailures >= this.config.failureThreshold) {
      return 'unhealthy';
    }
    if (result.responseTime > this.config.degradedThresholdMs) {
      return 'degraded';
    }
    if (result.success) {
      return 'healthy';
    }
    return previousStatus ?? 'unknown';
  }

  /**
   * Emit a health status change event
   */
  private emitStatusChange(
    provider: string,
    health: ProviderHealthInfo,
    previousStatus: ProviderHealthStatus | undefined
  ): void {
    const eventType = determineEventType(health.status, previousStatus);

    const event: ProviderEvent = {
      type: eventType,
      provider,
      timestamp: new Date(),
      health,
      details: { previousStatus }
    };

    logger.info(`Provider health status changed: ${provider}`, {
      provider,
      previousStatus,
      newStatus: health.status,
      consecutiveFailures: health.consecutiveFailures
    });

    for (const handler of this.eventHandlers) {
      invokeHandler(handler, event);
    }
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let monitorInstance: CalendarProviderHealthMonitor | null = null;

/**
 * Get or create the health monitor instance
 */
export function getCalendarHealthMonitor(): CalendarProviderHealthMonitor {
  monitorInstance ??= new CalendarProviderHealthMonitor();
  return monitorInstance;
}

/**
 * Export default instance
 */
export const calendarHealthMonitor = getCalendarHealthMonitor();
