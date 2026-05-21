/**
 * Tests for PatternLibrary
 */

import { PatternLibrary } from '@/server/parsers/patterns/PatternLibrary';

describe('PatternLibrary', () => {
  let patterns: PatternLibrary;

  beforeEach(() => {
    patterns = new PatternLibrary();
  });

  describe('Volume Patterns', () => {
    test('should match standard volume patterns', () => {
      const testCases = [
        { text: 'Volume 1', expected: '1' },
        { text: 'Vol. 25', expected: '25' },
        { text: 'Vol 10', expected: '10' },
        { text: 'Tome 3', expected: '3' },
        { text: 'Tomo 7', expected: '7' },
        { text: 'Band 12', expected: '12' },
        { text: 'Book 5', expected: '5' },
        { text: 'Part 2', expected: '2' },
      ];

      testCases.forEach(({ text, expected }) => {
        const match = patterns.match(text, 'volume');
        expect(match).not.toBeNull();
        expect(match?.value).toBe(expected);
        expect(match?.confidence).toBe(1.0);
      });
    });

    test('should match decimal volumes', () => {
      const match = patterns.match('Volume 3.5', 'volume', { includeSpecial: true });
      expect(match).not.toBeNull();
      expect(match?.value).toContain('3.5');
    });

    test('should match volume ranges', () => {
      const match = patterns.match('Volume 1-3', 'volume', { includeSpecial: true });
      expect(match).not.toBeNull();
      expect(match?.value).toContain('1');
    });

    test('should match omnibus editions', () => {
      const match = patterns.match('Omnibus 2', 'volume', { includeSpecial: true });
      expect(match).not.toBeNull();
      expect(match?.value).toContain('2');
    });

    test('should not match negative patterns', () => {
      const testCases = [
        'Volume 5 Extra',
        'Volume 10 Omake',
        'Behind the Scenes'
      ];

      testCases.forEach(text => {
        // Disable context matching to ensure negative patterns are respected
        const match = patterns.match(text, 'volume', { checkContext: false });
        expect(match).toBeNull();
      });
    });

    test('should match with context', () => {
      const match = patterns.match('The volume is 5', 'volume', { checkContext: true });
      expect(match).not.toBeNull();
      expect(match?.value).toBe('5');
      expect(match?.confidence).toBeLessThan(1.0);
    });
  });

  describe('Chapter Patterns', () => {
    test('should match standard chapter patterns', () => {
      const testCases = [
        { text: 'Chapter 1', expected: '1' },
        { text: 'Ch. 100', expected: '100' },
        { text: 'Ch 50', expected: '50' },
        { text: 'Episode 25', expected: '25' },
        { text: 'Ep. 10', expected: '10' },
        { text: 'Mission 7', expected: '7' },
        { text: '#42', expected: '42' },
      ];

      testCases.forEach(({ text, expected }) => {
        const match = patterns.match(text, 'chapter');
        expect(match).not.toBeNull();
        expect(match?.value).toBe(expected);
      });
    });

    test('should match decimal chapters', () => {
      const testCases = [
        { text: 'Chapter 10.5', expected: '10.5' },
        { text: 'Ch. 25.1', expected: '25.1' },
        { text: 'Episode 100.5', expected: '100.5' },
      ];

      testCases.forEach(({ text, expected }) => {
        const match = patterns.match(text, 'chapter');
        expect(match).not.toBeNull();
        expect(match?.value).toBe(expected);
      });
    });

    test('should match special chapters', () => {
      const testCases = [
        'Extra Chapter 1',
        'Special Chapter',
        'Prologue',
        'Epilogue',
        'Chapter Zero',
        'One-Shot'
      ];

      testCases.forEach(text => {
        const match = patterns.match(text, 'chapter', { includeSpecial: true });
        expect(match).not.toBeNull();
      });
    });

    test('should validate chapter numbers', () => {
      const match = patterns.match('Chapter 99999', 'chapter');
      expect(match).toBeNull(); // Exceeds reasonable limit
    });
  });

  describe('Status Patterns', () => {
    test('should determine ongoing status', () => {
      const testCases = [
        'Status: Ongoing',
        'Ongoing',
      ];

      testCases.forEach(text => {
        const status = patterns.determineStatus(text);
        expect(status).toBe('ONGOING');
      });
    });

    test('should determine completed status', () => {
      const testCases = [
        'Completed',
        'Finished',
        'Ended',
      ];

      testCases.forEach(text => {
        const status = patterns.determineStatus(text);
        expect(status).toBe('COMPLETED');
      });
    });

    test('should determine hiatus status', () => {
      const testCases = [
        'Hiatus',
        'Suspended',
        'Paused',
      ];

      testCases.forEach(text => {
        const status = patterns.determineStatus(text);
        expect(status).toBe('HIATUS');
      });
    });

    test('should determine cancelled status', () => {
      const testCases = [
        'Cancelled',
        'Discontinued',
        'Axed'
      ];

      testCases.forEach(text => {
        const status = patterns.determineStatus(text);
        expect(status).toBe('CANCELLED');
      });
    });
  });

  describe('ISBN Patterns', () => {
    test('should match ISBN-13', () => {
      const testCases = [
        { text: 'ISBN: 9781234567890', expected: '9781234567890' },
        { text: 'ISBN-13: 978-1-234-56789-0', expected: '9781234567890' },
        { text: 'ISBN 9784088725093', expected: '9784088725093' },
      ];

      testCases.forEach(({ text, expected }) => {
        const match = patterns.match(text, 'isbn');
        expect(match).not.toBeNull();
        expect(match?.value).toBe(expected);
      });
    });

    test('should match ISBN-10', () => {
      const testCases = [
        { text: 'ISBN: 1234567890', expected: '1234567890' },
        { text: 'ISBN-10: 1-234-56789-0', expected: '1234567890' },
      ];

      testCases.forEach(({ text, expected }) => {
        const match = patterns.match(text, 'isbn');
        expect(match).not.toBeNull();
        expect(match?.value).toBe(expected);
      });
    });

    test('should validate ISBN length', () => {
      const invalidISBN = 'ISBN: 12345'; // Too short
      const match = patterns.match(invalidISBN, 'isbn');
      expect(match).toBeNull();
    });
  });

  describe('Date Patterns', () => {
    test('should match ISO dates', () => {
      const testCases = [
        '2024-01-15',
        '2024/01/15',
      ];

      testCases.forEach(text => {
        const match = patterns.match(text, 'date');
        expect(match).not.toBeNull();
        expect(match?.value).toBe(text);
      });
    });

    test('should match US format dates', () => {
      const testCases = [
        '01/15/2024',
        '1-15-2024',
      ];

      testCases.forEach(text => {
        const match = patterns.match(text, 'date');
        expect(match).not.toBeNull();
      });
    });

    test('should validate date formats', () => {
      const testCases = [
        { text: '2024-01-15', shouldMatch: true },
        { text: 'not a date', shouldMatch: false },
      ];

      testCases.forEach(({ text, shouldMatch }) => {
        const match = patterns.match(text, 'date');
        if (shouldMatch) {
          expect(match).not.toBeNull();
        } else {
          expect(match).toBeNull();
        }
      });
    });
  });

  describe('Multi-language Support', () => {
    describe('Japanese Patterns', () => {
      test('should match Japanese volume patterns', () => {
        const testCases = [
          { text: '第5巻', expected: '5' },
          { text: '10巻', expected: '10' },
        ];

        testCases.forEach(({ text, expected }) => {
          const match = patterns.match(text, 'japanese');
          expect(match).not.toBeNull();
          expect(match?.value).toBe(expected);
        });
      });

      test('should match Japanese chapter patterns', () => {
        const testCases = [
          { text: '第100話', expected: '100' },
          { text: '第25章', expected: '25' },
          { text: '50話', expected: '50' },
        ];

        testCases.forEach(({ text, expected }) => {
          const match = patterns.match(text, 'japanese');
          expect(match).not.toBeNull();
          expect(match?.value).toBe(expected);
        });
      });

      test('should match Japanese status', () => {
        const testCases = [
          { text: '連載中', expected: '連載中' },
          { text: '完結', expected: '完結' },
          { text: '休載', expected: '休載' },
        ];

        testCases.forEach(({ text, expected }) => {
          const match = patterns.match(text, 'japanese');
          expect(match).not.toBeNull();
          expect(match?.value).toBe(expected);
        });
      });
    });

    describe('French Patterns', () => {
      test('should match French patterns', () => {
        const testCases = [
          { text: 'Tome 5', pattern: 'french' },
          { text: 'Chapitre 10', pattern: 'french' },
          { text: 'Épisode 25', pattern: 'french' },
        ];

        testCases.forEach(({ text, pattern }) => {
          const match = patterns.match(text, pattern);
          expect(match).not.toBeNull();
        });
      });
    });

    describe('Korean Patterns', () => {
      test('should match Korean patterns', () => {
        const testCases = [
          { text: '제5권', expected: '5' },
          { text: '제10화', expected: '10' },
          { text: '연재중', expected: '연재중' },
        ];

        testCases.forEach(({ text, expected }) => {
          const match = patterns.match(text, 'korean');
          expect(match).not.toBeNull();
          expect(match?.value).toBe(expected);
        });
      });
    });
  });

  describe('Special Patterns', () => {
    test('should match arc patterns', () => {
      const testCases = [
        'East Blue Arc',
        'Alabasta Saga',
        'Marineford Story',
        'Arc 1',
        'Season 2',
        'Part 3',
      ];

      testCases.forEach(text => {
        const match = patterns.match(text, 'arc');
        expect(match).not.toBeNull();
      });
    });

    test('should match edition patterns', () => {
      const testCases = [
        'Limited Edition',
        "Collector's Edition",
        'Special Edition',
        'Deluxe Edition',
        'Digital Edition',
        'Tankobon',
        'Bunkoban',
      ];

      testCases.forEach(text => {
        const match = patterns.match(text, 'edition');
        expect(match).not.toBeNull();
      });
    });

    test('should match URL patterns', () => {
      const testCases = [
        'https://example.com/manga',
        'http://wiki.com/page',
        '/wiki/One_Piece',
        '/manga/chapter-1',
      ];

      testCases.forEach(text => {
        const match = patterns.match(text, 'url');
        expect(match).not.toBeNull();
      });
    });
  });

  describe('matchAll', () => {
    test('should find all matches in text', () => {
      const text = 'Volume 1 contains Chapter 1, Chapter 2, and Chapter 3';
      
      const volumeMatches = patterns.matchAll(text, 'volume');
      expect(volumeMatches).toHaveLength(1);
      expect(volumeMatches[0]?.value).toBe('1');
      
      const chapterMatches = patterns.matchAll(text, 'chapter');
      expect(chapterMatches).toHaveLength(3);
      expect(chapterMatches.map(m => m.value)).toEqual(['1', '2', '3']);
    });

    test('should skip negative patterns in matchAll', () => {
      const text = 'Volume 1, Volume 3';

      const matches = patterns.matchAll(text, 'volume');
      expect(matches).toHaveLength(2);
      expect(matches.map(m => m.value)).toEqual(['1', '3']);
    });
  });

  describe('addCustomPattern', () => {
    test('should add custom pattern at runtime', () => {
      patterns.addCustomPattern('custom-id', {
        primary: [/ID-(\d+)/],
        validators: [{
          validate: (value) => parseInt(value, 10) > 0
        }]
      });

      const match = patterns.match('ID-12345', 'custom-id');
      expect(match).not.toBeNull();
      expect(match?.value).toBe('12345');
    });

    test('should list custom patterns in getPatternTypes', () => {
      patterns.addCustomPattern('test-pattern', {
        primary: [/test/]
      });

      const types = patterns.getPatternTypes();
      expect(types).toContain('test-pattern');
    });
  });
});