/**
 * ML Metrics Detail Types
 *
 * Type definitions for ML metrics detail component and its sub-components.
 */

import type { MLMetricsResponse } from '@/types/ml/ml-api-types';
import type { MetricType, TimeInterval } from '@/types/ml/ml-dashboard-types';

/**
 * Main component props
 */
export interface MLMetricsDetailProps {
  metrics: MLMetricsResponse | null;
  timeSeries: Array<{ timestamp: string; value: number }>;
  selectedMetric: MetricType;
  selectedInterval: TimeInterval;
  onMetricChange: (metric: MetricType) => void;
  onIntervalChange: (interval: TimeInterval) => void;
  onRefresh: () => void;
}

/**
 * Metric controls section props
 */
export interface MetricControlsProps {
  selectedMetric: MetricType;
  selectedInterval: TimeInterval;
  onMetricChange: (metric: MetricType) => void;
  onIntervalChange: (interval: TimeInterval) => void;
  onRefresh: () => void;
}

/**
 * Time series chart props
 */
export interface TimeSeriesChartProps {
  timeSeries: Array<{ timestamp: string; value: number }>;
  selectedMetric: MetricType;
}

/**
 * Metrics table props
 */
export interface MetricsTableProps {
  metrics: MLMetricsResponse | null;
}

/**
 * Individual metric row props
 */
export interface MetricRowProps {
  label: string;
  value: string | number;
  status?: 'good' | 'warning' | 'error';
  type?: 'badge' | 'progress';
  progressValue?: number;
  progressColor?: string;
}
