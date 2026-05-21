/**
 * ML Metrics Collection Service
 * 
 * Collects, aggregates, and provides analytics for ML model performance,
 * predictions, and system metrics.
 */

import { EventEmitter } from 'events';

import { isFeatureEnabled } from '@/server/config/feature-flags';
import { ModelType } from '@/server/config/ml-config';
import { logger } from '@/utils/logger';

/**
 * Metric types
 */
export enum MetricType {
  PREDICTION = 'prediction',
  ACCURACY = 'accuracy',
  CONFIDENCE = 'confidence',
  INFERENCE_TIME = 'inference_time',
  CACHE_HIT = 'cache_hit',
  ERROR = 'error',
  TRAINING = 'training',
  FEEDBACK = 'feedback'
}

/**
 * Prediction metric
 */
export interface PredictionMetric {
  id: string;
  timestamp: Date;
  modelType: ModelType;
  modelVersion: string;
  inputHash: string;
  confidence: number;
  inferenceTime: number;
  prediction: unknown;
  actual?: unknown;
  correct?: boolean;
  metadata?: Record<string, unknown>;
}

/**
 * Aggregated metrics
 */
export interface AggregatedMetrics {
  totalPredictions: number;
  averageConfidence: number;
  averageInferenceTime: number;
  accuracy: number;
  cacheHitRate: number;
  errorRate: number;
  predictionsByModel: Record<string, number>;
  confidenceDistribution: {
    low: number;    // < 0.5
    medium: number; // 0.5 - 0.8
    high: number;   // > 0.8
  };
  timeDistribution: {
    fast: number;   // < 10ms
    normal: number; // 10-50ms
    slow: number;   // > 50ms
  };
}

/**
 * Time series data point
 */
export interface TimeSeriesPoint {
  timestamp: Date;
  value: number;
  label?: string;
}

/**
 * ML Metrics Service
 */
export class MLMetricsService extends EventEmitter {
  private static instance: MLMetricsService;
  private metrics: Map<string, PredictionMetric[]> = new Map();
  private aggregatedCache: Map<string, AggregatedMetrics> = new Map();
  private cacheTimeout = 60000; // 1 minute cache
  private maxMetricsInMemory = 10000;
  private flushInterval: NodeJS.Timeout | null = null;
  
  private constructor() {
    super();
    this.startFlushInterval();
  }
  
  /**
   * Get singleton instance
   */
  public static getInstance(): MLMetricsService {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (!MLMetricsService.instance) {
      MLMetricsService.instance = new MLMetricsService();
    }
    return MLMetricsService.instance;
  }
  
  /**
   * Record a prediction metric
   */
  public recordPrediction(metric: Omit<PredictionMetric, 'id' | 'timestamp'>): Promise<void> {
    if (!isFeatureEnabled('metricsCollection')) {
      return Promise.resolve();
    }
    
    const fullMetric: PredictionMetric = {
      ...metric,
      id: this.generateMetricId(),
      timestamp: new Date()
    };
    
    // Store in memory
    const key = `${metric.modelType}_${metric.modelVersion}`;
    if (!this.metrics.has(key)) {
      this.metrics.set(key, []);
    }

    const modelMetrics = this.metrics.get(key);
    if (!modelMetrics) {
      logger.error('[MLMetrics] Failed to get metrics array after setting it');
      return Promise.resolve();
    }

    modelMetrics.push(fullMetric);

    // Trim if too many in memory
    if (modelMetrics.length > this.maxMetricsInMemory) {
      modelMetrics.shift();
    }
    
    // Invalidate cache
    this.aggregatedCache.delete(key);
    
    // Emit event for real-time monitoring
    this.emit('prediction', fullMetric);
    
    // Log if in debug mode
    if (isFeatureEnabled('debugMode')) {
      logger.debug('[MLMetrics] Prediction recorded:', {
        model: metric.modelType,
        confidence: metric.confidence.toFixed(3),
        time: `${metric.inferenceTime}ms`
      });
    }

    return Promise.resolve();
  }

  /**
   * Record user feedback
   */
  public recordFeedback(
    predictionId: string,
    correct: boolean,
    actualValue?: unknown,
    feedback?: string
  ): Promise<void> {
    if (!isFeatureEnabled('metricsCollection')) {
      return Promise.resolve();
    }
    
    // Find the prediction metric
    for (const [key, metrics] of this.metrics.entries()) {
      const metric = metrics.find(m => m["id"] === predictionId);
      if (metric) {
        metric.correct = correct;
        metric.actual = actualValue;
        
        if (feedback) {
          metric["metadata"] = { ...metric["metadata"], feedback };
        }
        
        // Emit feedback event
        this.emit('feedback', {
          predictionId,
          correct,
          actualValue,
          feedback
        });
        
        // Invalidate cache
        this.aggregatedCache.delete(key);
        
        logger.info('[MLMetrics] Feedback recorded for prediction:', predictionId);
        break;
      }
    }

    return Promise.resolve();
  }

  /**
   * Get aggregated metrics
   */
  public getAggregatedMetrics(
    modelType?: ModelType,
    timeRange?: { start: Date; end: Date }
  ): Promise<AggregatedMetrics> {
    const cacheKey = `${modelType || 'all'}_${timeRange?.start.getTime() ?? 0}_${timeRange?.end.getTime() ?? 0}`;

    // Check cache
    const cachedMetrics = this.aggregatedCache.get(cacheKey);
    if (cachedMetrics !== undefined) {
      return Promise.resolve(cachedMetrics);
    }
    
    // Collect relevant metrics
    let allMetrics: PredictionMetric[] = [];
    
    if (modelType) {
      // Get metrics for specific model
      for (const [key, metrics] of this.metrics.entries()) {
        if (key.startsWith(modelType)) {
          allMetrics.push(...metrics);
        }
      }
    } else {
      // Get all metrics
      for (const metrics of this.metrics.values()) {
        allMetrics.push(...metrics);
      }
    }
    
    // Apply time filter
    if (timeRange) {
      allMetrics = allMetrics.filter(m => 
        m.timestamp >= timeRange.start && m.timestamp <= timeRange.end
      );
    }
    
    // Calculate aggregated metrics
    const aggregated = this.calculateAggregatedMetrics(allMetrics);

    // Cache result
    this.aggregatedCache.set(cacheKey, aggregated);
    setTimeout(() => this.aggregatedCache.delete(cacheKey), this.cacheTimeout);

    return Promise.resolve(aggregated);
  }

  /**
   * Get time series data
   */
  public getTimeSeries(
    metricType: MetricType,
    modelType?: ModelType,
    timeRange?: { start: Date; end: Date },
    interval: 'minute' | 'hour' | 'day' = 'hour'
  ): Promise<TimeSeriesPoint[]> {
    // Collect relevant metrics
    let allMetrics: PredictionMetric[] = [];
    
    if (modelType) {
      for (const [key, metrics] of this.metrics.entries()) {
        if (key.startsWith(modelType)) {
          allMetrics.push(...metrics);
        }
      }
    } else {
      for (const metrics of this.metrics.values()) {
        allMetrics.push(...metrics);
      }
    }
    
    // Apply time filter
    if (timeRange) {
      allMetrics = allMetrics.filter(m => 
        m.timestamp >= timeRange.start && m.timestamp <= timeRange.end
      );
    }
    
    // Group by interval
    const grouped = this.groupByInterval(allMetrics, interval);
    
    // Calculate metric values for each interval
    const timeSeries: TimeSeriesPoint[] = [];
    
    for (const [timestamp, metrics] of grouped.entries()) {
      let value = 0;

      switch (metricType) {
        case MetricType.PREDICTION:
          value = metrics.length;
          break;
        case MetricType.CONFIDENCE:
          value = metrics.reduce((sum, m) => sum + m.confidence, 0) / metrics.length;
          break;
        case MetricType.INFERENCE_TIME:
          value = metrics.reduce((sum, m) => sum + m.inferenceTime, 0) / metrics.length;
          break;
        case MetricType.ACCURACY: {
          const correct = metrics.filter(m => m.correct === true).length;
          value = metrics.length > 0 ? correct / metrics.length : 0;
          break;
        }
        default:
          logger.warn('[MLMetrics] Unknown metric type:', metricType);
          value = 0;
          break;
      }

      timeSeries.push({
        timestamp: new Date(timestamp),
        value,
        label: new Date(timestamp).toISOString()
      });
    }

    return Promise.resolve(timeSeries.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime()));
  }

  /**
   * Get model comparison metrics
   */
  public async getModelComparison(): Promise<Record<string, AggregatedMetrics>> {
    const comparison: Record<string, AggregatedMetrics> = {};

    // Get metrics for each model type
    const modelTypes = Object.values(ModelType);
    const results = await Promise.all(
      modelTypes.map(async (modelType) => ({
        modelType,
        metrics: await this.getAggregatedMetrics(modelType)
      }))
    );

    for (const { modelType, metrics } of results) {
      comparison[modelType] = metrics;
    }

    return comparison;
  }
  
  /**
   * Calculate aggregated metrics from raw metrics
   */
  private calculateAggregatedMetrics(metrics: PredictionMetric[]): AggregatedMetrics {
    if (metrics.length === 0) {
      return this.getEmptyAggregatedMetrics();
    }
    
    const totalPredictions = metrics.length;
    const averageConfidence = metrics.reduce((sum, m) => sum + m.confidence, 0) / totalPredictions;
    const averageInferenceTime = metrics.reduce((sum, m) => sum + m.inferenceTime, 0) / totalPredictions;
    
    // Calculate accuracy
    const metricsWithFeedback = metrics.filter(m => m.correct !== undefined);
    const correctPredictions = metricsWithFeedback.filter(m => m.correct === true).length;
    const accuracy = metricsWithFeedback.length > 0 ? correctPredictions / metricsWithFeedback.length : 0;
    
    // Calculate cache hit rate (simplified - would need actual cache data)
    const cacheHitRate = 0; // TODO: Implement actual cache tracking
    
    // Calculate error rate
    const errors = metrics.filter(m => m["metadata"]?.["error"] === true).length;
    const errorRate = errors / totalPredictions;
    
    // Predictions by model
    const predictionsByModel: Record<string, number> = {};
    metrics.forEach(m => {
      predictionsByModel[m.modelType] = (predictionsByModel[m.modelType] ?? 0) + 1;
    });
    
    // Confidence distribution
    const confidenceDistribution = {
      low: metrics.filter(m => m.confidence < 0.5).length,
      medium: metrics.filter(m => m.confidence >= 0.5 && m.confidence < 0.8).length,
      high: metrics.filter(m => m.confidence >= 0.8).length
    };
    
    // Time distribution
    const timeDistribution = {
      fast: metrics.filter(m => m.inferenceTime < 10).length,
      normal: metrics.filter(m => m.inferenceTime >= 10 && m.inferenceTime < 50).length,
      slow: metrics.filter(m => m.inferenceTime >= 50).length
    };
    
    return {
      totalPredictions,
      averageConfidence,
      averageInferenceTime,
      accuracy,
      cacheHitRate,
      errorRate,
      predictionsByModel,
      confidenceDistribution,
      timeDistribution
    };
  }
  
  /**
   * Get empty aggregated metrics
   */
  private getEmptyAggregatedMetrics(): AggregatedMetrics {
    return {
      totalPredictions: 0,
      averageConfidence: 0,
      averageInferenceTime: 0,
      accuracy: 0,
      cacheHitRate: 0,
      errorRate: 0,
      predictionsByModel: {},
      confidenceDistribution: { low: 0, medium: 0, high: 0 },
      timeDistribution: { fast: 0, normal: 0, slow: 0 }
    };
  }
  
  /**
   * Group metrics by time interval
   */
  private groupByInterval(
    metrics: PredictionMetric[],
    interval: 'minute' | 'hour' | 'day'
  ): Map<number, PredictionMetric[]> {
    const grouped = new Map<number, PredictionMetric[]>();
    
    const intervalMs = {
      minute: 60000,
      hour: 3600000,
      day: 86400000
    }[interval];
    
    metrics.forEach(metric => {
      const bucket = Math.floor(metric.timestamp.getTime() / intervalMs) * intervalMs;
      
      if (!grouped.has(bucket)) {
        grouped.set(bucket, []);
      }

      const bucketMetrics = grouped.get(bucket);
      if (bucketMetrics) {
        bucketMetrics.push(metric);
      }
    });
    
    return grouped;
  }
  
  /**
   * Generate unique metric ID
   */
  private generateMetricId(): string {
    return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  /**
   * Start flush interval
   */
  private startFlushInterval(): void {
    if (!isFeatureEnabled('metricsCollection')) {
      return;
    }
    
    // Flush metrics to database every 5 minutes
    this.flushInterval = setInterval(() => {
      this.flushToDatabase();
    }, 300000); // 5 minutes
  }
  
  /**
   * Flush metrics to database
   */
  private flushToDatabase(): void {
    try {
      const allMetrics: PredictionMetric[] = [];

      for (const metrics of this.metrics.values()) {
        allMetrics.push(...metrics);
      }

      if (allMetrics.length === 0) {
        return;
      }

      // Store in database (would need Prisma schema update)
      // await prisma.mLMetric.createMany({
      //   data: allMetrics.map(m => ({
      //     ...m,
      //     prediction: JSON.stringify(m.prediction),
      //     actual: m.actual ? JSON.stringify(m.actual) : null,
      //     metadata: m["metadata"] ? JSON.stringify(m["metadata"]) : null
      //   }))
      // });

      logger.info(`[MLMetrics] Flushed ${allMetrics.length} metrics to database`);

      // Clear old metrics from memory
      const cutoffTime = new Date(Date.now() - 3600000); // 1 hour ago
      for (const [key, metrics] of this.metrics.entries()) {
        this.metrics.set(key, metrics.filter(m => m.timestamp > cutoffTime));
      }
    } catch (error: unknown) {const errorMessage = error instanceof Error ? error.message : String(error);
logger.error('[MLMetrics] Failed to flush metrics:', errorMessage);
    }
  }
  
  /**
   * Stop the service
   */
  public stop(): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }

    // Final flush
    this.flushToDatabase();
  }
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Get ML metrics service instance
 */
export function getMLMetricsService(): MLMetricsService {
  return MLMetricsService.getInstance();
}

/**
 * Record ML prediction options
 */
export interface RecordMLPredictionOptions {
  modelType: ModelType;
  modelVersion: string;
  confidence: number;
  inferenceTime: number;
  prediction: unknown;
  metadata?: Record<string, unknown>;
}

/**
 * Record a prediction
 */
export async function recordMLPrediction(
  options: RecordMLPredictionOptions
): Promise<void> {
  const { modelType, modelVersion, confidence, inferenceTime, prediction, metadata } = options;
  const predictionData: Record<string, unknown> = {
    modelType,
    modelVersion,
    inputHash: '', // Can be computed from input
    confidence,
    inferenceTime,
    prediction
  };
  if (metadata) {
    predictionData['metadata'] = metadata;
  }
  await getMLMetricsService().recordPrediction(predictionData as unknown as Omit<PredictionMetric, 'id' | 'timestamp'>);
}

// ============================================================================
// Default Export
// ============================================================================

export default MLMetricsService;