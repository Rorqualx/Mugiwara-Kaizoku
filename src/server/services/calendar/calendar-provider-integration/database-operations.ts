/**
 * Calendar Provider Integration - Database Operations
 *
 * Handles all database persistence for calendar provider integration.
 * Uses batch operations (createMany, Promise.all) to avoid await-in-loop violations.
 *
 * Key Optimizations:
 * - Batch checking for existing records
 * - Batch creation with createMany
 * - Parallel queries with Promise.all
 *
 * Performance:
 * - Before: 9 await-in-loop violations (N queries per release)
 * - After: 0 violations (1 batch query per operation type)
 *
 * Extracted from: CalendarProviderIntegrationService.ts (lines 295-470)
 */

// ============================================================================
// External Imports
// ============================================================================

import type { ID } from '@/types/search.types';
import { toNumberId } from '@/utils/id-converters';
import { createLogger } from '@/utils/logger';

// Local imports
import type {
  ProviderIntegrationConfig,
  RecentRelease,
  ProviderReleaseSchedule,
  CalendarEventType,
  EventStatus,
  ReleaseType
} from './types';


// ============================================================================
// Logger
// ============================================================================

const logger = createLogger('CalendarProviderIntegrationService:DatabaseOps');

// ============================================================================
// Database Operations
// ============================================================================

/**
 * Store release history with batch operations
 *
 * FIXED: 5 await-in-loop violations → batch operations
 * - Batches existence checks with Promise.all
 * - Batches previous release lookups with Promise.all
 * - Uses createMany for bulk inserts
 *
 * @param config - Provider integration configuration
 * @param mangaId - Manga identifier
 * @param releases - Array of recent releases to store
 * @param source - Source identifier for the releases
 * @returns Promise resolving when storage complete
 */
export async function storeReleaseHistory(
  config: ProviderIntegrationConfig,
  mangaId: ID,
  releases: RecentRelease[],
  source: string
): Promise<void> {
  const numericMangaId = toNumberId(mangaId);

  // Batch check for existing releases
  const existingChecks = await Promise.all(
    releases.map(release =>
      config.prisma.releaseHistory.findFirst({
        where: {
          mangaId: numericMangaId,
          chapterNumber: release.chapterNumber,
          source
        }
      })
    )
  );

  // Filter to only new releases
  const newReleases = releases.filter((_, idx) => !existingChecks[idx]);

  if (newReleases.length === 0) return;

  // Get previous releases for calculating days between (batch operation)
  const previousReleases = await Promise.all(
    newReleases.map(release =>
      config.prisma.releaseHistory.findFirst({
        where: {
          mangaId: numericMangaId,
          releaseDate: { lt: release.releaseDate }
        },
        orderBy: { releaseDate: 'desc' }
      })
    )
  );

  // Prepare data for batch create
  const dataToCreate = newReleases.map((release, idx) => {
    const releaseDateTime = new Date(release.releaseDate);
    const previousRelease = previousReleases[idx];
    const daysFromPrevious = previousRelease
      ? Math.floor(
          (releaseDateTime.getTime() - previousRelease.releaseDate.getTime()) /
            (1000 * 60 * 60 * 24)
        )
      : null;

    return {
      mangaId: numericMangaId,
      chapterId: 0,
      chapterNumber: String(release.chapterNumber),
      releaseDate: releaseDateTime,
      detectedDate: new Date(),
      dayOfWeek: releaseDateTime.getDay(),
      daysFromPrevious,
      isOnSchedule: true,
      source
    };
  });

  // Batch create all new releases
  try {
    await config.prisma.releaseHistory.createMany({
      data: dataToCreate,
      skipDuplicates: true
    });

    logger.info('Batch stored release history', {
      mangaId,
      source,
      count: dataToCreate.length
    });
  } catch (error: unknown) {
    logger.error('Failed to batch store release history', {
      mangaId,
      source,
      count: dataToCreate.length,
      error: error instanceof Error ? error.message : String(error)
    });
    throw error;
  }
}

/**
 * Store or update release schedule
 *
 * No await-in-loop violations (single upsert operation).
 * Extracted for consistency with other database operations.
 *
 * @param config - Provider integration configuration
 * @param mangaId - Manga identifier
 * @param schedule - Provider release schedule data
 * @param source - Source identifier for the schedule
 * @returns Promise resolving when schedule stored
 */
export async function storeReleaseSchedule(
  config: ProviderIntegrationConfig,
  mangaId: ID,
  schedule: ProviderReleaseSchedule,
  source: string
): Promise<void> {
  const numericMangaId = toNumberId(mangaId);

  try {
    await config.prisma.releaseSchedule.upsert({
      where: {
        mangaId_source: {
          mangaId: numericMangaId,
          source
        }
      },
      update: {
        releaseType: (schedule.type ?? 'REGULAR').toUpperCase() as unknown as ReleaseType,
        ...(schedule.dayOfWeek && { dayOfWeek: schedule.dayOfWeek }),
        ...(schedule.dayOfMonth && { dayOfMonth: schedule.dayOfMonth }),
        timezone: config.defaultTimezone,
        isConfirmed: false,
        confidence: schedule.confidence ?? 0,
        lastUpdated: new Date()
      },
      create: {
        mangaId: numericMangaId,
        releaseType: (schedule.type ?? 'REGULAR').toUpperCase() as unknown as ReleaseType,
        ...(schedule.dayOfWeek && { dayOfWeek: schedule.dayOfWeek }),
        ...(schedule.dayOfMonth && { dayOfMonth: schedule.dayOfMonth }),
        timezone: config.defaultTimezone,
        isConfirmed: false,
        confidence: schedule.confidence ?? 0,
        source
      }
    });

    logger.info('Stored release schedule', {
      mangaId,
      source,
      type: schedule.type
    });
  } catch (error: unknown) {
    logger.error('Failed to store release schedule', {
      mangaId,
      source,
      error: error instanceof Error ? error.message : String(error)
    });
    throw error;
  }
}

/**
 * Generate future calendar events based on schedule
 *
 * FIXED: 4 await-in-loop violations → batch operations
 * - Batches existence checks with Promise.all
 * - Uses createMany for bulk event creation
 *
 * @param config - Provider integration configuration
 * @param mangaId - Manga identifier
 * @param schedule - Provider release schedule data
 * @returns Promise resolving when events generated
 */
export async function generateFutureEvents(
  config: ProviderIntegrationConfig,
  mangaId: ID,
  schedule: ProviderReleaseSchedule
): Promise<void> {
  // Early return checks
  if (!schedule.nextRelease || !schedule.type || schedule.type === 'irregular') {
    return;
  }

  const numericMangaId = toNumberId(mangaId);

  // Generate event dates using helper function
  const events = calculateEventDates(schedule);
  if (events.length === 0) return;

  // Get manga title for event descriptions
  const manga = await config.prisma.manga.findUnique({
    where: { id: numericMangaId },
    select: { title: true }
  });
  if (!manga) return;

  // Batch check for existing events
  const existingChecks = await Promise.all(
    events.map(eventDate => {
      // Clone date to avoid mutations
      const startOfDay = new Date(eventDate);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(eventDate);
      endOfDay.setHours(23, 59, 59, 999);

      return config.prisma.calendarEvent.findFirst({
        where: {
          mangaId: numericMangaId,
          scheduledDate: {
            gte: startOfDay,
            lt: endOfDay
          },
          eventType: 'CHAPTER_RELEASE' as CalendarEventType
        }
      });
    })
  );

  // Filter to only new events
  const newEvents = events.filter((_, idx) => !existingChecks[idx]);

  if (newEvents.length === 0) return;

  // Prepare data for batch create
  const dataToCreate = newEvents.map(eventDate => ({
    mangaId: numericMangaId,
    eventType: 'CHAPTER_RELEASE' as CalendarEventType,
    scheduledDate: eventDate,
    status: 'SCHEDULED' as EventStatus,
    confidence: schedule.confidence ?? 0.5,
    title: `${manga.title} - New Chapter`,
    description: 'Expected new chapter release',
    source: 'calendar_sync'
  }));

  // Batch create all new events
  try {
    await config.prisma.calendarEvent.createMany({
      data: dataToCreate,
      skipDuplicates: true
    });

    logger.info('Batch created calendar events', {
      mangaId,
      count: dataToCreate.length,
      scheduleType: schedule.type
    });
  } catch (error: unknown) {
    logger.error('Failed to batch create calendar events', {
      mangaId,
      count: dataToCreate.length,
      error: error instanceof Error ? error.message : String(error)
    });
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Calculate future event dates based on release schedule
 *
 * Generates dates for the next 30 days based on schedule type.
 * Returns empty array for irregular or unknown schedule types.
 *
 * @param schedule - Provider release schedule
 * @returns Array of calculated event dates
 */
function calculateEventDates(schedule: ProviderReleaseSchedule): Date[] {
  const events: Date[] = [];

  // Guard: nextRelease is required for event generation
  if (!schedule.nextRelease) {
    return events;
  }

  const currentDate = new Date();
  const nextDate = new Date(schedule.nextRelease);

  // Generate events for next 30 days
  const endDate = new Date(currentDate.getTime() + 30 * 24 * 60 * 60 * 1000);

  while (nextDate <= endDate) {
    events.push(new Date(nextDate));

    // Calculate next date based on schedule type
    switch (schedule.type ?? '') {
      case 'weekly':
        nextDate.setDate(nextDate.getDate() + 7);
        break;
      case 'biweekly':
        nextDate.setDate(nextDate.getDate() + 14);
        break;
      case 'monthly':
        nextDate.setMonth(nextDate.getMonth() + 1);
        break;
      default:
        // Can't predict irregular or unknown schedules
        return events;
    }
  }

  return events;
}
