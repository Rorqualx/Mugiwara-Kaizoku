/**
 * Monitoring and Alerting Service
 * 
 * Provides system monitoring, health checks, and alerting capabilities
 */

import { EventEmitter } from 'events';
import os from 'os';

import { prisma } from '@/server/db';
import { getCpuUsagePercent, getProcessCpuPercent } from '@/server/utils/system-cpu';
import { getDiskUsage } from '@/server/utils/system-disk';
import { getAvailableMemory } from '@/server/utils/system-memory';
import { logger } from '@/utils/logger';

import { createWebSocketApiAdapter } from '../adapters/WebSocketApiAdapter';

import { performanceService } from './performanceService';
import { websocketService } from './websocketService';

interface HealthCheck {
  name: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  message?: string;
  lastCheck: Date;
  metadata?: Record<string, unknown>;
}

interface Alert {
  id: string;
  level: 'info' | 'warning' | 'critical';
  type: string;
  title: string;
  message: string;
  timestamp: Date;
  resolved: boolean;
  metadata?: Record<string, unknown>;
}

interface Threshold {
  metric: string;
  warning: number;
  critical: number;
  duration?: number; // How long the condition must persist
}

interface SystemMetrics {
  cpu: {
    usage: number;
    loadAverage: number[];
  };
  memory: {
    total: number;
    used: number;
    free: number;
    percentage: number;
  };
  disk: {
    total: number;
    used: number;
    free: number;
    percentage: number;
  };
  process: {
    uptime: number;
    pid: number;
    memory: number;
    cpu: number;
  };
}

export class MonitoringService extends EventEmitter {
  private healthChecks: Map<string, HealthCheck> = new Map();
  private alerts: Map<string, Alert> = new Map();
  private thresholds: Map<string, Threshold> = new Map();
  private _wsAdapter: ReturnType<typeof createWebSocketApiAdapter> | null = null;

  // Monitoring intervals
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private metricsInterval: NodeJS.Timeout | null = null;
  private alertCheckInterval: NodeJS.Timeout | null = null;

  // Metric history for trend analysis
  private metricHistory: Map<string, Array<{ value: number; timestamp: Date }>> = new Map();
  private readonly maxHistorySize = 100;

  constructor() {
    super();
    this.initializeThresholds();
    this.startMonitoring();
  }

  /**
   * Lazy initialization of WebSocket adapter to avoid circular dependency issues
   */
  private get wsAdapter(): ReturnType<typeof createWebSocketApiAdapter> {
    this._wsAdapter ??= createWebSocketApiAdapter();
    return this._wsAdapter;
  }

  /**
   * Initialize default thresholds
   */
  private initializeThresholds(): void {
    // System thresholds
    this.thresholds.set('cpu.usage', { metric: 'cpu.usage', warning: 70, critical: 90, duration: 60000 });
    this.thresholds.set('memory.percentage', { metric: 'memory.percentage', warning: 80, critical: 95 });
    this.thresholds.set('disk.percentage', { metric: 'disk.percentage', warning: 80, critical: 90 });
    
    // API thresholds
    this.thresholds.set('api.errorRate', { metric: 'api.errorRate', warning: 5, critical: 10 });
    this.thresholds.set('api.responseTime', { metric: 'api.responseTime', warning: 1000, critical: 3000 });
    this.thresholds.set('api.requestsPerSecond', { metric: 'api.requestsPerSecond', warning: 100, critical: 200 });
    
    // Database thresholds
    this.thresholds.set('db.connectionCount', { metric: 'db.connectionCount', warning: 80, critical: 95 });
    this.thresholds.set('db.queryTime', { metric: 'db.queryTime', warning: 500, critical: 1000 });
    
    // WebSocket thresholds
    this.thresholds.set('ws.connections', { metric: 'ws.connections', warning: 1000, critical: 5000 });
  }

  /**
   * Start monitoring
   */
  private startMonitoring(): void {
    // Health checks every 30 seconds
    this.healthCheckInterval = setInterval(() => {
      void this.runHealthChecks();
    }, 30000);
    
    // Metrics collection every 10 seconds
    this.metricsInterval = setInterval(() => {
      void this.collectMetrics();
    }, 10000);
    
    // Alert checks every 5 seconds
    this.alertCheckInterval = setInterval(() => {
      void this.checkAlerts();
    }, 5000);
    
    // Initial checks
    void this.runHealthChecks();
    void this.collectMetrics();
  }

  /**
   * Run all health checks
   */
  private async runHealthChecks(): Promise<void> {
    await Promise.all([
      this.checkDatabase(),
      this.checkCache(),
      this.checkWebSocket(),
      this.checkDiskSpace(),
      this.checkMemory(),
      this.checkExternalServices(),
    ]);
    
    this.emit('health:checked', this.getHealthStatus());
  }

  /**
   * Check database health
   */
  private async checkDatabase(): Promise<void> {
    const check: HealthCheck = {
      name: 'database',
      status: 'healthy',
      lastCheck: new Date(),
    };
    
    try {
      const start = Date.now();
      await prisma.$queryRaw`SELECT 1`;
      const responseTime = Date.now() - start;
      
      check["metadata"] = { responseTime };
      
      if (responseTime > 1000) {
        check["status"] = 'degraded';
        check.message = 'Slow database response';
      }
    } catch (error: unknown) {
      check["status"] = 'unhealthy';
      check.message = error instanceof Error ? error.message : 'Database connection failed';
    }
    
    this.healthChecks.set('database', check);
  }

  /**
   * Check cache health
   */
  private checkCache(): Promise<void> {
    const check: HealthCheck = {
      name: 'cache',
      status: 'healthy',
      lastCheck: new Date(),
    };

    try {
      const stats = performanceService.getCacheStats();
      check["metadata"] = stats as unknown as Record<string, unknown>;

      if (stats.hitRate < 50) {
        check["status"] = 'degraded';
        check.message = 'Low cache hit rate';
      }
    } catch (_error: unknown) {
      check["status"] = 'unhealthy';
      check.message = 'Cache service errorMessage';
    }

    this.healthChecks.set('cache', check);
    return Promise.resolve();
  }

  /**
   * Check WebSocket health
   */
  private async checkWebSocket(): Promise<void> {
    const check: HealthCheck = {
      name: 'websocket',
      status: 'healthy',
      lastCheck: new Date(),
    };

    try {
      const stats = await websocketService.getStats();
      check["metadata"] = stats as unknown as Record<string, unknown>;

      if (stats.totalClients > 5000) {
        check["status"] = 'degraded';
        check.message = 'High number of WebSocket connections';
      }
    } catch (_error: unknown) {
      check["status"] = 'unhealthy';
      check.message = 'WebSocket service errorMessage';
    }

    this.healthChecks.set('websocket', check);
  }

  /**
   * Check disk space
   */
  private async checkDiskSpace(): Promise<void> {
    const check: HealthCheck = {
      name: 'disk',
      status: 'healthy',
      lastCheck: new Date(),
    };
    
    try {
      const metrics = await this.getSystemMetrics();
      const diskPercentage = metrics.disk.percentage;
      
      check["metadata"] = { usage: diskPercentage };
      
      if (diskPercentage > 90) {
        check["status"] = 'unhealthy';
        check.message = 'Critical disk space';
      } else if (diskPercentage > 80) {
        check["status"] = 'degraded';
        check.message = 'Low disk space';
      }
    } catch (_error: unknown) {
      check["status"] = 'unhealthy';
      check.message = 'Failed to check disk space';
    }
    
    this.healthChecks.set('disk', check);
  }

  /**
   * Check memory usage
   */
  private async checkMemory(): Promise<void> {
    const check: HealthCheck = {
      name: 'memory',
      status: 'healthy',
      lastCheck: new Date(),
    };
    
    try {
      const metrics = await this.getSystemMetrics();
      const memoryPercentage = metrics.memory.percentage;
      
      check["metadata"] = { usage: memoryPercentage };
      
      if (memoryPercentage > 95) {
        check["status"] = 'unhealthy';
        check.message = 'Critical memory usage';
      } else if (memoryPercentage > 80) {
        check["status"] = 'degraded';
        check.message = 'High memory usage';
      }
    } catch (_error: unknown) {
      check["status"] = 'unhealthy';
      check.message = 'Failed to check memory';
    }
    
    this.healthChecks.set('memory', check);
  }

  /**
   * Check external services
   */
  private checkExternalServices(): Promise<void> {
    // Check metadata providers
    const providers = ['anilist', 'mangadex', 'comicvine'];

    for (const provider of providers) {
      const check: HealthCheck = {
        name: `provider.${provider}`,
        status: 'healthy',
        lastCheck: new Date(),
      };

      // This would check actual provider status
      // For now, we'll simulate
      this.healthChecks.set(`provider.${provider}`, check);
    }
    return Promise.resolve();
  }

  /**
   * Collect system metrics
   */
  private async collectMetrics(): Promise<void> {
    try {
      const metrics = await this.getSystemMetrics();
      const apiMetrics = performanceService.getMetrics();
      const wsStats = await websocketService.getStats();

      // Record metrics
      this.recordMetric('cpu.usage', metrics.cpu.usage);
      this.recordMetric('memory.percentage', metrics.memory.percentage);
      this.recordMetric('disk.percentage', metrics.disk.percentage);
      this.recordMetric('api.responseTime', apiMetrics.avgResponseTime);
      this.recordMetric('api.errorRate', apiMetrics.errorRate);
      this.recordMetric('api.requestsPerSecond', apiMetrics.requestsPerSecond);
      this.recordMetric('ws.connections', wsStats.totalClients);

      this.emit('metrics:collected', {
        system: metrics,
        api: apiMetrics,
        websocket: wsStats,
      });
    } catch (error: unknown) {
      logger.error('Failed to collect metrics:', error);
    }
  }

  /**
   * Record a metric value
   */
  private recordMetric(name: string, value: number): void {
    if (!this.metricHistory.has(name)) {
      this.metricHistory.set(name, []);
    }

    const history = this.metricHistory.get(name);
    if (!history) return;

    history.push({ value, timestamp: new Date() });

    // Keep only recent history
    if (history.length > this.maxHistorySize) {
      history.shift();
    }
  }

  /**
   * Check for alerts based on thresholds
   */
  private async checkAlerts(): Promise<void> {
    // Collect all alert operations to run in parallel
    const alertOperations: Promise<void>[] = [];

    for (const [_name, threshold] of this.thresholds) {
      const history = this.metricHistory.get(threshold.metric);
      if (!history || history.length === 0) continue;

      const latestEntry = history[history.length - 1];
      if (!latestEntry) continue;

      const latestValue = latestEntry.value;
      const existingAlert = Array.from(this.alerts.values())
        .find(a => a.type === threshold.metric && !a.resolved);

      if (latestValue >= threshold.critical) {
        if (existingAlert?.level !== 'critical') {
          alertOperations.push(
            this.createAlert('critical', threshold.metric,
              `${threshold.metric} is at ${latestValue.toFixed(2)} (critical threshold: ${threshold.critical})`)
          );
        }
      } else if (latestValue >= threshold.warning) {
        if (!existingAlert || existingAlert.level === 'info') {
          alertOperations.push(
            this.createAlert('warning', threshold.metric,
              `${threshold.metric} is at ${latestValue.toFixed(2)} (warning threshold: ${threshold.warning})`)
          );
        }
      } else if (existingAlert) {
        // Resolve alert if metric is back to normal
        alertOperations.push(this.resolveAlert(existingAlert["id"]));
      }
    }

    // Execute all alert operations in parallel
    await Promise.all(alertOperations);
  }

  /**
   * Create an alert
   */
  private async createAlert(
    level: Alert['level'],
    type: string,
    message: string
  ): Promise<void> {
    const alert: Alert = {
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      level,
      type,
      title: this.getAlertTitle(type),
      message,
      timestamp: new Date(),
      resolved: false,
    };
    
    this.alerts.set(alert["id"], alert);
    
    // Send notifications
    await this.sendAlertNotifications(alert);
    
    this.emit('alert:created', alert);
  }

  /**
   * Resolve an alert
   */
  private async resolveAlert(alertId: string): Promise<void> {
    const alert = this.alerts.get(alertId);
    if (!alert || alert.resolved) return;
    
    alert.resolved = true;
    
    // Send resolution notification
    await this.wsAdapter.broadcastSystemAlert({
      level: 'info',
      title: 'Alert Resolved',
      message: `${alert["title"]} has been resolved`,
      data: { alertId: alert["id"] },
    });
    
    this.emit('alert:resolved', alert);
  }

  /**
   * Send alert notifications
   */
  private async sendAlertNotifications(alert: Alert): Promise<void> {
    // Broadcast via WebSocket
    await this.wsAdapter.broadcastSystemAlert({
      level: alert.level === 'critical' ? 'error' : alert.level,
      title: alert["title"],
      message: alert.message,
      data: {
        alertId: alert["id"],
        type: alert.type,
        timestamp: alert.timestamp,
      },
    });
    
    // Log alert
    logger.error(`[ALERT] ${alert.level.toUpperCase()}: ${alert["title"]} - ${alert.message}`);
    
    // Additional notification channels could be added here (email, SMS, etc.)
  }

  /**
   * Get system metrics
   */
  private async getSystemMetrics(): Promise<SystemMetrics> {
    const [cpuUsage, processCpu, diskUsage] = await Promise.all([
      getCpuUsagePercent(),
      getProcessCpuPercent(),
      getDiskUsage(process.cwd())
    ]);

    const totalMemory = os.totalmem();
    // Reclaimable memory, not just MemFree — see @/server/utils/system-memory.
    const freeMemory = getAvailableMemory();
    const usedMemory = totalMemory - freeMemory;
    const processMemory = process.memoryUsage();

    return {
      cpu: {
        usage: cpuUsage,
        loadAverage: os.loadavg(),
      },
      memory: {
        total: totalMemory,
        used: usedMemory,
        free: freeMemory,
        percentage: (usedMemory / totalMemory) * 100,
      },
      disk: {
        total: diskUsage.totalBytes,
        used: diskUsage.usedBytes,
        free: diskUsage.freeBytes,
        percentage: diskUsage.usagePercent,
      },
      process: {
        uptime: process.uptime(),
        pid: process.pid,
        memory: processMemory.heapUsed,
        cpu: processCpu,
      },
    };
  }

  /**
   * Get alert title based on type
   */
  private getAlertTitle(type: string): string {
    const titles: Record<string, string> = {
      'cpu.usage': 'High CPU Usage',
      'memory.percentage': 'High Memory Usage',
      'disk.percentage': 'Low Disk Space',
      'api.errorRate': 'High API Error Rate',
      'api.responseTime': 'Slow API Response Time',
      'api.requestsPerSecond': 'High API Load',
      'db.connectionCount': 'High Database Connections',
      'db.queryTime': 'Slow Database Queries',
      'ws.connections': 'High WebSocket Connections',
    };
    
    return titles[type] ?? `Alert: ${type}`;
  }

  /**
   * Get health status
   */
  public getHealthStatus(): {
    status: 'healthy' | 'degraded' | 'unhealthy';
    checks: Array<HealthCheck & { name: string }>;
    timestamp: Date;
  } {
    const checks = Array.from(this.healthChecks.entries()).map(([name, check]) => ({
      ...check,
      name,
    }));
    
    const unhealthyCount = checks.filter(c => c["status"] === 'unhealthy').length;
    const degradedCount = checks.filter(c => c["status"] === 'degraded').length;
    
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    if (unhealthyCount > 0) {
      status = 'unhealthy';
    } else if (degradedCount > 0) {
      status = 'degraded';
    }
    
    return {
      status,
      checks,
      timestamp: new Date(),
    };
  }

  /**
   * Get active alerts
   */
  public getActiveAlerts(): Alert[] {
    return Array.from(this.alerts.values()).filter(a => !a.resolved);
  }

  /**
   * Get metric history
   */
  public getMetricHistory(
    metric: string,
    duration?: number
  ): Array<{ value: number; timestamp: Date }> {
    const history = this.metricHistory.get(metric) ?? [];
    
    if (duration) {
      const cutoff = Date.now() - duration;
      return history.filter(h => h.timestamp.getTime() > cutoff);
    }
    
    return history;
  }

  /**
   * Update threshold
   */
  public updateThreshold(
    metric: string,
    warning: number,
    critical: number,
    duration?: number
  ): void {
    this.thresholds.set(metric, {
      metric,
      warning,
      critical,
      ...(duration !== undefined ? { duration } : {})
    });
    this.emit('threshold:updated', { metric, warning, critical, duration });
  }

  /**
   * Shutdown service
   */
  public shutdown(): void {
    if (this.healthCheckInterval) clearInterval(this.healthCheckInterval);
    if (this.metricsInterval) clearInterval(this.metricsInterval);
    if (this.alertCheckInterval) clearInterval(this.alertCheckInterval);
    
    this.healthChecks.clear();
    this.alerts.clear();
    this.metricHistory.clear();
  }
}

// Export singleton instance
export const monitoringService = new MonitoringService();