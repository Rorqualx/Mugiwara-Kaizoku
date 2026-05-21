
import { getProviderConfig, isProviderEnabled, checkRateLimit, incrementRateLimit, decrementActiveRequests, waitForRateLimit } from '@/server/config/calendar-providers';
import { prisma } from '@/server/db';
import { CalendarEventService } from '@/server/services/calendar/CalendarEventService';
import { CalendarAniListAdapter } from '@/server/services/calendar/CalendarProviderAdapters';
import { createMangaUpdatesCalendarProvider } from '@/server/services/calendar/providers/MangaUpdatesCalendarProvider';
import { ReleaseNotificationService } from '@/server/services/notifications/ReleaseNotificationService';
import type { ID } from '@/types/search.types';
import { isError, isSuccess } from '@/utils/async-result';
import { toNumberId } from '@/utils/id-converters';
import { logger } from '@/utils/logger';
import { logCalendarSyncComplete, logReleaseDetected } from '@/utils/system-events';


import type { Chapter as ChapterEntity, MangaPublicationStatus } from '@prisma/client';

interface SyncResult {
    mangaId: ID;
    success: boolean;
    error?: string;
    notificationsSent?: number;
}
/**
 * Calendar sync scheduler - handles reconciliation and new release detection
 * Pattern detection has been removed; use manual schedule override instead
 */
export class CalendarSyncScheduler {
    private eventService: CalendarEventService;
    private notificationService: ReleaseNotificationService;
    private isRunning = false;
    private isSyncing = false;
    private syncInterval: NodeJS.Timeout | null = null;
    private reconcileInterval: NodeJS.Timeout | null = null;
    private cleanupInterval: NodeJS.Timeout | null = null;
    // Configuration
    private readonly SYNC_INTERVAL_MS = 60 * 60 * 1000; // 1 hour
    private readonly RECONCILE_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 hours
    private readonly CLEANUP_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours
    private readonly BATCH_SIZE = 10;
    private readonly RETENTION_DAYS = 90;
    constructor() {
        this.eventService = new CalendarEventService();
        this.notificationService = new ReleaseNotificationService();
    }
    /**
     * Start the calendar sync scheduler
     */
    async start(): Promise<void> {
        if (this.isRunning) {
            logger.info('[CalendarSync] Scheduler already running');
            return;
        }
        logger.info('[CalendarSync] Starting calendar sync scheduler');
        this.isRunning = true;
        // Run initial sync
        await this.runSync();
        // Schedule periodic syncs
        this.syncInterval = setInterval(() => {
            this.runSync().catch(error => {
                logger.error('[CalendarSync] Sync error:', error);
            });
        }, this.SYNC_INTERVAL_MS);
        // Schedule reconciliation
        this.reconcileInterval = setInterval(() => {
            this.runReconciliation().catch(error => {
                logger.error('[CalendarSync] Reconciliation error:', error);
            });
        }, this.RECONCILE_INTERVAL_MS);
        // Schedule cleanup
        this.cleanupInterval = setInterval(() => {
            this.runCleanup().catch(error => {
                logger.error('[CalendarSync] Cleanup error:', error);
            });
        }, this.CLEANUP_INTERVAL_MS);
        logger.info('[CalendarSync] Scheduler started successfully');
    }
    /**
     * Stop the calendar sync scheduler
     */
    stop(): Promise<void> {
        if (!this.isRunning) {
            return Promise.resolve();
        }
        logger.info('[CalendarSync] Stopping calendar sync scheduler');
        this.isRunning = false;
        if (this.syncInterval) {
            clearInterval(this.syncInterval);
            this.syncInterval = null;
        }
        if (this.reconcileInterval) {
            clearInterval(this.reconcileInterval);
            this.reconcileInterval = null;
        }
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
        }
        logger.info('[CalendarSync] Scheduler stopped');
        return Promise.resolve();
    }
    /**
     * Run a full sync for all monitored manga.
     * Guarded so concurrent calls (interval + manual trigger) cannot overlap.
     */
    async runSync(): Promise<void> {
        if (this.isSyncing) {
            logger.info('[CalendarSync] Sync already in progress, skipping');
            return;
        }
        this.isSyncing = true;
        logger.info('[CalendarSync] Starting sync cycle');
        const startTime = Date.now();
        try {
            // Get all monitored manga
            const monitoredManga = await this.getMonitoredManga();
            logger.info(`[CalendarSync] Found ${monitoredManga.length} monitored manga`);
            if (monitoredManga.length === 0) {
                logger.info('[CalendarSync] No monitored manga found, skipping sync');
                return;
            }
            // Process in batches
            const results: SyncResult[] = [];
            for (let i = 0; i < monitoredManga.length; i += this.BATCH_SIZE) {
                const batch = monitoredManga.slice(i, i + this.BATCH_SIZE);
                // eslint-disable-next-line no-await-in-loop
                const batchResults = await Promise.all(batch.map(manga => this.syncManga(manga["id"], manga["title"])));
                results.push(...batchResults);
                // Small delay between batches to avoid overloading
                if (i + this.BATCH_SIZE < monitoredManga.length) {
                    // eslint-disable-next-line no-await-in-loop
                    await new Promise<void>(resolve => {
                        setTimeout(resolve, 1000);
                    });
                }
            }
            // Calculate statistics
            const successful = results.filter(r => r.success).length;
            const failed = results.filter(r => !r.success).length;
            const totalNotifications = results.reduce((sum, r) => sum + (r.notificationsSent ?? 0), 0);
            const duration = Date.now() - startTime;
            logger.info(`[CalendarSync] Sync complete in ${duration}ms:`, {
                successful,
                failed,
                totalNotifications
            });
            // Log to system events
            logCalendarSyncComplete(monitoredManga.length, 0);
            // Send daily upcoming release notifications
            await this.notificationService.sendDailyUpcomingNotifications();
        }
        catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            logger.error('[CalendarSync] Fatal error during sync:', errorMessage);
            throw new Error(errorMessage);
        }
        finally {
            this.isSyncing = false;
        }
    }
    /**
     * Sync a single manga - checks for new releases and sends notifications
     */
    private async syncManga(mangaId: ID, title: string): Promise<SyncResult> {
        try {
            logger.info(`[CalendarSync] Syncing manga: ${title} (ID: ${mangaId})`);
            const numericId = toNumberId(mangaId);

            // Check for new releases (past)
            const newReleases = await this.checkForNewReleases(mangaId);

            // Predict future releases using MU release schedule
            await this.generateFutureEvents(numericId, title);

            // Send notifications for new releases (batched)
            const notificationResults = await Promise.all(
                newReleases.map(release =>
                    this.notificationService.sendNewReleaseNotification(mangaId, release.chapterNumber, release.releaseDate)
                )
            );
            const notificationsSent = notificationResults.filter(isSuccess).length;
            return { mangaId, success: true, notificationsSent };
        }
        catch (error: unknown) {
            logger.error(`[CalendarSync] Error syncing manga ${mangaId}:`, error);
            return { mangaId, success: false, error: error instanceof Error ? error.message : String(error) };
        }
    }

    /** Generate scheduled future CalendarEvents from MU release pattern */
    private async generateFutureEvents(mangaId: number, title: string): Promise<void> {
        const manga = await prisma.manga.findUnique({
            where: { id: mangaId },
            select: { providerMetadata: true },
        });
        const pm = manga?.providerMetadata as Record<string, Record<string, unknown>> | null;
        const muSeriesId = pm?.['mangaupdates']?.['providerId'] as string | undefined;
        if (!muSeriesId) return;

        const provider = createMangaUpdatesCalendarProvider({ enabled: true, seriesId: parseInt(muSeriesId, 10) });
        if (!provider.getReleaseSchedule) return;
        const schedule = await provider.getReleaseSchedule(title) as {
            pattern: string;
            confidence: number;
            nextExpectedRelease?: Date;
            averageInterval?: number;
        } | null;
        provider.dispose();

        if (!schedule || schedule.pattern === 'IRREGULAR' || schedule.confidence < 0.3) return;
        if (!schedule.nextExpectedRelease) return;

        const intervalDays = schedule.averageInterval ?? 7;
        const now = new Date();
        const futureLimit = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

        // Calculate scheduled release dates based on pattern
        const dates: Date[] = [];
        let next = new Date(schedule.nextExpectedRelease);
        while (next <= futureLimit) {
            if (next > now) dates.push(new Date(next));
            next = new Date(next.getTime() + intervalDays * 24 * 60 * 60 * 1000);
        }

        if (dates.length === 0) return;

        // Replace old scheduled events with fresh ones — atomic so a partial
        // failure can't leave the manga without any scheduled events.
        await prisma.$transaction([
            prisma.calendarEvent.deleteMany({
                where: { mangaId, status: 'SCHEDULED', source: 'mangaupdates' },
            }),
            prisma.calendarEvent.createMany({
                data: dates.map(date => ({
                    mangaId,
                    eventType: 'CHAPTER_RELEASE' as const,
                    scheduledDate: date,
                    status: 'SCHEDULED' as const,
                    title,
                    source: 'mangaupdates',
                    confidence: schedule.confidence,
                })),
                skipDuplicates: true,
            }),
        ]);

        logger.info(`[CalendarSync] Scheduled ${dates.length} releases for "${title}" (${schedule.pattern}, every ${intervalDays.toFixed(0)} days)`);
    }
    /**
     * Check for new releases from providers
     */
    // eslint-disable-next-line complexity -- complexity 28: 5-step pipeline (fetch manga + latest chapter, resolve provider IDs, fetch with MU fallback, filter to newer, batch insert) with optional-chain guards on every step; refactor candidate
    private async checkForNewReleases(mangaId: ID): Promise<Array<{
        chapterNumber: string;
        releaseDate: Date;
    }>> {
        try {
            const numericMangaId = toNumberId(mangaId);
            // Get manga with source information
            const manga = await prisma.manga.findUnique({
                where: {
                    id: numericMangaId
                },
                select: {
                    title: true,
                    source: true,
                    providerMetadata: true,
                    metadataId: true
                }
            });
            if (!manga) {
                logger.warn(`[CalendarSync] Manga not found: ${mangaId}`);
                return [];
            }
            // Get latest chapter from database
            const latestChapter = await prisma.chapter.findFirst({
                where: {
                    mangaId: numericMangaId
                },
                orderBy: {
                    index: 'desc'
                },
                select: {
                    index: true,
                    createdAt: true,
                    releaseDate: true
                }
            });
            const latestChapterNumber = latestChapter?.index ? latestChapter.index.toString() : '0';
            const newReleases: Array<{
                chapterNumber: string;
                releaseDate: Date;
            }> = [];
            // Try to get chapters from the manga's source + MangaUpdates fallback
            const providerMeta = manga.providerMetadata as Record<string, Record<string, unknown>> | null;
            const remoteId = providerMeta && typeof providerMeta === 'object' && 'id' in providerMeta
              ? (providerMeta as unknown as { id?: string }).id : null;

            // Also check for MU seriesId in providerMetadata for cross-provider release data
            const muSeriesId = providerMeta?.['mangaupdates']?.['providerId'] as string | undefined;

            // Fetch from primary source
            let providerChapters: ChapterEntity[] = [];
            if (manga["source"] && remoteId) {
                providerChapters = await this.getChaptersFromProvider(manga["source"].toLowerCase(), remoteId, latestChapterNumber);
            }

            // If primary source found nothing and MU seriesId available, try MU as fallback
            if (providerChapters.length === 0 && muSeriesId && manga["source"] !== 'mangaupdates') {
                const muChapters = await this.getChaptersFromProvider('mangaupdates', muSeriesId, latestChapterNumber);
                if (muChapters.length > 0) {
                    logger.info(`[CalendarSync] MU fallback found ${muChapters.length} chapters for "${manga.title}"`);
                    providerChapters = muChapters;
                }
            }

            if (manga["source"] && (remoteId ?? muSeriesId)) {
                // Collect chapters to create (batch processing)
                const chaptersToCreate: Array<{
                    mangaId: number;
                    index: number;
                    title: string;
                    releaseDate: Date;
                    fileName: string;
                    size: number;
                    updatedAt: Date;
                }> = [];

                // Process new chapters
                for (const chapter of providerChapters) {
                    // Check if chapter number is greater than latest
                    if (this.isChapterNewer(chapter.index ? chapter.index.toString() : '0', latestChapterNumber)) {
                        const releaseDateStr = chapter.releaseDate;
                        const releaseDate = typeof releaseDateStr === 'string' ? new Date(releaseDateStr) : releaseDateStr instanceof Date ? releaseDateStr : new Date();
                        newReleases.push({
                            chapterNumber: chapter.index ? chapter.index.toString() : '0',
                            releaseDate: releaseDate
                        });

                        chaptersToCreate.push({
                            mangaId: numericMangaId,
                            index: chapter.index,
                            title: chapter.title,
                            releaseDate: releaseDate,
                            fileName: `chapter-${chapter.index}`,
                            size: 0,
                            updatedAt: new Date()
                        });
                    }
                }

                // Batch create chapters
                if (chaptersToCreate.length > 0) {
                    await prisma.chapter.createMany({
                        data: chaptersToCreate,
                        skipDuplicates: true // Skip duplicate key errors gracefully
                    }).catch(error => {
                        logger.error(`[CalendarSync] Error creating chapters:`, error);
                    });
                }
            }
            // Create CalendarEvent records for detected releases
            if (newReleases.length > 0) {
                await prisma.calendarEvent.createMany({
                    data: newReleases.map(r => ({
                        mangaId: numericMangaId,
                        eventType: 'CHAPTER_RELEASE' as const,
                        scheduledDate: r.releaseDate,
                        actualDate: r.releaseDate,
                        status: 'RELEASED' as const,
                        title: `${manga.title} Ch. ${r.chapterNumber}`,
                        source: 'mangaupdates',
                        confidence: 0.9,
                    })),
                    skipDuplicates: true,
                }).catch(err => {
                    logger.error('[CalendarSync] Error creating calendar events:', err);
                });
            }

            // Log detected releases
            for (const release of newReleases) {
                logReleaseDetected(manga["title"], release.chapterNumber, release.releaseDate);
            }
            return newReleases;
        }
        catch (error: unknown) {
  logger.error(`[CalendarSync] Error checking releases for manga ${mangaId}:`, error);
            return [];
        }
    }
    /**
     * Get chapters from a specific provider
     */
    private async getChaptersFromProvider(source: string, remoteId: string, afterChapter: string): Promise<ChapterEntity[]> {
        try {
            const sourceLower = source.toLowerCase();
            // Check if provider is enabled
            if (!(await isProviderEnabled(sourceLower))) {
                logger.info(`[CalendarSync] Provider not enabled: ${source}`);
                return [];
            }
            // Check rate limits
            const canProceed = await checkRateLimit(sourceLower);
            if (!canProceed) {
                logger.info(`[CalendarSync] Rate limited for ${source}, waiting...`);
                await waitForRateLimit(sourceLower);
                // Check again after waiting
                const canProceedAfterWait = await checkRateLimit(sourceLower);
                if (!canProceedAfterWait) {
                    logger.info(`[CalendarSync] Still rate limited for ${source}, skipping`);
                    return [];
                }
            }
            // Get provider configuration (MU uses per-manga seriesId, skip global config)
            const config = sourceLower === 'mangaupdates'
                ? { enabled: true, config: {} }
                : await getProviderConfig(sourceLower);
            if (!config) {
                logger.info(`[CalendarSync] No configuration found for provider: ${source}`);
                return [];
            }
            let adapter: { isEnabled(): boolean; getLatestChapters(id: string, after?: string): Promise<ChapterEntity[]>; dispose(): void } | null = null;
            switch (sourceLower) {
                case 'anilist':
                    adapter = new CalendarAniListAdapter(config.config as Record<string, unknown>);
                    break;
                case 'mangaupdates':
                    adapter = createMangaUpdatesCalendarProvider({ enabled: true, seriesId: parseInt(remoteId, 10) });
                    break;
                default:
                    logger.info(`[CalendarSync] Unsupported source: ${source}`);
                    return [];
            }
            if (!adapter.isEnabled()) {
                return [];
            }
            try {
                // Increment rate limit counters
                incrementRateLimit(sourceLower);
                // Get latest chapters from provider
                const chapters = await adapter.getLatestChapters(remoteId, afterChapter);
                logger.info(`[CalendarSync] Found ${chapters.length} new chapters from ${source}`);
                // Dispose of adapter resources
                adapter.dispose();
                return chapters;
            }
            catch (error: unknown) {
  logger.error(`[CalendarSync] Error fetching chapters from ${source}:`, error);
                adapter.dispose();
                return [];
            }
            finally {
                // Always decrement active requests
                decrementActiveRequests(sourceLower);
            }
        }
        catch (error: unknown) {const errorMessage = error instanceof Error ? error.message : String(error);
logger.error(`[CalendarSync] Error in getChaptersFromProvider:`, errorMessage);
            return [];
        }
    }
    /**
     * Check if a chapter number is newer than another
     */
    private isChapterNewer(chapterNumber: string, latestChapter: string): boolean {
        try {
            // Extract numeric portion from chapter strings (e.g., "Chapter 10" -> "10")
            const extractNumber = (str: string): number => {
                const match = str.match(/(\d+\.?\d*)/);
                return match?.[1] ? parseFloat(match[1]) : NaN;
            };

            const current = extractNumber(chapterNumber);
            const latest = extractNumber(latestChapter);

            if (isNaN(current) || isNaN(latest)) {
                // Fallback to string comparison
                return chapterNumber > latestChapter;
            }
            return current > latest;
        }
        catch {
            return chapterNumber > latestChapter;
        }
    }
    /**
     * Reconcile calendar events with actual releases
     */
    private async runReconciliation(): Promise<void> {
        logger.info('[CalendarSync] Starting event reconciliation');
        try {
            const result = await this.eventService.reconcileEvents();
            if (isSuccess(result)) {
                logger.info(`[CalendarSync] Reconciliation complete:`, result.data);
            }
            else if (isError(result)) {
                logger.error('[CalendarSync] Reconciliation failed:', result.error);
            }
        }
        catch (error: unknown) {const errorMessage = error instanceof Error ? error.message : String(error);
logger.error('[CalendarSync] Fatal errorMessage during reconciliation:', errorMessage);
        }
    }
    /**
     * Clean up old calendar events
     */
    private async runCleanup(): Promise<void> {
        logger.info('[CalendarSync] Starting cleanup');
        try {
            const result = await this.eventService.cleanupOldEvents(this.RETENTION_DAYS);
            if (isSuccess(result)) {
                logger.info(`[CalendarSync] Cleanup complete: ${result.data} events removed`);
            }
            else if (isError(result)) {
                logger.error('[CalendarSync] Cleanup failed:', result.error);
            }
        }
        catch (error: unknown) {const errorMessage = error instanceof Error ? error.message : String(error);
logger.error('[CalendarSync] Fatal errorMessage during cleanup:', errorMessage);
        }
    }
    /**
     * Get all monitored manga.
     *
     * Monitored = ongoing status (RELEASING, ONGOING, HIATUS, NOT_YET_RELEASED).
     * Completed, cancelled, and unknown-status manga are not monitored.
     * This replaces the old monitoringConfig JSON approach with a
     * status-based rule: if a manga is actively publishing, track it.
     */
    private async getMonitoredManga(): Promise<Array<{
        id: ID;
        title: string;
    }>> {
        try {
            const ACTIVE_STATUSES: MangaPublicationStatus[] = ['ONGOING', 'HIATUS', 'NOT_YET_RELEASED', 'NOT_YET_PUBLISHED', 'UPCOMING'];

            const manga = await prisma.manga.findMany({
                where: {
                    Chapter: { some: {} },
                    Metadata: { status: { in: ACTIVE_STATUSES } },
                },
                select: { id: true, title: true },
                take: 100,
            });

            logger.info(`[CalendarSync] Found ${manga.length} ongoing manga for monitoring`);
            return manga.map(m => ({ id: m['id'], title: m.title }));
        }
        catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            logger.error('[CalendarSync] Error getting monitored manga:', errorMessage);
            return [];
        }
    }
}
// Export singleton instance
export const calendarSyncScheduler = new CalendarSyncScheduler();
