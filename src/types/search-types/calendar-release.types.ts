/**
 * Calendar and Release Types Module
 *
 * Types for calendar events, release schedules, and recent releases.
 * Includes provider-specific release tracking and schedule detection.
 *
 * Extracted from: search.types.ts
 */

// ============================================================================
// Imports
// ============================================================================

import type { MangaMetadata } from './core-search.types';

// ============================================================================
// Re-exports
// ============================================================================

// Re-export Prisma types
export type { CalendarEvent, EventStatus, ReleaseSchedule } from './enums.types';

// CalendarEventStatus is the same as EventStatus
export type { EventStatus as CalendarEventStatus } from './enums.types';

// ============================================================================
// Release Types
// ============================================================================

export interface RecentRelease {
  id: string;
  mangaId: string;
  mangaTitle: string;
  chapterNumber: string;
  chapterTitle?: string;
  releaseDate: Date | string;
  provider: string;
  url?: string;
}

export interface EnhancedMangaMetadata extends MangaMetadata {
  releaseSchedule?: {
    pattern?: string;
    nextRelease?: Date;
    frequency?: string;
    dayOfWeek?: number;
  };
  recentReleases?: RecentRelease[];
}

export interface FetchRecentReleasesOptions {
  limit?: number;
  offset?: number;
  startDate?: Date;
  endDate?: Date;
}

export interface ReleaseScheduleCapabilities {
  supportsSchedule: boolean;
  supportsRecentReleases: boolean;
  supportsScheduleDetection?: boolean;
  hasReleaseSchedule?: boolean;
  updateFrequency?: string;
  defaultTimezone?: string;
}

export interface ProviderReleaseSchedule {
  provider: string;
  mangaId: number;
  pattern?: string;
  type?: string;
  dayOfWeek?: number;
  dayOfMonth?: number;
  confidence?: number;
  nextRelease?: Date;
  schedule?: {
    pattern?: string;
    nextRelease?: Date;
    frequency?: string;
    dayOfMonth?: number;
  };
  lastUpdated: Date;
  updateFrequency?: string;
}

// ============================================================================
// Calendar Types
// ============================================================================

export interface CalendarFilters {
  mangaIds?: number[];
  eventTypes?: string[];
  status?: string[];
  providers?: string[];
  minConfidence?: number;
  /** Maximum number of events to return (default: 100, max: 500) */
  limit?: number;
  /** Number of events to skip for pagination */
  offset?: number;
}

export interface EventQueryOptions {
  includeDeleted?: boolean;
  sortOrder?: 'asc' | 'desc';
  orderBy?: string;
  orderDirection?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

export interface CreateCalendarEventDto {
  mangaId: number | string;
  chapterId?: number | string;
  eventType: string;
  scheduledDate: Date;
  actualDate?: Date;
  status?: string;
  confidence?: number;
  title?: string;
  description?: string;
  color?: string;
  source?: string;
  metadata?: unknown;
}

export interface UpdateCalendarEventDto {
  chapterId?: number | string;
  eventType?: string;
  scheduledDate?: Date;
  actualDate?: Date;
  status?: string;
  confidence?: number;
  title?: string;
  description?: string;
  color?: string;
  source?: string;
  metadata?: CalendarEventMetadata | unknown;
}

// ============================================================================
// Calendar Event Metadata Types
// ============================================================================

/**
 * Typed metadata interface for calendar events
 * Provides type safety when accessing event metadata fields
 */
export interface CalendarEventMetadata {
  /** Whether this event was manually overridden by user */
  isManualOverride?: boolean;
  /** Source of the event data (e.g., 'mangadex', 'anilist', 'manual') */
  source?: string;
  /** Original scheduled date before any changes */
  originalDate?: string;
  /** Provider-specific data */
  providerData?: Record<string, unknown>;
  /** Chapter number if applicable */
  chapterNumber?: string | number;
  /** Volume number if applicable */
  volumeNumber?: string | number;
  /** Reason for delay if status is DELAYED */
  delayReason?: string;
  /** Estimated new release date if delayed */
  estimatedDate?: string;
  /** Notes or comments about the event */
  notes?: string;
  /** Last user who modified this event */
  lastModifiedBy?: string;
  /** Tags for categorization */
  tags?: string[];
}
