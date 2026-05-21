/**
 * API Metrics Endpoint
 *
 * GET /api/v1/metrics/api - Get API usage metrics
 */

import { z } from 'zod';

import { createMetricsApiAdapter } from '@/server/api/adapters/MetricsApiAdapter';
import type { ApiRequest } from '@/server/api/middleware/apiMiddleware';
import { createApiRoute, successResponse } from '@/utils/api-route-factory';

import type { NextApiResponse } from 'next';

// Request validation schema
const _apiMetricsSchema = z.object({
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    interval: z.enum(['hour', 'day', 'week', 'month']).optional(),
    resources: z.string().optional(), // Comma-separated
    actions: z.string().optional(), // Comma-separated
});

export default createApiRoute({
    handlers: {
        GET: async (req: ApiRequest, res: NextApiResponse): Promise<void> => {
            const adapter = createMetricsApiAdapter({
                rateLimit: {
                    requests: { perMinute: 30, perHour: 500 },
                },
            });
            try {
                // Check rate limit
                const apiKey = req.auth && typeof req.auth === 'object' && 'apiKey' in req.auth
                    ? (req.auth as { apiKey: string }).apiKey
                    : '';
                await adapter.checkRateLimit(apiKey);

                // Parse query parameters
                const params = req.query;

                // Parse array parameters (only include if defined)
                const resources = typeof params["resources"] === 'string'
                    ? params["resources"].split(',').map((r: string) => r.trim()).filter(Boolean)
                    : undefined;
                const actions = typeof params["actions"] === 'string'
                    ? params["actions"].split(',').map((a: string) => a.trim()).filter(Boolean)
                    : undefined;

                // Build query with exactOptionalPropertyTypes compatibility
                const query = {
                    ...params,
                    ...(resources !== undefined ? { resources } : {}),
                    ...(actions !== undefined ? { actions } : {}),
                };

                // Get metrics
                const metrics = await adapter.getApiMetrics(query);
                res["status"](200).json(successResponse(metrics));
            }
            catch (error: unknown) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                throw new Error(errorMessage);
            }
            finally {
                // Clean up resources
                adapter.dispose();
            }
        },
    },
    requireAuth: true,
    permissions: {
        GET: { resource: 'admin', action: 'read' },
    },
});
