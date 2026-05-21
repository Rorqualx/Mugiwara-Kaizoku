/**
 * System Metrics Endpoint
 * 
 * GET /api/v1/metrics/system - Get system-wide metrics and statistics
 */

import { createMetricsApiAdapter } from '@/server/api/adapters/MetricsApiAdapter';
import { createApiRoute, successResponse } from '@/utils/api-route-factory';

export default createApiRoute({
  handlers: {
    GET: async (req: unknown, res: unknown): Promise<void> => {
      const adapter = createMetricsApiAdapter({
        rateLimit: {
          requests: { perMinute: 60, perHour: 1000 },
        },
      });

      try {
        // Check rate limit
        const reqAuth = req as { auth?: { apiKey?: string } };
        await adapter.checkRateLimit(reqAuth.auth?.apiKey ?? '');

        // Get system metrics
        const metrics = await adapter.getSystemMetrics();

        const resObj = res as { status: (code: number) => { json: (data: unknown) => unknown } };
        resObj.status(200).json(successResponse(metrics));
      } finally {
        // Clean up resources
        adapter.dispose();
      }
    }
  },
  requireAuth: true,
  permissions: {
    GET: { resource: 'metrics', action: 'read' },
  },
});