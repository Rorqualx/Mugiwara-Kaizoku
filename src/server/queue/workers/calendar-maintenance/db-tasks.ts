/**
 * Calendar Maintenance — Database-level Tasks
 *
 * Extracted from CalendarMaintenanceWorker to keep the worker class under the
 * 500-line cap. Both helpers are stateless side-effect functions: integrity
 * checks emit warnings via the logger, and the optimizer issues PostgreSQL
 * ANALYZE/REINDEX statements. Failures are logged but never thrown — these
 * are best-effort maintenance, not part of the main maintenance contract.
 */

import { prisma } from '@/server/db';
import { createLogger } from '@/utils/logger';

const logger = createLogger('CalendarMaintenanceWorker');

/**
 * Scan calendar tables for inconsistencies and emit warnings if any are found.
 * Currently checks: orphaned events (mangaId is NULL), overlapping scheduled
 * events (same manga + type within 24h), and out-of-range confidence values.
 */
export async function performIntegrityChecks(): Promise<void> {
    try {
        logger.info('[CalendarMaintenance] Performing integrity checks');
        const orphanedEventsResult = await prisma.$queryRaw<Array<{
            count: bigint;
        }>> `
        SELECT COUNT(*) as count FROM "CalendarEvent" WHERE "mangaId" IS NULL
      `;
        const orphanedEvents = Number(orphanedEventsResult[0]?.count ?? 0);
        if (orphanedEvents > 0) {
            logger.warn(`[CalendarMaintenance] Found ${orphanedEvents} orphaned events`);
        }
        const overlapping = await prisma.$queryRaw<Array<{
            count: bigint;
        }>> `
        SELECT COUNT(*) as count
        FROM "CalendarEvent" e1
        JOIN "CalendarEvent" e2 ON e1."mangaId" = e2."mangaId"
        WHERE e1["id"] !== e2.id
        AND e1."eventType" = e2."eventType"
        AND e1["status"] = 'SCHEDULED'
        AND e2["status"] = 'SCHEDULED'
        AND ABS(EXTRACT(EPOCH FROM (e1."scheduledDate" - e2."scheduledDate"))) < 86400
      `;
        const overlappingCount = Number(overlapping[0]?.count ?? 0);
        if (overlappingCount > 0) {
            logger.warn(`[CalendarMaintenance] Found ${overlappingCount} overlapping events`);
        }
        const invalidConfidence = await prisma.releaseSchedule.count({
            where: {
                OR: [
                    { confidence: { lt: 0 } },
                    { confidence: { gt: 1 } },
                ],
            },
        });
        if (invalidConfidence > 0) {
            logger.warn(`[CalendarMaintenance] Found ${invalidConfidence} schedules with invalid confidence`);
        }
    }
    catch (error: unknown) {
        logger.error('[CalendarMaintenance] Error performing integrity checks', error instanceof Error ? error.message : String(error));
    }
}

/**
 * Run PostgreSQL `ANALYZE` + `REINDEX CONCURRENTLY` on the calendar tables.
 * Concurrent reindex avoids holding write locks but still loads the planner.
 */
export async function optimizeDatabase(): Promise<void> {
    try {
        logger.info('[CalendarMaintenance] Optimizing database');
        await prisma.$executeRaw `ANALYZE "CalendarEvent"`;
        await prisma.$executeRaw `ANALYZE "ReleaseSchedule"`;
        await prisma.$executeRaw `ANALYZE "ReleaseHistory"`;
        await prisma.$executeRaw `REINDEX TABLE CONCURRENTLY "CalendarEvent"`;
        await prisma.$executeRaw `REINDEX TABLE CONCURRENTLY "ReleaseSchedule"`;
        await prisma.$executeRaw `REINDEX TABLE CONCURRENTLY "ReleaseHistory"`;
        logger.info('[CalendarMaintenance] Database optimization complete');
    }
    catch (error: unknown) {
        logger.error('[CalendarMaintenance] Error optimizing database', error instanceof Error ? error.message : String(error));
    }
}
