/**
 * Distributed Message Router - Notification Handler Module
 *
 * Handles PostgreSQL LISTEN/NOTIFY for cross-server messaging.
 * Processes routed message notifications and marks delivery status.
 *
 * Extracted from: DistributedMessageRouter.ts (lines 308-414)
 *
 * @module server/realtime/distributed-message-router/notification-handler
 */

import { Client } from 'pg';

import { prisma } from '@/server/db';
import { logger } from '@/utils/logger';

import { RoutedMessageNotificationSchema } from './types';

// ============================================================================
// Notification Setup
// ============================================================================

/**
 * Set up LISTEN/NOTIFY for cross-server messaging
 *
 * Establishes a PostgreSQL client connection and subscribes to the
 * server-specific routing channel. When messages are published to this
 * channel, they are passed to the onMessage callback for local delivery.
 *
 * @param serverId - Current server ID
 * @param onMessage - Callback for received messages
 * @returns PostgreSQL client with LISTEN established
 */
export async function setupNotifications(
  serverId: string,
  onMessage: (channel: string, payload: Record<string, unknown>) => void
): Promise<Client> {
  try {
    const notificationClient = new Client({
      connectionString: process.env["DATABASE_URL"],
    });

    await notificationClient.connect();

    // Listen to this server's routing channel
    const channelName = `message_routing_${serverId}`;
    await notificationClient.query(`LISTEN "${channelName}"`);

    // Handle notifications
    notificationClient.on('notification', (msg) => {
      if (msg.channel === channelName) {
        void handleRoutedMessage(serverId, msg.payload ?? '{}', onMessage);
      }
    });

    logger.info('Notification listener set up', { channel: channelName });
    return notificationClient;
  } catch (error: unknown) {
    logger.error('Failed to setup notifications:', error);
    throw error;
  }
}

// ============================================================================
// Message Handling
// ============================================================================

/**
 * Handle a routed message notification
 *
 * Processes a PostgreSQL NOTIFY message by:
 * 1. Validating the notification payload
 * 2. Fetching the full message from the routing table
 * 3. Delivering the message locally via callback
 * 4. Marking the message as delivered
 *
 * @param serverId - Current server ID
 * @param payload - Notification payload (JSON string)
 * @param onMessage - Callback to deliver message locally
 */
export async function handleRoutedMessage(
  serverId: string,
  payload: string,
  onMessage: (channel: string, payload: Record<string, unknown>) => void
): Promise<void> {
  try {
    const parsed: unknown = JSON.parse(payload);
    const result = RoutedMessageNotificationSchema.safeParse(parsed);

    if (!result.success) {
      logger.error('Invalid routed message notification format:', result.error);
      return;
    }

    const data = result.data;

    // Fetch the message from the routing table
    const messages = await prisma.$queryRaw<
      Array<{
        id: number;
        channel: string;
        payload: Record<string, unknown>;
        delivery_attempts: number;
      }>
    >`
      SELECT id, channel, payload, delivery_attempts
      FROM message_routing
      WHERE id = ${data.id}
        AND target_server = ${serverId}
        AND NOT delivered
    `;

    if (messages.length === 0) {
      return;
    }

    const message = messages[0];

    if (message === undefined) {
      return;
    }

    // Deliver message locally
    onMessage(message.channel, message.payload);

    // Mark as delivered
    await markMessageDelivered(message.id);

    logger.debug('Routed message delivered', {
      id: message.id,
      channel: message.channel,
    });
  } catch (error: unknown) {
    logger.error('Failed to handle routed message:', {
      error,
      payload,
    });
  }
}

// ============================================================================
// Delivery Tracking
// ============================================================================

/**
 * Mark a message as delivered
 *
 * Updates the message_routing table to mark the message as successfully
 * delivered and records the delivery timestamp.
 *
 * @param messageId - Message ID to mark as delivered
 */
export async function markMessageDelivered(messageId: number): Promise<void> {
  try {
    await prisma.$executeRaw`
      UPDATE message_routing
      SET delivered = TRUE, last_attempt_at = NOW()
      WHERE id = ${messageId}
    `;
  } catch (error: unknown) {
    logger.error('Failed to mark message as delivered:', {
      error,
      messageId,
    });
  }
}
