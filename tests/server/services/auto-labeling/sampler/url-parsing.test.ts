/**
 * URL Parsing Tests
 *
 * Tests for parseDiscoveredUrls function.
 *
 * @module tests/auto-labeling/sampler/url-parsing
 */

import { parseDiscoveredUrls } from '@/server/services/auto-labeling/sampler';

// ============================================================================
// parseDiscoveredUrls Tests
// ============================================================================

describe('parseDiscoveredUrls', () => {
  describe('simple URL types', () => {
    it('should parse CHAPTERS type URL', () => {
      const urls = parseDiscoveredUrls('CHAPTERS:https://example.com/chapters');

      expect(urls.length).toBe(1);
      expect(urls[0]?.type).toBe('CHAPTERS');
      expect(urls[0]?.url).toBe('https://example.com/chapters');
    });

    it('should parse VOLUMES type URL', () => {
      const urls = parseDiscoveredUrls('VOLUMES:https://example.com/volumes');

      expect(urls.length).toBe(1);
      expect(urls[0]?.type).toBe('VOLUMES');
      expect(urls[0]?.url).toBe('https://example.com/volumes');
    });

    it('should parse CHAPTERS_VOLUMES type URL', () => {
      const urls = parseDiscoveredUrls('CHAPTERS_VOLUMES:https://example.com/chapters_volumes');

      expect(urls.length).toBe(1);
      expect(urls[0]?.type).toBe('CHAPTERS_VOLUMES');
    });

    it('should parse MANGA_PAGE type URL', () => {
      const urls = parseDiscoveredUrls('MANGA_PAGE:https://example.com/manga');

      expect(urls.length).toBe(1);
      expect(urls[0]?.type).toBe('MANGA_PAGE');
    });

    it('should parse ARCS type URL', () => {
      const urls = parseDiscoveredUrls('ARCS:https://example.com/arcs');

      expect(urls.length).toBe(1);
      expect(urls[0]?.type).toBe('ARCS');
    });

    it('should parse GALLERY_SECTION type URL', () => {
      const urls = parseDiscoveredUrls('GALLERY_SECTION:https://example.com/gallery');

      expect(urls.length).toBe(1);
      expect(urls[0]?.type).toBe('GALLERY_SECTION');
    });

    it('should parse OTHER type URL', () => {
      const urls = parseDiscoveredUrls('OTHER:https://example.com/other');

      expect(urls.length).toBe(1);
      expect(urls[0]?.type).toBe('OTHER');
    });
  });

  describe('CATEGORY type URLs', () => {
    it('should parse CATEGORY with name', () => {
      const urls = parseDiscoveredUrls('CATEGORY:Story Arcs:https://example.com/category/arcs');

      expect(urls.length).toBe(1);
      expect(urls[0]?.type).toBe('CATEGORY');
      expect(urls[0]?.categoryName).toBe('Story Arcs');
      expect(urls[0]?.url).toBe('https://example.com/category/arcs');
    });

    it('should parse CATEGORY without name (simple format)', () => {
      const urls = parseDiscoveredUrls('CATEGORY:Characters:https://example.com/category');

      expect(urls.length).toBe(1);
      expect(urls[0]?.type).toBe('CATEGORY');
      expect(urls[0]?.categoryName).toBe('Characters');
    });

    it('should handle CATEGORY with URL directly', () => {
      const urls = parseDiscoveredUrls('CATEGORY:https://example.com/category');

      expect(urls.length).toBe(1);
      expect(urls[0]?.type).toBe('CATEGORY');
      expect(urls[0]?.url).toBe('https://example.com/category');
    });
  });

  describe('multiple URLs', () => {
    it('should parse multiple URLs separated by pipe', () => {
      const urls = parseDiscoveredUrls('CHAPTERS:https://example.com/chapters|VOLUMES:https://example.com/volumes');

      expect(urls.length).toBe(2);
      expect(urls[0]?.type).toBe('CHAPTERS');
      expect(urls[1]?.type).toBe('VOLUMES');
    });

    it('should parse three URLs', () => {
      const urls = parseDiscoveredUrls('CHAPTERS:https://example.com/chapters|VOLUMES:https://example.com/volumes|ARCS:https://example.com/arcs');

      expect(urls.length).toBe(3);
    });

    it('should handle mixed types', () => {
      const urls = parseDiscoveredUrls('CHAPTERS:https://example.com/chapters|CATEGORY:Arcs:https://example.com/arcs|MANGA_PAGE:https://example.com/manga');

      expect(urls.length).toBe(3);
      expect(urls[0]?.type).toBe('CHAPTERS');
      expect(urls[1]?.type).toBe('CATEGORY');
      expect(urls[2]?.type).toBe('MANGA_PAGE');
    });
  });

  describe('type variations', () => {
    it('should handle singular CHAPTER as CHAPTERS', () => {
      const urls = parseDiscoveredUrls('CHAPTER:https://example.com/chapter');

      expect(urls[0]?.type).toBe('CHAPTERS');
    });

    it('should handle singular VOLUME as VOLUMES', () => {
      const urls = parseDiscoveredUrls('VOLUME:https://example.com/volume');

      expect(urls[0]?.type).toBe('VOLUMES');
    });

    it('should handle singular ARC as ARCS', () => {
      const urls = parseDiscoveredUrls('ARC:https://example.com/arc');

      expect(urls[0]?.type).toBe('ARCS');
    });

    it('should handle GALLERY as GALLERY_SECTION', () => {
      const urls = parseDiscoveredUrls('GALLERY:https://example.com/gallery');

      expect(urls[0]?.type).toBe('GALLERY_SECTION');
    });
  });

  describe('URL without type prefix', () => {
    it('should treat bare URL without type prefix as MANGA_PAGE', () => {
      // Bare URLs are accepted and defaulted to MANGA_PAGE — main wiki URLs
      // are often recorded without a TYPE: prefix.
      const urls = parseDiscoveredUrls('https://example.com/page');

      expect(urls.length).toBe(1);
      expect(urls[0]?.type).toBe('MANGA_PAGE');
      expect(urls[0]?.url).toBe('https://example.com/page');
    });
  });

  describe('empty and invalid inputs', () => {
    it('should return empty array for empty string', () => {
      const urls = parseDiscoveredUrls('');

      expect(urls).toEqual([]);
    });

    it('should return empty array for whitespace', () => {
      const urls = parseDiscoveredUrls('   ');

      expect(urls).toEqual([]);
    });

    it('should skip parts without valid URLs', () => {
      const urls = parseDiscoveredUrls('CHAPTERS:not-a-url|VOLUMES:https://example.com/volumes');

      expect(urls.length).toBe(1);
      expect(urls[0]?.type).toBe('VOLUMES');
    });

    it('should skip invalid type without URL', () => {
      const urls = parseDiscoveredUrls('INVALID|CHAPTERS:https://example.com/chapters');

      expect(urls.length).toBe(1);
    });

    it('should handle empty parts in pipe-separated list', () => {
      const urls = parseDiscoveredUrls('CHAPTERS:https://example.com/chapters||VOLUMES:https://example.com/volumes');

      expect(urls.length).toBe(2);
    });
  });

  describe('case sensitivity', () => {
    it('should handle lowercase type names', () => {
      // The function converts to uppercase internally
      const urls = parseDiscoveredUrls('chapters:https://example.com/chapters');

      // lowercase 'chapters' is not a valid type - should be mapped
      expect(urls.length).toBe(1);
      expect(urls[0]?.type).toBe('CHAPTERS');
    });
  });

  describe('URL preservation', () => {
    it('should preserve full URL with query parameters', () => {
      const urls = parseDiscoveredUrls('CHAPTERS:https://example.com/chapters?page=1&sort=desc');

      expect(urls[0]?.url).toBe('https://example.com/chapters?page=1&sort=desc');
    });

    it('should preserve URL with hash', () => {
      const urls = parseDiscoveredUrls('CHAPTERS:https://example.com/chapters#section1');

      expect(urls[0]?.url).toBe('https://example.com/chapters#section1');
    });

    it('should preserve URL with special characters', () => {
      const urls = parseDiscoveredUrls('CHAPTERS:https://example.com/chapters/One_Piece_%28manga%29');

      expect(urls[0]?.url).toBe('https://example.com/chapters/One_Piece_%28manga%29');
    });
  });
});
