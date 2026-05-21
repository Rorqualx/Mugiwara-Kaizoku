/**
 * Tests for AddManga validation and error handling
 */

import type { MangaSearchResult } from '@/types/search.types';

import {
  validateSearchResult,
  validateMangaMetadata,
  validateFieldSelection
} from '../validation';

describe('AddManga Validation', () => {
  describe('validateSearchResult', () => {
    it('should validate a valid search result', () => {
      const input = {
        id: '123',
        title: 'Test Manga',
        source: 'anilist',
        sourceId: '456',
        provider: 'anilist'
      };
      const result = validateSearchResult(input);
      expect(result.isValid).toBe(true);
      expect(result.errors.length).toBe(0);
    });

    it('should handle missing required fields', () => {
      const input = {
        // Missing id and title
        source: 'anilist',
      };
      const result = validateSearchResult(input as Partial<MangaSearchResult>);
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('validateMangaMetadata', () => {
    it('should validate metadata with required fields', () => {
      const metadata = {
        title: 'Test Manga',
        description: 'A test manga',
        coverUrl: 'https://example.com/cover.jpg'
      };
      const result = validateMangaMetadata(metadata);
      expect(result.isValid).toBe(true);
      expect(result.errors.length).toBe(0);
    });

    it('should report error for missing title', () => {
      const metadata = {
        description: 'A test manga'
      };
      const result = validateMangaMetadata(metadata);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Title is required');
    });
  });

  describe('validateFieldSelection', () => {
    it('should validate title field', () => {
      const result = validateFieldSelection('title', 'Test Title');
      expect(result.isValid).toBe(true);
    });

    it('should reject empty title', () => {
      const result = validateFieldSelection('title', '');
      expect(result.isValid).toBe(false);
    });

    it('should validate description field', () => {
      const result = validateFieldSelection('description', 'Test description');
      expect(result.isValid).toBe(true);
    });

    it('should accept empty description', () => {
      const result = validateFieldSelection('description', '');
      expect(result.isValid).toBe(true);
    });
  });
});