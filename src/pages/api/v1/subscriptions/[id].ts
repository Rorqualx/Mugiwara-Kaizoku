/**
 * Subscription Management Endpoint
 * 
 * GET /api/v1/subscriptions/[id] - Get subscription details
 * DELETE /api/v1/subscriptions/[id] - Delete subscription
 */

import { subscriptionService } from '@/server/api/services/subscriptionService';
import { realtimeEmitter } from '@/server/services/realtime/RealtimeEventEmitter';
import { createApiRoute } from '@/utils/api-route-factory';
import { isSuccess, isError } from '@/utils/async-result';

export default createApiRoute({
  requireAuth: true,
  permissions: {
    GET: { resource: 'subscription', action: 'read' },
    DELETE: { resource: 'subscription', action: 'delete' },
  },
  handlers: {
    GET: (req, res): void => {
      // Get subscription ID from query
      const { id } = req.query;
      if (!id || Array.isArray(id)) {
        return res["status"](400).json({
          status: 'error',
          error: {
            code: 'INVALID_PARAMETER',
            message: 'Invalid subscription ID',
            timestamp: new Date().toISOString(),
            requestId: req.requestId ?? '',
          },
        });
      }

      // Get subscription
      const userSubscriptions = subscriptionService.getUserSubscriptions((req.auth as unknown as Record<string, unknown>)["userId"] as string);
      const subscription = userSubscriptions.find(s => s["id"] === id);

      if (!subscription) {
        return res["status"](404).json({
          status: 'error',
          error: {
            code: 'NOT_FOUND',
            message: 'Subscription not found',
            timestamp: new Date().toISOString(),
            requestId: req.requestId ?? '',
          },
        });
      }

      return res["status"](200).json({
        status: 'success',
        data: {
          id: subscription["id"],
          userId: subscription.userId,
          type: subscription.type,
          resourceId: subscription.resourceId,
          filters: subscription.filters,
          createdAt: subscription.createdAt.toISOString(),
          lastNotified: subscription.lastNotified?.toISOString(),
          _links: {
            self: `/api/v1/subscriptions/${subscription["id"]}`,
            unsubscribe: `/api/v1/subscriptions/${subscription["id"]}`,
          },
        },
      });
    },

    DELETE: async (req, res): Promise<void> => {
      // Get subscription ID from query
      const { id } = req.query;
      if (!id || Array.isArray(id)) {
        res["status"](400).json({
          status: 'error',
          error: {
            code: 'INVALID_PARAMETER',
            message: 'Invalid subscription ID',
            timestamp: new Date().toISOString(),
            requestId: req.requestId ?? '',
          },
        });
        return;
      }

      // Delete subscription
      const result = await subscriptionService.removeSubscription(
        ((req.auth as unknown) as Record<string, unknown>)["userId"] as string,
        id
      );
      
      if (isError(result)) {
        if (result.error instanceof Error ? result.error.message : String(result.error) === 'Subscription not found') {
          res["status"](404).json({
            status: 'error',
            error: {
              code: 'NOT_FOUND',
              message: 'Subscription not found',
              timestamp: new Date().toISOString(),
              requestId: req.requestId ?? '',
            },
          });
          return;
        }
        res["status"](500).json({
          status: 'error',
          error: {
            code: 'INTERNAL_ERROR',
            message: result.error instanceof Error ? result.error.message : String(result.error),
            timestamp: new Date().toISOString(),
            requestId: req.requestId ?? '',
          },
        });
        return;
      }
      
      if (isSuccess(result)) {
        // Emit WebSocket event for subscription deleted
        void realtimeEmitter.emitSystemEvent({
          eventType: 'subscription:deleted',
          source: 'subscriptionsApi',
          message: 'Subscription deleted',
          data: { subscriptionId: id }
        });

        res["status"](204).end();
        return;
      }
      
      // Should not reach here
      res["status"](500).json({
        status: 'error',
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to delete subscription',
          timestamp: new Date().toISOString(),
          requestId: req.requestId ?? '',
        },
      });
      return;
    },
  },
});