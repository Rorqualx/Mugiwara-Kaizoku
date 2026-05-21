/**
 * Calendar Provider Integration - Manual Operations
 *
 * Handles user-initiated manual overrides for release schedules.
 * Supports three override types:
 * - schedule: Full schedule override
 * - next_release: Single release override
 * - hiatus: Hiatus start/end events
 *
 * Extracted from: CalendarProviderIntegrationService.ts (lines 538-635)
 */

// ============================================================================
// External Imports
// ============================================================================


import { CalendarEventType, EventStatus } from '@prisma/client';

import type { ManualScheduleOverride } from '@/server/base/CalendarSupportedProvider';
import { createSuccessResult, createErrorResult } from '@/utils/async-result';
import type { AsyncResult } from '@/utils/async-result';
import { toNumberId } from '@/utils/id-converters';
import { createLogger } from '@/utils/logger';


// ============================================================================
// Internal Imports
// ============================================================================

import type {
  ProviderIntegrationConfig,
  ReleaseType
} from './types';



// ============================================================================
// Logger Setup
// ============================================================================

const logger = createLogger('CalendarProviderIntegrationService:ManualOps');

// ============================================================================
// Exported Functions
// ============================================================================

/**
 * Apply manual schedule override for a manga
 *
 * Supports three override types:
 * 1. 'schedule' - Full release schedule override with day/month/week patterns
 * 2. 'next_release' - Override for a single upcoming release date
 * 3. 'hiatus' - Mark a hiatus period with optional end date
 *
 * All overrides are marked with confidence 1.0 and confirmed status.
 * Metadata includes override creator and expiration time.
 *
 * @param config - Provider integration configuration containing Prisma client and settings
 * @param override - Manual override object specifying type and data
 * @returns AsyncResult containing void on success or Error on failure
 */
export async function applyManualOverride(
  config: ProviderIntegrationConfig,
  override: ManualScheduleOverride
): Promise<AsyncResult<void, Error>> {
  try {
    const numericMangaId = toNumberId(override.mangaId);

    // Schedule override: update or create release schedule
    if (override.overrideType === 'schedule' && override.scheduleData) {
      await config.prisma.releaseSchedule.upsert({
        where: {
          mangaId_source: {
            mangaId: numericMangaId,
            source: 'manual_override'
          }
        },
        update: {
          releaseType: override.scheduleData.releaseType as ReleaseType,
          ...(override.scheduleData.dayOfWeek && { dayOfWeek: override.scheduleData.dayOfWeek }),
          ...(override.scheduleData.dayOfMonth && { dayOfMonth: override.scheduleData.dayOfMonth }),
          timezone: override.scheduleData.timezone ?? config.defaultTimezone,
          isConfirmed: true,
          confidence: 1.0,
          lastUpdated: new Date(),
          metadata: {
            overrideBy: override.createdBy,
            expiresAt: override.expiresAt
          }
        },
        create: {
          mangaId: numericMangaId,
          releaseType: override.scheduleData.releaseType as ReleaseType,
          ...(override.scheduleData.dayOfWeek && { dayOfWeek: override.scheduleData.dayOfWeek }),
          ...(override.scheduleData.dayOfMonth && { dayOfMonth: override.scheduleData.dayOfMonth }),
          timezone: override.scheduleData.timezone ?? config.defaultTimezone,
          isConfirmed: true,
          confidence: 1.0,
          source: 'manual_override',
          metadata: {
            overrideBy: override.createdBy,
            expiresAt: override.expiresAt
          }
        }
      });
    }
    // Next release override: create a confirmed event for the next release
    else if (override.overrideType === 'next_release' && override.nextReleaseDate) {
      await config.prisma.calendarEvent.create({
        data: {
          mangaId: numericMangaId,
          eventType: CalendarEventType.CHAPTER_RELEASE,
          scheduledDate: override.nextReleaseDate,
          status: EventStatus.CONFIRMED,
          confidence: 1.0,
          title: 'Manual Release Override',
          source: 'manual_override',
          metadata: {
            overrideBy: override.createdBy
          }
        }
      });
    }
    // Hiatus override: create hiatus start (and optionally end) events
    else if (override.overrideType === 'hiatus' && override.hiatusInfo) {
      await config.prisma.calendarEvent.create({
        data: {
          mangaId: numericMangaId,
          eventType: CalendarEventType.HIATUS_START,
          scheduledDate: override.hiatusInfo.startDate,
          status: EventStatus.CONFIRMED,
          confidence: 1.0,
          title: 'Hiatus Start',
          ...(override.hiatusInfo.reason && { description: override.hiatusInfo.reason }),
          source: 'manual_override'
        }
      });

      // Create optional hiatus end event
      if (override.hiatusInfo.endDate) {
        await config.prisma.calendarEvent.create({
          data: {
            mangaId: numericMangaId,
            eventType: CalendarEventType.HIATUS_END,
            scheduledDate: override.hiatusInfo.endDate,
            status: EventStatus.SCHEDULED,
            confidence: 0.8,
            title: 'Hiatus End (Expected)',
            source: 'manual_override'
          }
        });
      }
    }

    logger.info(`Applied manual override for manga ${override.mangaId}`, {
      override
    });
    return createSuccessResult(undefined);
  } catch (error: unknown) {
    logger.error('Failed to apply manual override', {
      error: error instanceof Error ? error.message : String(error)
    });
    return createErrorResult(error instanceof Error ? error : new Error(String(error)));
  }
}
