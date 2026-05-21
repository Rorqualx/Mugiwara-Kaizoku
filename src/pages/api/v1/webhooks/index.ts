/**
 * Webhook Management API Endpoints
 *
 * GET /api/v1/webhooks - List webhooks
 * POST /api/v1/webhooks - Create webhook
 */

import crypto from 'crypto';

import { z } from 'zod';

import { WebhookEventType } from '@/server/api/services/webhookService';
import { prisma } from '@/server/db';
import { realtimeEmitter } from '@/server/services/realtime/RealtimeEventEmitter';
import { createApiRoute } from '@/utils/api-route-factory';

// Request validation schemas
const createWebhookSchema = z.object({
  url: z.string().url(),
  events: z.array(z.nativeEnum(WebhookEventType)).min(1),
  secret: z.string().min(16).optional()
});

export default createApiRoute({
  requireAuth: true,
  permissions: {
    GET: { resource: 'webhook', action: 'read' },
    POST: { resource: 'webhook', action: 'write' }
  },
  validation: {
    POST: createWebhookSchema
  },
  handlers: {
    GET: async (req, res): Promise<void> => {
      // List webhooks for the authenticated user
      const webhooks = await prisma.webhook.findMany({
        where: { userId: req.auth?.userId ?? '' },
        orderBy: { createdAt: 'desc' },
        include: {
          _count: {
            select: { deliveries: true }
          }
        }
      });

      const response = {
        status: 'success',
        data: webhooks.map((webhook: typeof webhooks[number]) => ({
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
        }))
      };

      return res["status"](200).json(response);
    },

    POST: async (req, res): Promise<void> => {
      const data = req.body as z.infer<typeof createWebhookSchema>;

      // Generate secret if not provided
      const plainSecret = data.secret ?? crypto.randomBytes(32).toString('hex');

      // Create webhook (secret should be hashed in production, but storing plain for MVP)
      const webhook = await prisma.webhook.create({
        data: {
          url: data.url,
          secret: plainSecret,
          events: data.events,
          userId: req.auth?.userId ?? '',
          enabled: true,
          failureCount: 0
        }
      });

      // Emit WebSocket event for webhook created
      void realtimeEmitter.emitSystemEvent({
        eventType: 'webhook:created',
        source: 'webhooksApi',
        message: `Webhook created: ${data.url}`,
        data: { webhookId: webhook["id"], url: webhook.url, events: webhook.events }
      });

      const response = {
        status: 'success',
        data: {
          id: webhook["id"],
          url: webhook.url,
          events: webhook.events,
          enabled: webhook.enabled,
          failureCount: webhook.failureCount,
          secret: plainSecret, // Return plain secret only on creation
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

      return res["status"](201).json(response);
    }
  }
});