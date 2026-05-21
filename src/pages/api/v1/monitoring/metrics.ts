/**
 * Monitoring Metrics API Endpoint
 * 
 * GET /api/v1/monitoring/metrics - Retrieve system and application metrics
 */

import os from 'os';

import { z } from 'zod';

import { monitoringService } from '@/server/api/services/monitoringService';
import { performanceService } from '@/server/api/services/performanceService';
import { websocketService } from '@/server/api/services/websocketService';
import { createApiRoute } from '@/utils/api-route-factory';

// Query validation schema
const metricsQuerySchema = z.object({
  metric: z.string().optional(),
  duration: z.string().regex(/^\d+$/).transform(Number).optional()
});

interface MetricsResponse {
  timestamp: string;
  system: {
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
    };
  };
  api: {
    avgResponseTime: number;
    p95ResponseTime: number;
    p99ResponseTime: number;
    requestsPerSecond: number;
    errorRate: number;
    cacheHitRate: number;
  };
  websocket: {
    totalClients: number;
    totalChannels: number;
    activeSubscriptions: number;
  };
  cache: {
    hits: number;
    misses: number;
    evictions: number;
    size: number;
    itemCount: number;
    hitRate: number;
  };
  history?: {
    metric: string;
    data: Array<{ value: number; timestamp: string }>;
  };
}

export default createApiRoute({
  requireAuth: true,
  permissions: {
    GET: { resource: 'monitoring', action: 'read' },
  },
  validation: {
    query: metricsQuerySchema,
  },
  handlers: {
    GET: async (req, res): Promise<void> => {
      // Get query parameters
      const { metric: metricName, duration } = req.query as z.infer<typeof metricsQuerySchema>;

      const performanceMetrics = performanceService.getMetrics();
      const cacheStats = performanceService.getCacheStats();
      const wsStats = await websocketService.getStats();
      const systemMetrics = await monitoringService['getSystemMetrics']();

      // Build response
      const response: MetricsResponse = {
        timestamp: new Date().toISOString(),
        system: {
          cpu: {
            usage: systemMetrics.cpu.usage,
            loadAverage: os.loadavg(),
          },
          memory: {
            total: systemMetrics.memory.total,
            used: systemMetrics.memory.used,
            free: systemMetrics.memory.free,
            percentage: systemMetrics.memory.percentage,
          },
          disk: {
            total: systemMetrics.disk.total,
            used: systemMetrics.disk.used,
            free: systemMetrics.disk.free,
            percentage: systemMetrics.disk.percentage,
          },
          process: {
            uptime: process.uptime(),
            pid: process.pid,
            memory: process.memoryUsage().heapUsed,
          },
        },
        api: {
          avgResponseTime: performanceMetrics.avgResponseTime,
          p95ResponseTime: performanceMetrics.p95ResponseTime,
          p99ResponseTime: performanceMetrics.p99ResponseTime,
          requestsPerSecond: performanceMetrics.requestsPerSecond,
          errorRate: performanceMetrics.errorRate,
          cacheHitRate: cacheStats.hitRate,
        },
        websocket: {
          totalClients: wsStats.totalClients,
          totalChannels: wsStats.totalChannels,
          activeSubscriptions: wsStats.averageSubscriptionsPerClient * wsStats.totalClients,
        },
        cache: {
          hits: cacheStats.hits,
          misses: cacheStats.misses,
          evictions: cacheStats.evictions,
          size: cacheStats.size,
          itemCount: cacheStats.itemCount,
          hitRate: cacheStats.hitRate,
        },
      };

      // If specific metric history is requested
      if (metricName && duration) {
        const history = monitoringService.getMetricHistory(metricName, duration);
        response.history = {
          metric: metricName,
          data: history.map(point => ({
            value: point.value,
            timestamp: point.timestamp.toISOString(),
          })),
        };
      }

      return res["status"](200).json({
        status: 'success',
        data: response,
      });
    },
  },
});