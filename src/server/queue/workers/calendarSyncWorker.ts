import { z } from 'zod';

import { prisma } from '@/server/db';
import { CalendarEventService } from '@/server/services/calendar/CalendarEventService';
import { realtimeEmitter } from '@/server/services/realtime/RealtimeEventEmitter';
import { isError } from '@/utils/async-result';
import { ValidationError } from '@/utils/errors';
import { createLogger } from '@/utils/logger';
import { logCalendarSyncComplete } from '@/utils/system-events';

const workerLogger = createLogger('CalendarSyncWorker');

// Zod schema for validating monitoring config
const MonitoringConfigSchema = z.object({
  isMonitored: z.boolean().optional(),
  enabled: z.boolean().optional()
}).passthrough();
/**
 * Worker for synchronizing calendar data - reconciliation and cleanup only
 * Pattern detection has been removed; use manual schedule override instead
 */
export class CalendarSyncWorker {
    private eventService = new CalendarEventService();
    /**
     * Initialize the worker
     */
    initialize(): void {
        workerLogger.info('[CalendarSync] Worker initialized');
    }
    /**
     * Process calendar synchronization for all monitored manga
     * Now only handles reconciliation and cleanup
     */
    async processCalendarSync(): Promise<void> {
        workerLogger.info('[CalendarSync] Starting calendar sync');

        // Emit sync started event
        void realtimeEmitter.emitCalendarSync({
            operation: 'started',
        });

        try {
            // Get all monitored manga
            const allManga = await prisma.manga.findMany({
                select: {
                    id: true,
                    title: true,
                    mangaTitle: true,
                    monitoringConfig: true,
                    source: true
                }
            });
            // Filter for monitored manga
            const monitoredManga = allManga.filter(manga => {
                // Check if monitoring is enabled in the config
                if (manga.monitoringConfig && typeof manga.monitoringConfig === 'object') {
                    const result = MonitoringConfigSchema.safeParse(manga.monitoringConfig);
                    if (result.success) {
                        const config = result.data;
                        return config.isMonitored === true || config.enabled === true;
                    }
                }
                return false;
            });
            workerLogger.info(`[CalendarSync] Found ${monitoredManga.length} monitored manga`);

            // Reconcile existing events with actual releases
            workerLogger.info('[CalendarSync] Reconciling events with actual releases');
            const reconcileResult = await this.eventService.reconcileEvents();
            if (isError(reconcileResult)) {
                workerLogger.warn('[CalendarSync] Failed to reconcile events:', reconcileResult.error);
            }
            // Log completion
            logCalendarSyncComplete(monitoredManga.length, 0);
            workerLogger.info('[CalendarSync] Sync complete');

            // Emit sync completed event
            void realtimeEmitter.emitCalendarSync({
                operation: 'completed',
                mangaCount: monitoredManga.length,
            });
        }
        catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            workerLogger.error('[CalendarSync] Fatal error during sync:', errorMessage);

            // Emit sync failed event
            void realtimeEmitter.emitCalendarSync({
                operation: 'failed',
                error: errorMessage,
            });

            throw new Error(errorMessage);
        }
    }
    /**
     * Process calendar sync for a specific manga
     * Now only handles reconciliation
     */
    async processMangaCalendarSync(mangaId: number): Promise<void> {
        workerLogger.info(`[CalendarSync] Processing calendar sync for manga ${mangaId}`);
        try {
            // Get manga details
            const manga = await prisma.manga.findUnique({
                where: { id: mangaId },
                select: {
                    id: true,
                    title: true,
                    mangaTitle: true,
                    source: true
                }
            });
            if (!manga) {
                throw new ValidationError(`Manga ${mangaId} not found`);
            }
            const mangaTitle = manga.mangaTitle ?? manga["title"];
            workerLogger.info(`[CalendarSync] Processed ${mangaTitle} - use manual schedule override to set release schedule`);
        }
        catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            workerLogger.error(`[CalendarSync] Error processing manga ${mangaId}:`, errorMessage);
            throw error;
        }
    }
    /**
     * Clean up old calendar events
     */
    async cleanupOldEvents(daysToKeep = 90): Promise<void> {
        workerLogger.info(`[CalendarSync] Cleaning up events older than ${daysToKeep} days`);
        try {
            const result = await this.eventService.cleanupOldEvents(daysToKeep);
            if (isError(result)) {
                workerLogger.error('[CalendarSync] Failed to cleanup old events:', result.error);
                throw result.error;
            }
            workerLogger.info('[CalendarSync] Old events cleaned up successfully');

            // Emit cleanup completed event
            void realtimeEmitter.emitCalendarSync({
                operation: 'cleanup',
            });
        }
        catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            workerLogger.error('[CalendarSync] Error cleaning up old events:', errorMessage);
            throw new Error(errorMessage);
        }
    }
}
// Export singleton instance
export const calendarSyncWorker = new CalendarSyncWorker();
