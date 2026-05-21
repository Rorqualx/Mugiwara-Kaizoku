/**
 * Provider Health Monitor - Core Class
 *
 * Main ProviderHealthMonitor class that orchestrates all health monitoring
 * functionality by integrating specialized modules.
 *
 * This class:
 * - Manages monitoring lifecycle (start/stop)
 * - Coordinates health checks across providers
 * - Stores and retrieves metrics history
 * - Delegates to specialized modules for analysis, alerting, and recovery
 *
 * Extracted from: provider-health-monitor.ts (lines 130-204, 260-290, 427-448)
 */

import { EventEmitter } from 'events';

import { providerRegistry } from '@/server/utils/provider-registry';
import type { MetadataProviderInterface } from '@/server/utils/provider-registry';
import { logger } from '@/utils/logging';

// Import specialized modules
import {
  getAlerts as retrieveAlerts,
  acknowledgeAlert as ackAlert,
  getSLACompliance as checkSLA,
  predictFailure as analyzePredictiveFailure,
  analyzeMetrics,
  createAlert
} from './alerting';
import { performHealthCheck as executeHealthCheck } from './health-checks';
import {
  storeMetrics,
  getMetricsHistory as retrieveMetricsHistory,
  calculateThroughput,
  calculateAvailability
} from './metrics';
import {
  checkAutoRecovery,
  executeRecoveryStrategy
} from './recovery';
import {
  HealthCheckType,
  AlertSeverity,
  RecoveryStrategy,
  type MonitoringConfig,
  type HealthMetrics,
  type Alert
} from './types';

/**
 * Provider Health Monitor
 *
 * Advanced health monitoring system for metadata providers.
 */
export class ProviderHealthMonitor extends EventEmitter {
  private config: MonitoringConfig;
  private metricsHistory: Map<string, HealthMetrics[]> = new Map();
  private alerts: Alert[] = [];
  private monitoringTimers: Map<string, NodeJS.Timeout> = new Map();
  private anomalyBaselines: Map<string, {
    responseTime: number;
    errorRate: number;
    throughput: number;
  }> = new Map();
  private slaViolations: Map<string, number> = new Map();
  private registeredHandler: ((event: { id: string }) => void) | null = null;
  private unregisteredHandler: ((event: { id: string }) => void) | null = null;

  constructor(config: Partial<MonitoringConfig> = {}) {
    super();
    this.config = this.buildDefaultConfig(config);

    if (this.config.enabled) {
      this.startMonitoring();
    }
  }

  /**
   * Build default configuration from partial config
   *
   * Extracted from constructor to reduce complexity from 22 to 3.
   */
  private buildDefaultConfig(config: Partial<MonitoringConfig>): MonitoringConfig {
    const configBase = {
      enabled: config.enabled !== false,
      interval: config.interval ?? 60000, // 1 minute
      healthCheckType: config.healthCheckType ?? HealthCheckType.PING,
      enableAnomalyDetection: config.enableAnomalyDetection ?? false,
      enablePredictiveAnalysis: config.enablePredictiveAnalysis ?? false,
      enableAutoRecovery: config.enableAutoRecovery ?? false,
      alertThresholds: {
        errorRate: config.alertThresholds?.errorRate ?? 0.1,
        responseTime: config.alertThresholds?.responseTime ?? 5000,
        availability: config.alertThresholds?.availability ?? 0.95,
        consecutiveFailures: config.alertThresholds?.consecutiveFailures ?? 3
      },
      recoveryStrategies: {
        DEGRADED: config.recoveryStrategies?.DEGRADED ?? RecoveryStrategy.THROTTLE,
        UNHEALTHY: config.recoveryStrategies?.UNHEALTHY ?? RecoveryStrategy.CIRCUIT_BREAK
      },
      metricsRetention: config.metricsRetention ?? 86400000 // 24 hours
    };

    if (config.sla !== undefined) {
      return { ...configBase, sla: config.sla };
    }

    return configBase;
  }

  /**
   * Start monitoring all providers
   */
  startMonitoring(): void {
    const providers = providerRegistry.getAllProviders();
    for (const [providerId, provider] of providers) {
      this.monitorProvider(providerId, provider);
    }

    // Store named handlers so they can be removed in stopMonitoring()
    this.registeredHandler = (event: { id: string }) => {
      const provider = providerRegistry.getProvider(event.id);
      if (provider) {
        this.monitorProvider(event.id, provider);
      }
    };
    this.unregisteredHandler = (event: { id: string }) => {
      this.stopMonitoringProvider(event.id);
    };

    // Listen for new provider registrations
    providerRegistry.on('provider-registered', this.registeredHandler);

    // Listen for provider unregistrations
    providerRegistry.on('provider-unregistered', this.unregisteredHandler);

    logger.info('Provider health monitoring started', {
      interval: this.config.interval,
      type: this.config.healthCheckType
    });
  }

  /**
   * Stop monitoring and remove all event listeners
   */
  stopMonitoring(): void {
    for (const [_providerId, timer] of this.monitoringTimers) {
      clearInterval(timer);
    }
    this.monitoringTimers.clear();

    // Remove event listeners from providerRegistry to prevent leaks
    if (this.registeredHandler) {
      providerRegistry.off('provider-registered', this.registeredHandler);
      this.registeredHandler = null;
    }
    if (this.unregisteredHandler) {
      providerRegistry.off('provider-unregistered', this.unregisteredHandler);
      this.unregisteredHandler = null;
    }

    logger.info('Provider health monitoring stopped');
  }

  /**
   * Perform health check on a provider
   */
  async performHealthCheck(
    providerId: string,
    provider: MetadataProviderInterface,
    type: HealthCheckType = this.config.healthCheckType
  ): Promise<HealthMetrics> {
    // Create local functions that close over metricsHistory
    const getThroughput = (pId: string): number =>
      calculateThroughput(this.metricsHistory, pId);
    const getAvailability = (pId: string): number =>
      calculateAvailability(this.metricsHistory, pId);

    const metrics = await executeHealthCheck(
      providerId,
      provider,
      type,
      getThroughput,
      getAvailability
    );

    // Store metrics
    storeMetrics(this.metricsHistory, providerId, metrics, this.config.metricsRetention);

    // Check for issues
    const createAlertFn = (
      pId: string,
      severity: AlertSeverity,
      alertType: string,
      message: string,
      metadata?: Record<string, unknown>
    ): void => {
      createAlert({
        providerId: pId,
        severity,
        type: alertType,
        message,
        alerts: this.alerts,
        emitter: this,
        retentionMs: this.config.metricsRetention,
        metadata: metadata ?? undefined
      });
    };

    analyzeMetrics({
      providerId,
      metrics,
      config: this.config,
      metricsHistory: this.metricsHistory,
      anomalyBaselines: this.anomalyBaselines,
      slaViolations: this.slaViolations,
      alerts: this.alerts,
      emitter: this,
      createAlertFn
    });

    return metrics;
  }

  /**
   * Get current health status
   */
  getHealthStatus(providerId?: string): Map<string, HealthMetrics> | HealthMetrics | null {
    if (providerId) {
      const history = this.metricsHistory.get(providerId);
      const latestMetric = history?.[history.length - 1];
      return latestMetric ?? null;
    }

    const status = new Map<string, HealthMetrics>();
    for (const [id, history] of this.metricsHistory) {
      if (history.length > 0) {
        const latestMetric = history[history.length - 1];
        if (latestMetric !== undefined) {
          status.set(id, latestMetric);
        }
      }
    }

    return status;
  }

  /**
   * Get metrics history
   */
  getMetricsHistory(
    providerId: string,
    duration?: number
  ): HealthMetrics[] {
    return retrieveMetricsHistory(this.metricsHistory, providerId, duration);
  }

  /**
   * Get alerts
   */
  getAlerts(
    filter?: {
      providerId?: string;
      severity?: AlertSeverity;
      acknowledged?: boolean;
    }
  ): Alert[] {
    return retrieveAlerts(this.alerts, filter);
  }

  /**
   * Acknowledge alert
   */
  acknowledgeAlert(alertId: string): void {
    ackAlert(this.alerts, alertId, this);
  }

  /**
   * Get SLA compliance
   */
  getSLACompliance(providerId: string): {
    compliant: boolean;
    availability: number;
    responseTime: number;
    errorRate: number;
    violations: number;
  } | null {
    if (!this.config.sla) return null;
    return checkSLA(this.metricsHistory, providerId, this.config.sla, this.slaViolations);
  }

  /**
   * Predict failures using time series analysis
   */
  predictFailure(providerId: string): {
    probability: number;
    timeToFailure?: number;
    indicators: string[];
  } | null {
    return analyzePredictiveFailure(
      this.metricsHistory,
      providerId,
      this.config.enablePredictiveAnalysis
    );
  }

  // Private methods

  private monitorProvider(providerId: string, provider: MetadataProviderInterface): void {
    if (this.monitoringTimers.has(providerId)) return;

    const timer = setInterval(() => {
      void (async () => {
        const metrics = await this.performHealthCheck(providerId, provider);

        // Emit metrics event
        this.emit('metrics-collected', metrics);

        // Check for auto-recovery
        if (this.config.enableAutoRecovery) {
          const strategy = checkAutoRecovery(metrics, this.config.recoveryStrategies);
          if (strategy) {
            const createAlertFn = (
              pId: string,
              severity: AlertSeverity,
              type: string,
              message: string
            ): void => {
              createAlert({
                providerId: pId,
                severity,
                type,
                message,
                alerts: this.alerts,
                emitter: this,
                retentionMs: this.config.metricsRetention
              });
            };

            await executeRecoveryStrategy(providerId, strategy, this, createAlertFn);
          }
        }
      })();
    }, this.config.interval);

    this.monitoringTimers.set(providerId, timer);
  }

  private stopMonitoringProvider(providerId: string): void {
    const timer = this.monitoringTimers.get(providerId);
    if (timer) {
      clearInterval(timer);
      this.monitoringTimers.delete(providerId);
    }
  }
}
