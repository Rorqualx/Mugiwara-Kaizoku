/**
 * Metrics Collector for Unified Parser
 * 
 * Collects and aggregates performance metrics for monitoring
 */

import { EventEmitter } from 'events';

import type { PrismaClient } from '@prisma/client';

// ============================================================================
// Types
// ============================================================================

export interface Metric {
  name: string;
  value: number;
  timestamp: Date;
  tags?: Record<string, string>;
  type: 'counter' | 'gauge' | 'histogram' | 'timer';
}

export interface AggregatedMetrics {
  period: string;
  startTime: Date;
  endTime: Date;
  metrics: {
    requests: {
      total: number;
      successful: number;
      failed: number;
      cached: number;
    };
    performance: {
      avgResponseTime: number;
      p50ResponseTime: number;
      p95ResponseTime: number;
      p99ResponseTime: number;
      minResponseTime: number;
      maxResponseTime: number;
    };
    sources: Record<string, {
      requests: number;
      errors: number;
      avgResponseTime: number;
    }>;
    cache: {
      hits: number;
      misses: number;
      hitRate: number;
      evictions: number;
      size: number;
    };
    errors: {
      total: number;
      byType: Record<string, number>;
      bySource: Record<string, number>;
    };
    resilience: {
      retries: number;
      circuitBreakerTrips: number;
      rateLimitHits: number;
      queueSize: number;
    };
  };
}

export interface Alert {
  id: string;
  level: 'info' | 'warning' | 'error' | 'critical';
  message: string;
  timestamp: Date;
  metric?: string;
  value?: number;
  threshold?: number;
  resolved?: boolean;
}

export interface AlertRule {
  name: string;
  metric: string;
  condition: 'above' | 'below' | 'equals' | 'not_equals';
  threshold: number;
  duration?: number; // seconds
  level: Alert['level'];
  message: string;
}

// ============================================================================
// Metrics Collector Implementation
// ============================================================================

export class MetricsCollector extends EventEmitter {
  private metrics: Metric[] = [];
  private alerts: Alert[] = [];
  private alertRules: AlertRule[] = [];
  private aggregationInterval: NodeJS.Timeout | null = null;
  private cleanupInterval: NodeJS.Timeout | null = null;
  private retentionPeriod: number = 7 * 24 * 60 * 60 * 1000; // 7 days
  private prisma?: PrismaClient;

  constructor(options: {
    prisma?: PrismaClient;
    retentionDays?: number;
    aggregationIntervalMs?: number;
    enableAlerts?: boolean;
  } = {}) {
    super();

    if (options.prisma !== undefined) {
      this.prisma = options.prisma;
    }
    this.retentionPeriod = (options.retentionDays ?? 7) * 24 * 60 * 60 * 1000;
    
    // Start aggregation
    if (options.aggregationIntervalMs) {
      this.startAggregation(options.aggregationIntervalMs);
    }
    
    // Start cleanup
    this.startCleanup();
    
    // Setup default alert rules if enabled
    if (options.enableAlerts) {
      this.setupDefaultAlertRules();
    }
  }

  /**
   * Record a metric
   */
  record(metric: Omit<Metric, 'timestamp'>): void {
    const fullMetric: Metric = {
      ...metric,
      timestamp: new Date()
    };
    
    this.metrics.push(fullMetric);
    this.emit('metric', fullMetric);
    
    // Check alert rules
    this.checkAlertRules(fullMetric);

    // Persist if database available
    if (this.prisma) {
      void this.persistMetric(fullMetric);
    }
  }

  /**
   * Record a counter metric
   */
  increment(name: string, value: number = 1, tags?: Record<string, string>): void {
    this.record({
      name,
      value,
      ...(tags !== undefined ? { tags } : {}),
      type: 'counter'
    });
  }

  /**
   * Record a gauge metric
   */
  gauge(name: string, value: number, tags?: Record<string, string>): void {
    this.record({
      name,
      value,
      ...(tags !== undefined ? { tags } : {}),
      type: 'gauge'
    });
  }

  /**
   * Record a timer metric
   */
  timer(name: string, duration: number, tags?: Record<string, string>): void {
    this.record({
      name,
      value: duration,
      ...(tags !== undefined ? { tags } : {}),
      type: 'timer'
    });
  }

  /**
   * Time a function execution
   */
  async timeExecution<T>(
    name: string,
    fn: () => Promise<T>,
    tags?: Record<string, string>
  ): Promise<T> {
    const start = Date.now();
    try {
      const result = await fn();
      const duration = Date.now() - start;
      this.timer(name, duration, { ...tags, status: 'success' });
      return result;
    } catch (error: unknown) {
  const duration = Date.now() - start;
      this.timer(name, duration, { ...tags, status: "error" });
      throw error;
    }
  }

  /**
   * Get current metrics
   */
  getMetrics(options: {
    name?: string;
    tags?: Record<string, string>;
    since?: Date;
    until?: Date;
  } = {}): Metric[] {
    let filtered = this.metrics;
    
    if (options["name"]) {
      filtered = filtered.filter(m => m["name"] === options["name"]);
    }
    
    if (options["tags"]) {
      const requiredTags = options["tags"];
      filtered = filtered.filter(m => {
        const metricTags = m["tags"];
        if (!metricTags) return false;
        return Object.entries(requiredTags).every(
          ([key, value]) => metricTags[key] === value
        );
      });
    }

    if (options.since) {
      const sinceTime = options.since;
      filtered = filtered.filter(m => m.timestamp >= sinceTime);
    }

    if (options.until) {
      const untilTime = options.until;
      filtered = filtered.filter(m => m.timestamp <= untilTime);
    }
    
    return filtered;
  }

  /**
   * Get aggregated metrics
   */
  getAggregatedMetrics(
    period: '1m' | '5m' | '15m' | '1h' | '24h' = '5m'
  ): AggregatedMetrics {
    const now = new Date();
    const periodMs = this.getPeriodMs(period);
    const startTime = new Date(now.getTime() - periodMs);
    
    const periodMetrics = this.getMetrics({ since: startTime });
    
    // Calculate aggregations
    const requests = periodMetrics.filter(m => m["name"] === 'parser.request');
    const successful = requests.filter(m => m["tags"]?.["status"] === 'success').length;
    const failed = requests.filter(m => m["tags"]?.["status"] === 'error').length;
    const cached = requests.filter(m => m["tags"]?.["cached"] === 'true').length;
    
    // Response times
    const responseTimes = periodMetrics
      .filter(m => m["name"] === 'parser.response_time')
      .map(m => m.value)
      .sort((a, b) => a - b);
    
    // Source metrics
    const sources: Record<string, {
      requests: number;
      errors: number;
      avgResponseTime: number;
    }> = {};
    const sourceNames = new Set(
      periodMetrics
        .map(m => m["tags"]?.["source"])
        .filter((s): s is string => typeof s === 'string')
    );

    sourceNames.forEach(source => {
      const sourceMetrics = periodMetrics.filter(m => m["tags"]?.["source"] === source);
      sources[source] = {
        requests: sourceMetrics.filter(m => m["name"] === 'parser.request').length,
        errors: sourceMetrics.filter(m => m["tags"]?.["status"] === 'error').length,
        avgResponseTime: this.calculateAverage(
          sourceMetrics
            .filter(m => m["name"] === 'parser.response_time')
            .map(m => m.value)
        )
      };
    });
    
    // Cache metrics
    const cacheHits = periodMetrics.filter(m => m["name"] === 'cache.hit').length;
    const cacheMisses = periodMetrics.filter(m => m["name"] === 'cache.miss').length;
    const cacheTotal = cacheHits + cacheMisses;
    
    // Error metrics
    const errors = periodMetrics.filter(m => m["tags"]?.["status"] === 'error');
    const errorsByType: Record<string, number> = {};
    const errorsBySource: Record<string, number> = {};
    
    errors.forEach(error => {
      const type = error["tags"]?.["error_type"] ?? 'unknown';
      const source = error["tags"]?.["source"] ?? 'unknown';
      errorsByType[type] = (errorsByType[type] ?? 0) + 1;
      errorsBySource[source] = (errorsBySource[source] ?? 0) + 1;
    });
    
    // Resilience metrics
    const retries = periodMetrics.filter(m => m["name"] === 'retry.attempt').length;
    const circuitTrips = periodMetrics.filter(m => m["name"] === 'circuit.open').length;
    const rateLimits = periodMetrics.filter(m => m["name"] === 'rate_limit.hit').length;
    const queueSizes = periodMetrics
      .filter(m => m["name"] === 'queue.size')
      .map(m => m.value);
    
    return {
      period,
      startTime,
      endTime: now,
      metrics: {
        requests: {
          total: requests.length,
          successful,
          failed,
          cached
        },
        performance: {
          avgResponseTime: this.calculateAverage(responseTimes),
          p50ResponseTime: this.calculatePercentile(responseTimes, 50),
          p95ResponseTime: this.calculatePercentile(responseTimes, 95),
          p99ResponseTime: this.calculatePercentile(responseTimes, 99),
          minResponseTime: responseTimes.length > 0 ? Math.min(...responseTimes) : 0,
          maxResponseTime: responseTimes.length > 0 ? Math.max(...responseTimes) : 0
        },
        sources,
        cache: {
          hits: cacheHits,
          misses: cacheMisses,
          hitRate: cacheTotal > 0 ? cacheHits / cacheTotal : 0,
          evictions: periodMetrics.filter(m => m["name"] === 'cache.eviction').length,
          size: this.getLatestValue(periodMetrics, 'cache.size')
        },
        errors: {
          total: errors.length,
          byType: errorsByType,
          bySource: errorsBySource
        },
        resilience: {
          retries,
          circuitBreakerTrips: circuitTrips,
          rateLimitHits: rateLimits,
          queueSize: this.calculateAverage(queueSizes)
        }
      }
    };
  }

  /**
   * Add alert rule
   */
  addAlertRule(rule: AlertRule): void {
    this.alertRules.push(rule);
  }

  /**
   * Get active alerts
   */
  getAlerts(options: {
    level?: Alert['level'];
    resolved?: boolean;
    since?: Date;
  } = {}): Alert[] {
    let filtered = this.alerts;
    
    if (options.level) {
      filtered = filtered.filter(a => a.level === options.level);
    }
    
    if (options.resolved !== undefined) {
      filtered = filtered.filter(a => a.resolved === options.resolved);
    }
    
    if (options.since) {
      const sinceTime = options.since;
      filtered = filtered.filter(a => a.timestamp >= sinceTime);
    }
    
    return filtered;
  }

  /**
   * Export metrics for external systems
   */
  exportMetrics(format: 'prometheus' | 'json' | 'csv' = 'json'): string {
    const aggregated = this.getAggregatedMetrics('5m');
    
    switch (format) {
      case 'prometheus':
        return this.toPrometheusFormat(aggregated);
      
      case 'csv':
        return this.toCSVFormat(aggregated);
      
      case 'json':
      default:
        return JSON.stringify(aggregated, null, 2);
    }
  }

  /**
   * Get health status
   */
  getHealthStatus(): {
    status: 'healthy' | 'degraded' | 'unhealthy';
    checks: Record<string, boolean>;
    metrics: AggregatedMetrics;
    alerts: Alert[];
  } {
    const metrics = this.getAggregatedMetrics('5m');
    const activeAlerts = this.getAlerts({ resolved: false });
    const criticalAlerts = activeAlerts.filter(a => a.level === 'critical');
    const errorAlerts = activeAlerts.filter(a => a.level === 'error');
    
    // Health checks
    const checks = {
      cache: metrics.metrics.cache.hitRate > 0.5,
      errors: metrics.metrics.errors.total < metrics.metrics.requests.total * 0.1,
      performance: metrics.metrics.performance.p95ResponseTime < 5000,
      circuit: metrics.metrics.resilience.circuitBreakerTrips === 0,
      queue: metrics.metrics.resilience.queueSize < 100
    };
    
    // Determine overall status
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    
    if (criticalAlerts.length > 0 || Object.values(checks).filter(c => !c).length > 2) {
      status = 'unhealthy';
    } else if (errorAlerts.length > 0 || Object.values(checks).some(c => !c)) {
      status = 'degraded';
    }
    
    return {
      status,
      checks,
      metrics,
      alerts: activeAlerts
    };
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  private setupDefaultAlertRules(): void {
    // Error rate alert
    this.addAlertRule({
      name: 'High Error Rate',
      metric: 'error_rate',
      condition: 'above',
      threshold: 0.1,
      duration: 60,
      level: 'error',
      message: 'Error rate above 10%'
    });
    
    // Response time alert
    this.addAlertRule({
      name: 'Slow Response Time',
      metric: 'response_time_p95',
      condition: 'above',
      threshold: 5000,
      duration: 120,
      level: 'warning',
      message: 'P95 response time above 5 seconds'
    });
    
    // Cache hit rate alert
    this.addAlertRule({
      name: 'Low Cache Hit Rate',
      metric: 'cache_hit_rate',
      condition: 'below',
      threshold: 0.5,
      duration: 300,
      level: 'warning',
      message: 'Cache hit rate below 50%'
    });
    
    // Circuit breaker alert
    this.addAlertRule({
      name: 'Circuit Breaker Open',
      metric: 'circuit_breaker_open',
      condition: 'above',
      threshold: 0,
      duration: 0,
      level: 'critical',
      message: 'Circuit breaker has been triggered'
    });
  }

  private checkAlertRules(metric: Metric): void {
    // Check each alert rule
    for (const rule of this.alertRules) {
      // Simple metric name matching for now
      if (metric["name"].includes(rule.metric)) {
        const shouldAlert = this.evaluateCondition(
          metric.value,
          rule.condition,
          rule.threshold
        );
        
        if (shouldAlert) {
          this.createAlert(rule, metric);
        }
      }
    }
  }

  private evaluateCondition(
    value: number,
    condition: AlertRule['condition'],
    threshold: number
  ): boolean {
    switch (condition) {
      case 'above':
        return value > threshold;
      case 'below':
        return value < threshold;
      case 'equals':
        return value === threshold;
      case 'not_equals':
        return value !== threshold;
      default:
        return false;
    }
  }

  private createAlert(rule: AlertRule, metric: Metric): void {
    const alert: Alert = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      level: rule.level,
      message: rule.message,
      timestamp: new Date(),
      metric: metric["name"],
      value: metric.value,
      threshold: rule.threshold,
      resolved: false
    };
    
    this.alerts.push(alert);
    this.emit('alert', alert);
  }

  private startAggregation(intervalMs: number): void {
    this.aggregationInterval = setInterval(() => {
      const aggregated = this.getAggregatedMetrics('5m');
      this.emit('aggregation', aggregated);

      // Persist aggregated metrics if database available
      if (this.prisma) {
        void this.persistAggregatedMetrics(aggregated);
      }
    }, intervalMs);
  }

  private startCleanup(): void {
    // Clean up old metrics every hour
    this.cleanupInterval = setInterval(() => {
      const cutoff = new Date(Date.now() - this.retentionPeriod);
      const before = this.metrics.length;
      
      this.metrics = this.metrics.filter(m => m.timestamp > cutoff);
      this.alerts = this.alerts.filter(a => a.timestamp > cutoff);
      
      const removed = before - this.metrics.length;
      if (removed > 0) {
        this.emit('cleanup', { removed, remaining: this.metrics.length });
      }
    }, 60 * 60 * 1000);
  }

  private persistMetric(_metric: Metric): Promise<void> {
    // Implementation depends on your Prisma schema
    // This is a placeholder
    try {
      // await this.prisma.metric.create({ data: metric });
    } catch (error: unknown) {
      console.error('Failed to persist metric:', error);
    }
    return Promise.resolve();
  }

  private persistAggregatedMetrics(_aggregated: AggregatedMetrics): Promise<void> {
    // Implementation depends on your Prisma schema
    // This is a placeholder
    try {
      // await this.prisma.aggregatedMetric.create({ data: aggregated });
    } catch (error: unknown) {
      console.error('Failed to persist aggregated metrics:', error);
    }
    return Promise.resolve();
  }

  private getPeriodMs(period: string): number {
    const periods: Record<string, number> = {
      '1m': 60 * 1000,
      '5m': 5 * 60 * 1000,
      '15m': 15 * 60 * 1000,
      '1h': 60 * 60 * 1000,
      '24h': 24 * 60 * 60 * 1000
    };
    const result = periods[period];
    return result ?? (5 * 60 * 1000); // Default to 5 minutes
  }

  private calculateAverage(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((a, b) => a + b, 0) / values.length;
  }

  private calculatePercentile(values: number[], percentile: number): number {
    if (values.length === 0) return 0;
    const index = Math.ceil((percentile / 100) * values.length) - 1;
    return values[Math.max(0, index)] ?? 0;
  }

  private getLatestValue(metrics: Metric[], name: string): number {
    const matching = metrics
      .filter(m => m["name"] === name)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    return matching[0]?.value ?? 0;
  }

  private toPrometheusFormat(aggregated: AggregatedMetrics): string {
    const lines: string[] = [];
    const timestamp = Date.now();
    
    // Request metrics
    lines.push(`# HELP parser_requests_total Total number of parser requests`);
    lines.push(`# TYPE parser_requests_total counter`);
    lines.push(`parser_requests_total ${aggregated.metrics.requests.total} ${timestamp}`);
    
    // Response time metrics
    lines.push(`# HELP parser_response_time_seconds Parser response time in seconds`);
    lines.push(`# TYPE parser_response_time_seconds histogram`);
    lines.push(`parser_response_time_seconds{quantile="0.5"} ${aggregated.metrics.performance.p50ResponseTime / 1000} ${timestamp}`);
    lines.push(`parser_response_time_seconds{quantile="0.95"} ${aggregated.metrics.performance.p95ResponseTime / 1000} ${timestamp}`);
    lines.push(`parser_response_time_seconds{quantile="0.99"} ${aggregated.metrics.performance.p99ResponseTime / 1000} ${timestamp}`);
    
    // Cache metrics
    lines.push(`# HELP cache_hit_rate Cache hit rate`);
    lines.push(`# TYPE cache_hit_rate gauge`);
    lines.push(`cache_hit_rate ${aggregated.metrics.cache.hitRate} ${timestamp}`);
    
    return lines.join('\n');
  }

  private toCSVFormat(aggregated: AggregatedMetrics): string {
    const rows: string[] = [];
    rows.push('metric,value,timestamp');
    
    const timestamp = aggregated.endTime.toISOString();
    
    rows.push(`requests_total,${aggregated.metrics.requests.total},${timestamp}`);
    rows.push(`requests_successful,${aggregated.metrics.requests.successful},${timestamp}`);
    rows.push(`requests_failed,${aggregated.metrics.requests.failed},${timestamp}`);
    rows.push(`response_time_avg,${aggregated.metrics.performance.avgResponseTime},${timestamp}`);
    rows.push(`cache_hit_rate,${aggregated.metrics.cache.hitRate},${timestamp}`);
    rows.push(`errors_total,${aggregated.metrics.errors.total},${timestamp}`);
    
    return rows.join('\n');
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    if (this.aggregationInterval) {
      clearInterval(this.aggregationInterval);
    }
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.removeAllListeners();
  }
}

// ============================================================================
// Factory Function
// ============================================================================

export function createMetricsCollector(options?: {
  prisma?: PrismaClient;
  retentionDays?: number;
  enableAlerts?: boolean;
}): MetricsCollector {
  return new MetricsCollector(options);
}