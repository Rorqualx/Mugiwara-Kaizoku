/**
 * Subscriptions Management Endpoints
 * 
 * GET /api/v1/subscriptions - List user subscriptions
 * POST /api/v1/subscriptions - Create new subscription
 */

import { z } from 'zod';

import { subscriptionService } from '@/server/api/services/subscriptionService';
import { realtimeEmitter } from '@/server/services/realtime/RealtimeEventEmitter';
import type { ApiAuth } from '@/types/api/common';
import { createApiRoute } from '@/utils/api-route-factory';
import { isSuccess, isError } from '@/utils/async-result';

// Request validation schemas
const createSubscriptionSchema = z.object({
  type: z.enum(['manga', 'library', 'download', 'system']),
  resourceId: z.union([z.string(), z.number()]).optional(),
  filters: z.record(z.unknown()).optional(),
});

export default createApiRoute({
  requireAuth: true,
  permissions: {
    GET: { resource: 'subscription', action: 'read' },
    POST: { resource: 'subscription', action: 'write' },
  },
  validation: {
    POST: createSubscriptionSchema,
  },
  handlers: {
    GET: (req, res): void => {
      // List user subscriptions
      const auth = req.auth as ApiAuth;
      if (!auth.userId) {
        throw new Error('User ID not found in auth');
      }
      const subscriptions = subscriptionService.getUserSubscriptions(auth.userId);
      
      return res["status"](200).json({
        status: 'success',
        data: {
          subscriptions: subscriptions.map(sub => ({
            id: sub["id"],
            userId: sub.userId,
            type: sub.type,
            resourceId: sub.resourceId,
            filters: sub.filters,
            createdAt: sub.createdAt.toISOString(),
            lastNotified: sub.lastNotified?.toISOString(),
            _links: {
              self: `/api/v1/subscriptions/${sub["id"]}`,
              unsubscribe: `/api/v1/subscriptions/${sub["id"]}`,
            },
          })),
        },
      });
    },

    POST: async (req, res): Promise<void> => {
      // Create new subscription
      const auth = req.auth as ApiAuth;
      if (!auth.userId) {
        throw new Error('User ID not found in auth');
      }
      const data = req.body as z.infer<typeof createSubscriptionSchema>;

      const result = await subscriptionService.createSubscription(
        auth.userId,
        data.type,
        data.resourceId,
        data.filters
      );
      
      if (isError(result)) {
        return res["status"](400).json({
          status: 'error',
          error: {
            code: 'SUBSCRIPTION_ERROR',
            message: result.error instanceof Error ? result.error.message : String(result.error),
            timestamp: new Date().toISOString(),
            requestId: req.requestId ?? '',
          },
        });
      }
      
      if (isSuccess(result)) {
        // Emit WebSocket event for subscription created
        void realtimeEmitter.emitSystemEvent({
          eventType: 'subscription:created',
          source: 'subscriptionsApi',
          message: `Subscription created: ${data.type}`,
          data: { subscriptionId: result.data["id"], type: result.data.type, resourceId: result.data.resourceId }
        });

        return res["status"](201).json({
          status: 'success',
          data: {
            id: result.data["id"],
            userId: result.data.userId,
            type: result.data.type,
            resourceId: result.data.resourceId,
            filters: result.data.filters,
            createdAt: result.data.createdAt.toISOString(),
            lastNotified: result.data.lastNotified?.toISOString(),
            _links: {
              self: `/api/v1/subscriptions/${result.data["id"]}`,
              unsubscribe: `/api/v1/subscriptions/${result.data["id"]}`,
            },
          },
        });
      }

      // Should not reach here
      return res["status"](500).json({
        status: 'error',
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to create subscription',
          timestamp: new Date().toISOString(),
          requestId: req.requestId ?? '',
        },
      });
    },
  },
});