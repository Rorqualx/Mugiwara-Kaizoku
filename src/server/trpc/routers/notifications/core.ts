/**
 * Core Notification Procedures
 *
 * Handles CRUD operations for notifications:
 * - Create, read, mark as read, delete notifications
 */
import { NotificationEventType } from '@prisma/client';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { NotificationService } from '@/server/services/notifications/NotificationService';
import { notifyUser } from '@/server/services/notifications/notify';
import { realtimeEmitter } from '@/server/services/realtime/RealtimeEventEmitter';
import { protectedProcedure } from '@/server/trpc/procedures';
import { router } from '@/server/trpc/trpc';
import { logger } from '@/utils/logger';

import type { NotificationSeverity } from '@prisma/client';

const notificationService = new NotificationService();

export const notificationCoreRouter = router({
  /**
   * Create a new notification
   */
  create: protectedProcedure
    .input(
      z.object({
        type: z.nativeEnum(NotificationEventType).default(NotificationEventType.USER_ACTION),
        title: z.string().min(1).max(200),
        message: z.string().min(1).max(1000),
        severity: z.enum(['INFO', 'SUCCESS', 'WARNING', 'ERROR']).default('INFO'),
        metadata: z.record(z.unknown()).optional(),
        relatedMangaId: z.number().optional(),
        relatedChapterId: z.number().optional(),
        actionUrl: z.string().optional()
      })
    )
    .mutation(async ({ input, ctx }) => {
      const notification = await notifyUser({
        userId: ctx.user.id,
        type: input.type,
        severity: input.severity as NotificationSeverity,
        title: input.title,
        message: input.message,
        ...(input.metadata !== undefined ? { metadata: input.metadata } : {}),
        ...(input.relatedMangaId !== undefined ? { relatedMangaId: input.relatedMangaId } : {}),
        ...(input.relatedChapterId !== undefined ? { relatedChapterId: input.relatedChapterId } : {}),
        ...(input.actionUrl !== undefined ? { actionUrl: input.actionUrl } : {}),
        // Client-initiated notifications are durable bell rows; external
        // delivery (Discord/Email/...) is reserved for server producers.
        externalChannels: false,
      });

      if (!notification) {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to create notification' });
      }

      logger.info('Notification created', { id: notification.id, type: input.type });
      return notification;
    }),

  /**
   * Get notifications with optional filters
   */
  getNotifications: protectedProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).default(50),
        offset: z.number().min(0).default(0),
        unreadOnly: z.boolean().default(false),
        type: z.string().optional()
      }).optional()
    )
    .query(async ({ input, ctx }) => {
      const options = input ? {
        limit: input.limit,
        offset: input.offset,
        unreadOnly: input.unreadOnly,
        userId: ctx.user.id,
        ...(input.type ? { type: input.type } : {})
      } : { userId: ctx.user.id };
      const result = await notificationService.getNotifications(options);
      if (result.status === 'error') {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: result.error.message });
      }
      if (result.status === 'success') {
        return result.data;
      }
      throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Unexpected result status' });
    }),

  /**
   * Get unread notification count
   */
  getUnreadCount: protectedProcedure.query(async ({ ctx }) => {
    const result = await notificationService.getUnreadCount(ctx.user.id);
    if (result.status === 'error') {
      throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: result.error.message });
    }
    if (result.status === 'success') {
      return result.data;
    }
    throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Unexpected result status' });
  }),

  /**
   * Mark notification(s) as read
   */
  markAsRead: protectedProcedure
    .input(z.object({ notificationIds: z.array(z.union([z.string(), z.number()])) }))
    .mutation(async ({ input }) => {
      const result = await notificationService.markAsRead(input.notificationIds);
      if (result.status === 'error') {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: result.error.message });
      }
      void realtimeEmitter.emitSystemEvent({
        eventType: 'notification:read',
        source: 'notification-router',
        message: `Marked ${input.notificationIds.length} notifications as read`,
        data: { count: input.notificationIds.length },
      });
      return { success: true };
    }),

  /**
   * Mark all notifications as read
   */
  markAllAsRead: protectedProcedure.mutation(async ({ ctx }) => {
    try {
      await ctx.prisma.notification.updateMany({
        where: { read: false, userId: ctx.user.id },
        data: { read: true, readAt: new Date() }
      });
      void realtimeEmitter.emitSystemEvent({
        eventType: 'notification:allRead',
        source: 'notification-router',
        message: 'All notifications marked as read',
        data: {},
      });
      logger.info('All notifications marked as read');
      return { success: true };
    } catch (error: unknown) {
      logger.error('Failed to mark all as read', error instanceof Error ? error.message : String(error));
      throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to mark all notifications as read' });
    }
  }),

  /**
   * Delete notification(s)
   */
  deleteNotification: protectedProcedure
    .input(z.object({ notificationIds: z.array(z.union([z.string(), z.number()])) }))
    .mutation(async ({ input }) => {
      const result = await notificationService.delete(input.notificationIds);
      if (result.status === 'error') {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: result.error.message });
      }
      void realtimeEmitter.emitSystemEvent({
        eventType: 'notification:deleted',
        source: 'notification-router',
        message: `Deleted ${input.notificationIds.length} notifications`,
        data: { count: input.notificationIds.length },
      });
      return { success: true };
    }),

  /**
   * Clear all notifications
   */
  clearAll: protectedProcedure.mutation(async ({ ctx }) => {
    try {
      await ctx.prisma.notification.deleteMany({
        where: { userId: ctx.user.id }
      });
      void realtimeEmitter.emitSystemEvent({
        eventType: 'notification:cleared',
        source: 'notification-router',
        message: 'All notifications cleared',
        data: {},
      });
      logger.info('All notifications cleared');
      return { success: true };
    } catch (error: unknown) {
      logger.error('Failed to clear all notifications', error instanceof Error ? error.message : String(error));
      throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to clear all notifications' });
    }
  }),

  /**
   * Get available notification event types
   */
  getAvailableEvents: protectedProcedure
    .output(z.array(z.string()))
    .query(() => {
      const events: NotificationEventType[] = [
        'MANGA_ADDED', 'MANGA_UPDATED', 'MANGA_DELETED', 'METADATA_UPDATED',
        'CHAPTER_ADDED', 'CHAPTER_DOWNLOADED', 'CHAPTER_FAILED',
        'VOLUME_ADDED', 'VOLUME_DOWNLOADED',
        'SYNC_STARTED', 'SYNC_COMPLETED', 'SYNC_FAILED',
        'BACKUP_STARTED', 'BACKUP_COMPLETED', 'BACKUP_FAILED',
        'SYSTEM_ERROR', 'SYSTEM_WARNING', 'SYSTEM_INFO', 'USER_ACTION',
        'SUWAYOMI_SERVER_CONNECTED', 'SUWAYOMI_SERVER_DISCONNECTED',
        'SUWAYOMI_SERVER_HEALTH_CHECK_FAILED', 'SUWAYOMI_SOURCE_INSTALLED',
        'SUWAYOMI_SOURCE_UNINSTALLED', 'SUWAYOMI_SEARCH_STARTED',
        'SUWAYOMI_SEARCH_COMPLETED', 'SUWAYOMI_SEARCH_FAILED',
        'SUWAYOMI_CHAPTER_DOWNLOAD_STARTED', 'SUWAYOMI_CHAPTER_DOWNLOAD_COMPLETED'
      ];
      return events;
    })
});
