/**
 * Release Detection Worker
 *
 * Detects new chapter releases in real-time by checking recent updates
 * from monitored manga and updating calendar events accordingly.
 *
 * Following project conventions:
 * - AsyncResult pattern
 * - Proper error handling
 * - Type-safe implementations
 */


import { EventStatus, CalendarEventType, Prisma } from '@prisma/client';

import { prisma } from '@/server/db';
import { CalendarEventService } from '@/server/services/calendar/CalendarEventService';
import { ReleaseScheduleService } from '@/server/services/calendar/ReleaseScheduleService';
import { realtimeEmitter } from '@/server/services/realtime/RealtimeEventEmitter';
import { createLogger } from '@/utils/logger';
import { logReleaseDetected, logPatternUpdated } from '@/utils/system-events';


const logger = createLogger('ReleaseDetectionWorker');
/**
 * Release detection configuration
 */
export interface ReleaseDetectionConfig {
    /**
     * Minutes to look back for new releases
     */
    lookbackMinutes: number;
    /**
     * Batch size for processing
     */
    batchSize: number;
    /**
     * Enable notifications for new releases
     */
    enableNotifications: boolean;
}
/**
 * Worker for detecting new manga releases
 */
export class ReleaseDetectionWorker {
    private eventService = new CalendarEventService();
    private scheduleService = new ReleaseScheduleService();
    private lastCheckTime: Date | null = null;
    /**
     * Detect new releases since last check
     */
    async detectNewReleases(config?: Partial<ReleaseDetectionConfig>): Promise<void> {
        const settings: ReleaseDetectionConfig = {
            lookbackMinutes: 15,
            batchSize: 20,
            enableNotifications: true,
            ...config
        };
        logger.info('[ReleaseDetection] Starting release detection');

        // Emit WebSocket event for detection started
        void realtimeEmitter.emitSystemEvent({
            eventType: 'release:detection:started',
            source: 'ReleaseDetectionWorker',
            message: 'Release detection started',
            data: { timestamp: new Date().toISOString() }
        });

        try {
            // Determine check window
            const now = new Date();
            const checkFrom = this.lastCheckTime ??
                new Date(now.getTime() - settings.lookbackMinutes * 60 * 1000);
            // Get recently updated chapters
            const recentChapters = await prisma.chapter.findMany({
                where: {
                    OR: [
                        {
                            createdAt: {
                                gte: checkFrom,
                                lte: now
                            }
                        },
                        {
                            updatedAt: {
                                gte: checkFrom,
                                lte: now
                            }
                        }
                    ],
                    Manga: {
                        monitoringConfig: {
                            path: ['enabled'],
                            equals: true
                        }
                    }
                },
                include: {
                    Manga: true
                },
                orderBy: {
                    createdAt: 'desc'
                },
                take: settings.batchSize
            });
            logger.info(`[ReleaseDetection] Found ${recentChapters.length} recent chapters`);

            // Process chapters in parallel using Promise.allSettled
            const processingResults = await Promise.allSettled(
                recentChapters.map((chapter) => this.processChapter(chapter, settings.enableNotifications))
            );

            // Count results
            const results = processingResults
                .filter((result) => result.status === 'fulfilled')
                .map((result) => (result as PromiseFulfilledResult<{ detected: boolean; matched: boolean }>).value);

            const detectedCount = results.filter((r) => r.detected).length;
            const matchedEvents = results.filter((r) => r.matched).length;

            // Log any failures
            const failures = processingResults.filter((result) => result.status === 'rejected');
            if (failures.length > 0) {
                logger.warn(`[ReleaseDetection] Failed to process ${failures.length} chapters`);
            }

            // Update last check time
            this.lastCheckTime = now;
            logger.info(`[ReleaseDetection] Detection complete: ${detectedCount} new releases, ${matchedEvents} matched predictions`);

            // Emit WebSocket event for real-time UI sync
            if (detectedCount > 0) {
                void realtimeEmitter.emitSystemEvent({
                    eventType: 'release:detection:completed',
                    source: 'ReleaseDetectionWorker',
                    message: `Detected ${detectedCount} new releases, ${matchedEvents} matched predictions`,
                    data: {
                        detectedCount,
                        matchedPredictions: matchedEvents,
                        timestamp: now.toISOString()
                    }
                });
            }

            // Reconcile any missed events
            await this.reconcileMissedEvents();
        }
        catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            logger.error('[ReleaseDetection] Fatal error during detection', errorMessage);

            // Emit WebSocket event for detection error
            void realtimeEmitter.emitSystemEvent({
                eventType: 'release:detection:error',
                source: 'ReleaseDetectionWorker',
                message: `Release detection failed: ${errorMessage}`,
                data: { error: errorMessage, timestamp: new Date().toISOString() }
            });

            throw error;
        }
    }

    /**
     * Process a single chapter for release detection
     */
    private async processChapter(
        chapter: unknown,
        enableNotifications: boolean
    ): Promise<{ detected: boolean; matched: boolean }> {
        const c = chapter as Record<string, unknown>;

        try {
            // Check if this is a new release
            const isNewRelease = await this.isNewRelease(chapter);

            if (!isNewRelease) {
                return { detected: false, matched: false };
            }

            // Log the detection
            const manga = c["Manga"] as Record<string, unknown>;
            logReleaseDetected(
                (manga["mangaTitle"] ?? manga["title"]) as string,
                (c["index"] as number).toString(),
                (c["releaseDate"] ?? c["createdAt"]) as Date
            );

            // Update calendar events
            const matched = await this.updateCalendarEvents(chapter);

            // Store in release history
            await this.storeReleaseHistory(chapter);

            // Update pattern confidence if this was predicted
            await this.updatePatternConfidence(c["mangaId"] as number, matched);

            // Send notification if enabled
            if (enableNotifications) {
                await this.sendReleaseNotification(chapter);
            }

            return { detected: true, matched };
        } catch (error: unknown) {
            logger.error(
                `[ReleaseDetection] Error processing chapter ${c["id"]}`,
                error instanceof Error ? error.message : String(error)
            );
            throw error;
        }
    }

    /**
     * Check if chapter is a new release
     */
    private async isNewRelease(chapter: unknown): Promise<boolean> {
        const c = chapter as Record<string, unknown>;
        // Check if we already have this in release history
        const existing = await prisma.releaseHistory.findFirst({
            where: {
                mangaId: c["mangaId"] as number,
                chapterId: c["id"] as number
            }
        });
        return !existing;
    }
    /**
     * Update calendar events for a new release
     */
    private async updateCalendarEvents(chapter: unknown): Promise<boolean> {
        const c = chapter as Record<string, unknown>;
        const manga = c["manga"] as Record<string, unknown>;
        try {
            const releaseDate = (c["releaseDate"] as Date | undefined) ?? (c["createdAt"] as Date);
            // Find matching scheduled event
            const scheduledEvent = await prisma.calendarEvent.findFirst({
                where: {
                    mangaId: c["mangaId"] as number,
                    eventType: CalendarEventType.CHAPTER_RELEASE,
                    status: EventStatus.SCHEDULED,
                    scheduledDate: {
                        gte: new Date(releaseDate.getTime() - 3 * 24 * 60 * 60 * 1000), // 3 days before
                        lte: new Date(releaseDate.getTime() + 3 * 24 * 60 * 60 * 1000) // 3 days after
                    }
                }
            });
            if (scheduledEvent) {
                // Update the event as released
                const existingMetadata = (scheduledEvent["metadata"] as Record<string, unknown> | null) ?? {};
                const newMetadata: Record<string, Prisma.InputJsonValue> = {
                    ...existingMetadata,
                    chapterNumber: typeof c["index"] === 'number' ? c["index"] : 0,
                    matchedPrediction: true,
                    predictionAccuracy: this.calculateAccuracy(scheduledEvent.scheduledDate, releaseDate)
                };

                await prisma.calendarEvent.update({
                    where: { id: scheduledEvent["id"] },
                    data: {
                        status: EventStatus.RELEASED,
                        actualDate: releaseDate,
                        chapterId: c["id"] as number,
                        metadata: newMetadata as Prisma.InputJsonValue
                    }
                });
                logger.info(`[ReleaseDetection] Matched release to scheduled event for manga ${c["mangaId"]}`);
                return true;
            }
            else {
                // Create a new event for unscheduled release
                const newMetadata: Record<string, Prisma.InputJsonValue> = {
                    chapterNumber: typeof c["index"] === 'number' ? c["index"] : 0,
                    wasUnscheduled: true
                };

                await prisma.calendarEvent.create({
                    data: {
                        mangaId: c["mangaId"] as number,
                        chapterId: c["id"] as number,
                        eventType: CalendarEventType.CHAPTER_RELEASE,
                        scheduledDate: releaseDate,
                        actualDate: releaseDate,
                        status: EventStatus.RELEASED,
                        confidence: 1.0,
                        title: `${manga["mangaTitle"] ?? manga["title"]} - Chapter ${c["index"] ?? 'Unknown'}`,
                        description: 'Unscheduled release detected',
                        source: 'release_detection',
                        metadata: newMetadata as Prisma.InputJsonValue
                    }
                });
                logger.info(`[ReleaseDetection] Created event for unscheduled release`);
                return false;
            }
        }
        catch (error: unknown) {
            logger.error('[ReleaseDetection] Error updating calendar events', error instanceof Error ? error.message : String(error));
            return false;
        }
    }
    /**
     * Calculate prediction accuracy
     */
    private calculateAccuracy(predicted: Date, actual: Date): number {
        const diffMs = Math.abs(predicted.getTime() - actual.getTime());
        const diffDays = diffMs / (1000 * 60 * 60 * 24);
        // Perfect if within same day
        if (diffDays < 1)
            return 1.0;
        // Decreases with each day of difference
        return Math.max(0, 1 - (diffDays * 0.2));
    }
    /**
     * Store release in history
     */
    private async storeReleaseHistory(chapter: unknown): Promise<void> {
        const c = chapter as Record<string, unknown>;
        try {
            const releaseDate = (c["releaseDate"] as Date | undefined) ?? (c["createdAt"] as Date);
            // Get previous release
            const previousRelease = await prisma.releaseHistory.findFirst({
                where: {
                    mangaId: c["mangaId"] as number,
                    releaseDate: { lt: releaseDate }
                },
                orderBy: { releaseDate: 'desc' }
            });
            const daysFromPrevious = previousRelease
                ? Math.floor((releaseDate.getTime() - previousRelease.releaseDate.getTime()) /
                    (1000 * 60 * 60 * 24))
                : undefined;

            const data: Record<string, unknown> = {
                mangaId: c["mangaId"],
                chapterId: c["id"],
                chapterNumber: (c["index"] as number | undefined)?.toString() ?? 'Unknown',
                releaseDate,
                detectedDate: new Date(),
                dayOfWeek: releaseDate.getDay(),
                isOnSchedule: await this.isOnSchedule(c["mangaId"] as number, releaseDate),
                source: 'release_detection'
            };

            if (daysFromPrevious !== undefined) {
                data["daysFromPrevious"] = daysFromPrevious;
            }

            await prisma.releaseHistory.create({
                data: data as {
                    mangaId: number;
                    chapterId: number;
                    chapterNumber: string;
                    releaseDate: Date;
                    detectedDate: Date;
                    dayOfWeek: number;
                    isOnSchedule: boolean;
                    source: string;
                    daysFromPrevious?: number;
                }
            });
        }
        catch (error: unknown) {
            logger.error('[ReleaseDetection] Error storing release history', error instanceof Error ? error.message : String(error));
        }
    }
    /**
     * Check if release is on schedule
     */
    private async isOnSchedule(mangaId: number, releaseDate: Date): Promise<boolean> {
        const schedule = await prisma.releaseSchedule.findFirst({
            where: { mangaId },
            orderBy: { confidence: 'desc' }
        });
        if (!schedule)
            return true; // No schedule to compare against
        // Check based on schedule type
        switch (schedule.releaseType) {
            case 'WEEKLY':
                return schedule.dayOfWeek === releaseDate.getDay();
            case 'BIWEEKLY':
                // Would need to check against pattern
                return true;
            case 'MONTHLY':
                return schedule.dayOfMonth === releaseDate.getDate();
            default:
                return true;
        }
    }
    /**
     * Update pattern confidence based on prediction accuracy
     */
    private async updatePatternConfidence(mangaId: number, _matchedPrediction: boolean): Promise<void> {
        try {
            const schedule = await prisma.releaseSchedule.findFirst({
                where: { mangaId },
                orderBy: { confidence: 'desc' }
            });
            if (!schedule)
                return;
            // Get recent prediction accuracy - filter metadata in application code
            const recentEvents = await prisma.calendarEvent.findMany({
                where: {
                    mangaId,
                    eventType: CalendarEventType.CHAPTER_RELEASE,
                    status: EventStatus.RELEASED
                },
                orderBy: { actualDate: 'desc' },
                take: 10
            });
            const accuracyCount = recentEvents.filter((e: typeof recentEvents[number]) => {
                const metadata = e["metadata"] as Record<string, unknown> | null;
                return metadata && (metadata["matchedPrediction"] as boolean) === true;
            }).length;
            const newConfidence = accuracyCount / Math.max(recentEvents.length, 1);
            // Update if confidence changed significantly
            if (Math.abs(newConfidence - schedule.confidence) > 0.1) {
                await prisma.releaseSchedule.update({
                    where: { id: schedule["id"] },
                    data: {
                        confidence: newConfidence,
                        lastUpdated: new Date()
                    }
                });
                const manga = await prisma.manga.findUnique({
                    where: { id: mangaId },
                    select: { title: true, mangaTitle: true }
                });
                logPatternUpdated(manga?.mangaTitle ?? manga?.title ?? 'Unknown', `${Math.round(schedule.confidence * 100)}%`, `${Math.round(newConfidence * 100)}%`, newConfidence);
            }
        }
        catch (error: unknown) {
            logger.error('[ReleaseDetection] Error updating pattern confidence', error instanceof Error ? error.message : String(error));
        }
    }
    /**
     * Send notification for new release
     */
    private sendReleaseNotification(chapter: unknown): Promise<void> {
        const c = chapter as Record<string, unknown>;
        try {
            // This would integrate with the notification system
            logger.info(`[ReleaseDetection] Would send notification for chapter ${c["id"]}`);
            // TODO: Implement actual notification sending
            // await notificationService.send({
            //   type: 'NEW_RELEASE',
            //   title: `New Chapter Released: ${chapter.manga.mangaTitle}`,
            //   message: `Chapter ${chapter.chapterNumber} is now available`,
            //   metadata: {
            //     mangaId: chapter.mangaId,
            //     chapterId: chapter.id
            //   }
            // });
        }
        catch (error: unknown) {
            logger.error('[ReleaseDetection] Error sending notification', error instanceof Error ? error.message : String(error));
        }
        return Promise.resolve();
    }
    /**
     * Reconcile missed events
     */
    private async reconcileMissedEvents(): Promise<void> {
        try {
            // Find scheduled events that should have been released by now
            const missedEvents = await prisma.calendarEvent.findMany({
                where: {
                    eventType: CalendarEventType.CHAPTER_RELEASE,
                    status: EventStatus.SCHEDULED,
                    scheduledDate: {
                        lt: new Date()
                    },
                    confidence: {
                        gte: 0.5 // Only reconcile confident predictions
                    }
                },
                include: {
                    manga: true
                }
            });

            logger.info(`[ReleaseDetection] Found ${missedEvents.length} potentially missed events`);

            // Process events in parallel using Promise.allSettled
            const results = await Promise.allSettled(
                missedEvents.map((event) => this.processEventReconciliation(event))
            );

            // Log any failures
            const failures = results.filter((result) => result.status === 'rejected');
            if (failures.length > 0) {
                logger.warn(`[ReleaseDetection] Failed to reconcile ${failures.length} events`);
            }
        }
        catch (error: unknown) {
            logger.error('[ReleaseDetection] Error reconciling missed events', error instanceof Error ? error.message : String(error));
        }
    }

    /**
     * Process reconciliation for a single missed event
     */
    private async processEventReconciliation(event: unknown): Promise<void> {
        const e = event as Record<string, unknown>;

        // Check if chapter was actually released
        const chapter = await prisma.chapter.findFirst({
            where: {
                mangaId: e["mangaId"] as number,
                releaseDate: {
                    gte: new Date((e["scheduledDate"] as Date).getTime() - 7 * 24 * 60 * 60 * 1000),
                    lte: new Date()
                }
            },
            orderBy: {
                releaseDate: 'desc'
            }
        });

        if (chapter) {
            await this.markEventAsDelayedWithChapter(e, chapter);
        } else {
            await this.markEventAsDelayedWithoutChapter(e);
        }
    }

    /**
     * Mark event as delayed when chapter was found
     */
    private async markEventAsDelayedWithChapter(
        event: Record<string, unknown>,
        chapter: Record<string, unknown>
    ): Promise<void> {
        const releaseDate = (chapter["releaseDate"] ?? chapter["createdAt"]) as Date;
        const scheduledDate = event["scheduledDate"] as Date;
        const delayDays = Math.floor((releaseDate.getTime() - scheduledDate.getTime()) / (1000 * 60 * 60 * 24));

        await prisma.calendarEvent.update({
            where: { id: event["id"] as number },
            data: {
                status: EventStatus.DELAYED,
                actualDate: releaseDate,
                chapterId: chapter["id"] as number,
                metadata: {
                    ...((event["metadata"] as Record<string, unknown> | null) ?? {}),
                    delayDays
                } as Prisma.InputJsonValue
            }
        });
    }

    /**
     * Mark event as delayed when no chapter was found
     */
    private async markEventAsDelayedWithoutChapter(event: Record<string, unknown>): Promise<void> {
        const scheduledDate = event["scheduledDate"] as Date;
        const daysPastDue = Math.floor((Date.now() - scheduledDate.getTime()) / (1000 * 60 * 60 * 24));

        // Only mark as delayed if significantly past due
        if (daysPastDue <= 7) {
            return;
        }

        await prisma.calendarEvent.update({
            where: { id: event["id"] as number },
            data: {
                status: EventStatus.DELAYED,
                metadata: {
                    ...((event["metadata"] as Record<string, unknown> | null) ?? {}),
                    daysPastDue
                } as Prisma.InputJsonValue
            }
        });
    }
}
// Export singleton instance
export const releaseDetectionWorker = new ReleaseDetectionWorker();
