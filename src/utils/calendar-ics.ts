/**
 * Calendar ICS Export Utility
 *
 * Generates ICS (iCalendar) format files for calendar events.
 * Supports export for Google Calendar, Apple Calendar, and other iCal-compatible apps.
 *
 * @module utils/calendar-ics
 */

import { createEvents, DateArray, EventAttributes } from 'ics';

import { isCalendarEventMetadata } from './calendar-type-guards';

import type { CalendarEvent } from '@prisma/client';

// ============================================================================
// Types
// ============================================================================

/**
 * Options for ICS calendar generation
 */
export interface IcsExportOptions {
  /** Calendar name shown in apps */
  calendarName?: string;
  /** Calendar description */
  description?: string;
  /** Product ID for the calendar */
  productId?: string;
  /** Include event descriptions */
  includeDescriptions?: boolean;
  /** Include confidence scores in descriptions */
  includeConfidence?: boolean;
  /** Event duration in hours (default: 1) */
  defaultDurationHours?: number;
}

/**
 * Result of ICS generation
 */
export interface IcsGenerationResult {
  success: boolean;
  value?: string;
  error?: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Convert a Date to ICS DateArray format [year, month, day, hour, minute]
 */
function dateToIcsArray(date: Date): DateArray {
  return [
    date.getFullYear(),
    date.getMonth() + 1, // ICS months are 1-indexed
    date.getDate(),
    date.getHours(),
    date.getMinutes(),
  ];
}

/**
 * Extract chapter number from event metadata
 */
function getChapterNumber(event: CalendarEvent): string | undefined {
  const metadata = event.metadata;
  if (isCalendarEventMetadata(metadata)) {
    const chapterNum = metadata.chapterNumber;
    if (chapterNum !== undefined) {
      return String(chapterNum);
    }
  }
  return undefined;
}

/**
 * Build event description including relevant metadata
 */
function buildEventDescription(
  event: CalendarEvent,
  options: IcsExportOptions
): string {
  const parts: string[] = [];

  // Add event description if present
  if (event.description && options.includeDescriptions) {
    parts.push(event.description);
  }

  // Add chapter number if available
  const chapterNum = getChapterNumber(event);
  if (chapterNum) {
    parts.push(`Chapter: ${chapterNum}`);
  }

  // Add confidence score if requested
  if (options.includeConfidence && event.confidence !== null) {
    const confidencePercent = Math.round(event.confidence * 100);
    parts.push(`Confidence: ${confidencePercent}%`);
  }

  // Add status
  parts.push(`Status: ${event.status}`);

  // Add source if available
  if (event.source) {
    parts.push(`Source: ${event.source}`);
  }

  return parts.join('\\n');
}

/**
 * Get event color for categories
 */
function getEventCategory(event: CalendarEvent): string {
  switch (event.status) {
    case 'CONFIRMED':
      return 'Confirmed Release';
    case 'SCHEDULED':
      return 'Scheduled Release';
    case 'DELAYED':
      return 'Delayed Release';
    case 'CANCELLED':
      return 'Cancelled';
    case 'RELEASED':
      return 'Released';
    default:
      return 'Manga Release';
  }
}

/**
 * Generate a unique UID for an event
 */
function generateEventUid(event: CalendarEvent, domain: string): string {
  return `event-${event.id}-${event.mangaId}@${domain}`;
}

// ============================================================================
// Main Export Function
// ============================================================================

/**
 * Generate an ICS calendar file from calendar events
 *
 * @param events - Array of calendar events to export
 * @param options - Export options
 * @returns ICS file content as string or error
 *
 * @example
 * ```typescript
 * const result = generateIcsCalendar(events, {
 *   calendarName: 'Manga Releases',
 *   includeConfidence: true
 * });
 *
 * if (result.success) {
 *   // result.value contains the ICS file content
 *   downloadFile(result.value, 'manga-calendar.ics');
 * }
 * ```
 */
export function generateIcsCalendar(
  events: CalendarEvent[],
  options: IcsExportOptions = {}
): IcsGenerationResult {
  const {
    calendarName = 'Manga Release Calendar',
    description = 'Upcoming manga chapter and volume releases',
    productId = '-//Mugiwara-Kaizoku//Calendar//EN',
    includeDescriptions = true,
    includeConfidence = true,
    defaultDurationHours = 1,
  } = options;

  // Convert events to ICS format
  const icsEvents: EventAttributes[] = events.map((event) => {
    const startDate = event.scheduledDate;
    const endDate = new Date(startDate.getTime() + defaultDurationHours * 60 * 60 * 1000);

    const icsEvent: EventAttributes = {
      start: dateToIcsArray(startDate),
      end: dateToIcsArray(endDate),
      title: event.title,
      description: buildEventDescription(event, {
        includeDescriptions,
        includeConfidence,
      }),
      uid: generateEventUid(event, 'mugiwara-kaizoku'),
      categories: [getEventCategory(event), event.eventType],
      status: event.status === 'CANCELLED' ? 'CANCELLED' : 'CONFIRMED',
      productId,
    };

    // Add location/URL if available from metadata
    const metadata = event.metadata;
    if (isCalendarEventMetadata(metadata) && metadata.providerData) {
      const url = metadata.providerData['url'];
      if (typeof url === 'string') {
        icsEvent.url = url;
      }
    }

    // Add organizer info
    icsEvent.organizer = {
      name: calendarName,
      email: 'calendar@mugiwara-kaizoku.local',
    };

    return icsEvent;
  });

  // Generate ICS file
  const result = createEvents(icsEvents);

  if (result.error) {
    return {
      success: false,
      error: result.error.message,
    };
  }

  // Add custom calendar metadata at the top
  let icsContent = result.value ?? '';

  // Insert calendar name and description after VCALENDAR
  if (icsContent.includes('BEGIN:VCALENDAR')) {
    icsContent = icsContent.replace(
      'BEGIN:VCALENDAR',
      `BEGIN:VCALENDAR\r\nX-WR-CALNAME:${calendarName}\r\nX-WR-CALDESC:${description}`
    );
  }

  return {
    success: true,
    value: icsContent,
  };
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Generate ICS content for a single event
 */
export function generateSingleEventIcs(
  event: CalendarEvent,
  options: IcsExportOptions = {}
): IcsGenerationResult {
  return generateIcsCalendar([event], options);
}

/**
 * Filter events suitable for ICS export (excludes cancelled/past events)
 */
export function filterEventsForExport(
  events: CalendarEvent[],
  options: {
    includeCancelled?: boolean;
    includePast?: boolean;
  } = {}
): CalendarEvent[] {
  const { includeCancelled = false, includePast = false } = options;
  const now = new Date();

  return events.filter((event) => {
    // Filter cancelled if not included
    if (!includeCancelled && event.status === 'CANCELLED') {
      return false;
    }

    // Filter past events if not included
    if (!includePast && event.scheduledDate < now && event.status !== 'RELEASED') {
      return false;
    }

    return true;
  });
}

/**
 * Get ICS file content type for downloads
 */
export function getIcsContentType(): string {
  return 'text/calendar;charset=utf-8';
}

/**
 * Generate filename for ICS export
 */
export function generateIcsFilename(prefix = 'manga-calendar'): string {
  const now = new Date();
  const dateStr = now.toISOString().split('T')[0];
  return `${prefix}-${dateStr}.ics`;
}
