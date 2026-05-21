/**
 * Calendar Maintenance Worker
 *
 * Performs maintenance tasks for the calendar system including
 * cleanup, optimization, and data integrity checks.
 *
 * Following project conventions:
 * - AsyncResult pattern
 * - Proper error handling
 * - Type-safe implementations
 */

import { EventStatus, CalendarEventType } from '@prisma/client';

import { prisma } from '@/server/db';
import { realtimeEmitter } from '@/server/services/realtime/RealtimeEventEmitter';
import { createSuccessResult, createErrorResult, isSuccess } from '@/utils/async-result';
import type { AsyncResult } from '@/utils/async-result';
import { createLogger } from '@/utils/logger';

import { optimizeDatabase, performIntegrityChecks } from './calendar-maintenance/db-tasks';


const logger = createLogger('CalendarMaintenanceWorker');
/**
 * Maintenance configuration
 */
export interface MaintenanceConfig {
    /**
     * Days to keep old events
     */
    daysToKeep: number;
    /**
     * Days to keep release history
     */
    historyDaysToKeep?: number;
    /**
     * Enable database optimization
     */
    enableOptimization?: boolean;
    /**
     * Enable integrity checks
     */
    enableIntegrityChecks?: boolean;
    /**
     * Batch size for operations
     */
    batchSize?: number;
}
/**
 * Maintenance statistics
 */
export interface MaintenanceStats {
    eventsDeleted: number;
    historyDeleted: number;
    duplicatesRemoved: number;
    orphansRemoved: number;
    patternsUpdated: number;
    duration: number;
}
/**
 * Worker for calendar maintenance tasks
 */
export class CalendarMaintenanceWorker {
    /**
     * Perform maintenance tasks
     */
    async performMaintenance(config: MaintenanceConfig): Promise<AsyncResult<MaintenanceStats, Error>> {
        const startTime = Date.now();
        const stats: MaintenanceStats = {
            eventsDeleted: 0,
            historyDeleted: 0,
            duplicatesRemoved: 0,
            orphansRemoved: 0,
            patternsUpdated: 0,
            duration: 0
        };
        logger.info('[CalendarMaintenance] Starting maintenance tasks');

        // Emit WebSocket event for maintenance started
        void realtimeEmitter.emitSystemEvent({
            eventType: 'calendar:maintenance:started',
            source: 'CalendarMaintenanceWorker',
            message: 'Calendar maintenance tasks started',
            data: { config }
        });

        try {
            // 1. Clean up old events
            const cleanupResult = await this.cleanupOldEvents(config.daysToKeep);
            if (isSuccess(cleanupResult)) {
                stats.eventsDeleted = cleanupResult.data.deleted;
            }
            // 2. Clean up old history
            if (config.historyDaysToKeep) {
                const historyResult = await this.cleanupOldHistory(config.historyDaysToKeep);
                if (isSuccess(historyResult)) {
                    stats.historyDeleted = historyResult.data.deleted;
                }
            }
            // 3. Remove duplicates
            const duplicatesResult = await this.removeDuplicateEvents();
            if (isSuccess(duplicatesResult)) {
                stats.duplicatesRemoved = duplicatesResult.data.removed;
            }
            // 4. Clean up orphaned records
            const orphansResult = await this.cleanupOrphans();
            if (isSuccess(orphansResult)) {
                stats.orphansRemoved = orphansResult.data.removed;
            }
            // 5. Update pattern accuracy
            const patternsResult = await this.updatePatternAccuracy();
            if (isSuccess(patternsResult)) {
                stats.patternsUpdated = patternsResult.data.updated;
            }
            // 6. Integrity checks
            if (config.enableIntegrityChecks) {
                await performIntegrityChecks();
            }
            // 7. Database optimization
            if (config.enableOptimization) {
                await optimizeDatabase();
            }
            stats.duration = Date.now() - startTime;
            logger.info('[CalendarMaintenance] Maintenance complete', { stats });

            // Emit WebSocket event for maintenance completed
            void realtimeEmitter.emitSystemEvent({
                eventType: 'calendar:maintenance:completed',
                source: 'CalendarMaintenanceWorker',
                message: 'Calendar maintenance tasks completed',
                data: { stats }
            });

            return createSuccessResult(stats);
        }
        catch (error: unknown) {
            logger.error('[CalendarMaintenance] Error during maintenance', error instanceof Error ? error.message : String(error));

            // Emit WebSocket event for maintenance error
            void realtimeEmitter.emitSystemEvent({
                eventType: 'calendar:maintenance:error',
                source: 'CalendarMaintenanceWorker',
                message: `Calendar maintenance failed: ${error instanceof Error ? error.message : String(error)}`,
                data: { error: error instanceof Error ? error.message : String(error) }
            });

            return createErrorResult(error instanceof Error ? error : new Error(String(error)));
        }
    }
    /**
     * Clean up old calendar events
     */
    private async cleanupOldEvents(daysToKeep: number): Promise<AsyncResult<{ deleted: number }, Error>> {
        try {
            const cutoffDate = new Date(Date.now() - daysToKeep * 24 * 60 * 60 * 1000);
            // Delete old released/cancelled events
            const result = await prisma.calendarEvent.deleteMany({
                where: {
                    AND: [
                        {
                            OR: [
                                { status: EventStatus.RELEASED },
                                { status: EventStatus.CANCELLED }
                            ]
                        },
                        {
                            scheduledDate: { lt: cutoffDate }
                        }
                    ]
                }
            });
            logger.info(`[CalendarMaintenance] Deleted ${result.count} old events`);
            return createSuccessResult({ deleted: result.count });
        }
        catch (error: unknown) {
            logger.error('[CalendarMaintenance] Error cleaning up old events', error instanceof Error ? error.message : String(error));
            return createErrorResult(new Error(error instanceof Error ? error.message : String(error)));
        }
    }
    /**
     * Clean up old release history
     */
    private async cleanupOldHistory(daysToKeep: number): Promise<AsyncResult<{ deleted: number }, Error>> {
        try {
            const cutoffDate = new Date(Date.now() - daysToKeep * 24 * 60 * 60 * 1000);
            const result = await prisma.releaseHistory.deleteMany({
                where: {
                    releaseDate: { lt: cutoffDate }
                }
            });
            logger.info(`[CalendarMaintenance] Deleted ${result.count} old history records`);
            return createSuccessResult({ deleted: result.count });
        }
        catch (error: unknown) {
            logger.error('[CalendarMaintenance] Error cleaning up history', error instanceof Error ? error.message : String(error));
            return createErrorResult(new Error(error instanceof Error ? error.message : String(error)));
        }
    }
    /**
     * Remove duplicate calendar events
     */
    private async removeDuplicateEvents(): Promise<AsyncResult<{ removed: number }, Error>> {
        try {
            // Find duplicates (same manga, date, type, and status)
            const duplicates = await prisma.$queryRaw<Array<{
                mangaId: number;
                scheduledDate: Date;
                eventType: string;
                duplicate_count: bigint;
            }>> `
        SELECT
          "mangaId",
          "scheduledDate",
          "eventType",
          COUNT(*) as duplicate_count
        FROM "CalendarEvent"
        WHERE status = 'SCHEDULED'
        GROUP BY "mangaId", "scheduledDate", "eventType"
        HAVING COUNT(*) > 1
      `;

            // Process all duplicates in parallel and collect IDs to delete
            const deleteIdArrays = await Promise.all(
                duplicates.map(async (dup) => {
                    const events = await prisma.calendarEvent.findMany({
                        where: {
                            mangaId: dup.mangaId,
                            scheduledDate: dup.scheduledDate,
                            eventType: dup.eventType as CalendarEventType,
                            status: EventStatus.SCHEDULED
                        },
                        orderBy: { createdAt: 'desc' },
                        select: { id: true }
                    });
                    // Return all but the first (most recent) for deletion
                    return events.slice(1).map(e => e.id);
                })
            );

            // Flatten all IDs to delete
            const idsToDelete = deleteIdArrays.flat();

            // Batch delete all duplicates in a single operation
            let removed = 0;
            if (idsToDelete.length > 0) {
                const result = await prisma.calendarEvent.deleteMany({
                    where: { id: { in: idsToDelete } }
                });
                removed = result.count;
            }

            if (removed > 0) {
                logger.info(`[CalendarMaintenance] Removed ${removed} duplicate events`);
            }
            return createSuccessResult({ removed });
        }
        catch (error: unknown) {
            logger.error('[CalendarMaintenance] Error removing duplicates', error instanceof Error ? error.message : String(error));
            return createErrorResult(new Error(error instanceof Error ? error.message : String(error)));
        }
    }
    /**
     * Clean up orphaned records
     */
    private async cleanupOrphans(): Promise<AsyncResult<{ removed: number }, Error>> {
        try {
            let removed = 0;
            // Remove events for deleted manga
            const orphanedEvents = await prisma.$queryRaw<Array<{
                id: number;
            }>> `
        SELECT id FROM "CalendarEvent" WHERE "mangaId" IS NULL
      `;
            if (orphanedEvents.length > 0) {
                const result = await prisma.calendarEvent.deleteMany({
                    where: {
                        id: { in: orphanedEvents.map(e => e["id"]) }
                    }
                });
                removed += result.count;
            }
            // Remove schedules for deleted manga
            const orphanedSchedules = await prisma.$queryRaw<Array<{
                id: number;
            }>> `
        SELECT id FROM "ReleaseSchedule" WHERE "mangaId" IS NULL
      `;
            if (orphanedSchedules.length > 0) {
                const result = await prisma.releaseSchedule.deleteMany({
                    where: {
                        id: { in: orphanedSchedules.map(s => s["id"]) }
                    }
                });
                removed += result.count;
            }
            // Remove history for deleted manga
            const orphanedHistory = await prisma.$queryRaw<Array<{
                id: number;
            }>> `
        SELECT id FROM "ReleaseHistory" WHERE "mangaId" IS NULL
      `;
            if (orphanedHistory.length > 0) {
                const result = await prisma.releaseHistory.deleteMany({
                    where: {
                        id: { in: orphanedHistory.map(h => h["id"]) }
                    }
                });
                removed += result.count;
            }
            if (removed > 0) {
                logger.info(`[CalendarMaintenance] Removed ${removed} orphaned records`);
            }
            return createSuccessResult({ removed });
        }
        catch (error: unknown) {
            logger.error('[CalendarMaintenance] Error cleaning up orphans', error instanceof Error ? error.message : String(error));
            return createErrorResult(new Error(error instanceof Error ? error.message : String(error)));
        }
    }
    /**
     * Calculate accuracy from event predictions
     * Extracted to reduce nesting depth
     */
    private calculatePredictionAccuracy(events: Array<{ scheduledDate: Date; actualDate: Date | null }>): number | null {
        let correctPredictions = 0;
        let totalPredictions = 0;

        for (const event of events) {
            if (!event.actualDate) continue;

            totalPredictions++;
            const diffDays = Math.abs(event.scheduledDate.getTime() - event.actualDate.getTime()) / (1000 * 60 * 60 * 24);
            if (diffDays <= 1) {
                correctPredictions++;
            }
        }

        return totalPredictions > 0 ? correctPredictions / totalPredictions : null;
    }

    /**
     * Process a single schedule for accuracy update
     * Returns the schedule ID if it should be updated, null otherwise
     */
    private async processScheduleAccuracy(schedule: { id: number; mangaId: number; confidence: number }): Promise<{ id: number; newConfidence: number } | null> {
        const recentEvents = await prisma.calendarEvent.findMany({
            where: {
                mangaId: schedule.mangaId,
                eventType: CalendarEventType.CHAPTER_RELEASE,
                status: { in: [EventStatus.RELEASED, EventStatus.DELAYED] },
                scheduledDate: {
                    gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) // Last 90 days
                }
            },
            select: { scheduledDate: true, actualDate: true }
        });

        if (recentEvents.length < 3) return null;

        const newConfidence = this.calculatePredictionAccuracy(recentEvents);
        if (newConfidence === null) return null;

        // Return update info if significantly different
        if (Math.abs(newConfidence - schedule.confidence) > 0.1) {
            return { id: schedule.id, newConfidence };
        }

        return null;
    }

    /**
     * Update pattern accuracy based on recent performance
     */
    private async updatePatternAccuracy(): Promise<AsyncResult<{ updated: number }, Error>> {
        try {
            // Get all active schedules
            const schedules = await prisma.releaseSchedule.findMany({
                where: {
                    isConfirmed: false // Only update non-manual schedules
                },
                select: { id: true, mangaId: true, confidence: true }
            });

            // Process all schedules in parallel to find which need updates
            const updateResults = await Promise.all(
                schedules.map(schedule => this.processScheduleAccuracy(schedule))
            );

            // Filter to only schedules that need updates
            const schedulesToUpdate = updateResults.filter((r): r is { id: number; newConfidence: number } => r !== null);

            // Batch update all schedules that need it
            let updated = 0;
            if (schedulesToUpdate.length > 0) {
                // Use a transaction for batch updates
                await prisma.$transaction(
                    schedulesToUpdate.map(({ id, newConfidence }) =>
                        prisma.releaseSchedule.update({
                            where: { id },
                            data: {
                                confidence: newConfidence,
                                lastUpdated: new Date()
                            }
                        })
                    )
                );
                updated = schedulesToUpdate.length;
            }

            if (updated > 0) {
                logger.info(`[CalendarMaintenance] Updated ${updated} pattern accuracies`);
            }
            return createSuccessResult({ updated });
        }
        catch (error: unknown) {
            logger.error('[CalendarMaintenance] Error updating pattern accuracy', error instanceof Error ? error.message : String(error));
            return createErrorResult(new Error(error instanceof Error ? error.message : String(error)));
        }
    }
    /**
     * Get maintenance status
     */
    async getMaintenanceStatus(): Promise<{
        lastRun?: Date;
        nextScheduledRun?: Date;
        stats: {
            totalEvents: number;
            scheduledEvents: number;
            totalSchedules: number;
            totalHistory: number;
        };
    }> {
        const [totalEvents, scheduledEvents, totalSchedules, totalHistory] = await Promise.all([
            prisma.calendarEvent.count(),
            prisma.calendarEvent.count({ where: { status: EventStatus.SCHEDULED } }),
            prisma.releaseSchedule.count(),
            prisma.releaseHistory.count()
        ]);
        return {
            stats: {
                totalEvents,
                scheduledEvents,
                totalSchedules,
                totalHistory
            }
        };
    }
}
// Export singleton instance
export const calendarMaintenanceWorker = new CalendarMaintenanceWorker();
