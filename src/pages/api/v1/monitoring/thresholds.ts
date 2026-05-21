/**
 * Monitoring Thresholds API Endpoint
 * 
 * GET /api/v1/monitoring/thresholds - Get all thresholds
 * PUT /api/v1/monitoring/thresholds - Update threshold
 */

import { z } from 'zod';

import { monitoringService } from '@/server/api/services/monitoringService';
import { realtimeEmitter } from '@/server/services/realtime/RealtimeEventEmitter';
import { createApiRoute } from '@/utils/api-route-factory';

// Request validation schemas
const updateThresholdSchema = z.object({
  metric: z.string(),
  warning: z.number(),
  critical: z.number(),
  duration: z.number().optional(),
});

interface Threshold {
  metric: string;
  warning: number;
  critical: number;
  duration?: number;
}

interface ThresholdsResponse {
  thresholds: Threshold[];
}

export default createApiRoute({
  requireAuth: true,
  permissions: {
    GET: { resource: 'monitoring', action: 'read' },
    PUT: { resource: 'monitoring', action: 'write' },
  },
  validation: {
    PUT: updateThresholdSchema,
  },
  handlers: {
    GET: (req, res): void => {
      // Get default thresholds
      const defaultThresholds: Threshold[] = [
        { metric: 'cpu.usage', warning: 70, critical: 90, duration: 60000 },
        { metric: 'memory.percentage', warning: 80, critical: 95 },
        { metric: 'disk.percentage', warning: 80, critical: 90 },
        { metric: 'api.errorRate', warning: 5, critical: 10 },
        { metric: 'api.responseTime', warning: 1000, critical: 3000 },
        { metric: 'api.requestsPerSecond', warning: 100, critical: 200 },
        { metric: 'db.connectionCount', warning: 80, critical: 95 },
        { metric: 'db.queryTime', warning: 500, critical: 1000 },
        { metric: 'ws.connections', warning: 1000, critical: 5000 },
      ];

      const response: ThresholdsResponse = {
        thresholds: defaultThresholds,
      };

      return res["status"](200).json({
        status: 'success',
        data: response,
      });
    },

    PUT: (req, res): void => {
      const data = req.body as z.infer<typeof updateThresholdSchema>;

      // Validate threshold values
      if (data.warning >= data.critical) {
        return res["status"](400).json({
          status: 'error',
          error: {
            code: 'INVALID_THRESHOLD',
            message: 'Warning threshold must be less than critical threshold',
            timestamp: new Date().toISOString(),
            requestId: req.requestId ?? '',
          },
        });
      }

      // Update threshold in monitoring service
      // Note: This would need implementation in the monitoring service
      monitoringService.updateThreshold(
        data.metric,
        data.warning,
        data.critical,
        data.duration
      );

      // Emit WebSocket event for threshold updated
      void realtimeEmitter.emitSystemEvent({
        eventType: 'monitoring:thresholds:updated',
        source: 'monitoring-thresholds-api',
        message: `Threshold updated for ${data.metric}`,
        data: { metric: data.metric, warning: data.warning, critical: data.critical, duration: data.duration },
      });

      return res["status"](200).json({
        status: 'success',
        data: {
          metric: data.metric,
          warning: data.warning,
          critical: data.critical,
          duration: data.duration,
        },
      });
    },
  },
});