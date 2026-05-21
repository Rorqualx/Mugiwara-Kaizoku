/**
 * Entity Building Tests
 *
 * Tests for buildExpectedEntities function.
 *
 * @module tests/auto-labeling/ground-truth/entity-building
 */

import { buildExpectedEntities } from '@/server/services/auto-labeling/ground-truth';

import type { GroundTruthMetadata } from '@/server/services/auto-labeling/ground-truth';

// ============================================================================
// Test Data
// ============================================================================

const METADATA_COMPLETE: GroundTruthMetadata = {
  anilistId: 21,
  titles: {
    romaji: 'One Piece',
    english: 'One Piece',
    native: 'ワンピース',
  },
  author: 'Eiichiro Oda',
  artist: null,
  status: 'ongoing',
  volumeCount: 107,
  chapterCount: 1100,
  genres: ['Action', 'Adventure', 'Comedy'],
  summary: 'Monkey D. Luffy wants to become the King of Pirates.',
  releaseYear: 1997,
  format: 'MANGA',
  coverImage: 'https://example.com/cover.jpg',
};

const METADATA_MINIMAL: GroundTruthMetadata = {
  anilistId: 100,
  titles: {
    romaji: 'Test Manga',
    english: null,
    native: null,
  },
  author: null,
  artist: null,
  status: null,
  volumeCount: null,
  chapterCount: null,
  genres: [],
  summary: null,
  releaseYear: null,
  format: null,
  coverImage: null,
};

const METADATA_DIFFERENT_AUTHOR_ARTIST: GroundTruthMetadata = {
  anilistId: 200,
  titles: {
    romaji: 'Death Note',
    english: 'Death Note',
    native: 'デスノート',
  },
  author: 'Tsugumi Ohba',
  artist: 'Takeshi Obata',
  status: 'completed',
  volumeCount: 12,
  chapterCount: 108,
  genres: ['Mystery', 'Psychological', 'Thriller'],
  summary: 'Light Yagami finds a notebook that can kill.',
  releaseYear: 2003,
  format: 'MANGA',
  coverImage: 'https://example.com/deathnote.jpg',
};

const METADATA_SAME_AUTHOR_ARTIST: GroundTruthMetadata = {
  anilistId: 300,
  titles: {
    romaji: 'Naruto',
    english: 'Naruto',
    native: 'ナルト',
  },
  author: 'Masashi Kishimoto',
  artist: 'Masashi Kishimoto',
  status: 'completed',
  volumeCount: 72,
  chapterCount: 700,
  genres: ['Action', 'Adventure'],
  summary: 'Naruto wants to be Hokage.',
  releaseYear: 1999,
  format: 'MANGA',
  coverImage: null,
};

// ============================================================================
// buildExpectedEntities Tests
// ============================================================================

describe('buildExpectedEntities', () => {
  describe('title entities', () => {
    it('should create TITLE entity from romaji title', () => {
      const entities = buildExpectedEntities(METADATA_COMPLETE);
      const titleEntity = entities.find(e => e.type === 'TITLE');

      expect(titleEntity).toBeDefined();
      expect(titleEntity?.value).toBe('One Piece');
      expect(titleEntity?.required).toBe(true);
    });

    it('should use english title when romaji is null', () => {
      const metadata: GroundTruthMetadata = {
        ...METADATA_MINIMAL,
        titles: { romaji: null, english: 'Test English', native: null },
      };

      const entities = buildExpectedEntities(metadata);
      const titleEntity = entities.find(e => e.type === 'TITLE');

      expect(titleEntity?.value).toBe('Test English');
    });

    it('should create ALT_TITLE from english when romaji exists', () => {
      const entities = buildExpectedEntities(METADATA_COMPLETE);
      const altTitles = entities.filter(e => e.type === 'ALT_TITLE');

      expect(altTitles.length).toBeGreaterThan(0);
      expect(altTitles.some(e => e.value === 'One Piece')).toBe(true);
    });

    it('should create ALT_TITLE from native title', () => {
      const entities = buildExpectedEntities(METADATA_COMPLETE);
      const altTitles = entities.filter(e => e.type === 'ALT_TITLE');

      expect(altTitles.some(e => e.value === 'ワンピース')).toBe(true);
    });

    it('should mark ALT_TITLE as not required', () => {
      const entities = buildExpectedEntities(METADATA_COMPLETE);
      const altTitles = entities.filter(e => e.type === 'ALT_TITLE');

      altTitles.forEach(e => {
        expect(e.required).toBe(false);
      });
    });
  });

  describe('author and artist entities', () => {
    it('should create AUTHOR entity when author exists', () => {
      const entities = buildExpectedEntities(METADATA_COMPLETE);
      const authorEntity = entities.find(e => e.type === 'AUTHOR');

      expect(authorEntity).toBeDefined();
      expect(authorEntity?.value).toBe('Eiichiro Oda');
      expect(authorEntity?.required).toBe(true);
    });

    it('should not create AUTHOR entity when author is null', () => {
      const entities = buildExpectedEntities(METADATA_MINIMAL);
      const authorEntity = entities.find(e => e.type === 'AUTHOR');

      expect(authorEntity).toBeUndefined();
    });

    it('should create ARTIST entity when different from author', () => {
      const entities = buildExpectedEntities(METADATA_DIFFERENT_AUTHOR_ARTIST);
      const artistEntity = entities.find(e => e.type === 'ARTIST');

      expect(artistEntity).toBeDefined();
      expect(artistEntity?.value).toBe('Takeshi Obata');
      expect(artistEntity?.required).toBe(false);
    });

    it('should not create ARTIST entity when same as author', () => {
      const entities = buildExpectedEntities(METADATA_SAME_AUTHOR_ARTIST);
      const artistEntity = entities.find(e => e.type === 'ARTIST');

      expect(artistEntity).toBeUndefined();
    });

    it('should not create ARTIST entity when artist is null', () => {
      const entities = buildExpectedEntities(METADATA_COMPLETE);
      const artistEntity = entities.find(e => e.type === 'ARTIST');

      expect(artistEntity).toBeUndefined();
    });
  });

  describe('status entity', () => {
    it('should create STATUS entity when status exists', () => {
      const entities = buildExpectedEntities(METADATA_COMPLETE);
      const statusEntity = entities.find(e => e.type === 'STATUS');

      expect(statusEntity).toBeDefined();
      expect(statusEntity?.value).toBe('ongoing');
      expect(statusEntity?.required).toBe(true);
    });

    it('should not create STATUS entity when status is null', () => {
      const entities = buildExpectedEntities(METADATA_MINIMAL);
      const statusEntity = entities.find(e => e.type === 'STATUS');

      expect(statusEntity).toBeUndefined();
    });
  });

  describe('count entities', () => {
    it('should create VOLUME_COUNT entity when volumeCount exists', () => {
      const entities = buildExpectedEntities(METADATA_COMPLETE);
      const volumeEntity = entities.find(e => e.type === 'VOLUME_COUNT');

      expect(volumeEntity).toBeDefined();
      expect(volumeEntity?.value).toBe('107');
      expect(volumeEntity?.required).toBe(true);
    });

    it('should create CHAPTER_COUNT entity when chapterCount exists', () => {
      const entities = buildExpectedEntities(METADATA_COMPLETE);
      const chapterEntity = entities.find(e => e.type === 'CHAPTER_COUNT');

      expect(chapterEntity).toBeDefined();
      expect(chapterEntity?.value).toBe('1100');
      expect(chapterEntity?.required).toBe(true);
    });

    it('should not create count entities when counts are null', () => {
      const entities = buildExpectedEntities(METADATA_MINIMAL);

      expect(entities.find(e => e.type === 'VOLUME_COUNT')).toBeUndefined();
      expect(entities.find(e => e.type === 'CHAPTER_COUNT')).toBeUndefined();
    });

    it('should handle zero counts', () => {
      const metadata: GroundTruthMetadata = {
        ...METADATA_MINIMAL,
        volumeCount: 0,
        chapterCount: 0,
      };

      const entities = buildExpectedEntities(metadata);

      // null check means 0 is treated as valid
      expect(entities.find(e => e.type === 'VOLUME_COUNT')).toBeDefined();
      expect(entities.find(e => e.type === 'CHAPTER_COUNT')).toBeDefined();
    });
  });

  describe('genre entities', () => {
    it('should create GENRE entities for each genre', () => {
      const entities = buildExpectedEntities(METADATA_COMPLETE);
      const genreEntities = entities.filter(e => e.type === 'GENRE');

      expect(genreEntities.length).toBe(3);
      expect(genreEntities.map(e => e.value)).toContain('Action');
      expect(genreEntities.map(e => e.value)).toContain('Adventure');
      expect(genreEntities.map(e => e.value)).toContain('Comedy');
    });

    it('should mark GENRE entities as not required', () => {
      const entities = buildExpectedEntities(METADATA_COMPLETE);
      const genreEntities = entities.filter(e => e.type === 'GENRE');

      genreEntities.forEach(e => {
        expect(e.required).toBe(false);
      });
    });

    it('should not create GENRE entities when genres is empty', () => {
      const entities = buildExpectedEntities(METADATA_MINIMAL);
      const genreEntities = entities.filter(e => e.type === 'GENRE');

      expect(genreEntities.length).toBe(0);
    });
  });

  describe('optional metadata entities', () => {
    it('should create SERIES_SUMMARY entity when summary exists', () => {
      const entities = buildExpectedEntities(METADATA_COMPLETE);
      const summaryEntity = entities.find(e => e.type === 'SERIES_SUMMARY');

      expect(summaryEntity).toBeDefined();
      expect(summaryEntity?.required).toBe(false);
    });

    it('should truncate SERIES_SUMMARY to 100 characters', () => {
      const longSummary = 'a'.repeat(300);
      const metadata: GroundTruthMetadata = {
        ...METADATA_MINIMAL,
        summary: longSummary,
      };

      const entities = buildExpectedEntities(metadata);
      const summaryEntity = entities.find(e => e.type === 'SERIES_SUMMARY');

      expect(summaryEntity?.value.length).toBe(100);
    });

    it('should create RELEASE_DATE entity when releaseYear exists', () => {
      const entities = buildExpectedEntities(METADATA_COMPLETE);
      const releaseDateEntity = entities.find(e => e.type === 'RELEASE_DATE');

      expect(releaseDateEntity).toBeDefined();
      expect(releaseDateEntity?.value).toBe('1997');
      expect(releaseDateEntity?.required).toBe(false);
    });

    // FORMAT is explicitly excluded in buildExpectedEntities (wikis rarely have consistent format)
    it('should NOT create FORMAT entity (excluded by design)', () => {
      const entities = buildExpectedEntities(METADATA_COMPLETE);
      const formatEntity = entities.find(e => e.type === 'FORMAT');

      expect(formatEntity).toBeUndefined();
    });

    it('should create COVER_IMAGE entity with image_present value when coverImage exists', () => {
      const entities = buildExpectedEntities(METADATA_COMPLETE);
      const coverEntity = entities.find(e => e.type === 'COVER_IMAGE');

      expect(coverEntity).toBeDefined();
      // Value is 'image_present' since wiki URLs differ from AniList URLs
      expect(coverEntity?.value).toBe('image_present');
      expect(coverEntity?.required).toBe(false);
    });

    it('should not create optional entities when values are null', () => {
      const entities = buildExpectedEntities(METADATA_MINIMAL);

      expect(entities.find(e => e.type === 'SERIES_SUMMARY')).toBeUndefined();
      expect(entities.find(e => e.type === 'RELEASE_DATE')).toBeUndefined();
      expect(entities.find(e => e.type === 'FORMAT')).toBeUndefined();
      expect(entities.find(e => e.type === 'COVER_IMAGE')).toBeUndefined();
    });
  });

  describe('entity normalization', () => {
    it('should include normalizedValue for all entities', () => {
      const entities = buildExpectedEntities(METADATA_COMPLETE);

      entities.forEach(e => {
        expect(e.normalizedValue).toBeDefined();
        expect(typeof e.normalizedValue).toBe('string');
      });
    });

    it('should normalize title value', () => {
      const entities = buildExpectedEntities(METADATA_COMPLETE);
      const titleEntity = entities.find(e => e.type === 'TITLE');

      expect(titleEntity?.normalizedValue).toBe('one piece');
    });

    it('should normalize author value', () => {
      const entities = buildExpectedEntities(METADATA_COMPLETE);
      const authorEntity = entities.find(e => e.type === 'AUTHOR');

      expect(authorEntity?.normalizedValue).toBe('eiichiro oda');
    });
  });

  describe('entity counts', () => {
    it('should return expected number of entities for complete metadata', () => {
      const entities = buildExpectedEntities(METADATA_COMPLETE);

      // TITLE + ALT_TITLE (english, native) + AUTHOR + STATUS + VOLUME_COUNT +
      // CHAPTER_COUNT + 3 GENREs + SERIES_SUMMARY + RELEASE_DATE + COVER_IMAGE
      // Note: FORMAT is excluded by design
      expect(entities.length).toBeGreaterThanOrEqual(12);
    });

    it('should return minimal entities for minimal metadata', () => {
      const entities = buildExpectedEntities(METADATA_MINIMAL);

      // Only TITLE from romaji
      expect(entities.length).toBe(1);
    });
  });
});
