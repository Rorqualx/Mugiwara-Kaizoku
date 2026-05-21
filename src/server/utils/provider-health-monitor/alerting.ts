/**
 * Provider Health Monitor - Alerting System
 *
 * Alert management, SLA monitoring, anomaly detection, and predictive analysis.
 *
 * Functions:
 * - Alert management (get, acknowledge, create)
 * - SLA compliance checking
 * - Anomaly detection with baselines
 * - Predictive failure analysis
 * - Comprehensive metrics analysis
 *
 * Extracted from: provider-health-monitor.ts (lines 292-355, 461-492, 521-529, 604-632)
 */

import { EventEmitter } from 'events';

import { ProviderStatus } from '@prisma/client';

import { logger } from '@/utils/logging';



import {
  AlertSeverity,
  type Alert,
  type HealthMetrics,
  type SLAConfig,
  type MonitoringConfig,
  type TimeSeriesPoint
} from './types';

// ============================================================================
// Metric Helper Functions
// ============================================================================

/**
 * Calculate trend using simple linear regression
 */
function calculateTrend(series: TimeSeriesPoint[]): number {
  if (series.length < 2) return 0;

  // Simple linear regression
  const n = series.length;
  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;

  for (let i = 0; i < n; i++) {
    const x = i;
    const point = series[i];
    if (point === undefined) continue;
    const y = point.value;
    sumX += x;
    sumY += y;
    sumXY += x * y;
    sumX2 += x * x;
  }

  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  return slope;
}

/**
 * Calculate volatility (coefficient of variation)
 */
function calculateVolatility(values: number[]): number {
  if (values.length < 2) return 0;

  const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
  const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
  const stdDev = Math.sqrt(variance);

  return stdDev / Math.max(mean, 1);
}

/**
 * Get metrics history filtered by time window
 */
function getMetricsHistory(
  metricsHistory: Map<string, HealthMetrics[]>,
  providerId: string,
  duration: number
): HealthMetrics[] {
  const history = metricsHistory.get(providerId) ?? [];
  const cutoff = Date.now() - duration;
  return history.filter(m => m.timestamp >= cutoff);
}

// ============================================================================
// Alert Management
// ============================================================================

/**
 * Get alerts with optional filtering
 */
export function getAlerts(
  alerts: Alert[],
  filter?: {
    providerId?: string;
    severity?: AlertSeverity;
    acknowledged?: boolean;
  }
): Alert[] {
  let filteredAlerts = [...alerts];

  if (filter) {
    if (filter.providerId) {
      filteredAlerts = filteredAlerts.filter(a => a.providerId === filter.providerId);
    }
    if (filter.severity) {
      filteredAlerts = filteredAlerts.filter(a => a.severity === filter.severity);
    }
    if (filter.acknowledged !== undefined) {
      filteredAlerts = filteredAlerts.filter(a => a.acknowledged === filter.acknowledged);
    }
  }

  return filteredAlerts;
}

/**
 * Acknowledge an alert
 */
export function acknowledgeAlert(
  alerts: Alert[],
  alertId: string,
  emitter: EventEmitter
): void {
  const alert = alerts.find(a => a.id === alertId);
  if (alert) {
    alert.acknowledged = true;
    emitter.emit('alert-acknowledged', alert);
  }
}

/**
 * Options for creating an alert
 */
export interface CreateAlertOptions {
  providerId: string;
  severity: AlertSeverity;
  type: string;
  message: string;
  alerts: Alert[];
  emitter: EventEmitter;
  retentionMs: number;
  metadata?: Record<string, unknown> | undefined;
}

/**
 * Create alert with logging
 */
export function createAlert(options: CreateAlertOptions): void {
  const { providerId, severity, type, message, alerts, emitter, retentionMs, metadata } = options;
  const alert: Alert = {
    id: `${providerId}-${type}-${Date.now()}`,
    timestamp: Date.now(),
    providerId,
    severity,
    type,
    message,
    ...(metadata !== undefined ? { metadata } : {}),
    acknowledged: false
  };

  alerts.push(alert);
  emitter.emit('alert-created', alert);

  // Log alert
  const logLevel = severity === AlertSeverity.CRITICAL || severity === AlertSeverity.ERROR ? 'error' :
                  severity === AlertSeverity.WARNING ? 'warn' : 'info';
  logger[logLevel](`[${providerId}] ${message}`, metadata);

  // Clean old alerts - update array in place without reassigning param
  const cutoff = Date.now() - retentionMs;
  const filtered = alerts.filter(a => a.timestamp >= cutoff);
  // Use splice to clear and repopulate without param reassignment
  alerts.splice(0, alerts.length, ...filtered);
}

// ============================================================================
// SLA Monitoring
// ============================================================================

/**
 * Check SLA compliance
 */
export function getSLACompliance(
  metricsHistory: Map<string, HealthMetrics[]>,
  providerId: string,
  slaConfig: SLAConfig,
  slaViolations: Map<string, number>
): {
  compliant: boolean;
  availability: number;
  responseTime: number;
  errorRate: number;
  violations: number;
} | null {
  const metrics = getMetricsHistory(
    metricsHistory,
    providerId,
    slaConfig.evaluationWindow
  );

  if (metrics.length === 0) return null;

  const availability = metrics.filter(m => m.status === ProviderStatus.READY).length / metrics.length;
  const avgResponseTime = metrics.reduce((sum, m) => sum + m.responseTime, 0) / metrics.length;
  const avgErrorRate = metrics.reduce((sum, m) => sum + m.errorRate, 0) / metrics.length;

  const compliant =
    availability >= slaConfig.targetAvailability &&
    avgResponseTime <= slaConfig.maxResponseTime &&
    avgErrorRate <= slaConfig.maxErrorRate;

  return {
    compliant,
    availability,
    responseTime: avgResponseTime,
    errorRate: avgErrorRate,
    violations: slaViolations.get(providerId) ?? 0
  };
}

/**
 * Options for checking SLA compliance
 */
export interface CheckSLAComplianceOptions {
  providerId: string;
  metrics: HealthMetrics;
  metricsHistory: Map<string, HealthMetrics[]>;
  slaConfig: SLAConfig;
  slaViolations: Map<string, number>;
  createAlertFn: (providerId: string, severity: AlertSeverity, type: string, message: string, metadata?: Record<string, unknown> | undefined) => void;
}

/**
 * Check SLA compliance and create violations
 */
export function checkSLACompliance(options: CheckSLAComplianceOptions): void {
  const { providerId, metricsHistory, slaConfig, slaViolations, createAlertFn } = options;
  const compliance = getSLACompliance(metricsHistory, providerId, slaConfig, slaViolations);
  if (compliance && !compliance.compliant) {
    const violations = (slaViolations.get(providerId) ?? 0) + 1;
    slaViolations.set(providerId, violations);
    createAlertFn(providerId, AlertSeverity.ERROR, 'sla-violation',
      `SLA violation #${violations}`, { compliance });
  }
}

// ============================================================================
// Predictive Analysis
// ============================================================================

/**
 * Predict failure probability
 */
export function predictFailure(
  metricsHistory: Map<string, HealthMetrics[]>,
  providerId: string,
  enablePredictiveAnalysis: boolean
): {
  probability: number;
  timeToFailure?: number;
  indicators: string[];
} | null {
  if (!enablePredictiveAnalysis) return null;

  const history = getMetricsHistory(metricsHistory, providerId, 3600000); // Last hour
  if (history.length < 10) return null;

  const indicators: string[] = [];
  let riskScore = 0;

  // Analyze trends
  const errorRateTrend = calculateTrend(
    history.map(m => ({ timestamp: m.timestamp, value: m.errorRate }))
  );
  const responseTimeTrend = calculateTrend(
    history.map(m => ({ timestamp: m.timestamp, value: m.responseTime }))
  );

  // Check for concerning trends
  if (errorRateTrend > 0.5) {
    indicators.push('Increasing error rate');
    riskScore += 0.3;
  }

  if (responseTimeTrend > 0.5) {
    indicators.push('Increasing response time');
    riskScore += 0.2;
  }

  // Check for volatility
  const responseTimeVolatility = calculateVolatility(
    history.map(m => m.responseTime)
  );
  if (responseTimeVolatility > 0.3) {
    indicators.push('High response time volatility');
    riskScore += 0.2;
  }

  // Check recent errors
  const recentErrors = history.slice(-5).filter(m => m.errorRate > 0).length;
  if (recentErrors >= 3) {
    indicators.push('Recent error spike');
    riskScore += 0.3;
  }

  // Estimate time to failure if risk is high
  let timeToFailure: number | undefined;
  if (riskScore > 0.5 && errorRateTrend > 0) {
    const lastMetric = history[history.length - 1];
    if (lastMetric !== undefined) {
      const currentErrorRate = lastMetric.errorRate;
      const rateOfIncrease = errorRateTrend;
      const criticalErrorRate = 0.5;
      if (currentErrorRate < criticalErrorRate) {
        timeToFailure = ((criticalErrorRate - currentErrorRate) / rateOfIncrease) * 60000;
      }
    }
  }

  const result: {
    probability: number;
    timeToFailure?: number;
    indicators: string[];
  } = {
    probability: Math.min(riskScore, 1),
    indicators
  };

  if (timeToFailure !== undefined) {
    result.timeToFailure = timeToFailure;
  }

  return result;
}

// ============================================================================
// Anomaly Detection
// ============================================================================

/**
 * Detect anomalies
 */
export function detectAnomalies(
  providerId: string,
  metrics: HealthMetrics,
  metricsHistory: Map<string, HealthMetrics[]>,
  anomalyBaselines: Map<string, { responseTime: number; errorRate: number; throughput: number }>,
  createAlertFn: (providerId: string, severity: AlertSeverity, type: string, message: string) => void
): void {
  const baseline = anomalyBaselines.get(providerId);

  if (!baseline) {
    // Calculate baseline from history
    const history = getMetricsHistory(metricsHistory, providerId, 3600000);
    if (history.length < 10) return;

    const avgResponseTime = history.reduce((sum, m) => sum + m.responseTime, 0) / history.length;
    const avgErrorRate = history.reduce((sum, m) => sum + m.errorRate, 0) / history.length;
    const avgThroughput = history.reduce((sum, m) => sum + m.throughput, 0) / history.length;

    anomalyBaselines.set(providerId, {
      responseTime: avgResponseTime,
      errorRate: avgErrorRate,
      throughput: avgThroughput
    });
    return;
  }

  // Check for anomalies (simple z-score approach)
  const responseTimeDeviation = Math.abs(metrics.responseTime - baseline.responseTime) / baseline.responseTime;
  const errorRateDeviation = Math.abs(metrics.errorRate - baseline.errorRate) / Math.max(baseline.errorRate, 0.01);

  if (responseTimeDeviation > 2) {
    createAlertFn(providerId, AlertSeverity.INFO, 'response-time-anomaly',
      `Response time anomaly detected: ${metrics.responseTime}ms (baseline: ${baseline.responseTime}ms)`);
  }

  if (errorRateDeviation > 2) {
    createAlertFn(providerId, AlertSeverity.WARNING, 'error-rate-anomaly',
      `Error rate anomaly detected: ${(metrics.errorRate * 100).toFixed(1)}% (baseline: ${(baseline.errorRate * 100).toFixed(1)}%)`);
  }
}

// ============================================================================
// Comprehensive Metrics Analysis
// ============================================================================

/**
 * Options for analyzing metrics
 */
export interface AnalyzeMetricsOptions {
  providerId: string;
  metrics: HealthMetrics;
  config: MonitoringConfig;
  metricsHistory: Map<string, HealthMetrics[]>;
  anomalyBaselines: Map<string, { responseTime: number; errorRate: number; throughput: number }>;
  slaViolations: Map<string, number>;
  alerts: Alert[];
  emitter: EventEmitter;
  createAlertFn: (providerId: string, severity: AlertSeverity, type: string, message: string, metadata?: Record<string, unknown> | undefined) => void;
}

/**
 * Analyze metrics for issues
 */
export function analyzeMetrics(options: AnalyzeMetricsOptions): void {
  const { providerId, metrics, config, metricsHistory, anomalyBaselines, slaViolations, createAlertFn } = options;
  // Check thresholds
  if (metrics.errorRate > config.alertThresholds.errorRate) {
    createAlertFn(providerId, AlertSeverity.WARNING, 'high-error-rate',
      `Error rate ${(metrics.errorRate * 100).toFixed(1)}% exceeds threshold`);
  }

  if (metrics.responseTime > config.alertThresholds.responseTime) {
    createAlertFn(providerId, AlertSeverity.WARNING, 'slow-response',
      `Response time ${metrics.responseTime}ms exceeds threshold`);
  }

  if (metrics.availability < config.alertThresholds.availability) {
    createAlertFn(providerId, AlertSeverity.ERROR, 'low-availability',
      `Availability ${(metrics.availability * 100).toFixed(1)}% below threshold`);
  }

  // Check for anomalies
  if (config.enableAnomalyDetection) {
    detectAnomalies(providerId, metrics, metricsHistory, anomalyBaselines, createAlertFn);
  }

  // Check SLA compliance
  if (config.sla) {
    checkSLACompliance({
      providerId,
      metrics,
      metricsHistory,
      slaConfig: config.sla,
      slaViolations,
      createAlertFn
    });
  }

  // Check predictive analysis
  if (config.enablePredictiveAnalysis) {
    const prediction = predictFailure(metricsHistory, providerId, true);
    if (prediction && prediction.probability > 0.7) {
      createAlertFn(providerId, AlertSeverity.WARNING, 'predicted-failure',
        `High failure probability: ${(prediction.probability * 100).toFixed(0)}%`,
        { prediction });
    }
  }
}
