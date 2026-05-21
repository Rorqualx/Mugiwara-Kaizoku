import { prisma } from '@/server/db';
import { realtimeEmitter } from '@/server/services/realtime/RealtimeEventEmitter';
import { createSuccessResult, createErrorResult, isSuccess } from '@/utils/async-result';
import type { AsyncResult } from '@/utils/async-result';
import { logger } from '@/utils/logger';

import { DiscordAdapter } from './adapters/discordAdapter';
import { EmailAdapter } from './adapters/emailAdapter';
import { TelegramAdapter } from './adapters/telegramAdapter';

import type { NotificationPayload } from './base/BaseNotificationAdapter';
import type { NotificationData, NotificationChannel } from './NotificationService';
import type { Prisma, NotificationEventType } from '@prisma/client';

function mapDataToPayload(data: NotificationData): NotificationPayload {
    const eventMap: Record<string, NotificationEventType> = {
        'NEW_RELEASE': 'MANGA_UPDATED' as NotificationEventType,
        'UPCOMING_RELEASE': 'UPDATE_AVAILABLE' as NotificationEventType,
        'RELEASE_DELAYED': 'UPDATE_AVAILABLE' as NotificationEventType,
        'PATTERN_CHANGED': 'SETTINGS_CHANGED' as NotificationEventType,
        'SYSTEM': 'SYSTEM_INFO' as NotificationEventType,
        'ERROR': 'SYSTEM_ERROR' as NotificationEventType,
    };
    const payload: NotificationPayload = {
        title: data.title,
        body: data.message,
        event: eventMap[data.type] ?? ('SYSTEM_INFO' as NotificationEventType),
    };
    if (data.metadata) payload.metadata = data.metadata;
    return payload;
}

export async function sendToChannel(channel: NotificationChannel, data: NotificationData): Promise<AsyncResult<void, Error>> {
    try {
        switch (channel.type) {
            case 'web':
                return await sendWebNotification(data);
            case 'email':
                return await sendEmailNotification(data);
            case 'discord':
                return await sendDiscordNotification(data);
            case 'telegram':
                return await sendTelegramNotification(data);
            default:
                return createErrorResult(new Error(`Unknown notification channel: ${channel.type}`));
        }
    }
    catch (error: unknown) {
        return createErrorResult(error instanceof Error ? error : new Error(String(error)));
    }
}

async function sendWebNotification(data: NotificationData): Promise<AsyncResult<void, Error>> {
    try {
        const notification = await prisma.notification.create({
            data: {
                userId: data.userId ?? 'system',
                type: data.type as NotificationEventType,
                severity: data.severity ?? 'INFO',
                title: data.title,
                message: data.message,
                metadata: (data.metadata ?? {}) as Prisma.InputJsonValue,
                read: false,
                createdAt: new Date(),
                ...(data.relatedMangaId !== null && data.relatedMangaId !== undefined ? { relatedMangaId: data.relatedMangaId } : {}),
                ...(data.relatedChapterId !== null && data.relatedChapterId !== undefined ? { relatedChapterId: data.relatedChapterId } : {}),
                ...(data.relatedJobId !== null && data.relatedJobId !== undefined ? { relatedJobId: data.relatedJobId } : {}),
                ...(data.actionUrl !== null && data.actionUrl !== undefined ? { actionUrl: data.actionUrl } : {})
            }
        });

        const levelMap: Record<string, 'info' | 'success' | 'warning' | 'error'> = {
            INFO: 'info',
            SUCCESS: 'success',
            WARNING: 'warning',
            ERROR: 'error'
        };
        void realtimeEmitter.emitNotification({
            id: String(notification.id),
            title: data.title,
            message: data.message,
            level: levelMap[data.severity ?? 'INFO'] ?? 'info'
        });

        return createSuccessResult(undefined);
    }
    catch (error: unknown) {
        return createErrorResult(error instanceof Error ? error : new Error(String(error)));
    }
}

async function sendEmailNotification(data: NotificationData): Promise<AsyncResult<void, Error>> {
    try {
        const { notificationsConfigService } = await import('./configService');
        const dbEmail = await notificationsConfigService.getEmailConfig();

        if (!dbEmail.to) {
            logger.info('[NotificationService] Email recipient not configured');
            return createSuccessResult(undefined);
        }

        const adapter = new EmailAdapter({
            host: dbEmail.smtp.host,
            port: dbEmail.smtp.port,
            username: dbEmail.smtp.auth.user,
            password: dbEmail.smtp.auth.pass,
            from: dbEmail.from,
            to: [dbEmail.to],
            secure: dbEmail.smtp.secure,
            enabled: true,
            events: []
        });

        if (!adapter.isEnabled()) {
            return createSuccessResult(undefined);
        }

        const payload = mapDataToPayload(data);
        const result = await adapter.send(payload);
        if (isSuccess(result)) {
            return createSuccessResult(undefined);
        }
        return createErrorResult(result.status === 'error' ? result.error : new Error('Email send failed'));
    }
    catch (error: unknown) {
        return createErrorResult(error instanceof Error ? error : new Error(String(error)));
    }
}

async function sendDiscordNotification(data: NotificationData): Promise<AsyncResult<void, Error>> {
    try {
        const { notificationsConfigService } = await import('./configService');
        const dbDiscord = await notificationsConfigService.getDiscordConfig();

        if (!dbDiscord.webhookUrl) {
            logger.info('[NotificationService] Discord webhook URL not configured');
            return createSuccessResult(undefined);
        }

        const adapter = new DiscordAdapter({
            webhookUrl: dbDiscord.webhookUrl,
            username: dbDiscord.username,
            ...(dbDiscord.avatarUrl ? { avatarUrl: dbDiscord.avatarUrl } : {}),
            ...(dbDiscord.mentionRole ? { mentionRole: dbDiscord.mentionRole } : {}),
            enabled: true,
            events: []
        });

        if (!adapter.isEnabled()) {
            return createSuccessResult(undefined);
        }

        const payload = mapDataToPayload(data);
        const result = await adapter.send(payload);
        if (isSuccess(result)) {
            return createSuccessResult(undefined);
        }
        return createErrorResult(result.status === 'error' ? result.error : new Error('Discord send failed'));
    }
    catch (error: unknown) {
        return createErrorResult(error instanceof Error ? error : new Error(String(error)));
    }
}

async function sendTelegramNotification(data: NotificationData): Promise<AsyncResult<void, Error>> {
    try {
        const { notificationsConfigService } = await import('./configService');
        const dbTelegram = await notificationsConfigService.getTelegramConfig();

        if (!dbTelegram.botToken || !dbTelegram.chatId) {
            logger.info('[NotificationService] Telegram bot token or chat ID not configured');
            return createSuccessResult(undefined);
        }

        const adapter = new TelegramAdapter({
            botToken: dbTelegram.botToken,
            chatId: dbTelegram.chatId,
            enabled: true,
            events: [],
            sendSilently: false
        });

        if (!adapter.isEnabled()) {
            return createSuccessResult(undefined);
        }

        const payload = mapDataToPayload(data);
        const result = await adapter.send(payload);
        if (isSuccess(result)) {
            return createSuccessResult(undefined);
        }
        return createErrorResult(result.status === 'error' ? result.error : new Error('Telegram send failed'));
    }
    catch (error: unknown) {
        return createErrorResult(error instanceof Error ? error : new Error(String(error)));
    }
}
