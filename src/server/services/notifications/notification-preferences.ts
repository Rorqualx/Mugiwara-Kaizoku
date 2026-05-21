import { prisma } from '@/server/db';
import { getErrorMessage } from '@/utils/errors/helpers';
import { logger } from '@/utils/logger';

import type { NotificationData, NotificationPreferences } from './NotificationService';
import type { NotificationEventType } from '@prisma/client';

export type PreferenceChannel = 'bell' | 'email' | 'discord' | 'slack' | 'telegram' | 'webhook';
export const PREFERENCE_CHANNELS: readonly PreferenceChannel[] = [
    'bell', 'email', 'discord', 'slack', 'telegram', 'webhook',
] as const;

const DEFAULT_PREFERENCES: NotificationPreferences = {
    channels: [{ type: 'web', enabled: true }],
    newReleases: true,
    upcomingReleases: true,
    releaseDelays: true,
    patternChanges: true,
    systemNotifications: true,
};

/**
 * Default per-channel enablement for unseen (userId, eventType, channel) pairs.
 * Bell defaults ON for every event; external channels default OFF — opt-in
 * keeps Discord/Email/etc. quiet until the user wires them up.
 */
function defaultEnabled(channel: PreferenceChannel): boolean {
    return channel === 'bell';
}

export function getUserPreferences(): Promise<NotificationPreferences> {
    try {
        return Promise.resolve(DEFAULT_PREFERENCES);
    } catch (error: unknown) {
        logger.error('[NotificationService] Error getting user preferences:', getErrorMessage(error));
        return Promise.resolve(DEFAULT_PREFERENCES);
    }
}

export function isNotificationEnabled(type: NotificationData['type'], preferences: NotificationPreferences): boolean {
    switch (type) {
        case 'NEW_RELEASE':
            return preferences.newReleases;
        case 'UPCOMING_RELEASE':
            return preferences.upcomingReleases;
        case 'RELEASE_DELAYED':
            return preferences.releaseDelays;
        case 'PATTERN_CHANGED':
            return preferences.patternChanges;
        case 'SYSTEM':
        case 'ERROR':
            return preferences.systemNotifications;
        default:
            return true;
    }
}

/**
 * Per-user, per-(eventType, channel) check used by the unified `notifyUser`
 * helper and external channel dispatchers. Returns `defaultEnabled(channel)`
 * when no row exists for the user — opt-in semantics for external channels.
 */
export async function isUserChannelEnabled(
    userId: string,
    eventType: NotificationEventType,
    channel: PreferenceChannel,
): Promise<boolean> {
    try {
        const pref = await prisma.notificationPreference.findUnique({
            where: { userId_eventType_channel: { userId, eventType, channel } },
            select: { enabled: true },
        });
        return pref?.enabled ?? defaultEnabled(channel);
    } catch (error) {
        logger.warn('[NotificationService] isUserChannelEnabled lookup failed', {
            error: getErrorMessage(error),
            userId,
            eventType,
            channel,
        });
        return defaultEnabled(channel);
    }
}

/**
 * Batch the per-channel lookups for a single (userId, eventType) — used by the
 * fan-out path so we don't issue one query per channel.
 */
export async function getUserChannelMatrix(
    userId: string,
    eventType: NotificationEventType,
): Promise<Record<PreferenceChannel, boolean>> {
    const result = {} as Record<PreferenceChannel, boolean>;
    try {
        const rows = await prisma.notificationPreference.findMany({
            where: { userId, eventType },
            select: { channel: true, enabled: true },
        });
        const lookup = new Map(rows.map((r) => [r.channel, r.enabled]));
        for (const channel of PREFERENCE_CHANNELS) {
            result[channel] = lookup.get(channel) ?? defaultEnabled(channel);
        }
        return result;
    } catch (error) {
        logger.warn('[NotificationService] getUserChannelMatrix lookup failed', {
            error: getErrorMessage(error),
            userId,
            eventType,
        });
        for (const channel of PREFERENCE_CHANNELS) {
            result[channel] = defaultEnabled(channel);
        }
        return result;
    }
}

export function isInQuietHours(preferences: NotificationPreferences): boolean {
    if (!preferences.quietHours?.enabled) {
        return false;
    }
    const now = new Date();
    const currentTime = now.getHours() * 60 + now.getMinutes();
    const startParts = preferences.quietHours.start.split(':').map(Number);
    const endParts = preferences.quietHours.end.split(':').map(Number);

    if (startParts.length !== 2 || endParts.length !== 2) {
        return false;
    }

    const startHour = startParts[0] ?? 0;
    const startMinute = startParts[1] ?? 0;
    const endHour = endParts[0] ?? 0;
    const endMinute = endParts[1] ?? 0;

    const startTime = startHour * 60 + startMinute;
    const endTime = endHour * 60 + endMinute;

    if (startTime > endTime) {
        return currentTime >= startTime || currentTime <= endTime;
    }
    return currentTime >= startTime && currentTime <= endTime;
}
