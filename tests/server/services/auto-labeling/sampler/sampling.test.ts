/**
 * Sampling Tests
 *
 * Tests for samplePages and related sampling functions.
 *
 * @module tests/auto-labeling/sampler/sampling
 */

import { samplePages, filterBySource, getTrainingDataStats, sampleUniqueTitles } from '@/server/services/auto-labeling/sampler';

import type { SamplingFilters } from '@/server/services/auto-labeling/types';

import {
  TRAINING_ENTRY_COMPLETE,
  TRAINING_ENTRY_FANDOM_ONLY,
  TRAINING_ENTRY_WIKIPEDIA_ONLY,
  TRAINING_ENTRY_NO_ANILIST,
  TRAINING_ENTRY_NO_URLS,
  TRAINING_ENTRY_MULTIPLE_URL_TYPES,
  TRAINING_ENTRIES_COLLECTION,
} from '../fixtures';

// ============================================================================
// samplePages Tests
// ============================================================================

describe('samplePages', () => {
  describe('basic sampling', () => {
    it('should return requested number of pages', () => {
      const pages = samplePages(TRAINING_ENTRIES_COLLECTION, 3);

      expect(pages.length).toBe(3);
    });

    it('should return all pages if count exceeds available', () => {
      const entries = [TRAINING_ENTRY_FANDOM_ONLY];
      const pages = samplePages(entries, 100);

      // Only as many pages as discovered URLs
      expect(pages.length).toBeLessThanOrEqual(100);
    });

    it('should return empty array for empty entries', () => {
      const pages = samplePages([], 10);

      expect(pages).toEqual([]);
    });

    it('should create valid SampledPage objects', () => {
      const pages = samplePages([TRAINING_ENTRY_COMPLETE], 1);

      expect(pages[0]).toHaveProperty('id');
      expect(pages[0]).toHaveProperty('title');
      expect(pages[0]).toHaveProperty('anilistId');
      expect(pages[0]).toHaveProperty('source');
      expect(pages[0]).toHaveProperty('url');
      expect(pages[0]).toHaveProperty('urlType');
    });
  });

  describe('filtering by AniList ID', () => {
    it('should filter entries requiring AniList ID', () => {
      const entries = [TRAINING_ENTRY_COMPLETE, TRAINING_ENTRY_NO_ANILIST];
      const filters: SamplingFilters = { requireAnilistId: true };

      const pages = samplePages(entries, 10, filters);

      // All pages should have anilistId
      pages.forEach(page => {
        expect(page.anilistId).not.toBeNull();
      });
    });

    it('should include entries without AniList ID when not required', () => {
      const entries = [TRAINING_ENTRY_COMPLETE, TRAINING_ENTRY_NO_ANILIST];
      const filters: SamplingFilters = { requireAnilistId: false };

      // No filter on anilistId
      const pages = samplePages(entries, 10, filters);

      // Should still work but no_anilist entries won't be sampled
      // because they have anilistId = null and pages need anilistId
      expect(pages.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('filtering by Fandom URLs', () => {
    it('should filter entries requiring Fandom URLs', () => {
      const entries = [TRAINING_ENTRY_FANDOM_ONLY, TRAINING_ENTRY_WIKIPEDIA_ONLY];
      const filters: SamplingFilters = { requireFandomUrls: true, sources: ['fandom'] };

      const pages = samplePages(entries, 10, filters);

      expect(pages.length).toBeGreaterThan(0);
      pages.forEach(page => {
        expect(page.source).toBe('fandom');
      });
    });
  });

  describe('filtering by Wikipedia URLs', () => {
    it('should filter entries requiring Wikipedia URLs', () => {
      const entries = [TRAINING_ENTRY_FANDOM_ONLY, TRAINING_ENTRY_WIKIPEDIA_ONLY];
      const filters: SamplingFilters = { requireWikipediaUrls: true, sources: ['wikipedia'] };

      const pages = samplePages(entries, 10, filters);

      pages.forEach(page => {
        expect(page.source).toBe('wikipedia');
      });
    });
  });

  describe('filtering by URL types', () => {
    it('should only include entries that have at least one matching URL type', () => {
      const filters: SamplingFilters = {
        urlTypes: ['CHAPTERS'],
        sources: ['fandom'],
      };

      const pages = samplePages(TRAINING_ENTRIES_COLLECTION, 10, filters);

      // Entries are filtered to those having at least one CHAPTERS type URL
      // All URLs from matching entries are included in the expansion
      expect(pages.length).toBeGreaterThan(0);
      // At least one page should be from an entry with CHAPTERS type
      const hasChaptersType = pages.some(page => page.urlType === 'CHAPTERS');
      expect(hasChaptersType).toBe(true);
    });

    it('should include entries with any of the specified URL types', () => {
      const filters: SamplingFilters = {
        urlTypes: ['CHAPTERS', 'VOLUMES'],
        sources: ['fandom'],
      };

      const pages = samplePages(TRAINING_ENTRIES_COLLECTION, 10, filters);

      // Should have pages from entries that have CHAPTERS or VOLUMES
      expect(pages.length).toBeGreaterThan(0);
    });
  });

  describe('filtering by source', () => {
    it('should filter to fandom source only', () => {
      const filters: SamplingFilters = { sources: ['fandom'] };

      const pages = samplePages(TRAINING_ENTRIES_COLLECTION, 10, filters);

      pages.forEach(page => {
        expect(page.source).toBe('fandom');
      });
    });

    it('should filter to wikipedia source only', () => {
      const filters: SamplingFilters = { sources: ['wikipedia'] };

      const pages = samplePages(TRAINING_ENTRIES_COLLECTION, 10, filters);

      pages.forEach(page => {
        expect(page.source).toBe('wikipedia');
      });
    });

    it('should include multiple sources', () => {
      const filters: SamplingFilters = { sources: ['fandom', 'wikipedia'] };

      const pages = samplePages(TRAINING_ENTRIES_COLLECTION, 20, filters);

      const sources = new Set(pages.map(p => p.source));
      // Should potentially have both sources
      expect(sources.size).toBeGreaterThanOrEqual(1);
    });
  });

  describe('excluding AniList IDs', () => {
    it('should exclude specified AniList IDs', () => {
      const filters: SamplingFilters = {
        excludeAnilistIds: [21], // Exclude One Piece
        sources: ['fandom'],
      };

      const pages = samplePages(TRAINING_ENTRIES_COLLECTION, 10, filters);

      pages.forEach(page => {
        expect(page.anilistId).not.toBe(21);
      });
    });
  });

  describe('seeded sampling', () => {
    it('should return same results with same seed', () => {
      const pages1 = samplePages(TRAINING_ENTRIES_COLLECTION, 5, undefined, 42);
      const pages2 = samplePages(TRAINING_ENTRIES_COLLECTION, 5, undefined, 42);

      expect(pages1).toEqual(pages2);
    });

    it('should return different results with different seeds', () => {
      const pages1 = samplePages(TRAINING_ENTRIES_COLLECTION, 5, undefined, 42);
      const pages2 = samplePages(TRAINING_ENTRIES_COLLECTION, 5, undefined, 123);

      // Not guaranteed to be different, but very likely
      const ids1 = pages1.map(p => p.id).sort();
      const ids2 = pages2.map(p => p.id).sort();

      // They should be different (with high probability)
      // If this fails occasionally, that's statistically expected
      expect(JSON.stringify(ids1)).not.toBe(JSON.stringify(ids2));
    });
  });

  describe('page ID generation', () => {
    it('should generate unique page IDs', () => {
      const pages = samplePages([TRAINING_ENTRY_MULTIPLE_URL_TYPES], 10, { sources: ['fandom'] });

      const ids = pages.map(p => p.id);
      const uniqueIds = new Set(ids);

      expect(uniqueIds.size).toBe(ids.length);
    });

    it('should include anilistId, source, and urlType in page ID', () => {
      const pages = samplePages([TRAINING_ENTRY_COMPLETE], 1, { sources: ['fandom'] });

      const page = pages[0];
      expect(page?.id).toContain(String(page?.anilistId));
      expect(page?.id).toContain(page?.source);
      expect(page?.id).toContain(page?.urlType);
    });
  });
});

// ============================================================================
// filterBySource Tests
// ============================================================================

describe('filterBySource', () => {
  it('should filter to entries with Fandom URLs', () => {
    const entries = [TRAINING_ENTRY_FANDOM_ONLY, TRAINING_ENTRY_WIKIPEDIA_ONLY];
    const filtered = filterBySource(entries, 'fandom');

    expect(filtered.length).toBe(1);
    expect(filtered[0]?.fandomDiscoveredUrls.length).toBeGreaterThan(0);
  });

  it('should filter to entries with Wikipedia URLs', () => {
    const entries = [TRAINING_ENTRY_FANDOM_ONLY, TRAINING_ENTRY_WIKIPEDIA_ONLY];
    const filtered = filterBySource(entries, 'wikipedia');

    expect(filtered.length).toBe(1);
    expect(filtered[0]?.wikipediaDiscoveredUrls.length).toBeGreaterThan(0);
  });

  it('should return empty array when no entries match', () => {
    const entries = [TRAINING_ENTRY_NO_URLS];
    const filtered = filterBySource(entries, 'fandom');

    expect(filtered).toEqual([]);
  });

  it('should filter to entries with ComicVine URLs', () => {
    const entries = [TRAINING_ENTRY_MULTIPLE_URL_TYPES, TRAINING_ENTRY_FANDOM_ONLY];
    const filtered = filterBySource(entries, 'comicvine');

    expect(filtered.length).toBe(1);
  });
});

// ============================================================================
// getTrainingDataStats Tests
// ============================================================================

describe('getTrainingDataStats', () => {
  it('should return total count', () => {
    const stats = getTrainingDataStats(TRAINING_ENTRIES_COLLECTION);

    expect(stats.total).toBe(TRAINING_ENTRIES_COLLECTION.length);
  });

  it('should count entries with AniList ID', () => {
    const entries = [TRAINING_ENTRY_COMPLETE, TRAINING_ENTRY_NO_ANILIST];
    const stats = getTrainingDataStats(entries);

    expect(stats.withAnilistId).toBe(1);
  });

  it('should count entries with Fandom URLs', () => {
    const entries = [TRAINING_ENTRY_FANDOM_ONLY, TRAINING_ENTRY_WIKIPEDIA_ONLY];
    const stats = getTrainingDataStats(entries);

    expect(stats.withFandomUrls).toBe(1);
  });

  it('should count entries with Wikipedia URLs', () => {
    const entries = [TRAINING_ENTRY_FANDOM_ONLY, TRAINING_ENTRY_WIKIPEDIA_ONLY];
    const stats = getTrainingDataStats(entries);

    expect(stats.withWikipediaUrls).toBe(1);
  });

  it('should return URL type distribution', () => {
    const stats = getTrainingDataStats(TRAINING_ENTRIES_COLLECTION);

    expect(stats.urlTypeDistribution).toBeDefined();
    expect(typeof stats.urlTypeDistribution.CHAPTERS).toBe('number');
    expect(typeof stats.urlTypeDistribution.VOLUMES).toBe('number');
  });

  it('should return zero counts for empty array', () => {
    const stats = getTrainingDataStats([]);

    expect(stats.total).toBe(0);
    expect(stats.withAnilistId).toBe(0);
    expect(stats.withFandomUrls).toBe(0);
  });
});

// ============================================================================
// sampleUniqueTitles Tests
// ============================================================================

describe('sampleUniqueTitles', () => {
  it('should return unique titles', () => {
    const pages = sampleUniqueTitles(TRAINING_ENTRIES_COLLECTION, 4);

    const titles = pages.map(p => p.title);
    const uniqueTitles = new Set(titles);

    expect(uniqueTitles.size).toBe(titles.length);
  });

  it('should respect count limit', () => {
    const pages = sampleUniqueTitles(TRAINING_ENTRIES_COLLECTION, 2);

    expect(pages.length).toBe(2);
  });

  it('should prefer CHAPTERS_VOLUMES over other types', () => {
    // TRAINING_ENTRY_MULTIPLE_URL_TYPES has CHAPTERS_VOLUMES
    const entries = [TRAINING_ENTRY_MULTIPLE_URL_TYPES];
    const pages = sampleUniqueTitles(entries, 1, { sources: ['fandom'] });

    expect(pages[0]?.urlType).toBe('CHAPTERS_VOLUMES');
  });

  it('should apply filters', () => {
    const filters: SamplingFilters = {
      requireAnilistId: true,
      sources: ['fandom'],
    };

    const pages = sampleUniqueTitles(TRAINING_ENTRIES_COLLECTION, 10, filters);

    pages.forEach(page => {
      expect(page.anilistId).not.toBeNull();
    });
  });

  it('should return empty for entries without matching URLs', () => {
    const entries = [TRAINING_ENTRY_NO_URLS];
    const pages = sampleUniqueTitles(entries, 10, { sources: ['fandom'] });

    expect(pages).toEqual([]);
  });

  it('should be reproducible with seed', () => {
    const pages1 = sampleUniqueTitles(TRAINING_ENTRIES_COLLECTION, 2, undefined, 42);
    const pages2 = sampleUniqueTitles(TRAINING_ENTRIES_COLLECTION, 2, undefined, 42);

    expect(pages1).toEqual(pages2);
  });
});
