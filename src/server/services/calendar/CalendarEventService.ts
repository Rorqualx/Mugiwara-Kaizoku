
import { EventStatus } from '@prisma/client';

import type { ID, CalendarFilters, EventQueryOptions, CreateCalendarEventDto, UpdateCalendarEventDto } from '@/types/search.types';
import type { AsyncResult } from '@/utils/async-result';


import { eventEmitter } from '../eventEmitter';

import { getCalendarCache } from './CalendarCacheService';
import {
  CalendarEventCrudOperations,
  CalendarEventQueryOperations,
  CalendarEventReconciliation,
  CalendarEventCleanup,
  type ReconciliationResult
} from './modules';

import type { CalendarEvent } from '@prisma/client';

export class CalendarEventService {
  private cache = getCalendarCache();

  private crudOperations = new CalendarEventCrudOperations(this.cache, eventEmitter);
  private queryOperations = new CalendarEventQueryOperations(this.cache);
  private reconciliation = new CalendarEventReconciliation(eventEmitter);
  private cleanup = new CalendarEventCleanup();

  /**
   * Create a new calendar event
   */
  async createEvent(event: CreateCalendarEventDto): Promise<AsyncResult<CalendarEvent, Error>> {
    return this.crudOperations.createEvent(event);
  }

  /**
   * Update an existing calendar event
   */
  async updateEvent(id: number, updates: UpdateCalendarEventDto): Promise<AsyncResult<CalendarEvent, Error>> {
    return this.crudOperations.updateEvent(id, updates);
  }

  /**
   * Get a single calendar event by ID
   */
  async getEvent(id: number): Promise<AsyncResult<CalendarEvent, Error>> {
    return this.crudOperations.getEvent(id);
  }

  /**
   * Delete a calendar event
   */
  async deleteEvent(id: number): Promise<AsyncResult<void, Error>> {
    return this.crudOperations.deleteEvent(id);
  }

  /**
   * Get events for a date range with filters
   */
  async getEventsForDateRange(
    start: Date,
    end: Date,
    filters?: CalendarFilters
  ): Promise<AsyncResult<CalendarEvent[], Error>> {
    return this.queryOperations.getEventsForDateRange(start, end, filters);
  }

  /**
   * Get upcoming events
   */
  async getUpcomingEvents(
    days: number,
    options?: EventQueryOptions
  ): Promise<AsyncResult<CalendarEvent[], Error>> {
    return this.queryOperations.getUpcomingEvents(days, options);
  }

  /**
   * Get events for a specific manga
   */
  async getMangaEvents(
    mangaId: ID,
    options?: EventQueryOptions
  ): Promise<AsyncResult<CalendarEvent[], Error>> {
    return this.queryOperations.getMangaEvents(mangaId, options);
  }

  /**
   * Confirm a release (mark scheduled event as released)
   */
  async confirmRelease(
    eventId: number,
    actualDate: Date,
    chapterId?: number
  ): Promise<AsyncResult<void, Error>> {
    return this.reconciliation.confirmRelease(eventId, actualDate, chapterId);
  }

  /**
   * Clean up old events
   */
  async cleanupOldEvents(daysToKeep: number): Promise<AsyncResult<number, Error>> {
    return this.cleanup.cleanupOldEvents(daysToKeep);
  }

  /**
   * Reconcile events with actual releases
   */
  async reconcileEvents(): Promise<AsyncResult<ReconciliationResult, Error>> {
    return this.reconciliation.reconcileEvents();
  }

  /**
   * Get overdue events
   */
  async getOverdueEvents(): Promise<AsyncResult<CalendarEvent[], Error>> {
    return this.queryOperations.getOverdueEvents();
  }

  /**
   * Update event status
   */
  async updateEventStatus(eventId: number, status: EventStatus): Promise<AsyncResult<void, Error>> {
    return this.crudOperations.updateEventStatus(eventId, status);
  }

  /**
   * Get delayed events
   */
  async getDelayedEvents(): Promise<AsyncResult<CalendarEvent[], Error>> {
    return this.queryOperations.getDelayedEvents();
  }
}