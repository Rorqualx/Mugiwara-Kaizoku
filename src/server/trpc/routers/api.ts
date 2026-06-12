import crypto from 'crypto';

import { TRPCError } from '@trpc/server';
/**
 * API Router
 *
 * tRPC router for API key and webhook management
 * Handles external API access configuration
 *
 * @module server/trpc/routers/api
 */
import { z } from 'zod';

import { apiAuthService } from '@/server/api/services/apiAuth';
import { prisma } from '@/server/db';
import { realtimeEmitter } from '@/server/services/realtime/RealtimeEventEmitter';
import { isSuccess, isError } from '@/utils/async-result';
import { ValidationError } from '@/utils/errors';
import { toStringId } from '@/utils/id-converters';
import { logger } from '@/utils/logger';

import { protectedProcedure } from '../procedures';
import { router } from '../trpc';

/**
 * Generate webhook secret
 */
function generateWebhookSecret(): string {
  return crypto.randomBytes(32).toString('hex');
}
/**
 * API router definition
 */
export const apiRouter = router({
  /**
   * Get all API keys for the current user
   */
  getApiKeys: protectedProcedure.query(async ({ ctx }) => {
    const userId = toStringId(ctx.user["id"]);
    const result = await apiAuthService.listApiKeys(userId);
    if (!isSuccess(result)) {
      logger.error('Failed to fetch API keys', { error: isError(result) ? result.error.message : 'unknown' });
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to fetch API keys'
      });
    }
    // Never return the stored key digests — only an id-based display prefix
    return result.data.map((key) => ({
      id: key.id,
      name: key.name,
      keyPrefix: `mk_${key.id.substring(0, 8)}...`,
      permissions: key.permissions,
      rateLimit: key.rateLimit,
      enabled: key.enabled,
      expiresAt: key.expiresAt,
      lastUsedAt: key.lastUsedAt,
      createdAt: key.createdAt
    }));
  }),
  /**
   * Create a new API key
   */
  createApiKey: protectedProcedure.input(z.object({
    name: z.string().min(1, 'Name is required'),
    permissions: z.array(z.object({
      resource: z.string(),
      actions: z.array(z.string()),
      scope: z.string().optional()
    })),
    expiresIn: z.number().optional() // Days until expiration
  })).mutation(async ({ ctx, input }) => {
    const userId = toStringId(ctx.user["id"]);
    if (!userId) {
      throw new TRPCError({
        code: 'UNAUTHORIZED',
        message: 'You must be logged in to create API keys'
      });
    }
    const expiresAt = input.expiresIn !== undefined
      ? new Date(Date.now() + input.expiresIn * 24 * 60 * 60 * 1000)
      : undefined;
    const permissions = input.permissions.map((p) => ({
      resource: p.resource,
      actions: p.actions,
      ...(p.scope !== undefined ? { scope: p.scope } : {})
    }));
    const result = await apiAuthService.generateApiKey(userId, input.name, permissions, expiresAt);
    if (!isSuccess(result)) {
      logger.error('Failed to create API key', { error: isError(result) ? result.error.message : 'unknown' });
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to create API key'
      });
    }
    // result.data.key is the raw key — this is the only time it is returned
    return result.data;
  }),
  /**
   * Delete an API key
   */
  deleteApiKey: protectedProcedure.input(z.object({
    id: z.string()
  })).mutation(async ({ ctx, input }) => {
    const userId = toStringId(ctx.user["id"]);
    const result = await apiAuthService.revokeApiKey(input.id, userId);
    if (!isSuccess(result)) {
      const message = isError(result) ? result.error.message : 'Failed to delete API key';
      if (message === 'API key not found') {
        throw new TRPCError({ code: 'NOT_FOUND', message });
      }
      logger.error(`Failed to delete API key ${input.id}`, { error: message });
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to delete API key'
      });
    }
    return { success: true };
  }),
  /**
   * Get all webhooks for the current user
   */
  getWebhooks: protectedProcedure.query(async ({ ctx }) => {
    try {
      const userId = toStringId(ctx.user["id"]);
      if (!userId) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'You must be logged in to view webhooks'
        });
      }
      const webhooks = await prisma.webhook.findMany({
        where: {
          userId: userId
        },
        include: {
          _count: {
            select: {
              deliveries: true
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        }
      });
      return webhooks.map((webhook: typeof webhooks[number]) => ({
        id: webhook["id"],
        url: webhook.url,
        events: webhook.events,
        enabled: webhook.enabled,
        failureCount: webhook.failureCount,
        deliveryCount: webhook._count.deliveries,
        createdAt: webhook.createdAt,
        updatedAt: webhook.updatedAt
      }));
    }
    catch (error: unknown) {
      if (error instanceof TRPCError)
      throw error;
      logger.error('Failed to fetch webhooks', error);
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to fetch webhooks'
      });
    }
  }),
  /**
   * Create a new webhook
   */
  createWebhook: protectedProcedure.input(z.object({
    url: z.string().url().refine((val) => val.startsWith('https://'), {
      message: 'Webhook URL must use HTTPS'
    }),
    events: z.array(z.string()).min(1, 'At least one event is required'),
    secret: z.string().optional()
  })).mutation(async ({ ctx, input }) => {
    try {
      const userId = toStringId(ctx.user["id"]);
      if (!userId) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'You must be logged in to create webhooks'
        });
      }
      const secret = input.secret || generateWebhookSecret();
      const webhook = await prisma.webhook.create({
        data: {
          url: input.url,
          secret,
          events: input.events,
          userId: userId
        }
      });
      logger.info(`Webhook created for user ${userId}: ${input.url}`);
      // Emit WebSocket event for real-time sync
      void realtimeEmitter.emitSystemEvent({
        eventType: 'webhook:created',
        source: 'api-router',
        message: 'Webhook created',
        data: { webhookId: webhook.id, events: input.events },
      });
      return {
        ...webhook,
        secret // Return secret for display to user
      };
    }
    catch (error: unknown) {
      if (error instanceof TRPCError)
      throw error;
      logger.error('Failed to create webhook', error);
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to create webhook'
      });
    }
  }),
  /**
   * Update a webhook
   */
  updateWebhook: protectedProcedure.input(z.object({
    id: z.string(),
    url: z.string().url().optional(),
    events: z.array(z.string()).optional(),
    enabled: z.boolean().optional()
  })).mutation(async ({ ctx, input }) => {
    try {
      const userId = toStringId(ctx.user["id"]);
      if (!userId) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'You must be logged in to update webhooks'
        });
      }
      // Ensure the webhook belongs to the user
      const webhook = await prisma.webhook.findFirst({
        where: {
          id: input["id"],
          userId: userId
        }
      });
      if (!webhook) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Webhook not found'
        });
      }
      const updated = await prisma.webhook.update({
        where: {
          id: input.id
        },
        data: {
          ...(input.url !== undefined ? { url: input.url } : {}),
          ...(input.events !== undefined ? { events: input.events } : {}),
          ...(input.enabled !== undefined ? { enabled: input.enabled } : {})
        }
      });
      logger.info(`Webhook ${input["id"]} updated`);
      // Emit WebSocket event for real-time sync
      void realtimeEmitter.emitSystemEvent({
        eventType: 'webhook:updated',
        source: 'api-router',
        message: 'Webhook updated',
        data: { webhookId: input.id, enabled: input.enabled },
      });
      return updated;
    }
    catch (error: unknown) {
      if (error instanceof TRPCError)
      throw error;
      logger.error(`Failed to update webhook ${input["id"]}`, error);
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to update webhook'
      });
    }
  }),
  /**
   * Delete a webhook
   */
  deleteWebhook: protectedProcedure.input(z.object({
    id: z.string()
  })).mutation(async ({ ctx, input }) => {
    try {
      const userId = toStringId(ctx.user["id"]);
      if (!userId) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'You must be logged in to delete webhooks'
        });
      }
      // Ensure the webhook belongs to the user
      const webhook = await prisma.webhook.findFirst({
        where: {
          id: input["id"],
          userId: userId
        }
      });
      if (!webhook) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Webhook not found'
        });
      }
      await prisma.webhook.delete({
        where: {
          id: input.id
        }
      });
      logger.info(`Webhook ${input["id"]} deleted`);
      // Emit WebSocket event for real-time sync
      void realtimeEmitter.emitSystemEvent({
        eventType: 'webhook:deleted',
        source: 'api-router',
        message: 'Webhook deleted',
        data: { webhookId: input.id },
      });
      return {
        success: true
      };
    }
    catch (error: unknown) {
      if (error instanceof TRPCError)
      throw error;
      logger.error(`Failed to delete webhook ${input["id"]}`, error);
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to delete webhook'
      });
    }
  }),
  /**
   * Test a webhook
   */
  testWebhook: protectedProcedure.input(z.object({
    id: z.string()
  })).mutation(async ({ ctx, input }) => {
    try {
      const userId = toStringId(ctx.user["id"]);
      if (!userId) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'You must be logged in to test webhooks'
        });
      }
      // Ensure the webhook belongs to the user
      const webhook = await prisma.webhook.findFirst({
        where: {
          id: input["id"],
          userId: userId
        }
      });
      if (!webhook) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Webhook not found'
        });
      }
      // Send test payload
      const testPayload = {
        event: 'test',
        timestamp: new Date().toISOString(),
        data: {
          message: 'This is a test webhook from Mugiwara Kaizoku'
        }
      };
      // Create HMAC signature
      const signature = crypto.createHmac('sha256', webhook.secret).update(JSON.stringify(testPayload)).digest('hex');
      // Send webhook
      const response = await fetch(webhook.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Signature': signature
        },
        body: JSON.stringify(testPayload)
      });
      if (response.ok) {
        logger.info(`Test webhook sent successfully to ${webhook.url}`);
        // Emit WebSocket event for real-time sync
        void realtimeEmitter.emitSystemEvent({
          eventType: 'webhook:tested',
          source: 'api-router',
          message: 'Webhook test successful',
          data: { webhookId: input.id, statusCode: response.status },
        });
        return {
          success: true,
          statusCode: response.status
        };
      } else
      {
        throw new ValidationError(`Webhook returned status ${response["status"]}`);
      }
    }
    catch (error: unknown) {
      if (error instanceof TRPCError)
      throw error;
      logger.error(`Failed to test webhook ${input["id"]}`, error);
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: error instanceof Error ? error.message : 'Failed to test webhook'
      });
    }
  }),
  /**
   * Get webhook delivery history
   */
  getWebhookDeliveries: protectedProcedure.input(z.object({
    webhookId: z.string(),
    limit: z.number().min(1).max(100).default(50)
  })).query(async ({ ctx, input }) => {
    try {
      const userId = toStringId(ctx.user["id"]);
      if (!userId) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'You must be logged in to view webhook deliveries'
        });
      }
      // Ensure the webhook belongs to the user
      const webhook = await prisma.webhook.findFirst({
        where: {
          id: input.webhookId,
          userId: userId
        }
      });
      if (!webhook) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Webhook not found'
        });
      }
      const deliveries = await prisma.webhookDelivery.findMany({
        where: {
          webhookId: input.webhookId
        },
        orderBy: {
          attemptedAt: 'desc'
        },
        take: input.limit
      });
      return deliveries;
    }
    catch (error: unknown) {
      if (error instanceof TRPCError)
      throw error;
      logger.error('Failed to fetch webhook deliveries', error);
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to fetch webhook deliveries'
      });
    }
  })
});
export type ApiRouter = typeof apiRouter;