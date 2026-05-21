import { subDays } from 'date-fns';

import { prisma } from '@/server/db';
import { CalendarEventService } from '@/server/services/calendar/CalendarEventService';
import { NotificationService } from '@/server/services/notifications/NotificationService';
import { isSuccess } from '@/utils/async-result';
import { logger } from '@/utils/logger';
import { logMaintenanceComplete } from '@/utils/system-events';

/**
 * Calendar maintenance scheduler - handles cleanup and data integrity
 * Pattern detection/refresh has been removed; use manual schedule override instead
 */
export class CalendarMaintenanceScheduler {
    private maintenanceInterval: NodeJS.Timeout | null = null;
    private isRunning = false;
    private eventService: CalendarEventService;
    private notificationService: NotificationService;
    // Configuration
    private readonly MAINTENANCE_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours
    private readonly EVENT_RETENTION_DAYS = 90;
    private readonly NOTIFICATION_RETENTION_DAYS = 30;
    constructor() {
        this.eventService = new CalendarEventService();
        this.notificationService = new NotificationService();
    }
    /**
     * Start the maintenance scheduler
     */
    async start(): Promise<void> {
        if (this.isRunning) {
            logger.info('[CalendarMaintenance] Scheduler already running');
            return;
        }
        logger.info('[CalendarMaintenance] Starting maintenance scheduler');
        this.isRunning = true;
        // Run initial maintenance
        await this.runMaintenance();
        // Schedule periodic maintenance
        this.maintenanceInterval = setInterval(() => {
            this.runMaintenance().catch(error => {
                logger.error('[CalendarMaintenance] Maintenance error:', error);
            });
        }, this.MAINTENANCE_INTERVAL_MS);
        logger.info('[CalendarMaintenance] Scheduler started successfully');
    }
    /**
     * Stop the maintenance scheduler
     */
    stop(): Promise<void> {
        if (!this.isRunning) {
            return Promise.resolve();
        }
        logger.info('[CalendarMaintenance] Stopping maintenance scheduler');
        this.isRunning = false;
        if (this.maintenanceInterval) {
            clearInterval(this.maintenanceInterval);
            this.maintenanceInterval = null;
        }
        logger.info('[CalendarMaintenance] Scheduler stopped');
        return Promise.resolve();
    }
    /**
     * Run all maintenance tasks
     */
    private async runMaintenance(): Promise<void> {
        logger.info('[CalendarMaintenance] Starting maintenance cycle');
        const startTime = Date.now();
        try {
            const results = {
                eventsDeleted: 0,
                notificationsDeleted: 0,
                orphanedEventsFixed: 0,
                duplicatesRemoved: 0
            };
            // 1. Clean up old calendar events
            const cleanupResult = await this.eventService.cleanupOldEvents(this.EVENT_RETENTION_DAYS);
            if (isSuccess(cleanupResult)) {
                results.eventsDeleted = cleanupResult.data;
                logger.info(`[CalendarMaintenance] Deleted ${results.eventsDeleted} old events`);
            }
            // 2. Clean up old notifications
            results.notificationsDeleted = await this.cleanupOldNotifications();
            logger.info(`[CalendarMaintenance] Deleted ${results.notificationsDeleted} old notifications`);
            // 3. Fix orphaned events (events for deleted manga)
            results.orphanedEventsFixed = await this.fixOrphanedEvents();
            logger.info(`[CalendarMaintenance] Fixed ${results.orphanedEventsFixed} orphaned events`);
            // 4. Remove duplicate events
            results.duplicatesRemoved = await this.removeDuplicateEvents();
            logger.info(`[CalendarMaintenance] Removed ${results.duplicatesRemoved} duplicate events`);
            const duration = Date.now() - startTime;
            logger.info(`[CalendarMaintenance] Maintenance complete in ${duration}ms:`, results);
            // Log to system events
            logMaintenanceComplete('Calendar', {
                eventsDeleted: results.eventsDeleted,
                notificationsDeleted: results.notificationsDeleted,
                orphanedEventsFixed: results.orphanedEventsFixed,
                duplicatesRemoved: results.duplicatesRemoved,
                duration
            });
        }
        catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            logger.error('[CalendarMaintenance] Fatal error during maintenance:', errorMessage);
        }
    }
    /**
     * Clean up old notifications
     */
    private async cleanupOldNotifications(): Promise<number> {
        try {
            const cutoffDate = subDays(new Date(), this.NOTIFICATION_RETENTION_DAYS);
            // Delete read notifications older than retention period
            const result = await prisma.notification.deleteMany({
                where: {
                    read: true,
                    readAt: { lt: cutoffDate }
                }
            });
            // Also delete unread notifications older than 2x retention period
            const unreadCutoff = subDays(new Date(), this.NOTIFICATION_RETENTION_DAYS * 2);
            const unreadResult = await prisma.notification.deleteMany({
                where: {
                    read: false,
                    createdAt: { lt: unreadCutoff }
                }
            });
            return result.count + unreadResult.count;
        }
        catch (error: unknown) {const errorMessage = error instanceof Error ? error.message : String(error);
logger.error('[CalendarMaintenance] Error cleaning notifications:', errorMessage);
            return 0;
        }
    }
    /**
     * Fix orphaned events (events for deleted manga)
     */
    private async fixOrphanedEvents(): Promise<number> {
        try {
            // Find events where manga no longer exists
            // Since manga has onDelete: Cascade, this should rarely happen
            // but we check for data integrity issues
            const allEvents = await prisma.calendarEvent.findMany({
                select: {
                    id: true,
                    mangaId: true
                }
            });
            // Check which events have non-existent manga
            // Sequential processing to avoid overwhelming DB with concurrent queries
            const orphanedEvents = [];
            /* eslint-disable no-await-in-loop -- Intentional sequential DB queries to avoid connection pool exhaustion */
            for (const event of allEvents) {
                const mangaExists = await prisma.manga.findUnique({
                    where: { id: event.mangaId }
                });
                if (!mangaExists) {
                    orphanedEvents.push(event);
                }
            }
            /* eslint-enable no-await-in-loop */
            if (orphanedEvents.length === 0) {
                return 0;
            }
            // Delete orphaned events
            const result = await prisma.calendarEvent.deleteMany({
                where: {
                    id: { in: orphanedEvents.map(e => e["id"]) }
                }
            });
            return result.count;
        }
        catch (error: unknown) {const errorMessage = error instanceof Error ? error.message : String(error);
logger.error('[CalendarMaintenance] Error fixing orphaned events:', errorMessage);
            return 0;
        }
    }
    /**
     * Remove duplicate events
     */
    private async removeDuplicateEvents(): Promise<number> {
        try {
            // Find potential duplicates (same manga, same date, same type)
            const events = await prisma.calendarEvent.findMany({
                orderBy: [
                    { mangaId: 'asc' },
                    { scheduledDate: 'asc' },
                    { eventType: 'asc' },
                    { createdAt: 'asc' } // Keep oldest
                ]
            });
            const duplicatesToDelete: number[] = [];
            let prev: typeof events[0] | null = null;
            for (const event of events) {
                if (prev &&
                    prev.mangaId === event.mangaId &&
                    prev.scheduledDate.getTime() === event.scheduledDate.getTime() &&
                    prev.eventType === event.eventType) {
                    // This is a duplicate, mark for deletion (keep the older one)
                    duplicatesToDelete.push(event["id"]);
                }
                else {
                    prev = event;
                }
            }
            if (duplicatesToDelete.length === 0) {
                return 0;
            }
            // Delete duplicates
            const result = await prisma.calendarEvent.deleteMany({
                where: {
                    id: { in: duplicatesToDelete }
                }
            });
            return result.count;
        }
        catch (error: unknown) {const errorMessage = error instanceof Error ? error.message : String(error);
logger.error('[CalendarMaintenance] Error removing duplicates:', errorMessage);
            return 0;
        }
    }
}
// Export singleton instance
export const calendarMaintenanceScheduler = new CalendarMaintenanceScheduler();
