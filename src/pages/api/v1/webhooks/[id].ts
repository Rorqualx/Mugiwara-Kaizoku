/**
 * Individual Webhook API Endpoints
 *
 * GET /api/v1/webhooks/[id] - Get webhook details
 * PATCH /api/v1/webhooks/[id] - Update webhook
 * DELETE /api/v1/webhooks/[id] - Delete webhook
 */

import { z } from 'zod';

import { WebhookEventType } from '@/server/api/services/webhookService';
import { prisma } from '@/server/db';
import { realtimeEmitter } from '@/server/services/realtime/RealtimeEventEmitter';
import { createApiRoute } from '@/utils/api-route-factory';
import { isObject } from '@/utils/type-guards';

// Helper to safely extract userId from auth object
function getUserId(auth: unknown): string {
  if (isObject(auth) && 'userId' in auth && typeof auth["userId"] === 'string') {
    return auth["userId"];
  }
  throw new Error('Invalid auth object');
}

// Request validation schemas
const updateWebhookSchema = z.object({
  url: z.string().url().optional(),
  events: z.array(z.nativeEnum(WebhookEventType)).min(1).optional(),
  enabled: z.boolean().optional()
});

export default createApiRoute({
  handlers: {
    GET: async (req, res): Promise<void> => {
      const { id } = req.query;
      if (!id || Array.isArray(id)) {
        return res["status"](400).json({
          status: 'error',
          error: {
            code: 'INVALID_PARAMETER',
            message: 'Invalid webhook ID',
            timestamp: new Date().toISOString(),
            requestId: req.requestId ?? ''
          }
        });
      }

      // Get webhook
      const webhook = await prisma.webhook.findFirst({
        where: {
          id,
          userId: getUserId(req.auth)
        }
      });

      if (!webhook) {
        return res["status"](404).json({
          status: 'error',
          error: {
            code: 'NOT_FOUND',
            message: 'Webhook not found',
            timestamp: new Date().toISOString(),
            requestId: req.requestId ?? ''
          }
        });
      }

      const response = {
        status: 'success',
        data: {
          id: webhook["id"],
          url: webhook.url,
          events: webhook.events,
          enabled: webhook.enabled,
          failureCount: webhook.failureCount,
          lastDeliveryAt: undefined, // TODO: Get from deliveries
          createdAt: webhook.createdAt.toISOString(),
          updatedAt: webhook.updatedAt.toISOString(),
          _links: {
            self: `/api/v1/webhooks/${webhook["id"]}`,
            test: `/api/v1/webhooks/${webhook["id"]}/test`,
            deliveries: `/api/v1/webhooks/${webhook["id"]}/deliveries`
          }
        }
      };

      return res["status"](200).json(response);
    },

    PATCH: async (req, res): Promise<void> => {
      const { id } = req.query;
      if (!id || Array.isArray(id)) {
        return res["status"](400).json({
          status: 'error',
          error: {
            code: 'INVALID_PARAMETER',
            message: 'Invalid webhook ID',
            timestamp: new Date().toISOString(),
            requestId: req.requestId ?? ''
          }
        });
      }

      // Check webhook exists and belongs to user
      const existing = await prisma.webhook.findFirst({
        where: {
          id,
          userId: getUserId(req.auth)
        }
      });

      if (!existing) {
        return res["status"](404).json({
          status: 'error',
          error: {
            code: 'NOT_FOUND',
            message: 'Webhook not found',
            timestamp: new Date().toISOString(),
            requestId: req.requestId ?? ''
          }
        });
      }

      // Update webhook
      const webhook = await prisma.webhook.update({
        where: { id },
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        data: {
          ...req.body,
          updatedAt: new Date()
        }
      });

      // Emit WebSocket event for webhook updated
      void realtimeEmitter.emitSystemEvent({
        eventType: 'webhook:updated',
        source: 'webhooksApi',
        message: `Webhook updated: ${webhook.url}`,
        data: { webhookId: webhook["id"], url: webhook.url, enabled: webhook.enabled }
      });

      const response = {
        status: 'success',
        data: {
          id: webhook["id"],
          url: webhook.url,
          events: webhook.events,
          enabled: webhook.enabled,
          failureCount: webhook.failureCount,
          lastDeliveryAt: undefined,
          createdAt: webhook.createdAt.toISOString(),
          updatedAt: webhook.updatedAt.toISOString(),
          _links: {
            self: `/api/v1/webhooks/${webhook["id"]}`,
            test: `/api/v1/webhooks/${webhook["id"]}/test`,
            deliveries: `/api/v1/webhooks/${webhook["id"]}/deliveries`
          }
        }
      };

      return res["status"](200).json(response);
    },

    DELETE: async (req, res): Promise<void> => {
      const { id } = req.query;
      if (!id || Array.isArray(id)) {
        res["status"](400).json({
          status: 'error',
          error: {
            code: 'INVALID_PARAMETER',
            message: 'Invalid webhook ID',
            timestamp: new Date().toISOString(),
            requestId: req.requestId ?? ''
          }
        });
        return;
      }

      // Check webhook exists and belongs to user
      const existing = await prisma.webhook.findFirst({
        where: {
          id,
          userId: getUserId(req.auth)
        }
      });

      if (!existing) {
        res["status"](404).json({
          status: 'error',
          error: {
            code: 'NOT_FOUND',
            message: 'Webhook not found',
            timestamp: new Date().toISOString(),
            requestId: req.requestId ?? ''
          }
        });
        return;
      }

      // Delete webhook and related deliveries
      await prisma.$transaction([
      prisma.webhookDelivery.deleteMany({
        where: { webhookId: id }
      }),
      prisma.webhook.delete({
        where: { id }
      })]
      );

      // Emit WebSocket event for webhook deleted
      void realtimeEmitter.emitSystemEvent({
        eventType: 'webhook:deleted',
        source: 'webhooksApi',
        message: `Webhook deleted: ${existing.url}`,
        data: { webhookId: id }
      });

      res["status"](204).end();
      return;
    }
  },
  requireAuth: true,
  permissions: {
    GET: { resource: 'webhook', action: 'read' },
    PATCH: { resource: 'webhook', action: 'write' },
    DELETE: { resource: 'webhook', action: 'delete' }
  },
  validation: {
    PATCH: updateWebhookSchema
  }
});