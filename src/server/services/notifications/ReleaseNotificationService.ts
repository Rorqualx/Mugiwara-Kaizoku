import { EventStatus, CalendarEventType } from '@prisma/client';
import { addDays, startOfDay, endOfDay } from 'date-fns';

import { prisma } from '@/server/db';
import { realtimeEmitter } from '@/server/services/realtime/RealtimeEventEmitter';
import type { ID } from '@/types/search.types';
import type { AsyncResult} from '@/utils/async-result';
import { createSuccessResult, createErrorResult, isSuccess, isError } from '@/utils/async-result'
import { unwrapOr } from '@/utils/async-result'
import { toNumberId } from '@/utils/id-converters';
import { logger } from '@/utils/logger';


import { CalendarEventService } from '../calendar/CalendarEventService';

import { notifySystem } from './notify';

import type { CalendarEvent } from '@prisma/client';

interface NotificationResult {
    sent: number;
    failed: number;
    errors: string[];
}

interface BatchTally {
    succeeded: boolean;
    errorMessage?: string;
}

function readBatchResult(
    batchResult: PromiseSettledResult<AsyncResult<void, Error>>,
): BatchTally {
    if (batchResult.status === 'fulfilled' && isSuccess(batchResult.value)) {
        return { succeeded: true };
    }
    const error: unknown = batchResult.status === 'rejected'
        ? batchResult.reason
        : ('error' in batchResult.value ? batchResult.value.error : undefined);
    return {
        succeeded: false,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
    };
}

export class ReleaseNotificationService {
    private eventService: CalendarEventService;
    // Configuration
    private readonly UPCOMING_DAYS = 1; // Notify 1 day before release
    private readonly BATCH_SIZE = 20;
    constructor() {
        this.eventService = new CalendarEventService();
    }
    /**
     * Send notifications for upcoming releases
     */
    async sendDailyUpcomingNotifications(): Promise<AsyncResult<NotificationResult, Error>> {
        try {
            logger.info('[ReleaseNotification] Sending daily upcoming release notifications');
            const tomorrow = addDays(new Date(), this.UPCOMING_DAYS);
            const start = startOfDay(tomorrow);
            const end = endOfDay(tomorrow);
            const eventsResult = await this.eventService.getEventsForDateRange(start, end, {
                eventTypes: [CalendarEventType.CHAPTER_RELEASE],
                status: [EventStatus.SCHEDULED, EventStatus.CONFIRMED],
                minConfidence: 0.7
            });
            if (isError(eventsResult)) {
                return createErrorResult(eventsResult.error);
            }
            const events = unwrapOr(eventsResult, []);
            logger.info(`[ReleaseNotification] Found ${events.length} upcoming releases`);
            const result: NotificationResult = { sent: 0, failed: 0, errors: [] };

            for (let i = 0; i < events.length; i += this.BATCH_SIZE) {
                const batch = events.slice(i, i + this.BATCH_SIZE);
                // eslint-disable-next-line no-await-in-loop -- Intentional batching to control concurrency (BATCH_SIZE chunks)
                const batchResults = await Promise.allSettled(batch.map((event: CalendarEvent) => this.sendUpcomingReleaseNotification(event)));
                batchResults.forEach((batchResult, index) => {
                    const batchEvent = batch[index];
                    if (batchEvent === undefined) return;
                    const tally = readBatchResult(batchResult);
                    if (tally.succeeded) {
                        result.sent++;
                    } else {
                        result.failed++;
                        result.errors.push(`Event ${batchEvent.id}: ${tally.errorMessage ?? 'Unknown error'}`);
                    }
                });
            }
            logger.info(`[ReleaseNotification] Notifications sent: ${result.sent}, failed: ${result.failed}`);

            void realtimeEmitter.emitSystemEvent({
                eventType: 'notifications:upcoming:batch:completed',
                source: 'ReleaseNotificationService',
                message: `Daily upcoming notifications: ${result.sent} sent, ${result.failed} failed`,
                data: { sent: result.sent, failed: result.failed, total: events.length }
            });

            return createSuccessResult(result);
        }
        catch (error: unknown) {
            return createErrorResult(error instanceof Error ? error : new Error(String(error)));
        }
    }
    /**
     * Send notification for a specific upcoming release
     */
    private async sendUpcomingReleaseNotification(event: CalendarEvent): Promise<AsyncResult<void, Error>> {
        try {
            const manga = await prisma.manga.findUnique({
                where: { id: toNumberId(event.mangaId) },
                select: { title: true },
            });
            if (!manga) {
                return createErrorResult(new Error(`Manga not found: ${event.mangaId}`));
            }
            const metadata = event.metadata as { chapterNumber?: string } | null;

            await notifySystem({
                type: 'CHAPTER_ADDED',
                severity: 'INFO',
                title: `New chapter tomorrow: ${manga.title}`,
                message: metadata?.chapterNumber
                    ? `Chapter ${metadata.chapterNumber} is expected to release tomorrow`
                    : 'A new chapter is expected to release tomorrow',
                metadata: {
                    mangaId: event.mangaId,
                    eventId: event.id,
                    chapterNumber: metadata?.chapterNumber,
                    confidence: event.confidence,
                    scheduledDate: event.scheduledDate,
                },
                relatedMangaId: toNumberId(event.mangaId),
                actionUrl: `/manga/${event.mangaId}`,
            });
            return createSuccessResult(undefined);
        }
        catch (error: unknown) {
            return createErrorResult(error instanceof Error ? error : new Error(String(error)));
        }
    }
    /**
     * Send notification for a new release
     */
    async sendNewReleaseNotification(mangaId: ID, chapterNumber: string, releaseDate: Date): Promise<AsyncResult<void, Error>> {
        try {
            const numericId = toNumberId(mangaId);
            const manga = await prisma.manga.findUnique({
                where: { id: numericId },
                select: { title: true },
            });
            if (!manga) {
                return createErrorResult(new Error(`Manga not found: ${mangaId}`));
            }
            const eventsResult = await this.eventService.getEventsForDateRange(startOfDay(releaseDate), endOfDay(releaseDate), {
                mangaIds: [numericId],
                eventTypes: [CalendarEventType.CHAPTER_RELEASE],
                status: [EventStatus.SCHEDULED]
            });
            if (isSuccess(eventsResult) && eventsResult.data.length > 0) {
                const event = eventsResult.data[0];
                if (event !== undefined) {
                    await this.eventService.confirmRelease(event.id, releaseDate);
                }
            }

            await notifySystem({
                type: 'CHAPTER_ADDED',
                severity: 'SUCCESS',
                title: `New chapter released: ${manga.title}`,
                message: `Chapter ${chapterNumber} is now available`,
                metadata: { mangaId, chapterNumber, releaseDate },
                relatedMangaId: numericId,
                actionUrl: `/manga/${mangaId}/chapters`,
            });
            return createSuccessResult(undefined);
        }
        catch (error: unknown) {
            return createErrorResult(error instanceof Error ? error : new Error(String(error)));
        }
    }
    /**
     * Process a single delayed event: notify + mark DELAYED.
     */
    private async processDelayedEvent(event: CalendarEvent, now: Date): Promise<AsyncResult<{ eventId: number }, Error>> {
        try {
            const manga = await prisma.manga.findUnique({
                where: { id: toNumberId(event.mangaId) },
                select: { title: true },
            });
            if (!manga) {
                return createErrorResult(new Error(`Manga not found: ${event.mangaId}`));
            }

            const delayDays = Math.floor((now.getTime() - event.scheduledDate.getTime()) / (1000 * 60 * 60 * 24));
            const metadata = event.metadata as { chapterNumber?: string } | null;

            await notifySystem({
                type: 'SYSTEM_WARNING',
                severity: 'WARNING',
                title: `Release delayed: ${manga.title}`,
                message: metadata?.chapterNumber
                    ? `Chapter ${metadata.chapterNumber} is ${delayDays} day${delayDays !== 1 ? 's' : ''} late`
                    : `Expected release is ${delayDays} day${delayDays !== 1 ? 's' : ''} late`,
                metadata: {
                    mangaId: event.mangaId,
                    eventId: event.id,
                    originalDate: event.scheduledDate,
                    delayDays,
                },
                relatedMangaId: toNumberId(event.mangaId),
                actionUrl: `/manga/${event.mangaId}`,
            });

            await this.eventService.updateEventStatus(event.id, EventStatus.DELAYED);
            return createSuccessResult({ eventId: event.id });
        } catch (error: unknown) {
            return createErrorResult(error instanceof Error ? error : new Error(String(error)));
        }
    }

    /**
     * Send notifications for delayed releases
     */
    async sendDelayNotifications(): Promise<AsyncResult<NotificationResult, Error>> {
        try {
            logger.info('[ReleaseNotification] Checking for delayed releases');
            const now = new Date();
            const eventsResult = await this.eventService.getOverdueEvents();
            if (isError(eventsResult)) {
                return createErrorResult(eventsResult.error);
            }
            const delayedEvents = unwrapOr(eventsResult, []);
            logger.info(`[ReleaseNotification] Found ${delayedEvents.length} delayed releases`);
            const result: NotificationResult = { sent: 0, failed: 0, errors: [] };

            const delayResults = await Promise.allSettled(
                delayedEvents.map((event) => this.processDelayedEvent(event, now)),
            );

            delayResults.forEach((delayResult, index) => {
                const delayedEvent = delayedEvents[index];
                if (delayedEvent === undefined) return;
                if (delayResult.status === 'fulfilled' && isSuccess(delayResult.value)) {
                    result.sent++;
                    return;
                }
                result.failed++;
                const error: unknown = delayResult.status === 'rejected'
                    ? delayResult.reason
                    : ('error' in delayResult.value ? delayResult.value.error : undefined);
                const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                result.errors.push(`Event ${delayedEvent.id}: ${errorMessage}`);
            });
            logger.info(`[ReleaseNotification] Delay notifications sent: ${result.sent}, failed: ${result.failed}`);

            void realtimeEmitter.emitSystemEvent({
                eventType: 'notifications:delay:batch:completed',
                source: 'ReleaseNotificationService',
                message: `Delay notifications: ${result.sent} sent, ${result.failed} failed`,
                data: { sent: result.sent, failed: result.failed, total: delayedEvents.length }
            });

            return createSuccessResult(result);
        }
        catch (error: unknown) {
            return createErrorResult(error instanceof Error ? error : new Error(String(error)));
        }
    }
    /**
     * Send notification when release pattern changes
     */
    async sendPatternChangeNotification(mangaId: ID, oldPattern: string, newPattern: string, confidence: number): Promise<AsyncResult<void, Error>> {
        try {
            const numericId = toNumberId(mangaId);
            const manga = await prisma.manga.findUnique({
                where: { id: numericId },
                select: { title: true },
            });
            if (!manga) {
                return createErrorResult(new Error(`Manga not found: ${mangaId}`));
            }

            await notifySystem({
                type: 'METADATA_UPDATED',
                severity: 'INFO',
                title: `Release schedule updated: ${manga.title}`,
                message: `Release pattern changed from ${this.formatPattern(oldPattern)} to ${this.formatPattern(newPattern)} (${Math.round(confidence * 100)}% confident)`,
                metadata: { mangaId, oldPattern, newPattern, confidence },
                relatedMangaId: numericId,
                actionUrl: `/manga/${mangaId}#schedule`,
            });
            return createSuccessResult(undefined);
        }
        catch (error: unknown) {
            return createErrorResult(error instanceof Error ? error : new Error(String(error)));
        }
    }
    /**
     * Format pattern type for display
     */
    private formatPattern(pattern: string): string {
        switch (pattern) {
            case 'WEEKLY': return 'weekly';
            case 'BIWEEKLY': return 'bi-weekly';
            case 'MONTHLY': return 'monthly';
            case 'IRREGULAR': return 'irregular';
            case 'HIATUS': return 'on hiatus';
            default: return pattern.toLowerCase();
        }
    }
}
