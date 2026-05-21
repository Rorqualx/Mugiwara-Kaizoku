/**
 * Tests for ReleaseNotificationService
 *
 * Validates that release/upcoming/delay/pattern-change events flow through the
 * unified `notifySystem` helper (which persists bell rows + fans out to
 * external channels). The test mocks `notifySystem` and asserts on its call
 * shape rather than on the legacy NotificationService.send signature.
 */

import { CalendarEventType, EventStatus } from '@prisma/client';
import { addDays, startOfDay, endOfDay } from 'date-fns';

import { prisma } from '@/server/db';
import type { CalendarEventService } from '@/server/services/calendar/CalendarEventService';
import {
  createSuccessResult,
  isSuccess,
  isError
} from '@/utils/async-result';


import { notifySystem } from '../notify';
import { ReleaseNotificationService } from '../ReleaseNotificationService';

import type { CalendarEvent } from '@prisma/client';


// Mock dependencies
// NOTE: Bun requires factory functions for jest.mock()
jest.mock('../../calendar/CalendarEventService', () => ({
  CalendarEventService: jest.fn().mockImplementation(() => ({
    getEvent: jest.fn(),
    getEventsForDateRange: jest.fn(),
    getUpcomingEvents: jest.fn(),
    getMangaEvents: jest.fn(),
    getOverdueEvents: jest.fn(),
    getDelayedEvents: jest.fn(),
    createEvent: jest.fn(),
    updateEvent: jest.fn(),
    deleteEvent: jest.fn(),
    generateFutureEvents: jest.fn(),
    reconcileEvents: jest.fn(),
    cleanupOldEvents: jest.fn(),
    confirmRelease: jest.fn(),
    updateEventStatus: jest.fn()
  }))
}));
jest.mock('../notify', () => ({
  notifySystem: jest.fn().mockResolvedValue(undefined),
  notifyUser: jest.fn().mockResolvedValue(null),
}));
jest.mock('@/server/db', () => ({
  prisma: {
    manga: {
      findUnique: jest.fn()
    }
  }
}));

const mockNotifySystem = notifySystem as jest.MockedFunction<typeof notifySystem>;

describe('ReleaseNotificationService', () => {
  let service: ReleaseNotificationService;
  let mockEventService: jest.Mocked<CalendarEventService>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockNotifySystem.mockResolvedValue(undefined);

    service = new ReleaseNotificationService();
    const serviceAsRecord = service as unknown as Record<string, unknown>;
    mockEventService = serviceAsRecord['eventService'] as jest.Mocked<CalendarEventService>;
  });

  describe('sendDailyUpcomingNotifications', () => {
    it('should send notifications for high-confidence upcoming releases', async () => {
      const tomorrow = addDays(new Date(), 1);
      const upcomingEvents: CalendarEvent[] = [
        {
          id: 1,
          mangaId: 123,
          chapterId: null,
          eventType: CalendarEventType.CHAPTER_RELEASE,
          scheduledDate: tomorrow,
          actualDate: null,
          status: EventStatus.SCHEDULED,
          confidence: 0.9,
          title: 'One Piece Chapter 1100',
          description: null,
          color: null,
          source: null,
          metadata: { chapterNumber: '1100' },
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          id: 2,
          mangaId: 456,
          chapterId: null,
          eventType: CalendarEventType.CHAPTER_RELEASE,
          scheduledDate: tomorrow,
          actualDate: null,
          status: EventStatus.CONFIRMED,
          confidence: 1.0,
          title: 'Attack on Titan Chapter 140',
          description: null,
          color: null,
          source: null,
          metadata: { chapterNumber: '140' },
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];

      mockEventService.getEventsForDateRange.mockResolvedValue(
        createSuccessResult(upcomingEvents)
      );

      (prisma.manga.findUnique as jest.Mock)
        .mockResolvedValueOnce({ id: 123, title: 'One Piece' })
        .mockResolvedValueOnce({ id: 456, title: 'Attack on Titan' });

      const result = await service.sendDailyUpcomingNotifications();

      expect(isSuccess(result)).toBe(true);
      if (isSuccess(result)) {
        expect(result.data).toEqual({ sent: 2, failed: 0, errors: [] });
      }

      expect(mockEventService.getEventsForDateRange).toHaveBeenCalledWith(
        startOfDay(tomorrow),
        endOfDay(tomorrow),
        {
          eventTypes: [CalendarEventType.CHAPTER_RELEASE],
          status: [EventStatus.SCHEDULED, EventStatus.CONFIRMED],
          minConfidence: 0.7
        }
      );

      expect(mockNotifySystem).toHaveBeenCalledTimes(2);
      expect(mockNotifySystem).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'CHAPTER_ADDED',
          title: 'New chapter tomorrow: One Piece',
          message: 'Chapter 1100 is expected to release tomorrow'
        })
      );
    });

    it('should handle notification failures gracefully', async () => {
      const tomorrow = addDays(new Date(), 1);
      const upcomingEvents: CalendarEvent[] = [
        {
          id: 1,
          mangaId: 123,
          chapterId: null,
          eventType: CalendarEventType.CHAPTER_RELEASE,
          scheduledDate: tomorrow,
          actualDate: null,
          status: EventStatus.SCHEDULED,
          confidence: 0.8,
          title: 'Test Manga Chapter 10',
          description: null,
          color: null,
          source: null,
          metadata: null,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];

      mockEventService.getEventsForDateRange.mockResolvedValue(
        createSuccessResult(upcomingEvents)
      );

      (prisma.manga.findUnique as jest.Mock).mockResolvedValue({
        id: 123,
        title: 'Test Manga'
      });

      mockNotifySystem.mockRejectedValueOnce(new Error('Notification service unavailable'));

      const result = await service.sendDailyUpcomingNotifications();

      expect(isSuccess(result)).toBe(true);
      if (isSuccess(result)) {
        expect(result.data).toEqual({
          sent: 0,
          failed: 1,
          errors: ['Event 1: Notification service unavailable']
        });
      }
    });

    it('should skip low-confidence predictions', async () => {
      mockEventService.getEventsForDateRange.mockResolvedValue(
        createSuccessResult([]) // Empty result due to confidence filter
      );

      const result = await service.sendDailyUpcomingNotifications();

      expect(isSuccess(result)).toBe(true);
      if (isSuccess(result)) {
        expect(result.data.sent).toBe(0);
      }

      expect(prisma.manga.findUnique).not.toHaveBeenCalled();
      expect(mockNotifySystem).not.toHaveBeenCalled();
    });
  });

  describe('sendNewReleaseNotification', () => {
    it('should send notification and update event status', async () => {
      const releaseDate = new Date();
      const mangaId = 123;
      const chapterNumber = '50';

      (prisma.manga.findUnique as jest.Mock).mockResolvedValue({
        id: mangaId,
        title: 'Test Manga'
      });

      const scheduledEvent: CalendarEvent = {
        id: 1,
        mangaId,
        chapterId: null,
        eventType: CalendarEventType.CHAPTER_RELEASE,
        scheduledDate: releaseDate,
        actualDate: null,
        status: EventStatus.SCHEDULED,
        confidence: 0.9,
        title: `Test Manga Chapter ${chapterNumber}`,
        description: null,
        color: null,
        source: null,
        metadata: null,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockEventService.getEventsForDateRange.mockResolvedValue(
        createSuccessResult([scheduledEvent])
      );

      mockEventService.confirmRelease.mockResolvedValue(
        createSuccessResult(undefined)
      );

      const result = await service.sendNewReleaseNotification(
        mangaId,
        chapterNumber,
        releaseDate
      );

      expect(isSuccess(result)).toBe(true);
      expect(mockEventService.confirmRelease).toHaveBeenCalledWith(1, releaseDate);

      expect(mockNotifySystem).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'CHAPTER_ADDED',
          severity: 'SUCCESS',
          title: 'New chapter released: Test Manga',
          message: `Chapter ${chapterNumber} is now available`,
          actionUrl: `/manga/${mangaId}/chapters`,
        })
      );
    });
  });

  describe('sendDelayNotifications', () => {
    it('should notify about delayed releases', async () => {
      const now = new Date();
      const pastDate = addDays(now, -3);

      const delayedEvents: CalendarEvent[] = [
        {
          id: 1,
          mangaId: 123,
          chapterId: null,
          eventType: CalendarEventType.CHAPTER_RELEASE,
          scheduledDate: pastDate,
          actualDate: null,
          status: EventStatus.SCHEDULED,
          confidence: 0.9,
          title: 'Delayed Chapter',
          description: null,
          color: null,
          source: null,
          metadata: { chapterNumber: '25' },
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];

      mockEventService.getOverdueEvents.mockResolvedValue(
        createSuccessResult(delayedEvents)
      );

      (prisma.manga.findUnique as jest.Mock).mockResolvedValue({
        id: 123,
        title: 'Test Manga'
      });

      mockEventService.updateEventStatus.mockResolvedValue(
        createSuccessResult(undefined)
      );

      const result = await service.sendDelayNotifications();

      expect(isSuccess(result)).toBe(true);
      if (isSuccess(result)) {
        expect(result.data).toEqual({ sent: 1, failed: 0, errors: [] });
      }

      expect(mockNotifySystem).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'SYSTEM_WARNING',
          severity: 'WARNING',
          title: 'Release delayed: Test Manga',
          message: 'Chapter 25 is 3 days late',
          metadata: expect.objectContaining({ delayDays: 3 })
        })
      );

      expect(mockEventService.updateEventStatus).toHaveBeenCalledWith(
        1,
        EventStatus.DELAYED
      );
    });
  });

  describe('sendPatternChangeNotification', () => {
    it('should notify when release pattern changes', async () => {
      (prisma.manga.findUnique as jest.Mock).mockResolvedValue({
        id: 123,
        title: 'Test Manga'
      });

      const result = await service.sendPatternChangeNotification(
        123,
        'WEEKLY',
        'BIWEEKLY',
        0.85
      );

      expect(isSuccess(result)).toBe(true);

      expect(mockNotifySystem).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'METADATA_UPDATED',
          title: 'Release schedule updated: Test Manga',
          message: 'Release pattern changed from weekly to bi-weekly (85% confident)',
          metadata: {
            mangaId: 123,
            oldPattern: 'WEEKLY',
            newPattern: 'BIWEEKLY',
            confidence: 0.85
          }
        })
      );
    });

    it('should handle hiatus notifications', async () => {
      (prisma.manga.findUnique as jest.Mock).mockResolvedValue({
        id: 123,
        title: 'Test Manga'
      });

      const result = await service.sendPatternChangeNotification(
        123,
        'WEEKLY',
        'HIATUS',
        1.0
      );

      expect(isSuccess(result)).toBe(true);

      expect(mockNotifySystem).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Release pattern changed from weekly to on hiatus (100% confident)'
        })
      );
    });
  });

  describe('error handling', () => {
    it('should handle database errors gracefully', async () => {
      mockEventService.getEventsForDateRange.mockRejectedValue(
        new Error('Database connection failed')
      );

      const result = await service.sendDailyUpcomingNotifications();

      expect(isError(result)).toBe(true);
      if (isError(result)) {
        expect(result.error instanceof Error ? result.error.message : String(result.error)).toBe('Database connection failed');
      }
    });

    it('should handle missing manga gracefully', async () => {
      (prisma.manga.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await service.sendNewReleaseNotification(999, '1', new Date());

      expect(isError(result)).toBe(true);
      if (isError(result)) {
        expect(result.error instanceof Error ? result.error.message : String(result.error)).toBe('Manga not found: 999');
      }
    });
  });
});
