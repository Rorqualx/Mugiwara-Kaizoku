/**
 * Calendar Type Guards
 *
 * Type guards and helper functions for safely accessing calendar event metadata.
 * Provides type-safe access to event metadata fields.
 *
 * @module utils/calendar-type-guards
 */

import type { CalendarEventMetadata } from '@/types/search-types/calendar-release.types';

import type { CalendarEvent, Prisma } from '@prisma/client';

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Check if a value is a non-null object
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Type guard to check if a value is a valid CalendarEventMetadata object
 *
 * @param value - Value to check
 * @returns true if value matches CalendarEventMetadata shape
 */
export function isCalendarEventMetadata(value: unknown): value is CalendarEventMetadata {
  if (!isRecord(value)) {
    return false;
  }

  // Check that all present properties have valid types
  const metadata = value as Record<string, unknown>;

  // isManualOverride must be boolean if present
  if ('isManualOverride' in metadata && typeof metadata['isManualOverride'] !== 'boolean') {
    return false;
  }

  // source must be string if present
  if ('source' in metadata && typeof metadata['source'] !== 'string') {
    return false;
  }

  // originalDate must be string if present
  if ('originalDate' in metadata && typeof metadata['originalDate'] !== 'string') {
    return false;
  }

  // providerData must be object if present
  if ('providerData' in metadata && !isRecord(metadata['providerData'])) {
    return false;
  }

  // tags must be array of strings if present
  if ('tags' in metadata) {
    const tags = metadata['tags'];
    if (!Array.isArray(tags) || !tags.every((t) => typeof t === 'string')) {
      return false;
    }
  }

  return true;
}

// ============================================================================
// Metadata Access Helpers
// ============================================================================

/**
 * Safely get typed metadata from a calendar event
 *
 * @param event - Calendar event
 * @returns Typed metadata or empty object if invalid
 *
 * @example
 * ```typescript
 * const metadata = getEventMetadata(event);
 * if (metadata.isManualOverride) {
 *   // Handle manual override
 * }
 * ```
 */
export function getEventMetadata(event: CalendarEvent): CalendarEventMetadata {
  const metadata = event.metadata;

  if (isCalendarEventMetadata(metadata)) {
    return metadata;
  }

  return {};
}

/**
 * Check if an event is a manual override
 */
export function isManualOverride(event: CalendarEvent): boolean {
  const metadata = getEventMetadata(event);
  return metadata.isManualOverride === true;
}

/**
 * Get the source of an event
 */
export function getEventSource(event: CalendarEvent): string | undefined {
  // First check event.source field
  if (event.source) {
    return event.source;
  }

  // Fallback to metadata source
  const metadata = getEventMetadata(event);
  return metadata.source;
}

/**
 * Get the chapter number from event metadata
 */
export function getChapterNumber(event: CalendarEvent): string | number | undefined {
  const metadata = getEventMetadata(event);
  return metadata.chapterNumber;
}

/**
 * Get the volume number from event metadata
 */
export function getVolumeNumber(event: CalendarEvent): string | number | undefined {
  const metadata = getEventMetadata(event);
  return metadata.volumeNumber;
}

/**
 * Get the delay reason from event metadata
 */
export function getDelayReason(event: CalendarEvent): string | undefined {
  const metadata = getEventMetadata(event);
  return metadata.delayReason;
}

/**
 * Get the original scheduled date from metadata
 */
export function getOriginalDate(event: CalendarEvent): Date | undefined {
  const metadata = getEventMetadata(event);
  if (metadata.originalDate) {
    const date = new Date(metadata.originalDate);
    return isNaN(date.getTime()) ? undefined : date;
  }
  return undefined;
}

/**
 * Get notes/comments from event metadata
 */
export function getEventNotes(event: CalendarEvent): string | undefined {
  const metadata = getEventMetadata(event);
  return metadata.notes;
}

/**
 * Get tags from event metadata
 */
export function getEventTags(event: CalendarEvent): string[] {
  const metadata = getEventMetadata(event);
  return metadata.tags ?? [];
}

/**
 * Get provider-specific data from metadata
 */
export function getProviderData<T = unknown>(
  event: CalendarEvent,
  key?: string
): T | Record<string, unknown> | undefined {
  const metadata = getEventMetadata(event);
  const providerData = metadata.providerData;

  if (!providerData) {
    return undefined;
  }

  if (key) {
    return providerData[key] as T;
  }

  return providerData;
}

// ============================================================================
// Metadata Creation Helpers
// ============================================================================

/**
 * Create a valid CalendarEventMetadata object
 *
 * @param data - Partial metadata fields
 * @returns Valid CalendarEventMetadata object
 */
export function createEventMetadata(
  data: Partial<CalendarEventMetadata>
): CalendarEventMetadata {
  const metadata: CalendarEventMetadata = {};

  if (data.isManualOverride !== undefined) {
    metadata.isManualOverride = data.isManualOverride;
  }

  if (data.source !== undefined) {
    metadata.source = data.source;
  }

  if (data.originalDate !== undefined) {
    metadata.originalDate = data.originalDate;
  }

  if (data.providerData !== undefined) {
    metadata.providerData = data.providerData;
  }

  if (data.chapterNumber !== undefined) {
    metadata.chapterNumber = data.chapterNumber;
  }

  if (data.volumeNumber !== undefined) {
    metadata.volumeNumber = data.volumeNumber;
  }

  if (data.delayReason !== undefined) {
    metadata.delayReason = data.delayReason;
  }

  if (data.estimatedDate !== undefined) {
    metadata.estimatedDate = data.estimatedDate;
  }

  if (data.notes !== undefined) {
    metadata.notes = data.notes;
  }

  if (data.lastModifiedBy !== undefined) {
    metadata.lastModifiedBy = data.lastModifiedBy;
  }

  if (data.tags !== undefined) {
    metadata.tags = [...data.tags];
  }

  return metadata;
}

/**
 * Merge metadata objects
 */
export function mergeEventMetadata(
  base: CalendarEventMetadata,
  updates: Partial<CalendarEventMetadata>
): CalendarEventMetadata {
  const result: CalendarEventMetadata = {
    ...base,
    ...updates,
  };

  // Merge providerData if both exist
  if (base.providerData ?? updates.providerData) {
    result.providerData = { ...base.providerData, ...updates.providerData };
  }

  // Merge tags if both exist
  if (base.tags ?? updates.tags) {
    result.tags = [...(base.tags ?? []), ...(updates.tags ?? [])];
  }

  return result;
}

/**
 * Convert Prisma JSON value to CalendarEventMetadata
 * Safe conversion from Prisma JSON type to typed metadata
 */
export function parseEventMetadata(
  value: Prisma.JsonValue | null | undefined
): CalendarEventMetadata {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  if (isCalendarEventMetadata(value)) {
    return value;
  }

  return {};
}
