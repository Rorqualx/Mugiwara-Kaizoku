import type { ExtendedEventEmitter } from '@/server/services/eventEmitter';
import type { ID, CalendarFilters, EventQueryOptions, CreateCalendarEventDto, UpdateCalendarEventDto } from '@/types/search.types';

import type { CalendarEventType, EventStatus, CalendarEvent } from '@prisma/client';

export interface CalendarEventServiceTypes {
  CalendarEventType: typeof CalendarEventType;
  EventStatus: typeof EventStatus;
  ID: ID;
  CalendarFilters: CalendarFilters;
  EventQueryOptions: EventQueryOptions;
  CreateCalendarEventDto: CreateCalendarEventDto;
  UpdateCalendarEventDto: UpdateCalendarEventDto;
  CalendarEvent: CalendarEvent;
}

export interface ReconciliationResult {
  reconciled: number;
  delayed: number;
}

export interface EventGenerationData {
  date: Date;
  chapterNumber: number;
}

export interface ReleaseSchedule {
  releaseType: string;
  confidence: number;
}

export interface EventCache {
  getEvents: (key: string) => CalendarEvent[] | null;
  setEvents: (key: string, events: CalendarEvent[]) => void;
  clearAll: () => void;
  clearForManga: (mangaId: string | number) => void;
  invalidateEventsForManga: (mangaId: string | number) => void;
}

export type EventEmitter = ExtendedEventEmitter;