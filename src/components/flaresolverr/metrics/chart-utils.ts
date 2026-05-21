/**
 * Chart utilities for FlareSolverr metrics visualization
 *
 * @module components/flaresolverr/metrics/chart-utils
 */

import type {
  FlareSolverrHourlyMetrics,
} from '@/server/services/flaresolverr/types';

import type { ChartData, ChartOptions, ScaleOptions } from 'chart.js';

// ============================================================================
// Types
// ============================================================================

export interface ResponseTimeChartConfig {
  timestamps: string[];
  avgValues: number[];
  minValues: number[];
  maxValues: number[];
}

export interface UptimeChartConfig {
  labels: string[];
  values: number[];
}

export interface ThroughputChartConfig {
  labels: string[];
  successful: number[];
  failed: number[];
}

// ============================================================================
// Formatting Helpers
// ============================================================================

/** Format timestamp for display */
export function formatTimestamp(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/** Format date for chart labels */
export function formatDateLabel(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

/** Format hour for chart labels */
export function formatHourLabel(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return `${formatDateLabel(d)} ${d.getHours()}:00`;
}

/** Format milliseconds to readable string */
export function formatMs(ms: number | null): string {
  if (ms === null) return 'N/A';
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

/** Format percentage */
export function formatPercent(value: number | null): string {
  if (value === null) return 'N/A';
  return `${value.toFixed(1)}%`;
}

// ============================================================================
// Data Preparation Functions
// ============================================================================

/** Prepare response time chart data from hourly aggregates */
export function prepareResponseTimeFromHourly(
  metrics: FlareSolverrHourlyMetrics[]
): ResponseTimeChartConfig {
  const filtered = metrics.filter((m) => m.avgResponseTime !== null);
  return {
    timestamps: filtered.map((m) => formatHourLabel(m.hour)),
    avgValues: filtered.map((m) => m.avgResponseTime ?? 0),
    minValues: filtered.map((m) => m.minResponseTime ?? 0),
    maxValues: filtered.map((m) => m.maxResponseTime ?? 0),
  };
}

/** Prepare uptime chart data from hourly aggregates */
export function prepareUptimeFromHourly(metrics: FlareSolverrHourlyMetrics[]): UptimeChartConfig {
  const filtered = metrics.filter((m) => m.uptimePercent !== null);
  return {
    labels: filtered.map((m) => formatHourLabel(m.hour)),
    values: filtered.map((m) => m.uptimePercent ?? 0),
  };
}

/** Prepare throughput chart data from hourly aggregates */
export function prepareThroughputFromHourly(
  metrics: FlareSolverrHourlyMetrics[]
): ThroughputChartConfig {
  return {
    labels: metrics.map((m) => formatHourLabel(m.hour)),
    successful: metrics.map((m) => m.successfulReqs),
    failed: metrics.map((m) => m.failedReqs),
  };
}

// ============================================================================
// Chart.js Configuration Builders
// ============================================================================

/** Build response time line chart data */
export function buildResponseTimeChartData(config: ResponseTimeChartConfig): ChartData<'line'> {
  return {
    labels: config.timestamps,
    datasets: [
      {
        label: 'Avg Response Time (ms)',
        data: config.avgValues,
        borderColor: 'rgb(59, 130, 246)',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        fill: true,
        tension: 0.3,
      },
      {
        label: 'Min',
        data: config.minValues,
        borderColor: 'rgb(34, 197, 94)',
        backgroundColor: 'transparent',
        borderDash: [5, 5],
        tension: 0.3,
      },
      {
        label: 'Max',
        data: config.maxValues,
        borderColor: 'rgb(239, 68, 68)',
        backgroundColor: 'transparent',
        borderDash: [5, 5],
        tension: 0.3,
      },
    ],
  };
}

/** Get uptime bar color based on value */
function getUptimeBarColor(value: number, isBackground: boolean): string {
  const opacity = isBackground ? 0.7 : 1;
  if (value >= 99) return isBackground ? 'rgba(34, 197, 94, 0.7)' : 'rgb(34, 197, 94)';
  if (value >= 95) return isBackground ? `rgba(234, 179, 8, ${opacity})` : 'rgb(234, 179, 8)';
  return isBackground ? `rgba(239, 68, 68, ${opacity})` : 'rgb(239, 68, 68)';
}

/** Build uptime bar chart data */
export function buildUptimeChartData(config: UptimeChartConfig): ChartData<'bar'> {
  return {
    labels: config.labels,
    datasets: [
      {
        label: 'Uptime %',
        data: config.values,
        backgroundColor: config.values.map((v) => getUptimeBarColor(v, true)),
        borderColor: config.values.map((v) => getUptimeBarColor(v, false)),
        borderWidth: 1,
      },
    ],
  };
}

/** Build throughput stacked bar chart data */
export function buildThroughputChartData(config: ThroughputChartConfig): ChartData<'bar'> {
  return {
    labels: config.labels,
    datasets: [
      {
        label: 'Successful',
        data: config.successful,
        backgroundColor: 'rgba(34, 197, 94, 0.7)',
        borderColor: 'rgb(34, 197, 94)',
        borderWidth: 1,
      },
      {
        label: 'Failed',
        data: config.failed,
        backgroundColor: 'rgba(239, 68, 68, 0.7)',
        borderColor: 'rgb(239, 68, 68)',
        borderWidth: 1,
      },
    ],
  };
}

// ============================================================================
// Chart Options Builders
// ============================================================================

/** Build X-axis scale options */
function buildXAxisScale(stacked = false): ScaleOptions<'category'> {
  return {
    stacked,
    grid: { display: false },
    ticks: { maxRotation: 45, minRotation: 0 },
  };
}

/** Build Y-axis scale options */
function buildYAxisScale(stacked = false): ScaleOptions<'linear'> {
  return {
    stacked,
    beginAtZero: true,
    grid: { color: 'rgba(0, 0, 0, 0.1)' },
  };
}

/** Get common chart options */
export function getCommonChartOptions(): ChartOptions<'line' | 'bar'> {
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'top' as const, labels: { boxWidth: 12, padding: 10 } },
    },
    scales: {
      x: buildXAxisScale(),
      y: buildYAxisScale(),
    },
  };
}

/** Get uptime chart specific options */
export function getUptimeChartOptions(): ChartOptions<'bar'> {
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'top' as const, labels: { boxWidth: 12, padding: 10 } },
    },
    scales: {
      x: buildXAxisScale(),
      y: { beginAtZero: false, min: 0, max: 100, ticks: { callback: (v) => `${v}%` } },
    },
  };
}

/** Get throughput chart options with stacked bars */
export function getThroughputChartOptions(): ChartOptions<'bar'> {
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'top' as const, labels: { boxWidth: 12, padding: 10 } },
    },
    scales: {
      x: buildXAxisScale(true),
      y: buildYAxisScale(true),
    },
  };
}
