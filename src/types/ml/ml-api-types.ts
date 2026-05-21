/**
 * ML API Types
 *
 * Type definitions for ML Pattern Recognition API responses and requests.
 * These types provide strict type safety for all ML dashboard API endpoints.
 */

/**
 * Aggregated metrics from ML prediction operations
 */
export interface MLMetricsResponse {
  totalPredictions: number;
  averageConfidence: number;
  averageInferenceTime: number;
  accuracy: number;
  cacheHitRate: number;
  errorRate: number;
  predictionsByModel: Record<string, number>;
  confidenceDistribution: {
    low: number;
    medium: number;
    high: number;
  };
  timeDistribution: {
    fast: number;
    normal: number;
    slow: number;
  };
}

/**
 * Time series data point for ML metrics over time
 */
export interface MLTimeSeriesPoint {
  timestamp: string;
  value: number;
  label?: string;
}

/**
 * Time series response containing array of data points
 */
export type MLTimeSeriesResponse = MLTimeSeriesPoint[];

/**
 * Model comparison metrics - maps model type to its aggregated metrics
 */
export type MLComparisonResponse = Record<string, MLMetricsResponse>;

/**
 * ML feature flags configuration
 */
export interface MLFeatureFlags {
  mlPatternRecognition: boolean;
  mlActiveLearning: boolean;
  mlPatternEvolution: boolean;
  mlTensorFlowBackend: boolean;
  mlFallbackMode: boolean;
  enableCaching: boolean;
  enableParallelProcessing: boolean;
  enableBatchProcessing: boolean;
  experimentalParsers: boolean;
  experimentalImageOptimization: boolean;
  advancedMetadataExtraction: boolean;
  adminDashboard: boolean;
  metricsCollection: boolean;
  debugMode: boolean;
}

/**
 * ML configuration settings
 */
export interface MLConfig {
  backend: string;
  minConfidence: number;
  maxInferenceTime: number;
  version?: string;
  [key: string]: unknown; // Allow additional config fields
}

/**
 * Feature flags API response
 */
export interface MLFeatureFlagsResponse {
  flags: MLFeatureFlags;
  mlConfig: MLConfig;
  mlAvailable: boolean;
}

/**
 * ML model status information
 */
export interface MLModelStatus {
  type: string;
  available: boolean;
  config: MLModelConfig;
  path?: string;
}

/**
 * ML model configuration details
 */
export interface MLModelConfig {
  version?: string;
  backend?: string;
  [key: string]: unknown; // Allow additional config fields
}

/**
 * Models status API response - maps model type to status
 */
export type MLModelsResponse = Record<string, MLModelStatus>;

/**
 * Feature flag update request payload
 */
export interface MLFeatureFlagUpdateRequest {
  feature: keyof MLFeatureFlags;
  enabled: boolean;
}

/**
 * ML metrics query parameters
 */
export interface MLMetricsQueryParams {
  type: 'aggregated' | 'timeseries' | 'comparison';
  metricType?: 'prediction' | 'confidence' | 'inference_time' | 'accuracy';
  interval?: 'minute' | 'hour' | 'day';
}

/**
 * ML feature flags query parameters
 */
export interface MLFeatureFlagsQueryParams {
  type: 'all' | 'flag';
}

/**
 * ML models query parameters
 */
export interface MLModelsQueryParams {
  type: 'status' | 'config';
}

/**
 * Type guard for MLMetricsResponse
 */
export function isMLMetricsResponse(value: unknown): value is MLMetricsResponse {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;

  return (
    typeof obj['totalPredictions'] === 'number' &&
    typeof obj['averageConfidence'] === 'number' &&
    typeof obj['averageInferenceTime'] === 'number' &&
    typeof obj['accuracy'] === 'number' &&
    typeof obj['cacheHitRate'] === 'number' &&
    typeof obj['errorRate'] === 'number' &&
    typeof obj['predictionsByModel'] === 'object' &&
    obj['predictionsByModel'] !== null &&
    typeof obj['confidenceDistribution'] === 'object' &&
    obj['confidenceDistribution'] !== null &&
    typeof obj['timeDistribution'] === 'object' &&
    obj['timeDistribution'] !== null
  );
}

/**
 * Type guard for MLTimeSeriesPoint
 */
export function isMLTimeSeriesPoint(value: unknown): value is MLTimeSeriesPoint {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;

  return (
    typeof obj['timestamp'] === 'string' &&
    typeof obj['value'] === 'number' &&
    (obj['label'] === undefined || typeof obj['label'] === 'string')
  );
}

/**
 * Type guard for MLTimeSeriesResponse
 */
export function isMLTimeSeriesResponse(value: unknown): value is MLTimeSeriesResponse {
  if (!Array.isArray(value)) return false;
  return value.every(isMLTimeSeriesPoint);
}

/**
 * Type guard for MLComparisonResponse
 */
export function isMLComparisonResponse(value: unknown): value is MLComparisonResponse {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;

  return Object.values(obj).every(isMLMetricsResponse);
}

/**
 * Type guard for MLFeatureFlags
 */
export function isMLFeatureFlags(value: unknown): value is MLFeatureFlags {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;

  const requiredFlags: Array<keyof MLFeatureFlags> = [
    'mlPatternRecognition',
    'mlActiveLearning',
    'mlPatternEvolution',
    'mlTensorFlowBackend',
    'mlFallbackMode',
    'enableCaching',
    'enableParallelProcessing',
    'enableBatchProcessing',
    'experimentalParsers',
    'experimentalImageOptimization',
    'advancedMetadataExtraction',
    'adminDashboard',
    'metricsCollection',
    'debugMode'
  ];

  return requiredFlags.every(flag => typeof obj[flag] === 'boolean');
}

/**
 * Type guard for MLConfig
 */
export function isMLConfig(value: unknown): value is MLConfig {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;

  return (
    typeof obj['backend'] === 'string' &&
    typeof obj['minConfidence'] === 'number' &&
    typeof obj['maxInferenceTime'] === 'number'
  );
}

/**
 * Type guard for MLFeatureFlagsResponse
 */
export function isMLFeatureFlagsResponse(value: unknown): value is MLFeatureFlagsResponse {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;

  return (
    isMLFeatureFlags(obj['flags']) &&
    isMLConfig(obj['mlConfig']) &&
    typeof obj['mlAvailable'] === 'boolean'
  );
}

/**
 * Type guard for MLModelStatus
 */
export function isMLModelStatus(value: unknown): value is MLModelStatus {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;

  return (
    typeof obj['type'] === 'string' &&
    typeof obj['available'] === 'boolean' &&
    typeof obj['config'] === 'object' &&
    obj['config'] !== null &&
    (obj['path'] === undefined || typeof obj['path'] === 'string')
  );
}

/**
 * Type guard for MLModelsResponse
 */
export function isMLModelsResponse(value: unknown): value is MLModelsResponse {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;

  return Object.values(obj).every(isMLModelStatus);
}

/**
 * Type guard for MLFeatureFlagUpdateRequest
 */
export function isMLFeatureFlagUpdateRequest(
  value: unknown
): value is MLFeatureFlagUpdateRequest {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;

  return (
    typeof obj['feature'] === 'string' &&
    typeof obj['enabled'] === 'boolean'
  );
}
