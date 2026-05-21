/**
 * CSV Parsing Tests
 *
 * Tests for parseCSVLine and loadTrainingData functions.
 *
 * @module tests/auto-labeling/sampler/csv-parsing
 */

import { mock, beforeEach, describe, it, expect } from 'bun:test';

import { loadTrainingData } from '@/server/services/auto-labeling/sampler';

// Mock fs module using Bun's mock
const mockReadFileSync = mock(() => '');

mock.module('fs', () => ({
  readFileSync: mockReadFileSync,
}));

// ============================================================================
// Test Data
// ============================================================================

const CSV_HEADER =
  'Title,AniListID,WikipediaURL,FandomURL,ComicVineID,FandomDiscoveredURLs,WikipediaDiscoveredURLs,ComicVineDiscoveredURLs';

const CSV_ROW_SIMPLE = 'One Piece,21,https://en.wikipedia.org/wiki/One_Piece,https://onepiece.fandom.com/wiki,4HM59,CHAPTERS:https://onepiece.fandom.com/wiki/Chapters,,';

const CSV_ROW_QUOTED = '"Attack on Titan, Vol. 1",30853,https://en.wikipedia.org/wiki/Attack_on_Titan,"https://attackontitan.fandom.com/wiki",4HM60,"CHAPTERS:https://attackontitan.fandom.com/wiki/Chapters|VOLUMES:https://attackontitan.fandom.com/wiki/Volumes","",""';

const CSV_ROW_ESCAPED_QUOTES = '"Title with ""quotes""",100,https://example.com,https://fandom.com,123,CHAPTERS:https://example.com/chapters,,';

const CSV_ROW_EMPTY_ANILIST = 'Unknown,DOES_NOT_EXIST,https://example.com,https://fandom.com,123,,,';

const CSV_ROW_NO_URLS = 'Simple Title,50,,,,,,';

// ============================================================================
// loadTrainingData Tests
// ============================================================================

describe('loadTrainingData', () => {
  beforeEach(() => {
    mockReadFileSync.mockClear();
  });

  describe('basic loading', () => {
    it('should load entries from CSV file', () => {
      const csv = `${CSV_HEADER}\n${CSV_ROW_SIMPLE}`;
      mockReadFileSync.mockReturnValue(csv);

      const entries = loadTrainingData('test.csv');

      expect(entries.length).toBe(1);
      expect(entries[0]?.title).toBe('One Piece');
    });

    it('should parse AniList ID as number', () => {
      const csv = `${CSV_HEADER}\n${CSV_ROW_SIMPLE}`;
      mockReadFileSync.mockReturnValue(csv);

      const entries = loadTrainingData('test.csv');

      expect(entries[0]?.anilistId).toBe(21);
    });

    it('should handle DOES_NOT_EXIST as null AniList ID', () => {
      const csv = `${CSV_HEADER}\n${CSV_ROW_EMPTY_ANILIST}`;
      mockReadFileSync.mockReturnValue(csv);

      const entries = loadTrainingData('test.csv');

      expect(entries[0]?.anilistId).toBeNull();
    });

    it('should load multiple rows', () => {
      const csv = `${CSV_HEADER}\n${CSV_ROW_SIMPLE}\n${CSV_ROW_QUOTED}`;
      mockReadFileSync.mockReturnValue(csv);

      const entries = loadTrainingData('test.csv');

      expect(entries.length).toBe(2);
    });
  });

  describe('quoted fields', () => {
    it('should handle quoted fields with commas', () => {
      const csv = `${CSV_HEADER}\n${CSV_ROW_QUOTED}`;
      mockReadFileSync.mockReturnValue(csv);

      const entries = loadTrainingData('test.csv');

      expect(entries[0]?.title).toBe('Attack on Titan, Vol. 1');
    });

    it('should handle escaped quotes', () => {
      const csv = `${CSV_HEADER}\n${CSV_ROW_ESCAPED_QUOTES}`;
      mockReadFileSync.mockReturnValue(csv);

      const entries = loadTrainingData('test.csv');

      expect(entries[0]?.title).toBe('Title with "quotes"');
    });
  });

  describe('URL parsing', () => {
    it('should parse Wikipedia URL', () => {
      const csv = `${CSV_HEADER}\n${CSV_ROW_SIMPLE}`;
      mockReadFileSync.mockReturnValue(csv);

      const entries = loadTrainingData('test.csv');

      expect(entries[0]?.wikipediaUrl).toBe('https://en.wikipedia.org/wiki/One_Piece');
    });

    it('should parse Fandom URL', () => {
      const csv = `${CSV_HEADER}\n${CSV_ROW_SIMPLE}`;
      mockReadFileSync.mockReturnValue(csv);

      const entries = loadTrainingData('test.csv');

      expect(entries[0]?.fandomUrl).toBe('https://onepiece.fandom.com/wiki');
    });

    it('should parse ComicVine ID', () => {
      const csv = `${CSV_HEADER}\n${CSV_ROW_SIMPLE}`;
      mockReadFileSync.mockReturnValue(csv);

      const entries = loadTrainingData('test.csv');

      expect(entries[0]?.comicVineId).toBe('4HM59');
    });

    it('should handle empty URLs as null', () => {
      const csv = `${CSV_HEADER}\n${CSV_ROW_NO_URLS}`;
      mockReadFileSync.mockReturnValue(csv);

      const entries = loadTrainingData('test.csv');

      expect(entries[0]?.wikipediaUrl).toBeNull();
      expect(entries[0]?.fandomUrl).toBeNull();
      expect(entries[0]?.comicVineId).toBeNull();
    });
  });

  describe('discovered URLs', () => {
    it('should parse Fandom discovered URLs', () => {
      const csv = `${CSV_HEADER}\n${CSV_ROW_SIMPLE}`;
      mockReadFileSync.mockReturnValue(csv);

      const entries = loadTrainingData('test.csv');

      expect(entries[0]?.fandomDiscoveredUrls.length).toBe(1);
      expect(entries[0]?.fandomDiscoveredUrls[0]?.type).toBe('CHAPTERS');
    });

    it('should parse multiple discovered URLs', () => {
      const csv = `${CSV_HEADER}\n${CSV_ROW_QUOTED}`;
      mockReadFileSync.mockReturnValue(csv);

      const entries = loadTrainingData('test.csv');

      expect(entries[0]?.fandomDiscoveredUrls.length).toBe(2);
    });

    it('should return empty array for empty discovered URLs', () => {
      const csv = `${CSV_HEADER}\n${CSV_ROW_NO_URLS}`;
      mockReadFileSync.mockReturnValue(csv);

      const entries = loadTrainingData('test.csv');

      expect(entries[0]?.fandomDiscoveredUrls).toEqual([]);
      expect(entries[0]?.wikipediaDiscoveredUrls).toEqual([]);
      expect(entries[0]?.comicVineDiscoveredUrls).toEqual([]);
    });
  });

  describe('edge cases', () => {
    it('should return empty array for empty CSV', () => {
      mockReadFileSync.mockReturnValue(CSV_HEADER);

      const entries = loadTrainingData('test.csv');

      expect(entries).toEqual([]);
    });

    it('should skip empty rows', () => {
      const csv = `${CSV_HEADER}\n${CSV_ROW_SIMPLE}\n\n${CSV_ROW_QUOTED}`;
      mockReadFileSync.mockReturnValue(csv);

      const entries = loadTrainingData('test.csv');

      expect(entries.length).toBe(2);
    });

    it('should skip whitespace-only rows', () => {
      const csv = `${CSV_HEADER}\n${CSV_ROW_SIMPLE}\n   \n${CSV_ROW_QUOTED}`;
      mockReadFileSync.mockReturnValue(csv);

      const entries = loadTrainingData('test.csv');

      expect(entries.length).toBe(2);
    });

    it('should use default path when not provided', () => {
      mockReadFileSync.mockReturnValue(CSV_HEADER);

      loadTrainingData();

      expect(mockReadFileSync).toHaveBeenCalledWith('ml-training-pages-full.csv', 'utf-8');
    });
  });

  describe('error handling', () => {
    it('should return empty array for file with no data rows', () => {
      mockReadFileSync.mockReturnValue(CSV_HEADER);

      const entries = loadTrainingData('test.csv');

      expect(entries).toEqual([]);
    });

    it('should return empty array for single line (just header)', () => {
      mockReadFileSync.mockReturnValue(CSV_HEADER);

      const entries = loadTrainingData('test.csv');

      expect(entries).toEqual([]);
    });
  });
});
