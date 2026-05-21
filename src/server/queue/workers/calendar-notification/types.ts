/**
 * Calendar Notification Types Module
 *
 * Shared type definitions for calendar notification system.
 * Used across all notification processor modules.
 *
 * Extracted from: calendarNotificationWorker.ts (lines 25-93)
 */

import type { ReleaseSchedule, Prisma } from '@prisma/client';

// ============================================================================
// Prisma Extension Types
// ============================================================================

/**
 * Type for Prisma metadata JSON field
 */
export interface NotificationMetadata {
  sentNotifications?: string[];
  lastNotificationSent?: string;
  daysPastDue?: number;
  [key: string]: unknown;
}

/**
 * Extended Manga type with title fields
 */
export interface MangaWithTitle {
  mangaTitle?: string;
  title?: string;
}

/**
 * Extended event/schedule with manga relation
 */
export interface CalendarEventWithManga {
  id: number;
  manga?: MangaWithTitle;
  metadata?: Prisma.JsonValue;
  scheduledDate: Date;
  [key: string]: unknown;
}

/**
 * Release schedule with manga relation
 */
export interface ReleaseScheduleWithManga extends ReleaseSchedule {
  manga?: MangaWithTitle;
}

// ============================================================================
// Configuration Types
// ============================================================================

/**
 * Notification configuration
 */
export interface NotificationConfig {
  /**
   * Hours before release to send notification
   */
  leadTimeHours: number;
  /**
   * Enable different notification types
   */
  enabledTypes: {
    upcomingRelease: boolean;
    releaseDelay: boolean;
    patternChange: boolean;
    newRelease: boolean;
  };
  /**
   * Batch size for processing
   */
  batchSize?: number;
  /**
   * Minimum confidence for predictions
   */
  minConfidence?: number;
}

/**
 * Notification statistics
 */
export interface NotificationStats {
  sent: number;
  failed: number;
  skipped: number;
  types: Record<string, number>;
}
