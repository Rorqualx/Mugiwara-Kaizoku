/**
 * User Activity Metrics Endpoint
 * 
 * GET /api/v1/metrics/user/[id] - Get activity metrics for a specific user
 */

import { z } from 'zod';

import { createMetricsApiAdapter } from '@/server/api/adapters/MetricsApiAdapter';
import type { ApiAuth } from '@/types/api/common';
import { createApiRoute } from '@/utils/api-route-factory';

// Request validation schema
const userActivitySchema = z.object({
  days: z.coerce.number().int().min(1).max(365).optional(),
});

export default createApiRoute({
  requireAuth: true,
  validation: {
    query: userActivitySchema,
  },
  handlers: {
    GET: async (req, res): Promise<void> => {
      // Get user ID from query
      const { id } = req.query;
      if (!id || Array.isArray(id)) {
        return res["status"](400).json({
          status: 'error',
          error: {
            code: 'INVALID_PARAMETER',
            message: 'Invalid user ID',
            timestamp: new Date().toISOString(),
            requestId: req.requestId ?? '',
          },
        });
      }

      // Check permissions - users can view their own metrics, admins can view any
      const auth = req.auth as ApiAuth;
      const isOwnMetrics = auth.userId === id;
      const hasAdminPermission = auth.permissions?.some(
        (p) => p.resource === 'admin' && p.actions.includes('read')
      ) ?? false;
      
      if (!isOwnMetrics && !hasAdminPermission) {
        return res["status"](403).json({
          status: 'error',
          error: {
            code: 'INSUFFICIENT_PERMISSIONS',
            message: 'You do not have permission to view this user\'s metrics',
            timestamp: new Date().toISOString(),
            requestId: req.requestId ?? '',
          },
        });
      }

      const adapter = createMetricsApiAdapter({
        rateLimit: {
          requests: { perMinute: 30, perHour: 500 },
        },
      });

      try {
        // Check rate limit
        await adapter.checkRateLimit(auth.apiKey ?? '');

        // Get query parameters
        const params = req.query as z.infer<typeof userActivitySchema>;
        
        // Get user activity metrics
        const metrics = await adapter.getUserActivity(id, params.days);
        
        return res["status"](200).json({
          status: 'success',
          data: metrics,
        });
      } finally {
        // Clean up resources
        adapter.dispose();
      }
    },
  },
});