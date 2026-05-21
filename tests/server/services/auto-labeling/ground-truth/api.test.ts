/**
 * Ground Truth API Tests
 *
 * Tests for fetchAnilistMetadata function (with mocked fetch).
 *
 * @module tests/auto-labeling/ground-truth/api
 */

import { fetchAnilistMetadata } from '@/server/services/auto-labeling/ground-truth';

// ============================================================================
// Mock Data
// ============================================================================

const MOCK_ANILIST_RESPONSE_SUCCESS = {
  data: {
    Media: {
      id: 21,
      title: {
        romaji: 'One Piece',
        english: 'One Piece',
        native: 'ワンピース',
      },
      status: 'RELEASING',
      description: 'Monkey D. Luffy wants to become the King of Pirates.',
      volumes: 107,
      chapters: 1100,
      genres: ['Action', 'Adventure', 'Comedy'],
      staff: {
        edges: [
          {
            role: 'Story & Art',
            node: { name: { full: 'Eiichiro Oda' } },
          },
        ],
      },
      startDate: { year: 1997, month: 7, day: 22 },
      coverImage: {
        large: 'https://s4.anilist.co/file/anilistcdn/media/manga/cover/large/bx21-UzVFLACLh8F7.jpg',
        medium: null,
      },
      format: 'MANGA',
      isAdult: false,
    },
  },
};

const MOCK_ANILIST_RESPONSE_MINIMAL = {
  data: {
    Media: {
      id: 100,
      title: {
        romaji: 'Test Manga',
        english: null,
        native: null,
      },
      status: null,
      description: null,
      volumes: null,
      chapters: null,
      genres: null,
      staff: null,
      startDate: null,
      coverImage: null,
      format: null,
      isAdult: false,
    },
  },
};

const MOCK_ANILIST_RESPONSE_NOT_FOUND = {
  data: { Media: null },
};

const MOCK_ANILIST_RESPONSE_ERROR = {
  errors: [{ message: 'Media not found' }],
};

// ============================================================================
// Test Setup
// ============================================================================

describe('fetchAnilistMetadata', () => {
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  // ============================================================================
  // Success Cases
  // ============================================================================

  describe('successful responses', () => {
    it('should return success result with complete metadata', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(MOCK_ANILIST_RESPONSE_SUCCESS),
      }) as unknown as typeof fetch;

      const result = await fetchAnilistMetadata(21);

      expect(result.success).toBe(true);
      expect(result.metadata).not.toBeNull();
      expect(result.metadata?.anilistId).toBe(21);
    });

    it('should extract title information correctly', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(MOCK_ANILIST_RESPONSE_SUCCESS),
      }) as unknown as typeof fetch;

      const result = await fetchAnilistMetadata(21);

      expect(result.metadata?.titles.romaji).toBe('One Piece');
      expect(result.metadata?.titles.english).toBe('One Piece');
      expect(result.metadata?.titles.native).toBe('ワンピース');
    });

    it('should extract author from staff edges', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(MOCK_ANILIST_RESPONSE_SUCCESS),
      }) as unknown as typeof fetch;

      const result = await fetchAnilistMetadata(21);

      expect(result.metadata?.author).toBe('Eiichiro Oda');
    });

    it('should normalize status to lowercase', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(MOCK_ANILIST_RESPONSE_SUCCESS),
      }) as unknown as typeof fetch;

      const result = await fetchAnilistMetadata(21);

      expect(result.metadata?.status).toBe('ongoing');
    });

    it('should extract volume and chapter counts', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(MOCK_ANILIST_RESPONSE_SUCCESS),
      }) as unknown as typeof fetch;

      const result = await fetchAnilistMetadata(21);

      expect(result.metadata?.volumeCount).toBe(107);
      expect(result.metadata?.chapterCount).toBe(1100);
    });

    it('should extract genres', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(MOCK_ANILIST_RESPONSE_SUCCESS),
      }) as unknown as typeof fetch;

      const result = await fetchAnilistMetadata(21);

      expect(result.metadata?.genres).toEqual(['Action', 'Adventure', 'Comedy']);
    });

    it('should extract release year from startDate', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(MOCK_ANILIST_RESPONSE_SUCCESS),
      }) as unknown as typeof fetch;

      const result = await fetchAnilistMetadata(21);

      expect(result.metadata?.releaseYear).toBe(1997);
    });

    it('should extract cover image', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(MOCK_ANILIST_RESPONSE_SUCCESS),
      }) as unknown as typeof fetch;

      const result = await fetchAnilistMetadata(21);

      expect(result.metadata?.coverImage).toContain('anilist');
    });

    it('should build expected entities', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(MOCK_ANILIST_RESPONSE_SUCCESS),
      }) as unknown as typeof fetch;

      const result = await fetchAnilistMetadata(21);

      expect(result.expectedEntities).toBeDefined();
      expect(result.expectedEntities.length).toBeGreaterThan(0);
    });

    it('should include TITLE entity in expected entities', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(MOCK_ANILIST_RESPONSE_SUCCESS),
      }) as unknown as typeof fetch;

      const result = await fetchAnilistMetadata(21);
      const titleEntity = result.expectedEntities.find(e => e.type === 'TITLE');

      expect(titleEntity).toBeDefined();
      expect(titleEntity?.value).toBe('One Piece');
    });
  });

  // ============================================================================
  // Minimal Data
  // ============================================================================

  describe('minimal data responses', () => {
    it('should handle minimal metadata', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(MOCK_ANILIST_RESPONSE_MINIMAL),
      }) as unknown as typeof fetch;

      const result = await fetchAnilistMetadata(100);

      expect(result.success).toBe(true);
      expect(result.metadata).not.toBeNull();
    });

    it('should handle null optional fields', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(MOCK_ANILIST_RESPONSE_MINIMAL),
      }) as unknown as typeof fetch;

      const result = await fetchAnilistMetadata(100);

      expect(result.metadata?.author).toBeNull();
      expect(result.metadata?.artist).toBeNull();
      expect(result.metadata?.volumeCount).toBeNull();
      expect(result.metadata?.chapterCount).toBeNull();
    });

    it('should return empty array for null genres', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(MOCK_ANILIST_RESPONSE_MINIMAL),
      }) as unknown as typeof fetch;

      const result = await fetchAnilistMetadata(100);

      expect(result.metadata?.genres).toEqual([]);
    });
  });

  // ============================================================================
  // Error Cases
  // ============================================================================

  describe('error responses', () => {
    it('should return error for non-existent media', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(MOCK_ANILIST_RESPONSE_NOT_FOUND),
      }) as unknown as typeof fetch;

      const result = await fetchAnilistMetadata(99999);

      expect(result.success).toBe(false);
      expect(result.error).toContain('No media found');
    });

    it('should return error for GraphQL errors', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(MOCK_ANILIST_RESPONSE_ERROR),
      }) as unknown as typeof fetch;

      const result = await fetchAnilistMetadata(99999);

      expect(result.success).toBe(false);
      expect(result.error).toContain('GraphQL error');
    });

    it('should return error for HTTP error', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      }) as unknown as typeof fetch;

      const result = await fetchAnilistMetadata(21);

      expect(result.success).toBe(false);
      expect(result.error).toContain('500');
    });

    it('should return error for network failure', async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error('Network error')) as unknown as typeof fetch;

      const result = await fetchAnilistMetadata(21);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Network error');
    });

    it('should return empty expectedEntities on error', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(MOCK_ANILIST_RESPONSE_NOT_FOUND),
      }) as unknown as typeof fetch;

      const result = await fetchAnilistMetadata(99999);

      expect(result.expectedEntities).toEqual([]);
    });

    it('should return null metadata on error', async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error('Network error')) as unknown as typeof fetch;

      const result = await fetchAnilistMetadata(21);

      expect(result.metadata).toBeNull();
    });
  });

  // ============================================================================
  // Staff Role Extraction
  // ============================================================================

  describe('staff role extraction', () => {
    it('should extract author from "Story" role', async () => {
      const response = {
        data: {
          Media: {
            ...MOCK_ANILIST_RESPONSE_SUCCESS.data.Media,
            staff: {
              edges: [
                { role: 'Story', node: { name: { full: 'Writer Name' } } },
                { role: 'Art', node: { name: { full: 'Artist Name' } } },
              ],
            },
          },
        },
      };

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(response),
      }) as unknown as typeof fetch;

      const result = await fetchAnilistMetadata(21);

      expect(result.metadata?.author).toBe('Writer Name');
      expect(result.metadata?.artist).toBe('Artist Name');
    });

    it('should extract author from "Original Creator" role', async () => {
      const response = {
        data: {
          Media: {
            ...MOCK_ANILIST_RESPONSE_SUCCESS.data.Media,
            staff: {
              edges: [
                { role: 'Original Creator', node: { name: { full: 'Creator Name' } } },
              ],
            },
          },
        },
      };

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(response),
      }) as unknown as typeof fetch;

      const result = await fetchAnilistMetadata(21);

      expect(result.metadata?.author).toBe('Creator Name');
    });

    it('should handle empty staff edges', async () => {
      const response = {
        data: {
          Media: {
            ...MOCK_ANILIST_RESPONSE_SUCCESS.data.Media,
            staff: { edges: [] },
          },
        },
      };

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(response),
      }) as unknown as typeof fetch;

      const result = await fetchAnilistMetadata(21);

      expect(result.metadata?.author).toBeNull();
      expect(result.metadata?.artist).toBeNull();
    });
  });

  // ============================================================================
  // Status Normalization
  // ============================================================================

  describe('status normalization', () => {
    it.each([
      ['RELEASING', 'ongoing'],
      ['FINISHED', 'completed'],
      ['HIATUS', 'hiatus'],
      ['CANCELLED', 'cancelled'],
      ['NOT_YET_RELEASED', 'upcoming'],
    ])('should normalize %s to %s', async (input, expected) => {
      const response = {
        data: {
          Media: {
            ...MOCK_ANILIST_RESPONSE_SUCCESS.data.Media,
            status: input,
          },
        },
      };

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(response),
      }) as unknown as typeof fetch;

      const result = await fetchAnilistMetadata(21);

      expect(result.metadata?.status).toBe(expected);
    });
  });
});
