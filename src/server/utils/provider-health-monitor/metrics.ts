/**
 * Provider Health Monitor - Metrics Module
 *
 * Metrics storage, retrieval, and statistical calculations.
 *
 * Functions:
 * - storeMetrics: Store and manage metrics history
 * - getMetricsHistory: Retrieve historical metrics
 * - calculateThroughput: Request rate calculation
 * - calculateAvailability: Availability percentage
 * - calculateTrend: Linear regression trend analysis
 * - calculateVolatility: Statistical volatility
 *
 * Extracted from: provider-health-monitor.ts (lines 449-459, 633-667)
 */

import { ProviderStatus } from '@prisma/client';

import {
  type HealthMetrics,
  type TimeSeriesPoint
} from './types';

/**
 * Store metrics with automatic cleanup based on retention period
 *
 * @param metricsHistory - Map to store metrics in
 * @param providerId - Provider identifier
 * @param metrics - Metrics snapshot to store
 * @param retentionMs - Retention period in milliseconds
 */
export function storeMetrics(
  metricsHistory: Map<string, HealthMetrics[]>,
  providerId: string,
  metrics: HealthMetrics,
  retentionMs: number
): void {
  let history = metricsHistory.get(providerId);
  if (!history) {
    history = [];
    metricsHistory.set(providerId, history);
  }

  history.push(metrics);

  // Clean old metrics
  const cutoff = Date.now() - retentionMs;
  const filtered = history.filter(m => m.timestamp >= cutoff);
  metricsHistory.set(providerId, filtered);
}

/**
 * Get metrics history for a provider
 *
 * @param metricsHistory - Map containing all metrics
 * @param providerId - Provider identifier
 * @param durationMs - Optional time window in milliseconds
 * @returns Array of historical metrics
 */
export function getMetricsHistory(
  metricsHistory: Map<string, HealthMetrics[]>,
  providerId: string,
  durationMs?: number
): HealthMetrics[] {
  const history = metricsHistory.get(providerId) ?? [];
  if (!durationMs) return history;

  const cutoff = Date.now() - durationMs;
  return history.filter(m => m.timestamp >= cutoff);
}

/**
 * Calculate throughput (requests per minute)
 *
 * @param metricsHistory - Map containing metrics
 * @param providerId - Provider identifier
 * @returns Request count in last minute
 */
export function calculateThroughput(
  metricsHistory: Map<string, HealthMetrics[]>,
  providerId: string
): number {
  const history = getMetricsHistory(metricsHistory, providerId, 60000); // Last minute
  return history.length;
}

/**
 * Calculate availability percentage
 *
 * @param metricsHistory - Map containing metrics
 * @param providerId - Provider identifier
 * @param metrics - Optional specific metrics array
 * @returns Availability as decimal (0-1)
 */
export function calculateAvailability(
  metricsHistory: Map<string, HealthMetrics[]>,
  providerId: string,
  metrics?: HealthMetrics[]
): number {
  const history = metrics ?? getMetricsHistory(metricsHistory, providerId, 3600000);
  if (history.length === 0) return 0;

  const available = history.filter(m => m.status === ProviderStatus.READY).length;
  return available / history.length;
}

/**
 * Calculate trend using linear regression
 *
 * @param series - Time series data points
 * @returns Slope of trend line
 */
export function calculateTrend(series: TimeSeriesPoint[]): number {
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
 *
 * @param values - Array of numeric values
 * @returns Volatility metric
 */
export function calculateVolatility(values: number[]): number {
  if (values.length < 2) return 0;

  const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
  const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
  const stdDev = Math.sqrt(variance);

  return stdDev / Math.max(mean, 1);
}
