import { prisma } from '@/server/db';
import type { ID } from '@/types/search.types';
import { createSuccessResult, createErrorResult, isSuccess } from '@/utils/async-result';
import type { AsyncResult } from '@/utils/async-result';
import { toNumberId } from '@/utils/id-converters';
import { logger } from '@/utils/logger';
import { logNotificationSent, logNotificationFailed } from '@/utils/system-events';

import { sendToChannel } from './notification-channel-dispatch';
import { getUserPreferences, isNotificationEnabled, isInQuietHours } from './notification-preferences';

import type { Notification, NotificationEventType, Prisma } from '@prisma/client';

export interface NotificationData {
    type: 'NEW_RELEASE' | 'UPCOMING_RELEASE' | 'RELEASE_DELAYED' | 'PATTERN_CHANGED' | 'SYSTEM' | 'ERROR';
    title: string;
    message: string;
    userId?: string;
    severity?: 'INFO' | 'WARNING' | 'ERROR' | 'SUCCESS';
    metadata?: Record<string, unknown>;
    relatedMangaId?: number | null;
    relatedChapterId?: number | null;
    relatedJobId?: bigint | null;
    actionUrl?: string | null;
    imageUrl?: string;
    actions?: Array<{ label: string; url: string }>;
    priority?: 'low' | 'normal' | 'high';
    persistent?: boolean;
}

export interface NotificationChannel {
    type: 'web' | 'email' | 'discord' | 'telegram';
    enabled: boolean;
    config?: Record<string, unknown>;
}

export interface NotificationPreferences {
    channels: NotificationChannel[];
    newReleases: boolean;
    upcomingReleases: boolean;
    releaseDelays: boolean;
    patternChanges: boolean;
    systemNotifications: boolean;
    quietHours?: {
        enabled: boolean;
        start: string;
        end: string;
    };
}

export interface NotificationQueryOptions {
    limit?: number;
    offset?: number;
    unreadOnly?: boolean;
    type?: string;
    userId?: string;
}

export interface NotificationRecord {
    id: number;
    type: string;
    title: string;
    message: string;
    metadata: Record<string, unknown> | null;
    severity: string;
    userId: string;
    read: boolean;
    readAt: Date | null;
    createdAt: Date;
    relatedMangaId: number | null;
    relatedChapterId: number | null;
    relatedJobId: bigint | null;
    actionUrl: string | null;
}

function buildWhereClause(options: NotificationQueryOptions): Prisma.NotificationWhereInput {
    const where: Prisma.NotificationWhereInput = {};
    if (options.userId) where.userId = options.userId;
    if (options.unreadOnly) where.read = false;
    if (options.type) where.type = options.type as NotificationEventType;
    return where;
}

function toNotificationRecord(n: Notification): NotificationRecord {
    return {
        id: n.id,
        type: n.type as string,
        title: n.title,
        message: n.message,
        metadata: n.metadata as Record<string, unknown> | null,
        severity: n.severity,
        userId: n.userId,
        read: n.read,
        readAt: n.readAt,
        createdAt: n.createdAt,
        relatedMangaId: n.relatedMangaId,
        relatedChapterId: n.relatedChapterId,
        relatedJobId: n.relatedJobId,
        actionUrl: n.actionUrl
    };
}

function collectSendErrors(results: PromiseSettledResult<AsyncResult<void, Error>>[]): string[] {
    return results
        .filter((r): r is PromiseRejectedResult => r.status === 'rejected')
        .map(r => r.reason instanceof Error ? r.reason.message : String(r.reason));
}

export class NotificationService {
    async send(data: NotificationData): Promise<AsyncResult<void, Error>> {
        try {
            const preferences = await getUserPreferences();

            if (!isNotificationEnabled(data.type, preferences)) {
                logger.info(`[NotificationService] Notification type ${data.type} is disabled`);
                return createSuccessResult(undefined);
            }

            if (isInQuietHours(preferences)) {
                logger.info('[NotificationService] In quiet hours, skipping external channels');
            }

            const enabledChannels = preferences.channels.filter(ch => ch.enabled);
            const results = await Promise.allSettled(
                enabledChannels.map(channel => sendToChannel(channel, data))
            );

            const successCount = results.filter(r => r.status === 'fulfilled' && isSuccess(r.value)).length;
            if (successCount > 0) {
                logNotificationSent(data.type, data.title, successCount);
                return createSuccessResult(undefined);
            }

            const errors = collectSendErrors(results);
            logNotificationFailed(data.type, data.title, errors.join(', '));
            return createErrorResult(new Error('Failed to send notification to any channel'));
        }
        catch (error: unknown) {
            return createErrorResult(error instanceof Error ? error : new Error(String(error)));
        }
    }

    async markAsRead(notificationIds: ID[]): Promise<AsyncResult<void, Error>> {
        try {
            const numericIds = notificationIds.map(id => toNumberId(id));
            await prisma.notification.updateMany({
                where: { id: { in: numericIds } },
                data: { read: true, readAt: new Date() }
            });
            return createSuccessResult(undefined);
        }
        catch (error: unknown) {
            return createErrorResult(error instanceof Error ? error : new Error(String(error)));
        }
    }

    async delete(notificationIds: ID[]): Promise<AsyncResult<void, Error>> {
        try {
            const numericIds = notificationIds.map(id => toNumberId(id));
            await prisma.notification.deleteMany({
                where: { id: { in: numericIds } }
            });
            return createSuccessResult(undefined);
        }
        catch (error: unknown) {
            return createErrorResult(error instanceof Error ? error : new Error(String(error)));
        }
    }

    async getUnreadCount(userId?: string): Promise<AsyncResult<number, Error>> {
        try {
            const where: Prisma.NotificationWhereInput = { read: false };
            if (userId) where.userId = userId;
            const count = await prisma.notification.count({ where });
            return createSuccessResult(count);
        }
        catch (error: unknown) {
            return createErrorResult(error instanceof Error ? error : new Error(String(error)));
        }
    }

    async getNotifications(options?: NotificationQueryOptions): Promise<AsyncResult<NotificationRecord[], Error>> {
        try {
            const { limit = 50, offset = 0 } = options ?? {};
            const where = buildWhereClause(options ?? {});
            const notifications = await prisma.notification.findMany({
                where,
                orderBy: [{ read: 'asc' }, { createdAt: 'desc' }],
                take: limit,
                skip: offset
            });
            return createSuccessResult(notifications.map(toNotificationRecord));
        }
        catch (error: unknown) {
            return createErrorResult(error instanceof Error ? error : new Error(String(error)));
        }
    }
}
