/**
 * Calendar Event Logging Functions
 *
 * Logging functions for calendar operations including release detection,
 * pattern updates, sync operations, and schedule management.
 *
 * Extracted from: systemEvents.ts
 */

import { emitEvent } from '../eventEmitter';

/**
 * Logs a release detection event
 * Emits an info event when a new manga release is detected
 *
 * @param {string} mangaTitle - Title of the manga
 * @param {string} chapterNumber - Chapter number/identifier
 * @param {Date} releaseDate - Date of the release
 *
 * @example
 * ```ts
 * logReleaseDetected("One Piece", "1042", new Date());
 * ```
 */
export function logReleaseDetected(
  mangaTitle: string,
  chapterNumber: string,
  releaseDate: Date
): void {
  emitEvent(
    'info',
    `New release detected: ${mangaTitle} Chapter ${chapterNumber}`,
    'Calendar',
    {
      details: {
        type: 'release_detected',
        mangaTitle,
        chapterNumber,
        releaseDate: releaseDate.toISOString()
      }
    }
  );
}

/**
 * Logs a pattern update event
 * Emits an info event when a manga's release pattern is updated
 *
 * @param {string} mangaTitle - Title of the manga
 * @param {string} oldPattern - Previous release pattern
 * @param {string} newPattern - New release pattern
 * @param {number} confidence - Pattern confidence score (0-1)
 *
 * @example
 * ```ts
 * logPatternUpdated("One Piece", "IRREGULAR", "WEEKLY", 0.95);
 * ```
 */
export function logPatternUpdated(
  mangaTitle: string,
  oldPattern: string,
  newPattern: string,
  confidence: number
): void {
  emitEvent(
    'info',
    `Release pattern updated for ${mangaTitle}: ${oldPattern} → ${newPattern} (${Math.round(confidence * 100)}% confident)`,
    'Calendar',
    {
      details: {
        type: 'pattern_updated',
        mangaTitle,
        oldPattern,
        newPattern,
        confidence
      }
    }
  );
}

/**
 * Logs a calendar sync start event
 * Emits an info event when calendar synchronization begins
 *
 * @param {string} provider - The calendar provider being synced (optional)
 *
 * @example
 * ```ts
 * logCalendarSyncStart('AniList');
 * ```
 */
export function logCalendarSyncStart(provider?: string): void {
  const message = provider
    ? `Starting calendar sync with ${provider}`
    : 'Starting calendar sync';

  emitEvent('info', message, 'Calendar', {
    details: {
      type: 'calendar_sync_start',
      provider
    }
  });
}

/**
 * Logs a calendar sync completion event
 * Emits a success event when calendar synchronization completes
 *
 * @param {number} mangaCount - Number of manga checked
 * @param {number} eventsCreated - Number of calendar events created
 *
 * @example
 * ```ts
 * logCalendarSyncComplete(50, 125);
 * ```
 */
export function logCalendarSyncComplete(
  mangaCount: number,
  eventsCreated: number
): void {
  emitEvent(
    'success',
    `Calendar sync complete: ${mangaCount} manga checked, ${eventsCreated} events created`,
    'Calendar',
    {
      details: {
        type: 'calendar_sync_complete',
        mangaCount,
        eventsCreated
      }
    }
  );
}

/**
 * Logs an upcoming release event
 * Emits an info event for upcoming manga releases
 *
 * @param {string} mangaTitle - Title of the manga
 * @param {string} chapterNumber - Chapter number/identifier
 * @param {Date} expectedDate - Expected release date
 *
 * @example
 * ```ts
 * logUpcomingRelease("One Piece", "1043", new Date('2025-03-15'));
 * ```
 */
export function logUpcomingRelease(
  mangaTitle: string,
  chapterNumber: string,
  expectedDate: Date
): void {
  emitEvent(
    'info',
    `Upcoming release: ${mangaTitle} Chapter ${chapterNumber} expected on ${expectedDate.toLocaleDateString()}`,
    'Calendar',
    {
      details: {
        type: 'upcoming_release',
        mangaTitle,
        chapterNumber,
        expectedDate: expectedDate.toISOString()
      }
    }
  );
}

/**
 * Logs a release delay event
 * Emits a warning event when a manga release is delayed
 *
 * @param {string} mangaTitle - Title of the manga
 * @param {string} chapterNumber - Chapter number/identifier
 * @param {Date} originalDate - Originally scheduled date
 * @param {number} delayDays - Number of days delayed
 *
 * @example
 * ```ts
 * logReleaseDelayed("One Piece", "1042", new Date('2025-03-08'), 7);
 * ```
 */
export function logReleaseDelayed(
  mangaTitle: string,
  chapterNumber: string,
  originalDate: Date,
  delayDays: number
): void {
  emitEvent(
    'warning',
    `Release delayed: ${mangaTitle} Chapter ${chapterNumber} delayed by ${delayDays} days`,
    'Calendar',
    {
      details: {
        type: 'release_delayed',
        mangaTitle,
        chapterNumber,
        originalDate: originalDate.toISOString(),
        delayDays
      }
    }
  );
}

/**
 * Logs a hiatus announcement event
 * Emits a warning event when a manga goes on hiatus
 *
 * @param {string} mangaTitle - Title of the manga
 * @param {Date} [returnDate] - Expected return date (if known)
 *
 * @example
 * ```ts
 * logHiatusAnnounced("Hunter x Hunter", new Date('2025-12-01'));
 * ```
 */
export function logHiatusAnnounced(
  mangaTitle: string,
  returnDate?: Date
): void {
  const message = returnDate
    ? `${mangaTitle} is going on hiatus until ${returnDate.toLocaleDateString()}`
    : `${mangaTitle} is going on hiatus`;

  emitEvent(
    'warning',
    message,
    'Calendar',
    {
      details: {
        type: 'hiatus_announced',
        mangaTitle,
        returnDate: returnDate?.toISOString()
      }
    }
  );
}

/**
 * Logs a calendar event creation
 * Emits an info event when a new calendar event is created
 *
 * @param {string} mangaTitle - Title of the manga
 * @param {string} eventType - Type of calendar event
 * @param {Date} scheduledDate - Scheduled date for the event
 * @param {number} confidence - Confidence level (0-1)
 *
 * @example
 * ```ts
 * logCalendarEventCreated("One Piece", "release", new Date('2025-03-15'), 0.95);
 * ```
 */
export function logCalendarEventCreated(
  mangaTitle: string,
  eventType: string,
  scheduledDate: Date,
  confidence: number
): void {
  emitEvent(
    'info',
    `Calendar event created: ${mangaTitle} ${eventType} on ${scheduledDate.toLocaleDateString()}`,
    'Calendar',
    {
      details: {
        type: 'calendar_event_created',
        mangaTitle,
        eventType,
        scheduledDate: scheduledDate.toISOString(),
        confidence
      }
    }
  );
}

/**
 * Logs a release confirmation
 * Emits a success event when a predicted release is confirmed
 *
 * @param {string} mangaTitle - Title of the manga
 * @param {string} chapterNumber - Chapter number
 * @param {Date} predictedDate - Originally predicted date
 * @param {Date} actualDate - Actual release date
 *
 * @example
 * ```ts
 * logReleaseConfirmed("One Piece", "1042", new Date('2025-03-15'), new Date('2025-03-15'));
 * ```
 */
export function logReleaseConfirmed(
  mangaTitle: string,
  chapterNumber: string,
  predictedDate: Date,
  actualDate: Date
): void {
  const daysDiff = Math.abs(
    (actualDate.getTime() - predictedDate.getTime()) / (1000 * 60 * 60 * 24)
  );
  const accuracy = daysDiff === 0 ? 'exactly on time' : `${Math.round(daysDiff)} days off`;

  emitEvent(
    'success',
    `Release confirmed: ${mangaTitle} Chapter ${chapterNumber} - ${accuracy}`,
    'Calendar',
    {
      details: {
        type: 'release_confirmed',
        mangaTitle,
        chapterNumber,
        predictedDate: predictedDate.toISOString(),
        actualDate: actualDate.toISOString(),
        accuracy: daysDiff
      }
    }
  );
}

/**
 * Logs an overdue release detection
 * Emits a warning when releases are overdue
 *
 * @param {string} mangaTitle - Title of the manga
 * @param {string} chapterNumber - Expected chapter number
 * @param {Date} expectedDate - Expected release date
 * @param {number} daysOverdue - Number of days overdue
 *
 * @example
 * ```ts
 * logOverdueDetected("One Piece", "1043", new Date('2025-03-08'), 7);
 * ```
 */
export function logOverdueDetected(
  mangaTitle: string,
  chapterNumber: string,
  expectedDate: Date,
  daysOverdue: number
): void {
  emitEvent(
    'warning',
    `Overdue release: ${mangaTitle} Chapter ${chapterNumber} is ${daysOverdue} days late`,
    'Calendar',
    {
      details: {
        type: 'overdue_detected',
        mangaTitle,
        chapterNumber,
        expectedDate: expectedDate.toISOString(),
        daysOverdue
      }
    }
  );
}

/**
 * Logs a schedule manual override
 * Emits an info event when user manually overrides a schedule
 *
 * @param {string} mangaTitle - Title of the manga
 * @param {string} overrideType - Type of override
 * @param {string} overrideDetails - Override details
 *
 * @example
 * ```ts
 * logScheduleManualOverride("One Piece", "release_date", "Changed from weekly to biweekly");
 * ```
 */
export function logScheduleManualOverride(
  mangaTitle: string,
  overrideType: string,
  overrideDetails: string
): void {
  emitEvent(
    'info',
    `Schedule override: ${mangaTitle} - ${overrideDetails}`,
    'Calendar',
    {
      details: {
        type: 'schedule_override',
        mangaTitle,
        overrideType,
        details: overrideDetails
      }
    }
  );
}

/**
 * Logs a calendar provider sync
 * Emits an info event when syncing with external provider
 *
 * @param {string} provider - Provider name
 * @param {number} mangaCount - Number of manga synced
 * @param {boolean} success - Whether sync was successful
 * @param {string} [error] - Error message if failed
 *
 * @example
 * ```ts
 * logCalendarProviderSync("AniList", 50, true);
 * ```
 */
export function logCalendarProviderSync(
  provider: string,
  mangaCount: number,
  success: boolean,
  error?: string
): void {
  if (success) {
    emitEvent(
      'success',
      `Provider sync complete: ${provider} - ${mangaCount} manga synced`,
      'Calendar',
      {
        details: {
          type: 'provider_sync',
          provider,
          mangaCount,
          success
        }
      }
    );
  } else {
    emitEvent(
      'error',
      `Provider sync failed: ${provider} - ${error}`,
      'Calendar',
      {
        details: {
          type: 'provider_sync_failed',
          provider,
          error
        }
      }
    );
  }
}

/**
 * Logs a pattern detection failure
 * Emits a warning when pattern detection fails
 *
 * @param {string} mangaTitle - Title of the manga
 * @param {string} reason - Reason for failure
 *
 * @example
 * ```ts
 * logPatternDetectionFailed("Hunter x Hunter", "Insufficient release history");
 * ```
 */
export function logPatternDetectionFailed(
  mangaTitle: string,
  reason: string
): void {
  emitEvent(
    'warning',
    `Pattern detection failed: ${mangaTitle} - ${reason}`,
    'Calendar',
    {
      details: {
        type: 'pattern_detection_failed',
        mangaTitle,
        reason
      }
    }
  );
}

/**
 * Logs a calendar export
 * Emits a success event when calendar is exported
 *
 * @param {string} format - Export format (ics, csv, etc)
 * @param {number} eventCount - Number of events exported
 *
 * @example
 * ```ts
 * logCalendarExported("ics", 250);
 * ```
 */
export function logCalendarExported(
  format: string,
  eventCount: number
): void {
  emitEvent(
    'success',
    `Calendar exported: ${eventCount} events to ${format.toUpperCase()} format`,
    'Calendar',
    {
      details: {
        type: 'calendar_exported',
        format,
        eventCount
      }
    }
  );
}
