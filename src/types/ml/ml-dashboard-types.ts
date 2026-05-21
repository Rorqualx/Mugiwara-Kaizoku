/**
 * ML Dashboard Component Types
 *
 * Type definitions for ML dashboard React components, props, and state.
 * Provides strict typing for component interfaces and event handlers.
 */

import type {
  MLMetricsResponse,
  MLTimeSeriesPoint,
  MLComparisonResponse,
  MLFeatureFlags,
  MLConfig,
  MLModelsResponse
} from './ml-api-types';
import type { ChartData } from 'chart.js';

/**
 * ML Dashboard main component state
 */
export interface MLDashboardState {
  loading: boolean;
  error: string | null;
  notification: string | null;
  metrics: MLMetricsResponse | null;
  timeSeries: MLTimeSeriesPoint[];
  modelComparison: MLComparisonResponse;
  featureFlags: MLFeatureFlags | null;
  mlConfig: MLConfig | null;
  mlAvailable: boolean;
  modelStatus: MLModelsResponse;
  selectedMetric: MetricType;
  selectedInterval: TimeInterval;
  autoRefresh: boolean;
}

/**
 * Metric type selection
 */
export type MetricType = 'prediction' | 'confidence' | 'inference_time' | 'accuracy';

/**
 * Time interval selection
 */
export type TimeInterval = 'minute' | 'hour' | 'day';

/**
 * Overview panel component props
 */
export interface MLOverviewPanelProps {
  metrics: MLMetricsResponse | null;
  timeSeries: MLTimeSeriesPoint[];
  modelComparison: MLComparisonResponse;
  timeSeriesChartData: ChartData<'line'>;
  confidenceChartData: ChartData<'pie'>;
  modelComparisonChartData: ChartData<'bar'>;
}

/**
 * Metrics panel component props
 */
export interface MLMetricsPanelProps {
  metrics: MLMetricsResponse | null;
  timeSeries: MLTimeSeriesPoint[];
  selectedMetric: MetricType;
  selectedInterval: TimeInterval;
  timeSeriesChartData: ChartData<'line'>;
  onMetricChange: (metric: MetricType) => void;
  onIntervalChange: (interval: TimeInterval) => void;
  onRefresh: () => void;
}

/**
 * Models panel component props
 */
export interface MLModelsPanelProps {
  modelStatus: MLModelsResponse;
}

/**
 * Settings panel component props
 */
export interface MLSettingsPanelProps {
  featureFlags: MLFeatureFlags | null;
  mlConfig: MLConfig | null;
  mlAvailable: boolean;
  onFeatureFlagUpdate: (feature: keyof MLFeatureFlags, enabled: boolean) => void;
}

/**
 * Metric card component props
 */
export interface MetricCardProps {
  title: string;
  value: string | number;
  icon?: React.ReactNode;
  color?: string;
  showProgress?: boolean;
  progressValue?: number;
}

/**
 * Model status card component props
 */
export interface ModelStatusCardProps {
  type: string;
  available: boolean;
  config: {
    version?: string;
    backend?: string;
    [key: string]: unknown;
  };
  path?: string;
}

/**
 * Feature flag switch component props
 */
export interface FeatureFlagSwitchProps {
  flagKey: keyof MLFeatureFlags;
  enabled: boolean;
  onChange: (enabled: boolean) => void;
  disabled?: boolean;
}

/**
 * Chart configuration options
 */
export interface ChartOptions {
  responsive?: boolean;
  maintainAspectRatio?: boolean;
  plugins?: {
    legend?: {
      display?: boolean;
      position?: 'top' | 'bottom' | 'left' | 'right';
    };
    tooltip?: {
      enabled?: boolean;
    };
  };
}

/**
 * Dashboard actions
 */
export interface MLDashboardActions {
  fetchData: () => Promise<void>;
  updateFeatureFlag: (feature: keyof MLFeatureFlags, enabled: boolean) => Promise<void>;
  setSelectedMetric: (metric: MetricType) => void;
  setSelectedInterval: (interval: TimeInterval) => void;
  setAutoRefresh: (enabled: boolean) => void;
  showNotification: (message: string) => void;
  showError: (error: string) => void;
  clearNotification: () => void;
  clearError: () => void;
}

/**
 * Event handlers for ML dashboard
 */
export interface MLDashboardEventHandlers {
  onRefresh: () => void;
  onMetricChange: (metric: MetricType) => void;
  onIntervalChange: (interval: TimeInterval) => void;
  onAutoRefreshToggle: (enabled: boolean) => void;
  onFeatureFlagToggle: (feature: keyof MLFeatureFlags, enabled: boolean) => void;
}

/**
 * Select option for dropdowns
 */
export interface SelectOption<T = string> {
  value: T;
  label: string;
}

/**
 * Metric select options
 */
export const METRIC_OPTIONS: Array<SelectOption<MetricType>> = [
  { value: 'prediction', label: 'Predictions' },
  { value: 'confidence', label: 'Confidence' },
  { value: 'inference_time', label: 'Inference Time' },
  { value: 'accuracy', label: 'Accuracy' }
];

/**
 * Time interval select options
 */
export const INTERVAL_OPTIONS: Array<SelectOption<TimeInterval>> = [
  { value: 'minute', label: 'Minute' },
  { value: 'hour', label: 'Hour' },
  { value: 'day', label: 'Day' }
];

/**
 * Confidence level thresholds
 */
export interface ConfidenceThresholds {
  low: number; // < 0.5
  medium: number; // 0.5 - 0.8
  high: number; // > 0.8
}

/**
 * Performance thresholds for inference time (in milliseconds)
 */
export interface PerformanceThresholds {
  fast: number; // < 10ms
  normal: number; // 10-50ms
  slow: number; // > 50ms
}

/**
 * Dashboard refresh settings
 */
export interface RefreshSettings {
  enabled: boolean;
  intervalMs: number; // Default: 30000 (30 seconds)
}

/**
 * Error boundary state for ML dashboard
 */
export interface MLDashboardErrorState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

/**
 * Loading states for different sections
 */
export interface LoadingStates {
  metrics: boolean;
  timeSeries: boolean;
  modelComparison: boolean;
  featureFlags: boolean;
  modelStatus: boolean;
}
