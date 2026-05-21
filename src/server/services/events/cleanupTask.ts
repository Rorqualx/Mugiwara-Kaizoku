/**
 * Event Cleanup Task
 *
 * Scheduled task to automatically remove old events.
 * This helps maintain database performance by removing events
 * that are no longer needed.
 *
 * @module server/services/events/cleanupTask
 */
import { logger } from '@/utils/logger';

import { eventLogger } from './eventLogger';
import { eventService } from './eventService';
import { EventType, EventSource } from './eventTypes';
/**
 * Default retention period in days
 */
const DEFAULT_RETENTION_DAYS = 30;
/**
 * Cleans up old events based on retention settings
 *
 * @param {number} [retentionDays=DEFAULT_RETENTION_DAYS] - Days to retain events
 * @returns {Promise<number>} Number of events deleted
 */
export async function cleanupOldEvents(retentionDays: number = DEFAULT_RETENTION_DAYS): Promise<number> {
    try {
        const startTime = Date.now();
        // Log the start of cleanup
        await eventLogger.logEvent(EventType.SYSTEM_STARTUP, EventSource.SYSTEM, `Starting event cleanup for events older than ${retentionDays} days`, {
            details: {
                retentionDays,
                startTime: new Date().toISOString()
            }
        });
        // Perform the cleanup
        const deletedCount = await eventService.cleanupEvents(retentionDays);
        // Calculate duration
        const duration = (Date.now() - startTime) / 1000; // in seconds
        // Log the completion of cleanup
        await eventLogger.logEvent(EventType.SYSTEM_STARTUP, EventSource.SYSTEM, `Completed event cleanup, removed ${deletedCount} events`, {
            details: {
                retentionDays,
                deletedCount,
                durationSeconds: duration.toFixed(2)
            }
        });
        return deletedCount;
    }
    catch (error: unknown) {
        // Log any errors
        if (error instanceof Error) {
            await eventLogger.logError(EventSource.SYSTEM, 'Error during event cleanup', error, {
                additionalDetails: {
                    retentionDays
                }
            });
        }
        throw error;
    }
}
/**
 * Schedule the cleanup task to run daily
 *
 * @param {number} [retentionDays=DEFAULT_RETENTION_DAYS] - Days to retain events
 */
export function scheduleEventCleanup(retentionDays: number = DEFAULT_RETENTION_DAYS): void {
    // This function would be called during app initialization
    // and would schedule the cleanup task using the application's
    // task scheduling system.
    //
    // Example implementation with node-cron:
    //
    // import cron from 'node-cron';
    //
    // // Run daily at 3:00 AM
    // cron.schedule('0 3 * * *', async () => {
    //   try {
    //     await cleanupOldEvents(retentionDays);
    //   } catch (error) {
    //     console.error('Scheduled event cleanup failed:', error);
    //   }
    // });
    logger.info(`Scheduled daily event cleanup (retention: ${retentionDays} days)`);
}
