/**
 * Calendar Export Utilities
 *
 * Provides functions to export calendar data in various formats including
 * iCal, CSV, and JSON. Supports timezone conversion and filtering options.
 *
 * @module utils/calendar-export
 */
import { format, formatISO } from 'date-fns';
import { toZonedTime, fromZonedTime } from 'date-fns-tz';

import { ValidationError } from '@/utils/error-handling';

import type { CalendarEvent, Prisma } from '@prisma/client';

// Helper function to extract pattern type from metadata
function getPatternTypeFromMetadata(metadata: Prisma.JsonValue | null | undefined): string | undefined {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return undefined;
  }
  const obj = metadata as Record<string, unknown>;
  const patternType = obj['patternType'];
  return typeof patternType === 'string' ? patternType : undefined;
}

/**
 * iCal event template
 */
const ICAL_TEMPLATE = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Mugiwara Kaizoku//Manga Release Calendar//EN
CALSCALE:GREGORIAN
METHOD:PUBLISH
X-WR-CALNAME:Manga Release Calendar
X-WR-TIMEZONE:{timezone}
{events}
END:VCALENDAR`;
/**
 * iCal event item template
 */
const ICAL_EVENT_TEMPLATE = `BEGIN:VEVENT
UID:{uid}
DTSTAMP:{dtstamp}
DTSTART:{dtstart}
DTEND:{dtend}
SUMMARY:{summary}
DESCRIPTION:{description}
STATUS:{status}
CATEGORIES:{categories}
END:VEVENT`;
/**
 * Export options interface
 */
export interface ExportOptions {
  format: 'ical' | 'csv' | 'json' | 'google';
  /** @deprecated Predicted events have been removed; this option is ignored */
  includePredicted?: boolean;
  timezone?: string;
  dateRange?: {
    start: Date;
    end: Date;
  };
}
/**
 * Generate a unique event ID for iCal
 */
function generateEventUID(event: CalendarEvent): string {
  return `${event.id}@mugiwara-kaizoku.app`;
}
/**
 * Format date for iCal (YYYYMMDDTHHMMSSZ)
 */
function formatICalDate(date: Date | string, timezone: string): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  const utcDate = fromZonedTime(dateObj, timezone);
  return formatISO(utcDate, { format: 'basic' }).replace(/[-:]/g, '').replace(/\.\d{3}/, '') + 'Z';
}
/**
 * Convert event status to iCal status
 */
function getICalStatus(status: string): string {
  switch (status) {
    case 'CONFIRMED':
      return 'CONFIRMED';
    case 'SCHEDULED':
      return 'TENTATIVE';
    case 'CANCELLED':
      return 'CANCELLED';
    default:
      return 'TENTATIVE';
  }
}
/**
 * Escape text for iCal format
 */
function escapeICalText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '');
}
/**
 * Export calendar events to iCal format
 */
export function exportToICal(events: CalendarEvent[], options: ExportOptions): string {
  const timezone = options.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
  const now = new Date();
  // Filter events based on options
  const filteredEvents = events.filter((event) => {
    // Filter by date range
    if (options.dateRange) {
      const eventDate = new Date(event.scheduledDate);
      if (eventDate < options.dateRange.start || eventDate > options.dateRange.end) {
        return false;
      }
    }
    return true;
  });
  // Generate iCal events
  const icalEvents = filteredEvents.map((event) => {
    const eventDate = new Date(event.scheduledDate);
    const endDate = new Date(eventDate.getTime() + 60 * 60 * 1000); // 1 hour duration
    const patternType = getPatternTypeFromMetadata(event.metadata);
    const confidence = event.confidence ?? 1;
    const description = [
    event.description,
    confidence < 1 ? `Confidence: ${Math.round(confidence * 100)}%` : '',
    patternType ? `Pattern: ${patternType}` : '',
    event.source ? `Source: ${event.source}` : ''].
    filter(Boolean).join('\\n');
    return ICAL_EVENT_TEMPLATE
      .replace('{uid}', generateEventUID(event))
      .replace('{dtstamp}', formatICalDate(now, timezone))
      .replace('{dtstart}', formatICalDate(eventDate, timezone))
      .replace('{dtend}', formatICalDate(endDate, timezone))
      .replace('{summary}', escapeICalText(event.title))
      .replace('{description}', escapeICalText(description))
      .replace('{status}', getICalStatus(event.status))
      .replace('{categories}', escapeICalText(event.eventType));
  }).join('\n');
  return ICAL_TEMPLATE
    .replace('{timezone}', timezone)
    .replace('{events}', icalEvents);
}
/**
 * Export calendar events to CSV format
 */
export function exportToCSV(events: CalendarEvent[], options: ExportOptions): string {
  const timezone = options.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
  // Filter events
  const filteredEvents = events.filter((event) => {
    if (options.dateRange) {
      const eventDate = new Date(event.scheduledDate);
      if (eventDate < options.dateRange.start || eventDate > options.dateRange.end) {
        return false;
      }
    }
    return true;
  });
  // CSV headers
  const headers = [
  'Title',
  'Date',
  'Time',
  'Status',
  'Type',
  'Confidence',
  'Pattern',
  'Manga ID',
  'Description',
  'Source URL'].
  join(',');
  // CSV rows
  const rows = filteredEvents.map((event) => {
    const eventDate = toZonedTime(new Date(event.scheduledDate), timezone);
    const patternType = getPatternTypeFromMetadata(event.metadata);
    const confidence = event.confidence ?? 1;
    const row = [
    `"${event.title.replace(/"/g, '""')}"`,
    format(eventDate, 'yyyy-MM-dd'),
    format(eventDate, 'HH:mm'),
    event.status,
    event.eventType,
    Math.round(confidence * 100) + '%',
    patternType ?? '',
    event.mangaId,
    `"${(event.description ?? '').replace(/"/g, '""')}"`,
    event.source ?? ''];

    return row.join(',');
  });
  return [headers, ...rows].join('\n');
}
/**
 * Export calendar events to JSON format
 */
export function exportToJSON(events: CalendarEvent[], options: ExportOptions): string {
  const timezone = options.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
  // Filter events
  const filteredEvents = events.filter((event) => {
    if (options.dateRange) {
      const eventDate = new Date(event.scheduledDate);
      if (eventDate < options.dateRange.start || eventDate > options.dateRange.end) {
        return false;
      }
    }
    return true;
  });
  // Transform events for export
  const exportData = {
    metadata: {
      exportDate: new Date().toISOString(),
      timezone,
      eventCount: filteredEvents.length
    },
    events: filteredEvents.map((event) => {
      const patternType = getPatternTypeFromMetadata(event.metadata);
      return {
        id: event.id,
        title: event.title,
        scheduledDate: event.scheduledDate,
        localDate: format(toZonedTime(new Date(event.scheduledDate), timezone), "yyyy-MM-dd'T'HH:mm:ssXXX"),
        status: event.status,
        type: event.eventType,
        confidence: event.confidence,
        mangaId: event.mangaId,
        description: event.description,
        sourceUrl: event.source,
        pattern: patternType,
        metadata: event.metadata
      };
    })
  };
  return JSON.stringify(exportData, null, 2);
}
/**
 * Download file utility
 */
export function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  // Cleanup
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
/**
 * Generate Google Calendar URL
 */
export function generateGoogleCalendarUrl(event: CalendarEvent): string {
  const url = new URL('https://calendar.google.com/calendar/render');
  // Set action to create event
  url.searchParams.set('action', 'TEMPLATE');
  // Set title
  url.searchParams.set('text', event.title);
  // Set dates (Google Calendar expects UTC in specific format)
  const startDate = new Date(event.scheduledDate);
  const endDate = new Date(startDate.getTime() + 60 * 60 * 1000); // 1 hour duration
  const formatGoogleDate = (date: Date): string => {
    return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  };
  url.searchParams.set('dates', `${formatGoogleDate(startDate)}/${formatGoogleDate(endDate)}`);
  // Set details
  const patternType = getPatternTypeFromMetadata(event.metadata);
  const detailsParts: string[] = [];
  if (event.description) {
    detailsParts.push(event.description);
  }
  if (event.confidence !== null && event.confidence < 1) {
    detailsParts.push(`Confidence: ${Math.round(event.confidence * 100)}%`);
  }
  if (patternType) {
    detailsParts.push(`Pattern: ${patternType}`);
  }
  if (event.source) {
    detailsParts.push(`Source: ${event.source}`);
  }
  const details = detailsParts.join('\n\n');
  if (details) {
    url.searchParams.set('details', details);
  }
  // Set location (optional)
  if (event.source) {
    url.searchParams.set('location', event.source);
  }
  return url.toString();
}
/**
 * Export events to Google Calendar
 */
export function exportToGoogleCalendar(events: CalendarEvent[], options: ExportOptions): void {
  // Filter events
  const filteredEvents = events.filter((event) => {
    if (options.dateRange) {
      const eventDate = new Date(event.scheduledDate);
      if (eventDate < options.dateRange.start || eventDate > options.dateRange.end) {
        return false;
      }
    }
    return true;
  });
  if (filteredEvents.length === 0) {
    throw new ValidationError('No events to export');
  }
  if (filteredEvents.length === 1) {
    // Single event - open directly
    const firstEvent = filteredEvents[0];
    if (firstEvent) {
      window.open(generateGoogleCalendarUrl(firstEvent), '_blank');
    }
  } else
  {
    // Multiple events - export as iCal and provide instructions
    const icalContent = exportToICal(filteredEvents, { ...options, format: 'ical' });
    const blob = new Blob([icalContent], { type: 'text/calendar' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `manga-releases-${format(new Date(), 'yyyyMMdd-HHmmss')}.ics`;
    document.body.appendChild(link);
    link.click();
    // Cleanup
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    // Show instructions
    alert('Downloaded iCal file. To import to Google Calendar:\n\n1. Open Google Calendar\n2. Click Settings → Import & Export\n3. Select the downloaded .ics file\n4. Choose your calendar and click Import');
  }
}
/**
 * Export calendar events with download
 */
export function exportCalendarEvents(events: CalendarEvent[], options: ExportOptions): void {
  const timestamp = format(new Date(), 'yyyyMMdd-HHmmss');
  let content: string;
  let filename: string;
  let mimeType: string;
  switch (options.format) {
    case 'ical':
      content = exportToICal(events, options);
      filename = `manga-releases-${timestamp}.ics`;
      mimeType = 'text/calendar';
      break;
    case 'csv':
      content = exportToCSV(events, options);
      filename = `manga-releases-${timestamp}.csv`;
      mimeType = 'text/csv';
      break;
    case 'json':
      content = exportToJSON(events, options);
      filename = `manga-releases-${timestamp}.json`;
      mimeType = 'application/json';
      break;
    case 'google':
      exportToGoogleCalendar(events, options);
      return; // Google Calendar handles its own export
    default: throw new ValidationError(`Unsupported export format: ${options.format}`);
  }
  downloadFile(content, filename, mimeType);
}