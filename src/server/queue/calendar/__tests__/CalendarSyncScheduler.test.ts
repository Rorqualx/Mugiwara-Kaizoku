// Mock dependencies - define mocks inside factories to avoid hoisting issues
// These must come before any imports of mocked modules
jest.mock('@/server/db', () => ({
  prisma: {
    manga: {
      findUnique: jest.fn(),
      findMany: jest.fn()
    },
    chapter: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      createMany: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
      count: jest.fn(),
    },
    config: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      upsert: jest.fn(),
      delete: jest.fn()
    },
    calendarEvent: {
      create: jest.fn(),
      createMany: jest.fn().mockResolvedValue({ count: 0 }),
    }
  }
}));

// Define mock adapter at module scope for access in tests
const mockCalendarAniListAdapter = {
  isEnabled: jest.fn(() => true),
  getLatestChapters: jest.fn(() => Promise.resolve([])),
  dispose: jest.fn()
};

// Mock calendar provider adapters - use the module-scoped mock
jest.mock('@/server/services/calendar/CalendarProviderAdapters', () => ({
  CalendarAniListAdapter: jest.fn(() => mockCalendarAniListAdapter)
}));

jest.mock('../../../services/calendar/ReleaseScheduleService', () => ({
  ReleaseScheduleService: jest.fn()
}));
jest.mock('../../../services/calendar/CalendarEventService', () => ({
  CalendarEventService: jest.fn().mockImplementation(() => ({
    // Event retrieval
    getEvent: jest.fn(),
    getEventsForDateRange: jest.fn(),
    getUpcomingEvents: jest.fn(),
    getMangaEvents: jest.fn(),
    getOverdueEvents: jest.fn(),
    getDelayedEvents: jest.fn(),

    // Event management
    createEvent: jest.fn(),
    updateEvent: jest.fn(),
    deleteEvent: jest.fn(),

    // Special operations
    generateFutureEvents: jest.fn(),
    reconcileEvents: jest.fn(),
    cleanupOldEvents: jest.fn(),
    confirmRelease: jest.fn(),
    updateEventStatus: jest.fn()
  }))
}));
jest.mock('../../../services/notifications/ReleaseNotificationService', () => ({
  ReleaseNotificationService: jest.fn()
}));
jest.mock('../../../config/calendar-providers', () => ({
  isProviderEnabled: jest.fn(),
  getProviderConfig: jest.fn(),
  checkRateLimit: jest.fn(),
  incrementRateLimit: jest.fn(),
  decrementActiveRequests: jest.fn(),
  waitForRateLimit: jest.fn()
}));
jest.mock('../../../../utils/system-events', () => ({
  systemEvents: {
    emit: jest.fn(),
    on: jest.fn()
  },
  logReleaseDetected: jest.fn(),
  logPatternUpdated: jest.fn(),
  logCalendarSyncComplete: jest.fn()
}));
const mockChildLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  child: jest.fn(),
};
mockChildLogger.child.mockReturnValue(mockChildLogger);

jest.mock('../../../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    child: jest.fn(() => mockChildLogger),
  },
  createLogger: jest.fn(() => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    child: jest.fn(() => mockChildLogger),
  }))
}));

// Import after mocks are set up
import * as calendarProviders from '@/server/config/calendar-providers';
import { prisma } from '@/server/db';
import { CalendarAniListAdapter } from '@/server/services/calendar/CalendarProviderAdapters';

import { CalendarSyncScheduler } from '../CalendarSyncScheduler';

// Cast for proper typing
const MockCalendarAniListAdapterConstructor = CalendarAniListAdapter as jest.Mock;

describe('CalendarSyncScheduler', () => {
  let scheduler: CalendarSyncScheduler;

  beforeEach(() => {
    // Clear all mocks EXCEPT the adapter mock implementations
    jest.clearAllMocks();

    // Restore adapter mock implementations after clearAllMocks
    (mockCalendarAniListAdapter.isEnabled as jest.Mock).mockImplementation(() => true);
    (mockCalendarAniListAdapter.getLatestChapters as jest.Mock).mockImplementation(() => Promise.resolve([]));
    (mockCalendarAniListAdapter.dispose as jest.Mock).mockImplementation(() => {});

    scheduler = new CalendarSyncScheduler();

    // Mock provider config
    (calendarProviders.isProviderEnabled as jest.Mock).mockResolvedValue(true);
    (calendarProviders.getProviderConfig as jest.Mock).mockResolvedValue({
      enabled: true,
      config: {
        apiEndpoint: 'https://api.example.com'
      }
    });

    // Mock rate limit functions
    (calendarProviders.checkRateLimit as jest.Mock).mockResolvedValue(true);
    (calendarProviders.incrementRateLimit as jest.Mock).mockReturnValue(undefined);
    (calendarProviders.decrementActiveRequests as jest.Mock).mockReturnValue(undefined);
    (calendarProviders.waitForRateLimit as jest.Mock).mockResolvedValue(undefined);
  });

  describe('checkForNewReleases', () => {
    it('should detect new chapters from AniList', async () => {
      // Mock manga data (only fields that are selected in the query)
      const mockManga = {
        title: 'Test Manga',
        source: 'anilist',
        providerMetadata: { id: '12345' },
        metadataId: null
      };

      // Mock latest chapter
      const mockLatestChapter = {
        index: 10,
        createdAt: new Date('2025-01-01'),
        releaseDate: new Date('2025-01-01')
      };

      // Mock new chapters from provider
      const mockNewChapters = [
      {
        id: 1,
        mangaId: 1,
        index: 11,
        title: 'Chapter 11',
        releaseDate: new Date('2025-01-08'),
        fileName: 'chapter-11',
        size: 0,
        createdAt: new Date('2025-01-08'),
        updatedAt: new Date('2025-01-08')
      },
      {
        id: 2,
        mangaId: 1,
        index: 12,
        title: 'Chapter 12',
        releaseDate: new Date('2025-01-15'),
        fileName: 'chapter-12',
        size: 0,
        createdAt: new Date('2025-01-15'),
        updatedAt: new Date('2025-01-15')
      }];

      // Setup mocks
      (prisma.manga.findUnique as jest.Mock).mockResolvedValue(mockManga);
      (prisma.chapter.findFirst as jest.Mock).mockResolvedValue(mockLatestChapter);
      (prisma.chapter.createMany as jest.Mock).mockResolvedValue({ count: 2 });

      // Setup adapter mock
      (mockCalendarAniListAdapter.getLatestChapters as jest.Mock).mockResolvedValue(mockNewChapters as never);

      // Call private method via reflection (for testing)
      const schedulerRecord = scheduler as unknown as Record<string, unknown>;
      const checkForNewReleases = schedulerRecord['checkForNewReleases'] as (mangaId: number) => Promise<unknown[]>;
      const result = await checkForNewReleases.call(scheduler, 1);

      // Verify results
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        chapterNumber: '11',
        releaseDate: new Date('2025-01-08')
      });
      expect(result[1]).toEqual({
        chapterNumber: '12',
        releaseDate: new Date('2025-01-15')
      });

      // Verify adapter was created
      expect(MockCalendarAniListAdapterConstructor).toHaveBeenCalled();

      // Verify provider was called
      expect(mockCalendarAniListAdapter.getLatestChapters).toHaveBeenCalledWith('12345', '10');

      // Verify chapters were created
      expect(prisma.chapter.createMany).toHaveBeenCalledTimes(1);
    });

    it('should handle provider errors gracefully', async () => {
      const mockManga = {
        title: 'Test Manga',
        source: 'anilist',
        providerMetadata: { id: '12345' },
        metadataId: null
      };

      (prisma.manga.findUnique as jest.Mock).mockResolvedValue(mockManga);
      (prisma.chapter.findFirst as jest.Mock).mockResolvedValue(null);

      // Mock provider error
      (mockCalendarAniListAdapter.getLatestChapters as jest.Mock).mockRejectedValue(new Error('Provider error'));

      const schedulerRecord = scheduler as unknown as Record<string, unknown>;
      const checkForNewReleases = schedulerRecord['checkForNewReleases'] as (mangaId: number) => Promise<unknown[]>;
      const result = await checkForNewReleases.call(scheduler, 1);

      // Should return empty array on error
      expect(result).toEqual([]);
    });

    it('should skip disabled providers', async () => {
      const mockManga = {
        title: 'Test Manga',
        source: 'anilist',
        providerMetadata: { id: '12345' },
        metadataId: null
      };

      (prisma.manga.findUnique as jest.Mock).mockResolvedValue(mockManga);
      (calendarProviders.isProviderEnabled as jest.Mock).mockResolvedValue(false);

      const schedulerRecord = scheduler as unknown as Record<string, unknown>;
      const checkForNewReleases = schedulerRecord['checkForNewReleases'] as (mangaId: number) => Promise<unknown[]>;
      const result = await checkForNewReleases.call(scheduler, 1);

      // Should return empty array for disabled provider
      expect(result).toEqual([]);
      expect(mockCalendarAniListAdapter.getLatestChapters).not.toHaveBeenCalled();
    });

    it('should handle AniList provider', async () => {
      const mockManga = {
        title: 'Test Manga',
        source: 'anilist',
        providerMetadata: { id: '12345' },
        metadataId: null
      };

      (prisma.manga.findUnique as jest.Mock).mockResolvedValue(mockManga);
      (prisma.chapter.findFirst as jest.Mock).mockResolvedValue(null);

      (mockCalendarAniListAdapter.getLatestChapters as jest.Mock).mockResolvedValue([]);

      const schedulerRecord = scheduler as unknown as Record<string, unknown>;
      const checkForNewReleases = schedulerRecord['checkForNewReleases'] as (mangaId: number) => Promise<unknown[]>;
      await checkForNewReleases.call(scheduler, 1);

      expect(mockCalendarAniListAdapter.getLatestChapters as jest.Mock).toHaveBeenCalled();
    });
  });

  describe('isChapterNewer', () => {
    it('should compare numeric chapters correctly', () => {
      const schedulerRecord = scheduler as unknown as Record<string, unknown>;
      const isChapterNewer = schedulerRecord['isChapterNewer'] as (newChapter: string, currentChapter: string) => boolean;
      expect(isChapterNewer('11', '10')).toBe(true);
      expect(isChapterNewer('10.5', '10')).toBe(true);
      expect(isChapterNewer('9', '10')).toBe(false);
      expect(isChapterNewer('10', '10')).toBe(false);
    });

    it('should handle non-numeric chapters', () => {
      const schedulerRecord = scheduler as unknown as Record<string, unknown>;
      const isChapterNewer = schedulerRecord['isChapterNewer'] as (newChapter: string, currentChapter: string) => boolean;
      expect(isChapterNewer('Chapter 11', 'Chapter 10')).toBe(true);
      expect(isChapterNewer('Special', 'Chapter 10')).toBe(true);
      expect(isChapterNewer('Chapter 9', 'Chapter 10')).toBe(false);
    });
  });

  describe('lifecycle', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should start and stop correctly', async () => {
      const schedulerRecord = scheduler as unknown as Record<string, unknown>;
      await scheduler.start();
      expect(schedulerRecord['isRunning']).toBe(true);
      expect(schedulerRecord['syncInterval']).toBeDefined();

      await scheduler.stop();
      expect(schedulerRecord['isRunning']).toBe(false);
      expect(schedulerRecord['syncInterval']).toBeNull();
    });

    it('should not start twice', async () => {
      const schedulerRecord = scheduler as unknown as Record<string, unknown>;
      await scheduler.start();
      const firstInterval = schedulerRecord['syncInterval'];

      await scheduler.start();
      expect(schedulerRecord['syncInterval']).toBe(firstInterval);
    });
  });
});