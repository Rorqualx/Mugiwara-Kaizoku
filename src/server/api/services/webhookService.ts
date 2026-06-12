/**
 * Webhook Service
 *
 * Handles webhook event delivery and management. Deliveries are recorded in
 * WebhookDelivery; webhooks that fail 5 times in a row are skipped until a
 * successful delivery (or retry) resets their failure count.
 */

import crypto from 'crypto';
import { EventEmitter } from 'events';

import { prisma } from '@/server/db';
import type { AsyncResult } from '@/utils/async-result';
import { createSuccessResult, createErrorResult, isSuccess } from '@/utils/async-result';
import { toStringId } from '@/utils/id-converters';
import { logger } from '@/utils/logger';

import type { Prisma, Webhook } from '@prisma/client';

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

/** Consecutive failures after which a webhook stops receiving events */
const MAX_FAILURE_COUNT = 5;

/** Record a delivery attempt; logging must never break the delivery path */
async function recordDelivery(
  webhookId: string,
  event: WebhookEvent,
  outcome: { success: boolean; statusCode?: number; error?: string }
): Promise<void> {
  try {
    await prisma.webhookDelivery.create({
      data: {
        webhookId,
        event: event.type,
        payload: event as unknown as Prisma.InputJsonValue,
        success: outcome.success,
        ...(outcome.statusCode !== undefined ? { statusCode: outcome.statusCode } : {}),
        ...(outcome.error !== undefined ? { error: outcome.error } : {})
      }
    });
  } catch (error: unknown) {
    logger.error('Failed to record webhook delivery', {
      webhookId,
      error: error instanceof Error ? error.message : String(error)
    });
  }
}

/**
 * Webhook Service class
 *
 * Manages webhook event delivery
 */
export class WebhookService extends EventEmitter {
  /**
   * Trigger webhooks subscribed to an event
   */
  async trigger(event: WebhookEvent & {
    userId?: string;
  }): Promise<void> {
    try {
      // Emit event for SSE
      this.emit('event:triggered', event);

      // Get all webhooks subscribed to this event
      const webhooks = await prisma.webhook.findMany({
        where: {
          enabled: true,
          events: { has: event.type },
          failureCount: { lt: MAX_FAILURE_COUNT },
          ...(event.userId !== undefined ? { userId: event.userId } : {})
        }
      });
      if (webhooks.length === 0) {
        return;
      }
      logger.info(`Triggering ${webhooks.length} webhooks for event ${event.type}`);

      // Send to each webhook in parallel
      await Promise.all(webhooks.map((webhook) => this.sendWebhook(webhook, event)));
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Failed to trigger webhooks', errorMessage);
    }
  }

  /**
   * Send webhook event and record the delivery
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
          'X-Kaizoku-Delivery': event.id,
          'User-Agent': 'Kaizoku-Webhook/1.0'
        },
        body: payload,
        signal: AbortSignal.timeout(10000) // 10 second timeout
      });
      if (!response.ok) {
        throw new Error(`Webhook delivery failed: ${response.status} ${response.statusText}`);
      }

      await recordDelivery(webhook.id, event, { success: true, statusCode: response.status });

      // Reset failure count on success
      if (webhook.failureCount > 0) {
        await prisma.webhook.update({
          where: { id: webhook.id },
          data: { failureCount: 0 }
        });
      }
      return createSuccessResult(undefined);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      await recordDelivery(webhook.id, event, { success: false, error: errorMessage });
      await prisma.webhook
        .update({
          where: { id: webhook.id },
          data: { failureCount: { increment: 1 } }
        })
        .catch((updateError: unknown) => {
          logger.error('Failed to increment webhook failure count', {
            webhookId: webhook.id,
            error: updateError instanceof Error ? updateError.message : String(updateError)
          });
        });
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
   * Create a webhook event, persist it, and trigger deliveries asynchronously
   */
  async createEvent(type: WebhookEventType, data: Record<string, unknown>): Promise<WebhookEvent> {
    const event: WebhookEvent = {
      id: crypto.randomUUID(),
      type,
      timestamp: new Date().toISOString(),
      data
    };

    // Store event in database
    const entityType = type.split('.')[0] ?? '';
    await prisma.apiEvent.create({
      data: {
        type,
        entityId: toStringId(data["id"] ?? ''),
        entityType,
        data: data as Prisma.InputJsonValue
      }
    });

    // Trigger webhooks asynchronously so callers are not blocked on delivery
    globalThis.queueMicrotask(() => {
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
   * Test a webhook by sending a synthetic event
   */
  async testWebhook(webhookId: string): Promise<AsyncResult<boolean, Error>> {
    try {
      const webhook = await prisma.webhook.findUnique({
        where: { id: webhookId }
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
      const result = await this.sendWebhook(webhook, testEvent);
      return isSuccess(result)
        ? createSuccessResult(true)
        : createErrorResult(new Error('Webhook test failed'));
    } catch (error: unknown) {
      return createErrorResult(error instanceof Error ? error : new Error('Webhook test failed'));
    }
  }

  /**
   * Retry failed webhook deliveries from the last 24 hours
   */
  async retryFailedDeliveries(webhookId: string): Promise<AsyncResult<number, Error>> {
    try {
      const webhook = await prisma.webhook.findUnique({
        where: { id: webhookId }
      });
      if (!webhook) {
        return createErrorResult(new Error('Webhook not found'));
      }
      // Get recent failed deliveries
      const failedDeliveries = await prisma.webhookDelivery.findMany({
        where: {
          webhookId,
          success: false,
          attemptedAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
          }
        },
        orderBy: { attemptedAt: 'desc' },
        take: 10 // Limit retries
      });
      let successCount = 0;
      for (const delivery of failedDeliveries) {
        const storedEvent = delivery.payload as unknown as Partial<WebhookEvent>;
        const event: WebhookEvent = {
          id: storedEvent.id ?? crypto.randomUUID(),
          type: delivery.event,
          timestamp: new Date().toISOString(),
          data: storedEvent.data ?? {}
        };
        // eslint-disable-next-line no-await-in-loop -- retries are intentionally sequential to avoid hammering a recovering endpoint
        const result = await this.sendWebhook(webhook, event);
        if (isSuccess(result)) {
          successCount++;
        }
      }
      return createSuccessResult(successCount);
    } catch (error: unknown) {
      return createErrorResult(error instanceof Error ? error : new Error('Failed to retry deliveries'));
    }
  }
}

// Export singleton instance
export const webhookService = new WebhookService();
