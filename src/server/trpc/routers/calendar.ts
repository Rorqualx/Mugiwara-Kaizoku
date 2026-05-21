/**
 * Calendar Router
 *
 * tRPC router for manga release calendar management.
 * Provides endpoints for release schedules, calendar events, and pattern detection.
 *
 * @module server/trpc/routers/calendar
 */
import { CalendarEventType, EventStatus, MangaPublicationStatus } from '@prisma/client';
import { z } from 'zod';

import { prisma } from '@/server/db';
import { calendarSyncScheduler } from '@/server/queue/calendar/CalendarSyncScheduler';
import { CalendarEventService } from '@/server/services/calendar/CalendarEventService';
import { ReleaseScheduleService } from '@/server/services/calendar/ReleaseScheduleService';
import { realtimeEmitter } from '@/server/services/realtime/RealtimeEventEmitter';
import type { CalendarFilters } from '@/types/search.types';
import { ReleaseType } from '@/types/search.types';
import {
  isSuccess,
  isError
} from '@/utils/async-result'
import { ValidationError } from '@/utils/errors';


import { protectedProcedure } from '../procedures';
import { router, } from '../trpc';

import { exportCalendarData } from './calendar/export-handler';
// Input schemas following project conventions
const getEventsSchema = z.object({
    start: z.date(),
    end: z.date(),
    filters: z.object({
        mangaIds: z.array(z.number()).optional(),
        eventTypes: z.array(z.enum([
            CalendarEventType.CHAPTER_RELEASE,
            CalendarEventType.VOLUME_RELEASE,
            CalendarEventType.HIATUS_START,
            CalendarEventType.HIATUS_END,
            CalendarEventType.SPECIAL_RELEASE,
            CalendarEventType.ANNOUNCEMENT
        ] as const)).optional(),
        status: z.array(z.enum([
            EventStatus.SCHEDULED,
            EventStatus.RELEASED,
            EventStatus.DELAYED,
            EventStatus.CANCELLED,
            EventStatus.CONFIRMED
        ] as const)).optional(),
        minConfidence: z.number().min(0).max(1).optional(),
        limit: z.number().min(1).max(500).default(100).optional(),
        offset: z.number().min(0).default(0).optional()
    }).optional()
});
const updateScheduleSchema = z.object({
    mangaId: z.number(),
    schedule: z.object({
        releaseType: z.enum([
            ReleaseType.WEEKLY,
            ReleaseType.BIWEEKLY,
            ReleaseType.MONTHLY,
            ReleaseType.IRREGULAR,
            ReleaseType.REGULAR
        ] as const).optional(),
        dayOfWeek: z.number().min(0).max(6).optional(),
        dayOfMonth: z.number().min(1).max(31).optional(),
        releaseTime: z.string().optional(),
        timezone: z.string().optional(),
        confidence: z.number().min(0).max(1).optional(),
        isConfirmed: z.boolean().optional(),
        source: z.string().optional()
    })
});
const createEventSchema = z.object({
    mangaId: z.number(),
    chapterId: z.number().optional(),
    eventType: z.enum([
        CalendarEventType.CHAPTER_RELEASE,
        CalendarEventType.VOLUME_RELEASE,
        CalendarEventType.HIATUS_START,
        CalendarEventType.HIATUS_END,
        CalendarEventType.SPECIAL_RELEASE,
        CalendarEventType.ANNOUNCEMENT
    ] as const),
    scheduledDate: z.date(),
    actualDate: z.date().optional(),
    status: z.enum([
        EventStatus.SCHEDULED,
        EventStatus.RELEASED,
        EventStatus.DELAYED,
        EventStatus.CANCELLED,
        EventStatus.CONFIRMED
    ] as const).default(EventStatus.SCHEDULED),
    confidence: z.number().min(0).max(1).default(1),
    title: z.string(),
    description: z.string().optional(),
    color: z.string().optional(),
    source: z.string().optional(),
    metadata: z.record(z.unknown()).optional()
});
/**
 * Router for calendar management
 */
const ACTIVE_STATUSES: MangaPublicationStatus[] = ['ONGOING', 'HIATUS', 'NOT_YET_RELEASED', 'NOT_YET_PUBLISHED', 'UPCOMING'];

const monitoredMangaSelect = {
    id: true, title: true, publicationStatus: true,
    Metadata: { select: { cover: true, coverLarge: true, status: true } },
    ReleaseSchedule: { select: { releaseType: true, dayOfWeek: true, confidence: true } },
    _count: { select: { Chapter: true, CalendarEvent: true } },
} as const;

interface MonitoredMangaRow {
    id: number; title: string; publicationStatus: string;
    Metadata: { cover: string; coverLarge: string | null; status: string } | null;
    ReleaseSchedule: Array<{ releaseType: string; dayOfWeek: number | null; confidence: number | null }>;
    _count: { Chapter: number; CalendarEvent: number };
}

async function getMonitoredMangaForCalendar(): Promise<Array<{
    id: number; title: string; cover: string; status: string;
    schedule: { releaseType: string; dayOfWeek: number | null; confidence: number | null } | null;
    chapterCount: number; eventCount: number;
}>> {
    const manga = await prisma.manga.findMany({
        where: { Chapter: { some: {} }, Metadata: { status: { in: ACTIVE_STATUSES } } },
        select: monitoredMangaSelect,
        orderBy: { title: 'asc' },
        take: 50,
    }) as unknown as MonitoredMangaRow[];

    return manga.map(m => ({
        id: m.id, title: m.title,
        cover: m.Metadata?.coverLarge ?? m.Metadata?.cover ?? '/cover-not-found.jpg',
        status: m.Metadata?.status ?? m.publicationStatus,
        schedule: m.ReleaseSchedule[0] ?? null,
        chapterCount: m._count.Chapter,
        eventCount: m._count.CalendarEvent,
    }));
}

export const calendarRouter = router({
    /**
     * Get calendar events for date range
     */
    getEvents: protectedProcedure
        .input(getEventsSchema)
        .query(async ({ input }) => {
        const service = new CalendarEventService();
        const result = await service.getEventsForDateRange(input.start, input.end, input.filters as CalendarFilters | undefined);
        if (isError(result)) {
            throw result.error;
        }
        if (isSuccess(result)) {
            return result.data;
        }
        throw new ValidationError('Unknown state in getEvents');
    }),
    /**
     * Get release schedule for specific manga
     */
    getSchedule: protectedProcedure
        .input(z.object({ mangaId: z.number() }))
        .query(async ({ input }) => {
        const service = new ReleaseScheduleService();
        const result = await service.getSchedule(input.mangaId);
        if (isError(result)) {
            throw result.error;
        }
        if (isSuccess(result)) {
            return result.data;
        }
        throw new ValidationError('Unknown state in getSchedule');
    }),
    /**
     * Update or create release schedule
     */
    updateSchedule: protectedProcedure
        .input(updateScheduleSchema)
        .mutation(async ({ input }) => {
        const service = new ReleaseScheduleService();
        const scheduleData = {
            ...(input.schedule.releaseType !== undefined ? { releaseType: input.schedule.releaseType } : {}),
            ...(input.schedule.dayOfWeek !== undefined ? { dayOfWeek: input.schedule.dayOfWeek } : {}),
            ...(input.schedule.dayOfMonth !== undefined ? { dayOfMonth: input.schedule.dayOfMonth } : {}),
            ...(input.schedule.releaseTime !== undefined ? { releaseTime: input.schedule.releaseTime } : {}),
            ...(input.schedule.timezone !== undefined ? { timezone: input.schedule.timezone } : {}),
            ...(input.schedule.confidence !== undefined ? { confidence: input.schedule.confidence } : {}),
            ...(input.schedule.isConfirmed !== undefined ? { isConfirmed: input.schedule.isConfirmed } : {}),
            ...(input.schedule.source !== undefined ? { source: input.schedule.source } : {})
        };
        const result = await service.updateSchedule(input.mangaId, scheduleData);
        if (isError(result)) {
            throw result.error;
        }
        if (isSuccess(result)) {
            // Emit WebSocket event for real-time sync
            void realtimeEmitter.emitSystemEvent({
                eventType: 'calendar:schedule:updated',
                source: 'calendar-router',
                message: `Release schedule updated for manga ${input.mangaId}`,
                data: { mangaId: input.mangaId, schedule: result.data }
            });
            return result.data;
        }
        throw new ValidationError('Unknown state in updateSchedule');
    }),
    /**
     * Get upcoming releases for manga
     */
    getUpcomingReleases: protectedProcedure
        .input(z.object({
        mangaId: z.number().optional(),
        days: z.number().min(1).max(90).default(30)
    }))
        .query(async ({ input }) => {
        const service = new CalendarEventService();
        const endDate = new Date();
        endDate.setDate(endDate.getDate() + input.days);
        const result = await service.getEventsForDateRange(new Date(), endDate, input.mangaId ? { mangaIds: [input.mangaId] } : undefined);
        if (isError(result)) {
            throw result.error;
        }
        if (isSuccess(result)) {
            return result.data;
        }
        throw new ValidationError('Unknown state in getUpcomingReleases');
    }),
    /**
     * Mark release as confirmed
     */
    confirmRelease: protectedProcedure
        .input(z.object({
        eventId: z.number()
    }))
        .mutation(async ({ input }) => {
        const service = new CalendarEventService();
        const result = await service.updateEvent(input.eventId, {
            status: EventStatus.CONFIRMED,
            confidence: 1
        });
        if (isError(result)) {
            throw result.error;
        }
        if (isSuccess(result)) {
            // Emit WebSocket event for real-time sync
            void realtimeEmitter.emitSystemEvent({
                eventType: 'calendar:release:confirmed',
                source: 'calendar-router',
                message: `Release confirmed for event ${input.eventId}`,
                data: { eventId: input.eventId, event: result.data }
            });
            return result.data;
        }
        throw new ValidationError('Unknown state in confirmRelease');
    }),
    /**
     * Create manual calendar event
     */
    createEvent: protectedProcedure
        .input(createEventSchema)
        .mutation(async ({ input }) => {
        const service = new CalendarEventService();
        const eventData = {
            mangaId: input.mangaId,
            eventType: input.eventType as CalendarEventType,
            scheduledDate: input.scheduledDate,
            status: input.status as EventStatus,
            confidence: input.confidence,
            title: input.title,
            ...(input.chapterId !== undefined ? { chapterId: input.chapterId } : {}),
            ...(input.actualDate !== undefined ? { actualDate: input.actualDate } : {}),
            ...(input.description !== undefined ? { description: input.description } : {}),
            ...(input.color !== undefined ? { color: input.color } : {}),
            ...(input.source !== undefined ? { source: input.source } : {}),
            ...(input.metadata !== undefined ? { metadata: input.metadata } : {})
        };
        const result = await service.createEvent(eventData);
        if (isError(result)) {
            throw result.error;
        }
        if (isSuccess(result)) {
            // Emit WebSocket event for real-time sync
            void realtimeEmitter.emitSystemEvent({
                eventType: 'calendar:event:created',
                source: 'calendar-router',
                message: `Calendar event created: ${input.title}`,
                data: { mangaId: input.mangaId, event: result.data }
            });
            return result.data;
        }
        throw new ValidationError('Unknown state in createEvent');
    }),
    /**
     * Update calendar event
     */
    updateEvent: protectedProcedure
        .input(z.object({
        eventId: z.number(),
        updates: z.object({
            scheduledDate: z.date().optional(),
            actualDate: z.date().optional(),
            status: z.enum([
                EventStatus.SCHEDULED,
                EventStatus.RELEASED,
                EventStatus.DELAYED,
                EventStatus.CANCELLED,
                EventStatus.CONFIRMED
            ] as const).optional(),
            confidence: z.number().min(0).max(1).optional(),
            title: z.string().optional(),
            description: z.string().optional(),
            color: z.string().optional(),
            metadata: z.record(z.unknown()).optional()
        })
    }))
        .mutation(async ({ input }) => {
        const service = new CalendarEventService();
        const updateData = {
            ...(input.updates.scheduledDate !== undefined ? { scheduledDate: input.updates.scheduledDate } : {}),
            ...(input.updates.actualDate !== undefined ? { actualDate: input.updates.actualDate } : {}),
            ...(input.updates.status !== undefined ? { status: input.updates.status } : {}),
            ...(input.updates.confidence !== undefined ? { confidence: input.updates.confidence } : {}),
            ...(input.updates.title !== undefined ? { title: input.updates.title } : {}),
            ...(input.updates.description !== undefined ? { description: input.updates.description } : {}),
            ...(input.updates.color !== undefined ? { color: input.updates.color } : {}),
            ...(input.updates.metadata !== undefined ? { metadata: input.updates.metadata } : {})
        };
        const result = await service.updateEvent(input.eventId, updateData);
        if (isError(result)) {
            throw result.error;
        }
        if (isSuccess(result)) {
            // Emit WebSocket event for real-time sync
            void realtimeEmitter.emitSystemEvent({
                eventType: 'calendar:event:updated',
                source: 'calendar-router',
                message: `Calendar event updated: ${input.eventId}`,
                data: { eventId: input.eventId, event: result.data }
            });
            return result.data;
        }
        throw new ValidationError('Unknown state in updateEvent');
    }),
    /**
     * Delete calendar event
     */
    deleteEvent: protectedProcedure
        .input(z.object({
        eventId: z.number()
    }))
        .mutation(async ({ input }) => {
        const service = new CalendarEventService();
        const result = await service.deleteEvent(input.eventId);
        if (isError(result)) {
            throw result.error;
        }
        // Emit WebSocket event for real-time sync
        void realtimeEmitter.emitSystemEvent({
            eventType: 'calendar:event:deleted',
            source: 'calendar-router',
            message: `Calendar event deleted: ${input.eventId}`,
            data: { eventId: input.eventId }
        });
        return { success: true };
    }),
    /**
     * Get calendar statistics
     */
    getStatistics: protectedProcedure
        .input(z.object({
        mangaId: z.number().optional(),
        dateRange: z.object({
            start: z.date(),
            end: z.date()
        }).optional()
    }))
        .query(async ({ input }) => {
        const service = new CalendarEventService();
        const startDate = input.dateRange?.start ?? new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
        const endDate = input.dateRange?.end ?? new Date();
        const result = await service.getEventsForDateRange(startDate, endDate, input.mangaId ? { mangaIds: [input.mangaId] } : undefined);
        if (isError(result)) {
            throw result.error;
        }
        if (!isSuccess(result)) {
            throw new ValidationError('Unknown state in getStatistics');
        }
        const events = result.data;
        // Calculate statistics
        const totalEvents = events.length;
        const confirmedEvents = events.filter(e => e["status"] === EventStatus.CONFIRMED).length;
        const delayedEvents = events.filter(e => e["status"] === EventStatus.DELAYED).length;
        const cancelledEvents = events.filter(e => e["status"] === EventStatus.CANCELLED).length;
        // Calculate average confidence
        const avgConfidence = events.length > 0
            ? events.reduce((sum, e) => sum + (e.confidence ?? 0), 0) / events.length
            : 0;
        // Group by event type
        const byType = events.reduce((acc, event) => {
            return {
                ...acc,
                [event.eventType]: (acc[event.eventType] ?? 0) + 1
            };
        }, {} as Record<string, number>);
        return {
            totalEvents,
            confirmedEvents,
            delayedEvents,
            cancelledEvents,
            accuracyRate: confirmedEvents / Math.max(totalEvents, 1),
            delayRate: delayedEvents / Math.max(totalEvents, 1),
            cancellationRate: cancelledEvents / Math.max(totalEvents, 1),
            averageConfidence: avgConfidence,
            eventsByType: byType
        };
    }),
    /**
     * Export calendar data
     */
    exportCalendar: protectedProcedure
        .input(z.object({
        format: z.enum(['ics', 'json', 'rss']).default('ics'),
        mangaIds: z.array(z.number()).optional(),
        dateRange: z.object({
            start: z.date().optional(),
            end: z.date().optional()
        }).optional()
    }))
        .query(({ input }) => exportCalendarData(input)),

    /** Get all monitored manga with covers and schedule info for the calendar page */
    getMonitoredManga: protectedProcedure.query(async () => {
        return getMonitoredMangaForCalendar();
    }),

    /** Trigger a manual calendar sync for all monitored manga */
    triggerSync: protectedProcedure.mutation(() => {
        // Fire-and-forget so the request returns immediately, but the scheduler's
        // own isSyncing guard prevents overlap with the periodic interval.
        void calendarSyncScheduler.runSync().catch((error: unknown) => {
            // runSync logs internally; swallow here so the unhandled rejection
            // doesn't crash the worker thread.
            void error;
        });
        return { triggered: true };
    }),
});
