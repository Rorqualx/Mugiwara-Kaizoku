import { EventStatus } from '@prisma/client';
import { addDays, startOfDay, endOfDay } from 'date-fns';

import { prisma } from '@/server/db';
import type { ID, CalendarFilters, EventQueryOptions } from '@/types/search.types';
import { createSuccessResult, createErrorResult, isSuccess, isError } from '@/utils/async-result';
import type { AsyncResult } from '@/utils/async-result';
import { toNumberId } from '@/utils/id-converters';


import type { EventCache } from './types';
import type { CalendarEvent } from '@prisma/client';

export class CalendarEventQueryOperations {
  constructor(private cache: EventCache) {}

  /**
   * Get events for a date range with filters
   */
  async getEventsForDateRange(
    start: Date,
    end: Date,
    filters?: CalendarFilters
  ): Promise<AsyncResult<CalendarEvent[], Error>> {
    try {
      // Generate cache key
      const cacheKey = `events-${start.toISOString()}-${end.toISOString()}-${JSON.stringify(filters ?? {})}`;

      // Check cache first
      const cached = this.cache.getEvents(cacheKey);
      if (cached) {
        return createSuccessResult(cached);
      }

      const where: Record<string, unknown> = {
        scheduledDate: {
          gte: startOfDay(start),
          lte: endOfDay(end)
        }
      };

      // Apply filters
      if (filters?.mangaIds?.length) {
        where['mangaId'] = {
          in: filters.mangaIds
        };
      }
      if (filters?.eventTypes?.length) {
        where['eventType'] = {
          in: filters.eventTypes
        };
      }
      if (filters?.status?.length) {
        where['status'] = {
          in: filters.status
        };
      }
      if (filters?.minConfidence !== undefined) {
        where['confidence'] = {
          gte: filters.minConfidence
        };
      }

      // Apply pagination with defaults (limit: 100, max: 500)
      const limit = Math.min(filters?.limit ?? 100, 500);
      const offset = filters?.offset ?? 0;

      const events = await prisma.calendarEvent.findMany({
        where,
        orderBy: {
          scheduledDate: 'asc'
        },
        take: limit,
        skip: offset,
        include: {
          manga: {
            select: {
              title: true,
              mangaTitle: true
            }
          },
          chapter: {
            select: {
              title: true,
              index: true
            }
          }
        }
      });

      // Map to domain types - keeping null values as is
      const domainEvents = events;

      // Cache the results
      this.cache.setEvents(cacheKey, domainEvents);

      return createSuccessResult(domainEvents as CalendarEvent[]);
    } catch (error: unknown) {
      return createErrorResult(error instanceof Error ? error : new Error(String(error)));
    }
  }

  /**
   * Get upcoming events
   */
  async getUpcomingEvents(
    days: number,
    options?: EventQueryOptions
  ): Promise<AsyncResult<CalendarEvent[], Error>> {
    const now = new Date();
    const futureDate = addDays(now, days);
    const filters: CalendarFilters = {
      minConfidence: 0.5
    };

    const eventsResult = await this.getEventsForDateRange(now, futureDate, filters);
    if (isError(eventsResult)) {
      return eventsResult;
    }
    if (!isSuccess(eventsResult)) {
      return createErrorResult(new Error('Failed to get events'));
    }

    let events = eventsResult.data;

    // Apply limit if specified
    if (options?.limit) {
      events = events.slice(0, options.limit);
    }

    return createSuccessResult(events);
  }

  /**
   * Get events for a specific manga
   */
  async getMangaEvents(
    mangaId: ID,
    options?: EventQueryOptions
  ): Promise<AsyncResult<CalendarEvent[], Error>> {
    try {
      const numericId = toNumberId(mangaId);
      const where: Record<string, unknown> = {
        mangaId: numericId
      };

      const orderBy: Record<string, unknown> = {};
      if (options?.orderBy) {
        orderBy[options.orderBy] = options.orderDirection ?? 'asc';
      } else {
        orderBy['scheduledDate'] = 'desc';
      }

      const findManyOptions: Record<string, unknown> = {
        where,
        orderBy,
        include: {
          chapter: {
            select: {
              title: true,
              index: true
            }
          }
        }
      };

      if (options?.limit !== undefined) {
        findManyOptions['take'] = options.limit;
      }
      if (options?.offset !== undefined) {
        findManyOptions['skip'] = options.offset;
      }

      const events = await prisma.calendarEvent.findMany(findManyOptions as unknown as never);

      // Map to domain types - keeping null values as is
      const domainEvents = events;

      return createSuccessResult(domainEvents as CalendarEvent[]);
    } catch (error: unknown) {
      return createErrorResult(error instanceof Error ? error : new Error(String(error)));
    }
  }

  /**
   * Get overdue events
   */
  async getOverdueEvents(): Promise<AsyncResult<CalendarEvent[], Error>> {
    try {
      const events = await prisma.calendarEvent.findMany({
        where: {
          status: EventStatus.SCHEDULED,
          scheduledDate: {
            lt: new Date()
          }
        },
        include: {
          manga: {
            select: {
              title: true,
              mangaTitle: true
            }
          }
        }
      });

      const domainEvents = events.map((event: typeof events[number]) => ({
        ...event,
        chapterId: event.chapterId,
        actualDate: event.actualDate,
        description: event.description,
        color: event.color,
        source: event.source,
        eventType: event.eventType,
        status: event.status,
        metadata: event.metadata ?? {}
      }));

      return createSuccessResult(domainEvents as CalendarEvent[]);
    } catch (error: unknown) {
      return createErrorResult(error instanceof Error ? error : new Error(String(error)));
    }
  }

  /**
   * Get delayed events
   */
  async getDelayedEvents(): Promise<AsyncResult<CalendarEvent[], Error>> {
    try {
      const events = await prisma.calendarEvent.findMany({
        where: {
          status: EventStatus.DELAYED,
          scheduledDate: {
            gte: addDays(new Date(), -30) // Last 30 days
          }
        },
        include: {
          manga: {
            select: {
              title: true,
              mangaTitle: true
            }
          }
        }
      });

      const domainEvents = events.map((event: typeof events[number]) => ({
        ...event,
        chapterId: event.chapterId,
        actualDate: event.actualDate,
        description: event.description,
        color: event.color,
        source: event.source,
        eventType: event.eventType,
        status: event.status,
        metadata: event.metadata ?? {}
      }));

      return createSuccessResult(domainEvents as CalendarEvent[]);
    } catch (error: unknown) {
      return createErrorResult(error instanceof Error ? error : new Error(String(error)));
    }
  }
}