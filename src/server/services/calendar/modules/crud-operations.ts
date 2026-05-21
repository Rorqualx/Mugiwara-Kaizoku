
import { CalendarEventType, EventStatus } from '@prisma/client';

import { prisma } from '@/server/db';
import type { CreateCalendarEventDto, UpdateCalendarEventDto } from '@/types/search.types';
import { createSuccessResult, createErrorResult } from '@/utils/async-result';
import type { AsyncResult } from '@/utils/async-result';
import { toNumberId } from '@/utils/id-converters';


import { validateStatusTransition } from '../validators/event-status-validator';

import type { EventCache, EventEmitter } from './types';
import type { CalendarEvent } from '@prisma/client';

/**
 * Validate status transition for an event update
 * @returns Error if validation fails, null if valid
 */
async function validateEventStatusUpdate(
  eventId: number,
  newStatus: string,
  force?: boolean
): Promise<Error | null> {
  const currentEvent = await prisma.calendarEvent.findUnique({
    where: { id: eventId },
    select: { status: true, mangaId: true }
  });

  if (!currentEvent) {
    return new Error(`Calendar event not found: ${eventId}`);
  }

  try {
    validateStatusTransition(currentEvent.status, newStatus as EventStatus, eventId, force);
    return null; // Validation passed
  } catch (error) {
    return error instanceof Error ? error : new Error(String(error));
  }
}

export class CalendarEventCrudOperations {
  constructor(
    private cache: EventCache,
    private eventEmitter: EventEmitter
  ) {}

  /**
   * Create a new calendar event
   */
  async createEvent(event: CreateCalendarEventDto): Promise<AsyncResult<CalendarEvent, Error>> {
    try {
      const numericMangaId = toNumberId(event.mangaId);
      const numericChapterId = event.chapterId ? toNumberId(event.chapterId) : undefined;
      const dataToCreate: Record<string, unknown> = {
        mangaId: numericMangaId,
        eventType: event.eventType as CalendarEventType,
        scheduledDate: event.scheduledDate,
        title: event.title ?? '',
        metadata: event.metadata ?? {}
      };

      if (numericChapterId !== undefined) {
        dataToCreate['chapterId'] = numericChapterId;
      }
      if (event.actualDate !== undefined) {
        dataToCreate['actualDate'] = event.actualDate;
      }
      if (event.status !== undefined) {
        dataToCreate['status'] = event.status as EventStatus;
      }
      if (event.confidence !== undefined) {
        dataToCreate['confidence'] = event.confidence;
      }
      if (event.description !== undefined) {
        dataToCreate['description'] = event.description;
      }
      if (event.color !== undefined) {
        dataToCreate['color'] = event.color;
      }
      if (event.source !== undefined) {
        dataToCreate['source'] = event.source;
      }

      const created = await prisma.calendarEvent.create({
        data: dataToCreate as unknown as never
      });

      // Invalidate cache for this manga only (more efficient than clearAll)
      this.cache.invalidateEventsForManga(numericMangaId);

      // Emit calendar event created notification
      this.eventEmitter.emit('calendar:event:created', {
        eventId: created.id,
        mangaId: numericMangaId
      });

      // Prisma CalendarEvent matches domain CalendarEvent type
      return createSuccessResult(created);
    } catch (error: unknown) {
      return createErrorResult(error instanceof Error ? error : new Error(String(error)));
    }
  }

  /**
   * Update an existing calendar event
   * @param options.force - If true, allows invalid status transitions (admin override)
   */
  async updateEvent(
    id: number,
    updates: UpdateCalendarEventDto,
    options?: { force?: boolean }
  ): Promise<AsyncResult<CalendarEvent, Error>> {
    try {
      // Validate status transition if status is being updated
      if (updates.status !== undefined) {
        const validationError = await validateEventStatusUpdate(id, updates.status, options?.force);
        if (validationError !== null) {
          return createErrorResult(validationError);
        }
      }

      const updateData: Record<string, unknown> = {
        ...updates,
        metadata: updates.metadata ?? {}
      };

      if (updates.chapterId !== undefined) {
        updateData['chapterId'] = updates.chapterId ? toNumberId(updates.chapterId) : null;
      }

      const updated = await prisma.calendarEvent.update({
        where: { id },
        data: updateData
      });

      // Invalidate cache for this manga only (more efficient than clearAll)
      this.cache.invalidateEventsForManga(updated.mangaId);

      // Emit schedule override notification if scheduled date was changed
      if (updates.scheduledDate) {
        this.eventEmitter.emit('calendar:schedule:updated', {
          scheduleId: updated.id,
          mangaId: updated.mangaId
        });
      }

      return createSuccessResult(updated);
    } catch (error: unknown) {
      return createErrorResult(error instanceof Error ? error : new Error(String(error)));
    }
  }

  /**
   * Get a single calendar event by ID
   */
  async getEvent(id: number): Promise<AsyncResult<CalendarEvent, Error>> {
    try {
      // Check cache first
      const cached = this.cache.getEvents(`event-${id}`);
      if (cached && cached.length > 0) {
        const firstEvent = cached[0];
        if (firstEvent !== undefined) {
          return createSuccessResult(firstEvent);
        }
      }

      const event = await prisma.calendarEvent.findUnique({
        where: { id },
        include: {
          manga: true,
          chapter: true
        }
      });

      if (!event) {
        return createErrorResult(new Error(`Calendar event not found: ${id}`));
      }

      // Cache the event
      const domainEvent = event as unknown as CalendarEvent;
      this.cache.setEvents(`event-${id}`, [domainEvent]);

      return createSuccessResult(domainEvent);
    } catch (error: unknown) {
      return createErrorResult(error instanceof Error ? error : new Error(String(error)));
    }
  }

  /**
   * Delete a calendar event
   */
  async deleteEvent(id: number): Promise<AsyncResult<void, Error>> {
    try {
      // Get the event before deleting to invalidate cache properly
      const event = await prisma.calendarEvent.findUnique({
        where: { id },
        select: { mangaId: true }
      });

      if (!event) {
        return createErrorResult(new Error(`Calendar event not found: ${id}`));
      }

      await prisma.calendarEvent.delete({
        where: { id }
      });

      // Invalidate cache for this manga only (more efficient than clearAll)
      this.cache.invalidateEventsForManga(event.mangaId);

      return createSuccessResult(undefined);
    } catch (error: unknown) {
      return createErrorResult(error instanceof Error ? error : new Error(String(error)));
    }
  }

  /**
   * Update event status with state machine validation
   * @param options.force - If true, allows invalid status transitions (admin override)
   */
  async updateEventStatus(
    eventId: number,
    status: EventStatus,
    options?: { force?: boolean }
  ): Promise<AsyncResult<void, Error>> {
    try {
      // Validate status transition
      const validationError = await validateEventStatusUpdate(eventId, status, options?.force);
      if (validationError !== null) {
        return createErrorResult(validationError);
      }

      const updated = await prisma.calendarEvent.update({
        where: { id: eventId },
        data: { status }
      });

      // Invalidate cache for this manga only (more efficient than clearAll)
      this.cache.invalidateEventsForManga(updated.mangaId);

      return createSuccessResult(undefined);
    } catch (error: unknown) {
      return createErrorResult(error instanceof Error ? error : new Error(String(error)));
    }
  }
}