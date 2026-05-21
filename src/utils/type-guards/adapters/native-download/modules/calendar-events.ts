/**
 * Calendar & Events Type Guards
 *
 * Type guards for calendar integration, event scheduling, and release management.
 * Focuses on calendar events, release schedules, and provider capabilities.
 *
 * Type Guards:
 * - isCalendarEvent: Validates calendar event objects
 * - isFetchRecentReleasesOptions: Validates recent releases fetch options
 * - isReleaseScheduleCapabilities: Validates release schedule capabilities
 * - isProviderReleaseSchedule: Validates provider release schedules
 *
 * Extracted from: search-types.ts (lines 353-413, 644-660)
 */

import type {
  CalendarEvent,
  FetchRecentReleasesOptions,
  ReleaseScheduleCapabilities,
  ProviderReleaseSchedule
} from "@/types/search.types";

// Import from foundation utils
import {
  isRecord,
  validateRequiredString,
  validateOptionalString,
  validateRequiredNumber,
  validateOptionalNumber,
  validateRequiredBoolean,
  validateOptionalBoolean,
  validateDateField,
  validateOptionalDateField
} from './search-types-utils';

export function isCalendarEvent(obj: unknown): obj is CalendarEvent {
  if (!isRecord(obj)) return false;

  return (
    validateRequiredString(obj, "id") &&
    validateRequiredString(obj, "title") &&
    validateRequiredString(obj, "type") &&
    validateDateField(obj, "start") &&
    validateDateField(obj, "end") &&
    validateOptionalString(obj, "mangaId") &&
    validateOptionalString(obj, "chapterId")
  );
}

export function isFetchRecentReleasesOptions(obj: unknown): obj is FetchRecentReleasesOptions {
  if (!isRecord(obj)) return false;

  return (
    validateOptionalNumber(obj, "limit") &&
    validateOptionalNumber(obj, "offset") &&
    validateOptionalDateField(obj, "startDate") &&
    validateOptionalDateField(obj, "endDate")
  );
}

export function isReleaseScheduleCapabilities(obj: unknown): obj is ReleaseScheduleCapabilities {
  if (!isRecord(obj)) return false;

  return (
    validateRequiredBoolean(obj, "supportsSchedule") &&
    validateRequiredBoolean(obj, "supportsRecentReleases") &&
    validateOptionalBoolean(obj, "supportsScheduleDetection") &&
    validateOptionalBoolean(obj, "hasReleaseSchedule") &&
    validateOptionalString(obj, "updateFrequency") &&
    validateOptionalString(obj, "defaultTimezone")
  );
}

export function isProviderReleaseSchedule(obj: unknown): obj is ProviderReleaseSchedule {
  if (!isRecord(obj)) return false;

  return (
    validateRequiredString(obj, "provider") &&
    validateRequiredNumber(obj, "mangaId") &&
    validateOptionalString(obj, "pattern") &&
    validateOptionalString(obj, "type") &&
    validateOptionalNumber(obj, "dayOfWeek") &&
    validateOptionalNumber(obj, "dayOfMonth") &&
    validateOptionalNumber(obj, "confidence") &&
    validateOptionalDateField(obj, "nextRelease") &&
    validateDateField(obj, "lastUpdated") &&
    validateOptionalString(obj, "updateFrequency")
  );
}