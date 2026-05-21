/**
 * Monitoring Alerts API Endpoint
 * 
 * GET /api/v1/monitoring/alerts - Get monitoring alerts
 */

import { z as _z } from 'zod';
import { z } from 'zod';

import { monitoringService } from '@/server/api/services/monitoringService';
import { createApiRoute } from '@/utils/api-route-factory';

// Query validation schema
const alertsQuerySchema = z.object({
  includeResolved: _z.enum(['true', 'false']).optional(),
  level: z.enum(['info', 'warning', 'critical']).optional(),
  type: z.string().optional(),
});

interface Alert {
  id: string;
  level: 'info' | 'warning' | 'critical';
  type: string;
  title: string;
  message: string;
  timestamp: string;
  resolved: boolean;
  metadata?: Record<string, unknown>;
}

interface AlertsResponse {
  alerts: Alert[];
  stats: {
    active: number;
    resolved: number;
    critical: number;
    warning: number;
    info: number;
  };
}

export default createApiRoute({
  requireAuth: true,
  permissions: {
    GET: { resource: 'monitoring', action: 'read' },
  },
  validation: {
    query: alertsQuerySchema,
  },
  handlers: {
    GET: (req, res): void => {
      // Get query parameters
      const params = req.query as z.infer<typeof alertsQuerySchema>;
      const _includeResolved = params.includeResolved === 'true';
      const level = params.level;
      const type = params.type;

      // Get all alerts from monitoring service
      const activeAlerts = monitoringService.getActiveAlerts();
      let alerts = activeAlerts;

      // If includeResolved is true, we'd need to get resolved alerts too
      // For now, we'll just work with active alerts
      
      // Filter by level if specified
      if (level) {
        alerts = alerts.filter(alert => alert.level === level);
      }

      // Filter by type if specified
      if (type) {
        alerts = alerts.filter(alert => alert.type === type);
      }

      // Calculate stats
      const stats = {
        active: activeAlerts.length,
        resolved: 0, // Would be calculated from resolved alerts
        critical: activeAlerts.filter(a => a.level === 'critical').length,
        warning: activeAlerts.filter(a => a.level === 'warning').length,
        info: activeAlerts.filter(a => a.level === 'info').length,
      };

      const response: AlertsResponse = {
        alerts: alerts.map(alert => {
          const mappedAlert: Alert = {
            id: alert["id"],
            level: alert.level,
            type: alert.type,
            title: alert["title"],
            message: alert.message,
            timestamp: alert.timestamp.toISOString(),
            resolved: alert.resolved
          };
          if (alert["metadata"] !== undefined) {
            mappedAlert.metadata = alert["metadata"] as Record<string, unknown>;
          }
          return mappedAlert;
        }),
        stats,
      };

      return res["status"](200).json({
        status: 'success',
        data: response,
      });
    },
  },
});