// @ts-nocheck
// TODO: This file is disabled until the Webhook Prisma model is implemented
// The Webhook model needs to be added to schema.prisma before this service can be used
// Related files that also need the Webhook model:
// - src/pages/api/v1/webhooks/*.ts
// - src/server/trpc/routers/api.ts (webhook routes)
// - src/server/api/__tests__/integration/webhooks.test.ts

/**
 * Webhook Service
 *
 * Handles webhook event delivery and management
 */

import crypto from 'crypto';
import { EventEmitter } from 'events';

import { prisma } from '@/server/db';
import type { AsyncResult} from '@/utils/async-result';
import { createErrorResult} from '@/utils/async-result';
import { toStringId } from '@/utils/id-converters';
import { logger } from '@/utils/logger';

export interface WebhookEvent {
  id: string;
  type: string;
  timestamp: string;
  data: Record<string, unknown>;
}
export enum WebhookEventType {
  // Manga events
  MANGA_CREATED = 'manga.created',
  MANGA_UPDATED = 'manga.updated',
  MANGA_DELETED = 'manga.deleted',
  // Chapter events
  CHAPTER_CREATED = 'chapter.created',
  CHAPTER_DOWNLOADED = 'chapter.downloaded',
  CHAPTER_FAILED = 'chapter.failed',
  CHAPTER_DELETED = 'chapter.deleted',
  // Library events
  LIBRARY_CREATED = 'library.created',
  LIBRARY_SCAN_STARTED = 'library.scan.started',
  LIBRARY_SCAN_COMPLETED = 'library.scan.completed',
  LIBRARY_DELETED = 'library.deleted',
  // Download events
  DOWNLOAD_STARTED = 'download.started',
  DOWNLOAD_PROGRESS = 'download.progress',
  DOWNLOAD_COMPLETED = 'download.completed',
  DOWNLOAD_FAILED = 'download.failed',
}
interface Webhook {
  id: string;
  url: string;
  secret: string;
  events: string[];
  enabled: boolean;
  userId: string;
  failureCount: number;
}

/**
 * Webhook Service class
 * 
 * Manages webhook event delivery
 */
export class WebhookService extends EventEmitter {
  /**
   * Trigger webhook for an event
   */
  trigger(event: WebhookEvent & {
    userId?: string;
  }): Promise<void> {
    try {
      // Emit event for SSE
      this.emit('event:triggered', event);

      // TODO: Add Webhook model to Prisma schema
      // See: docs/missing-models.md for schema definition
      return Promise.reject(new Error('Webhook model not yet implemented. Please add to schema.'));

      /* COMMENTED OUT - Webhook model not in schema
      // Get all webhooks subscribed to this event
      const where: Prisma.WebhookWhereInput = {
        enabled: true,
        events: {
          has: event.type
        },
        failureCount: {
          lt: 5 // Skip webhooks that have failed too many times
        },
        ...(event.userId !== null && { userId: event.userId })
      };

      const webhooks = await prisma.webhook.findMany({
        where
      });
      if (webhooks.length === 0) {
        return;
      }
      logger.info(`Triggering ${webhooks.length} webhooks for event ${event.type}`);

      // Send to each webhook in parallel
      await Promise.all(webhooks.map((webhook: typeof webhooks[number]) => this.sendWebhook(webhook as Webhook, event)));
      */
    } catch (error: unknown) {const errorMessage = error instanceof Error ? error.message : String(error);
logger.error('Failed to trigger webhooks', errorMessage);
    }
  }

  /**
   * Send webhook event
   */
  private async sendWebhook(webhook: Webhook, event: WebhookEvent): Promise<AsyncResult<void, Error>> {
    try {
      const payload = JSON.stringify(event);
      const signature = this.generateSignature(payload, webhook.secret);
      const response = await fetch(webhook.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Kaizoku-Signature': signature,
          'X-Kaizoku-Event': event.type,
          'X-Kaizoku-Delivery': event["id"],
          'User-Agent': 'Kaizoku-Webhook/1.0'
        },
        body: payload,
        signal: AbortSignal.timeout(10000) // 10 second timeout
      });
      if (!response.ok) {
        throw new Error(`Webhook delivery failed: ${response["status"]} ${response.statusText}`);
      }

      // TODO: Add WebhookDelivery and Webhook models to Prisma schema
      throw new Error('WebhookDelivery and Webhook models not yet implemented.');

      /* COMMENTED OUT - WebhookDelivery and Webhook models not in schema
      // Log successful delivery
      await prisma.webhookDelivery.create({
        data: {
          webhookId: webhook["id"],
          eventId: event["id"],
          eventType: event.type,
          payload: event as Record<string, unknown>,
          status: 'SUCCESS',
          statusCode: response["status"],
          attempts: 1
        }
      });

      // Reset failure count on success
      if (webhook.failureCount > 0) {
        await prisma.webhook.update({
          where: {
            id: webhook.id
          },
          data: {
            failureCount: 0
          }
        });
      }
      */
      // Note: unreachable until models are implemented (throw above)
    } catch (error: unknown) {
      // TODO: Add WebhookDelivery and Webhook models to Prisma schema
      /* COMMENTED OUT - WebhookDelivery and Webhook models not in schema
      // Log failed delivery
      const errorMessage = error instanceof Error ? (error instanceof Error ? error.message : String(error)) : 'Unknown error';
      await prisma.webhookDelivery.create({
        data: {
          webhookId: webhook["id"],
          eventId: event["id"],
          eventType: event.type,
          payload: event as Record<string, unknown>,
          status: 'FAILED',
          error: errorMessage,
          attempts: 1
        }
      });

      // Increment failure count
      await prisma.webhook.update({
        where: {
          id: webhook.id
        },
        data: {
          failureCount: {
            increment: 1
          }
        }
      });
      */
      logger.error(`Webhook delivery failed for ${webhook.url}`, error);
      return createErrorResult(error instanceof Error ? error : new Error('Webhook delivery failed'));
    }
  }

  /**
   * Generate HMAC signature for payload
   */
  private generateSignature(payload: string, secret: string): string {
    return crypto.createHmac('sha256', secret).update(payload).digest('hex');
  }

  /**
   * Verify webhook signature
   */
  verifySignature(payload: string, signature: string, secret: string): boolean {
    const expectedSignature = this.generateSignature(payload, secret);
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));
  }

  /**
   * Create a webhook event
   */
  async createEvent(type: WebhookEventType, data: Record<string, unknown>): Promise<WebhookEvent> {
    const event: WebhookEvent = {
      id: crypto.randomUUID(),
      type,
      timestamp: new Date().toISOString(),
      data
    };

    // Store event in database
    const entityType = type.split('.')[0];

    // Prisma model access - apiEvent model exists in schema
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- Prisma type system limitation
    const apiEventModel = prisma.apiEvent;

    // Type guard to ensure the model is available
    if (!apiEventModel || typeof (apiEventModel as { create?: unknown }).create !== 'function') {
      throw new Error('prisma.apiEvent model is not available');
    }

    // Create event in database
    await (apiEventModel as { create: (args: { data: { type: string; entityId: string; entityType: string; data: Record<string, unknown> } }) => Promise<unknown> }).create({
      data: {
        type,
        entityId: toStringId(data["id"] ?? ''),
        entityType: entityType ?? '',
        // Extract entity type from event type
        data: data as Record<string, unknown>
      }
    });

    // Trigger webhooks asynchronously using globalThis.queueMicrotask (Node.js 11+)
    // Fallback to setTimeout if queueMicrotask is not available
    const scheduleTask = typeof globalThis.queueMicrotask === 'function'
      ? globalThis.queueMicrotask
      : (fn: () => void) => setTimeout(fn, 0);

    scheduleTask(() => {
      this.trigger(event).catch((triggerError: unknown) => {
        logger.error('Failed to trigger webhooks for event', {
          type,
          error: triggerError instanceof Error ? triggerError.message : String(triggerError)
        });
      });
    });
    return event;
  }

  /**
   * Test a webhook
   */
  testWebhook(_webhookId: string): Promise<AsyncResult<boolean, Error>> {
    try {
      // TODO: Add Webhook model to Prisma schema
      // See: docs/missing-models.md for schema definition
      return Promise.reject(new Error('Webhook model not yet implemented. Please add to schema.'));

      /* COMMENTED OUT - Webhook model not in schema
      const webhook = await prisma.webhook.findUnique({
        where: {
          id: webhookId
        }
      });
      if (!webhook) {
        return createErrorResult(new Error('Webhook not found'));
      }
      const testEvent: WebhookEvent = {
        id: crypto.randomUUID(),
        type: 'webhook.test',
        timestamp: new Date().toISOString(),
        data: {
          message: 'This is a test webhook event',
          webhookId: webhook.id
        }
      };
      const result = await this.sendWebhook(webhook as Webhook, testEvent);
      return isSuccess(result) ? createSuccessResult(true) : createErrorResult(
        (isError(result) ? result.error : null) || new Error('Webhook test failed')
      );
      */
    } catch (error: unknown) {
      return createErrorResult(error instanceof Error ? error : new Error('Webhook test failed'));
    }
  }

  /**
   * Retry failed webhook deliveries
   */
  retryFailedDeliveries(_webhookId: string): Promise<AsyncResult<number, Error>> {
    try {
      // TODO: Add WebhookDelivery and Webhook models to Prisma schema
      // See: docs/missing-models.md for schema definition
      return Promise.reject(new Error('WebhookDelivery and Webhook models not yet implemented. Please add to schema.'));

      /* COMMENTED OUT - WebhookDelivery and Webhook models not in schema
      // Get recent failed deliveries
      const failedDeliveries = await prisma.webhookDelivery.findMany({
        where: {
          webhookId,
          status: 'FAILED',
          deliveredAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
          }
        },
        orderBy: {
          deliveredAt: 'desc'
        },
        take: 10 // Limit retries
      });
      const webhook = await prisma.webhook.findUnique({
        where: {
          id: webhookId
        }
      });
      if (!webhook) {
        return createErrorResult(new Error('Webhook not found'));
      }
      let successCount = 0;
      for (const delivery of failedDeliveries) {
        const event: WebhookEvent = {
          id: delivery.eventId,
          type: delivery.eventType,
          timestamp: new Date().toISOString(),
          data: delivery.payload as Record<string, unknown>
        };
        const result = await this.sendWebhook(webhook as Webhook, event);
        if (isSuccess(result)) {
          successCount++;
        }
      }
      return createSuccessResult(successCount);
      */
    } catch (error: unknown) {
      return createErrorResult(error instanceof Error ? error : new Error('Failed to retry deliveries'));
    }
  }
}

// Export singleton instance
export const webhookService = new WebhookService();