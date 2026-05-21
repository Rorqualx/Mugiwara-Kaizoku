/**
 * Performance Monitor
 * 
 * Monitors and tracks performance metrics for the Pattern Recognition Engine.
 * Provides real-time insights and alerts for performance issues.
 */

import { EventEmitter } from 'events';

import { logger } from '@/utils/logger';

export class PerformanceMonitor extends EventEmitter {
  private metrics: {
    inferenceTime: number[],
    featureExtractionTime: number[],
    cacheHitRate: number[],
    memoryUsage: number[],
    errorRate: number[]
  };
  
  private intervals: {
    metricsCollection?: NodeJS.Timeout,
    reporting?: NodeJS.Timeout,
    cleanup?: NodeJS.Timeout
  } = {};
  
  private config = {
    collectionInterval: 5000, // 5 seconds
    reportingInterval: 60000, // 1 minute
    cleanupInterval: 300000, // 5 minutes
    maxMetricHistory: 1000,
    alertThresholds: {
      inferenceTime: 100, // ms
      memoryUsage: 400, // MB
      errorRate: 0.1 // 10%
    }
  };
  
  private startTime: Date;
  private totalOperations = 0;
  private totalErrors = 0;

  constructor() {
    super();
    this.metrics = {
      inferenceTime: [],
      featureExtractionTime: [],
      cacheHitRate: [],
      memoryUsage: [],
      errorRate: []
    };
    this.startTime = new Date();
  }

  /**
   * Start monitoring
   */
  start(): void {
    // Collect metrics periodically
    this.intervals.metricsCollection = setInterval(() => {
      this.collectMetrics();
    }, this.config.collectionInterval);
    
    // Report metrics periodically
    this.intervals.reporting = setInterval(() => {
      this.reportMetrics();
    }, this.config.reportingInterval);
    
    // Clean up old metrics
    this.intervals.cleanup = setInterval(() => {
      this.cleanupMetrics();
    }, this.config.cleanupInterval);
    
    logger.info('Performance monitoring started');
  }

  /**
   * Stop monitoring
   */
  stop(): void {
    if (this.intervals.metricsCollection) {
      clearInterval(this.intervals.metricsCollection);
    }
    if (this.intervals.reporting) {
      clearInterval(this.intervals.reporting);
    }
    if (this.intervals.cleanup) {
      clearInterval(this.intervals.cleanup);
    }
    
    logger.info('Performance monitoring stopped');
  }

  /**
   * Record inference time
   */
  recordInferenceTime(timeMs: number): void {
    this.metrics.inferenceTime.push(timeMs);
    this.totalOperations++;
    
    // Check threshold
    if (timeMs > this.config.alertThresholds.inferenceTime) {
      this.emit('alert', {
        type: 'high_inference_time',
        value: timeMs,
        threshold: this.config.alertThresholds.inferenceTime
      });
    }
  }

  /**
   * Record feature extraction time
   */
  recordFeatureExtractionTime(timeMs: number): void {
    this.metrics.featureExtractionTime.push(timeMs);
  }

  /**
   * Record cache hit rate
   */
  recordCacheHitRate(rate: number): void {
    this.metrics.cacheHitRate.push(rate);
  }

  /**
   * Record error
   */
  recordError(error: Error): void {
    this.totalErrors++;
    const errorRate = this.totalErrors / this.totalOperations;
    this.metrics.errorRate.push(errorRate);
    
    // Check threshold
    if (errorRate > this.config.alertThresholds.errorRate) {
      this.emit('alert', {
        type: 'high_error_rate',
        value: errorRate,
        threshold: this.config.alertThresholds.errorRate,
        error: (error instanceof Error ? error.message : String(error))
      });
    }
  }

  /**
   * Collect current metrics
   */
  private collectMetrics(): void {
    // Memory usage
    const memoryUsage = process.memoryUsage().heapUsed / 1024 / 1024; // MB
    this.metrics.memoryUsage.push(memoryUsage);
    
    // Check memory threshold
    if (memoryUsage > this.config.alertThresholds.memoryUsage) {
      this.emit('alert', {
        type: 'high_memory_usage',
        value: memoryUsage,
        threshold: this.config.alertThresholds.memoryUsage
      });
    }
  }

  /**
   * Report aggregated metrics
   */
  private reportMetrics(): void {
    const report = {
      timestamp: new Date(),
      uptime: Date.now() - this.startTime.getTime(),
      operations: {
        total: this.totalOperations,
        errors: this.totalErrors,
        errorRate: this.totalErrors / this.totalOperations || 0
      },
      performance: {
        inferenceTime: this.calculateStats(this.metrics.inferenceTime),
        featureExtractionTime: this.calculateStats(this.metrics.featureExtractionTime),
        cacheHitRate: this.calculateStats(this.metrics.cacheHitRate)
      },
      resources: {
        memoryUsage: this.calculateStats(this.metrics.memoryUsage),
        cpuUsage: process.cpuUsage()
      }
    };
    
    this.emit('report', report);
    
    // Log summary
    logger.info(`Performance Report:
      Operations: ${report.operations.total} (${report.operations.errorRate.toFixed(2)}% errors)
      Avg Inference: ${report.performance.inferenceTime.mean.toFixed(2)}ms
      Avg Memory: ${report.resources.memoryUsage.mean.toFixed(2)}MB
      Cache Hit Rate: ${(report.performance.cacheHitRate.mean * 100).toFixed(2)}%`);
  }

  /**
   * Clean up old metrics
   */
  private cleanupMetrics(): void {
    const maxSize = this.config.maxMetricHistory;
    
    for (const key in this.metrics) {
      const metric = this.metrics[key as keyof typeof this.metrics];
      if (metric.length > maxSize) {
        // Keep only recent metrics
        this.metrics[key as keyof typeof this.metrics] = metric.slice(-maxSize);
      }
    }
  }

  /**
   * Calculate statistics for a metric
   */
  private calculateStats(values: number[]): {
    mean: number,
    median: number,
    min: number,
    max: number,
    p95: number,
    p99: number
  } {
    if (values.length === 0) {
      return { mean: 0, median: 0, min: 0, max: 0, p95: 0, p99: 0 };
    }
    
    const sorted = [...values].sort((a, b) => a - b);
    const sum = values.reduce((a, b) => a + b, 0);
    
    return {
      mean: sum / values.length,
      median: sorted[Math.floor(sorted.length / 2)] ?? 0,
      min: sorted[0] ?? 0,
      max: sorted[sorted.length - 1] ?? 0,
      p95: sorted[Math.floor(sorted.length * 0.95)] ?? 0,
      p99: sorted[Math.floor(sorted.length * 0.99)] ?? 0
    };
  }

  /**
   * Get current statistics
   */
  getStatistics(): {
    uptime: number,
    totalOperations: number,
    totalErrors: number,
    errorRate: number,
    averageInferenceTime: number,
    averageMemoryUsage: number,
    currentMemoryUsage: number
  } {
    const uptimeMs = Date.now() - this.startTime.getTime();
    
    return {
      uptime: uptimeMs,
      totalOperations: this.totalOperations,
      totalErrors: this.totalErrors,
      errorRate: this.totalOperations > 0 ? this.totalErrors / this.totalOperations : 0,
      averageInferenceTime: this.metrics.inferenceTime.length > 0
        ? this.metrics.inferenceTime.reduce((a, b) => a + b, 0) / this.metrics.inferenceTime.length
        : 0,
      averageMemoryUsage: this.metrics.memoryUsage.length > 0
        ? this.metrics.memoryUsage.reduce((a, b) => a + b, 0) / this.metrics.memoryUsage.length
        : 0,
      currentMemoryUsage: process.memoryUsage().heapUsed / 1024 / 1024
    };
  }

  /**
   * Get detailed metrics
   */
  getDetailedMetrics(): typeof this.metrics {
    return { ...this.metrics };
  }

  /**
   * Reset metrics
   */
  reset(): void {
    this.metrics = {
      inferenceTime: [],
      featureExtractionTime: [],
      cacheHitRate: [],
      memoryUsage: [],
      errorRate: []
    };
    this.totalOperations = 0;
    this.totalErrors = 0;
    this.startTime = new Date();
  }

  /**
   * Export metrics for analysis
   */
  exportMetrics(): {
    startTime: Date,
    endTime: Date,
    metrics: unknown,
    statistics: unknown
  } {
    return {
      startTime: this.startTime,
      endTime: new Date(),
      metrics: this.getDetailedMetrics(),
      statistics: this.getStatistics()
    };
  }

  /**
   * Set alert threshold
   */
  setAlertThreshold(metric: keyof typeof this.config.alertThresholds, value: number): void {
    this.config.alertThresholds[metric] = value;
  }

  /**
   * Get health status
   */
  getHealthStatus(): {
    status: 'healthy' | 'warning' | 'critical',
    issues: string[]
  } {
    const issues: string[] = [];
    const stats = this.getStatistics();
    
    // Check error rate
    if (stats.errorRate > 0.2) {
      issues.push(`High error rate: ${(stats.errorRate * 100).toFixed(2)}%`);
    } else if (stats.errorRate > 0.1) {
      issues.push(`Elevated error rate: ${(stats.errorRate * 100).toFixed(2)}%`);
    }
    
    // Check memory usage
    if (stats.currentMemoryUsage > 500) {
      issues.push(`High memory usage: ${stats.currentMemoryUsage.toFixed(2)}MB`);
    } else if (stats.currentMemoryUsage > 400) {
      issues.push(`Elevated memory usage: ${stats.currentMemoryUsage.toFixed(2)}MB`);
    }
    
    // Check inference time
    if (stats.averageInferenceTime > 100) {
      issues.push(`Slow inference: ${stats.averageInferenceTime.toFixed(2)}ms`);
    } else if (stats.averageInferenceTime > 50) {
      issues.push(`Inference time increasing: ${stats.averageInferenceTime.toFixed(2)}ms`);
    }
    
    // Determine overall status
    let status: 'healthy' | 'warning' | 'critical' = 'healthy';
    if (issues.length > 2 || stats.errorRate > 0.2 || stats.currentMemoryUsage > 500) {
      status = 'critical';
    } else if (issues.length > 0) {
      status = 'warning';
    }
    
    return { status, issues };
  }
}