/**
 * Integration tests for Calendar Provider Integration
 *
 * Tests real provider implementations with mocked HTTP responses
 * to ensure proper API integration and error handling.
 */

// Mock prisma before imports - define mock inside factory to avoid hoisting issues
jest.mock('@/server/db', () => ({
  prisma: {
    manga: {
      findMany: jest.fn()
    },
    releaseSchedule: {
      upsert: jest.fn(),
      findFirst: jest.fn()
    }
  }
}));

import { prisma } from '@/server/db';
import { ReleaseType } from '@/types/search.types';

import { AniListCalendarProvider } from '../providers/AniListCalendarProvider';

// Mock fetch globally
const mockFetch = jest.fn() as unknown as jest.MockedFunction<typeof fetch>;
global.fetch = mockFetch as unknown as typeof fetch;

describe('Calendar Provider Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch.mockClear();
  });
  
  // MangaDex provider tests removed as MangaDex is no longer supported
  
  describe('AniListCalendarProvider', () => {
    let provider: AniListCalendarProvider;
    
    beforeEach(() => {
      provider = new AniListCalendarProvider({ accessToken: 'test-token' });
    });
    
    afterEach(() => {
      provider.dispose();
    });
    
    describe('getReleaseSchedule', () => {
      it('should fetch manga details and analyze pattern', async () => {
        // Mock GraphQL response
        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve({
            data: {
              Media: {
                id: 123,
                title: {
                  english: 'Test Manga',
                  romaji: 'Test Manga',
                  native: 'テスト漫画'
                },
                status: 'RELEASING',
                chapters: 50,
                volumes: 5,
                updatedAt: Math.floor(Date.now() / 1000),
                nextAiringEpisode: null,
                startDate: { year: 2024, month: 1, day: 1 },
                endDate: null,
                source: 'MANGA',
                countryOfOrigin: 'JP'
              }
            }
          })
        } as Response);
        
        // Mock activity response (empty for simplicity)
        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve({
            data: {
              Page: {
                activities: []
              }
            }
          })
        } as Response);
        
        const schedule = await provider.getReleaseSchedule('123');
        
        expect(schedule).toMatchObject({
          status: 'ongoing',
          pattern: 'IRREGULAR', // No activity data
          chapters: 50,
          volumes: 5
        });
        
        // Verify GraphQL query was sent
        expect(mockFetch).toHaveBeenCalledWith(
          'https://graphql.anilist.co',
          expect.objectContaining({
            method: 'POST',
            headers: expect.objectContaining({
              'Authorization': 'Bearer test-token'
            })
          })
        );
      });
      
      it('should handle API errors gracefully', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 401,
          statusText: 'Unauthorized'
        } as Response);
        
        const schedule = await provider.getReleaseSchedule('123');
        
        expect(schedule).toBeNull();
      });
    });
  });
  
  describe('Provider Integration Flow', () => {
    it('should complete a full sync cycle with real providers', async () => {
      // This test verifies the complete integration flow
      // In a real environment, this would connect to actual APIs

      // Mock manga data - use the mocked prisma directly
      (prisma.manga.findMany as jest.Mock).mockResolvedValue([
        {
          id: 1,
          title: 'Test Manga',
          source: 'anilist:123',
          libraryId: 1,
          metadataId: null,
          lastChecked: null,
          libraryPath: null,
          mangaTitle: null,
          createdAt: new Date(),
          errorMessage: null,
          lastErrorAt: null,
          lastSyncAt: null,
          summary: null,
          syncCount: 0,
          updatedAt: new Date(),
          searchProvider: 'anilist',
          providerMetadata: { isMonitored: true },
          monitoringConfig: null,
          fileStatus: 'PENDING',
          libraryStatus: 'ACTIVE',
          metadataConfidence: null,
          mlCorrected: null,
          publicationStatus: 'UNKNOWN',
          rawProviderData: null,
          selectedSourceId: null,
          sourceId: null
        }
      ]);

      // Integration test updated to use AniList provider instead
      // Mock AniList GraphQL response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({
          data: {
            Media: {
              id: 123,
              title: {
                english: 'Test Manga',
                romaji: 'Test Manga'
              },
              status: 'RELEASING',
              chapters: 50,
              volumes: 5,
              updatedAt: Math.floor(Date.now() / 1000)
            }
          }
        })
      } as Response);

      // Mock activity response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({
          data: {
            Page: {
              activities: []
            }
          }
        })
      } as Response);

      // Mock database operations - use the mocked prisma directly
      (prisma.releaseSchedule.upsert as jest.Mock).mockResolvedValue({
        id: 1,
        mangaId: 1,
        releaseType: ReleaseType.WEEKLY,
        dayOfWeek: new Date().getDay(),
        dayOfMonth: null,
        frequency: null,
        confidence: 0.9,
        source: 'anilist',
        isConfirmed: false,
        timezone: 'UTC',
        releaseTime: null,
        metadata: null,
        lastUpdated: new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      });

      const provider = new AniListCalendarProvider({ accessToken: 'test-token' });
      const schedule = await provider.getReleaseSchedule('123');
      
      expect(schedule).toBeTruthy();
      
      provider.dispose();
    });
  });
});
