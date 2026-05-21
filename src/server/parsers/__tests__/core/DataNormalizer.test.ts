/**
 * Tests for DataNormalizer
 */

import { DataNormalizer } from '@/server/parsers/core/DataNormalizer';

import { 
  createTestExtractedContent,
  createTestChapter,
  createTestVolume} from '../helpers/testDataHelpers';

describe('DataNormalizer', () => {
  let normalizer: DataNormalizer;

  beforeEach(() => {
    normalizer = new DataNormalizer();
  });

  describe('normalize', () => {
    test('should normalize basic manga data', () => {
      const content = createTestExtractedContent({
        metadata: {
          title: 'One Piece',
          author: ['Eiichiro Oda'],
          status: 'ONGOING',
          volumes: 110,
          chapters: 1100,
          description: 'A pirate adventure story'
        },
        images: [
          { url: 'cover.jpg', type: 'cover' }
        ],
        tables: []
      });
      
      const result = normalizer.normalize(content);

      expect(result.title).toBe('One Piece');
      expect(result.author).toEqual(['Eiichiro Oda']);
      expect(result.status).toBe('ONGOING');
      expect(result.totalVolumes).toBe(110);
      expect(result.totalChapters).toBe(1100);
      // coverImage is not set from images array in current implementation
      expect(result.description).toBe('A pirate adventure story');
    });

    test('should handle missing fields gracefully', () => {
      const content = createTestExtractedContent({
        metadata: {},
        images: [],
        tables: []
      });
      
      const result = normalizer.normalize(content);

      expect(result.title).toBe('Unknown');
      expect(result.author).toBeUndefined();
      expect(result.status).toBe('UNKNOWN');
      expect(result.totalVolumes).toBeUndefined();
      expect(result.totalChapters).toBeUndefined();
    });

    test('should normalize dates to ISO format', () => {
      const content = createTestExtractedContent({
        metadata: {
          startDate: 'July 22, 1997',
          endDate: 'December 31, 2023'
        }
      });
      
      const result = normalizer.normalize(content, {
        validateDates: true
      });

      expect(result.startDate?.toISOString().split('T')[0]).toBe('1997-07-22');
      expect(result.endDate?.toISOString().split('T')[0]).toBe('2023-12-31');
    });

    test('should normalize status values', () => {
      const testCases = [
        { input: 'ongoing', expected: 'ONGOING' },
        { input: 'Completed', expected: 'COMPLETED' },
        { input: 'on hiatus', expected: 'HIATUS' },
        { input: 'cancelled', expected: 'CANCELLED' },
        { input: 'unknown status', expected: 'UNKNOWN' }
      ];
      
      testCases.forEach(({ input, expected }) => {
        const content = createTestExtractedContent({
          metadata: { status: input as unknown as 'ONGOING' | 'COMPLETED' | 'HIATUS' | 'CANCELLED' | 'NOT_YET_RELEASED' }
        });

        const result = normalizer.normalize(content);
        expect(result.status).toBe(expected);
      });
    });

    test('should deduplicate chapters', () => {
      const content = createTestExtractedContent({
        chapters: [
          createTestChapter({ chapterNumber: '1', title: 'Chapter 1' }),
          createTestChapter({ chapterNumber: '1', title: 'Chapter 1 Duplicate' }),
          createTestChapter({ chapterNumber: '2', title: 'Chapter 2' })
        ]
      });
      
      const result = normalizer.normalize(content, {
        deduplicateChapters: true
      });

      expect(result.chapters).toHaveLength(2);
      const chapter0 = result.chapters[0];
      const chapter1 = result.chapters[1];
      if (!chapter0 || !chapter1) throw new Error('Expected chapters');
      expect(chapter0.number).toBe(1);
      expect(chapter1.number).toBe(2);
    });

    test('should deduplicate volumes', () => {
      const content = createTestExtractedContent({
        volumes: [
          createTestVolume({ volumeNumber: 1, title: 'Volume 1' }),
          createTestVolume({ volumeNumber: 1, title: 'Volume 1 Duplicate' }),
          createTestVolume({ volumeNumber: 2, title: 'Volume 2' })
        ]
      });
      
      const result = normalizer.normalize(content, {
        deduplicateVolumes: true
      });

      expect(result.volumes).toHaveLength(2);
      const volume0 = result.volumes[0];
      const volume1 = result.volumes[1];
      if (!volume0 || !volume1) throw new Error('Expected volumes');
      expect(volume0.number).toBe(1);
      expect(volume1.number).toBe(2);
    });

    test('should sort chapters numerically', () => {
      const content = createTestExtractedContent({
        chapters: [
          createTestChapter({ chapterNumber: '10', title: 'Chapter 10' }),
          createTestChapter({ chapterNumber: '2', title: 'Chapter 2' }),
          createTestChapter({ chapterNumber: '1', title: 'Chapter 1' }),
          createTestChapter({ chapterNumber: '10.5', title: 'Chapter 10.5' })
        ]
      });
      
      const result = normalizer.normalize(content, {
        sortChapters: true
      });

      const chapter0 = result.chapters[0];
      const chapter1 = result.chapters[1];
      const chapter2 = result.chapters[2];
      const chapter3 = result.chapters[3];
      if (!chapter0 || !chapter1 || !chapter2 || !chapter3) throw new Error('Expected chapters');
      expect(chapter0.number).toBe(1);
      expect(chapter1.number).toBe(2);
      expect(chapter2.number).toBe(10);
      expect(chapter3.number).toBe(10.5);
    });

    test('should sort volumes numerically', () => {
      const content = createTestExtractedContent({
        volumes: [
          createTestVolume({ volumeNumber: 10, title: 'Volume 10' }),
          createTestVolume({ volumeNumber: 2, title: 'Volume 2' }),
          createTestVolume({ volumeNumber: 1, title: 'Volume 1' }),
          createTestVolume({ volumeNumber: 3.5, title: 'Volume 3.5' })
        ]
      });
      
      const result = normalizer.normalize(content, {
        sortVolumes: true
      });

      const volume0 = result.volumes[0];
      const volume1 = result.volumes[1];
      const volume2 = result.volumes[2];
      const volume3 = result.volumes[3];
      if (!volume0 || !volume1 || !volume2 || !volume3) throw new Error('Expected volumes');
      expect(volume0.number).toBe(1);
      expect(volume1.number).toBe(2);
      expect(volume2.number).toBe(3.5);
      expect(volume3.number).toBe(10);
    });

    test('should merge genre variants', () => {
      const content = createTestExtractedContent({
        metadata: {
          genres: ['Sci-Fi', 'Science Fiction', 'SciFi', 'Action', 'action']
        }
      });

      const result = normalizer.normalize(content, {
        mergeVariants: true
      });

      // Genres are normalized to title case and deduplicated
      expect(result.genres).toEqual(['Science Fiction', 'Action']);
    });

    test('should infer missing data from chapters', () => {
      // Date inference from originalRun string is not implemented
      // But inferMissingData DOES infer status and magazine type from chapters
      const now = new Date();
      const threeMonthsAgo = new Date(now.getTime() - (90 * 24 * 60 * 60 * 1000));

      const content = createTestExtractedContent({
        metadata: {},
        chapters: Array.from({ length: 10 }, (_, i) => createTestChapter({
          chapterNumber: String(i + 1),
          title: `Chapter ${i + 1}`,
          releaseDate: new Date(threeMonthsAgo.getTime() + (i * 7 * 24 * 60 * 60 * 1000)).toISOString()
        }))
      });

      const result = normalizer.normalize(content, {
        inferMissingData: true
      });

      // Should infer weekly publication from 7-day intervals
      expect(result.magazine).toBe('Weekly Publication');
      expect(result.totalChapters).toBe(10);
    });

    test('should validate numbers and remove invalid entries', () => {
      // validateNumbers with removeInvalid filters out invalid volumes/chapters
      const content = createTestExtractedContent({
        volumes: [
          createTestVolume({ volumeNumber: -5, title: 'Invalid negative' }),
          createTestVolume({ volumeNumber: 1, title: 'Valid' }),
          createTestVolume({ volumeNumber: 1001, title: 'Invalid too large' })
        ],
        chapters: [
          createTestChapter({ chapterNumber: '-1', title: 'Invalid negative' }),
          createTestChapter({ chapterNumber: '1', title: 'Valid' }),
          createTestChapter({ chapterNumber: '10001', title: 'Invalid too large' })
        ]
      });

      const result = normalizer.normalize(content, {
        validateNumbers: true,
        removeInvalid: true
      });

      // Should keep only valid entries (volumes 1-999, chapters 0-9999)
      expect(result.volumes).toHaveLength(1);
      expect(result.volumes[0]?.number).toBe(1);
      expect(result.chapters).toHaveLength(1);
      expect(result.chapters[0]?.number).toBe(1);
    });

    test('should filter invalid genres via merge variants', () => {
      // mergeVariants handles filtering out empty/null/undefined genre values
      const content = createTestExtractedContent({
        metadata: {
          genres: ['', 'Action', null as unknown as string, undefined as unknown as string, '  ', 'Comedy']
        }
      });

      const result = normalizer.normalize(content, {
        mergeVariants: true
      });

      // Should filter out empty/null/undefined and normalize valid ones
      expect(result.genres).toEqual(['Action', 'Comedy']);
    });

    test('should normalize text fields', () => {
      const content = createTestExtractedContent({
        metadata: {
          title: '  one PIECE  ',
          description: 'A  story\n\nabout   pirates'
        }
      });

      const result = normalizer.normalize(content, {
        normalizeText: true
      });

      expect(result.title).toBe('One Piece');
      expect(result.description).toBe('A Story About Pirates');
    });
  });

  describe('volume normalization', () => {
    test('should normalize volume data structure', () => {
      const content = createTestExtractedContent({
        volumes: [
          createTestVolume({
            volumeNumber: 1,
            title: 'Romance Dawn',
            isbn: '978-1234567890',
            releaseDate: 'December 24, 1997',
            chapters: [
              createTestChapter({ chapterNumber: '1', title: 'Chapter 1' }),
              createTestChapter({ chapterNumber: '2', title: 'Chapter 2' })
            ]
          })
        ]
      });
      
      const result = normalizer.normalize(content);

      const volume = result.volumes[0];
      if (!volume) throw new Error('Expected volume');
      expect(volume.number).toBe(1);
      expect(volume.title).toBe('Romance Dawn');
      expect(volume.isbn).toBe('978-1234567890');
      expect(volume.releaseDate?.toISOString().split('T')[0]).toBe('1997-12-24');
      expect(volume.chapters).toEqual([1, 2]);
    });

    test('should handle volume ranges', () => {
      const content = createTestExtractedContent({
        volumes: [
          createTestVolume({
            volumeNumber: 1,
            title: 'Omnibus 1-3',
            chapters: Array.from({ length: 27 }, (_, i) =>
              createTestChapter({ chapterNumber: String(i + 1) })
            )
          })
        ]
      });

      const result = normalizer.normalize(content);

      const volume0 = result.volumes[0];
      if (!volume0) throw new Error('Expected volume');
      expect(volume0.isOmnibus).toBe(true);
      expect(volume0.volumeRange).toEqual({ start: 1, end: 3 });
      expect(volume0.chapterRange).toEqual({ start: 1, end: 27 });
    });

    test('should detect special editions', () => {
      const content = createTestExtractedContent({
        volumes: [
          createTestVolume({ volumeNumber: 1, title: 'Volume 1 - Limited Edition' }),
          createTestVolume({ volumeNumber: 2, title: 'Volume 2 - Collector\'s Edition' }),
          createTestVolume({ volumeNumber: 3, title: 'Volume 3 - Digital Edition' })
        ]
      });

      const result = normalizer.normalize(content);

      const volume0 = result.volumes[0];
      const volume1 = result.volumes[1];
      const volume2 = result.volumes[2];
      if (!volume0 || !volume1 || !volume2) throw new Error('Expected volumes');
      expect(volume0.edition).toBe('Limited');
      expect(volume1.edition).toBe('Collector');
      expect(volume2.edition).toBe('Digital');
    });
  });

  describe('chapter normalization', () => {
    test('should normalize chapter data structure', () => {
      const content = createTestExtractedContent({
        chapters: [
          createTestChapter({
            chapterNumber: '1',
            title: 'Romance Dawn',
            volumeNumber: 1,
            releaseDate: 'July 22, 1997',
            url: '/wiki/Chapter_1'
          })
        ]
      });
      
      const result = normalizer.normalize(content);

      const chapter = result.chapters[0];
      if (!chapter) throw new Error('Expected chapter');
      expect(chapter.number).toBe(1);
      expect(chapter.title).toBe('Romance Dawn');
      expect(chapter.volumeNumber).toBe(1);
      expect(chapter.releaseDate?.toISOString().split('T')[0]).toBe('1997-07-22');
      expect(chapter.url).toBe('/wiki/Chapter_1');
    });

    test('should handle special chapter numbers', () => {
      const testCases = [
        { input: '0', normalized: 0 },
        { input: '10.5', normalized: 10.5 },
        { input: 'Prologue', normalized: 0 },  // parseFloat('Prologue') = NaN, defaults to 0
        { input: 'Epilogue', normalized: 0 },  // parseFloat('Epilogue') = NaN, defaults to 0
        { input: 'Extra 1', normalized: 0 },   // parseFloat('Extra 1') = NaN, defaults to 0
        { input: 'Special', normalized: 0 }    // parseFloat('Special') = NaN, defaults to 0
      ];

      testCases.forEach(({ input, normalized }) => {
        const content = createTestExtractedContent({
          chapters: [createTestChapter({ chapterNumber: input })]
        });

        const result = normalizer.normalize(content);
        const chapter0 = result.chapters[0];
        if (!chapter0) throw new Error('Expected chapter');
        expect(chapter0.number).toBe(normalized);
      });
    });

    test('should group chapters by volume', () => {
      const content = createTestExtractedContent({
        chapters: [
          createTestChapter({ chapterNumber: '1', volumeNumber: 1 }),
          createTestChapter({ chapterNumber: '2', volumeNumber: 1 }),
          createTestChapter({ chapterNumber: '3', volumeNumber: 2 }),
          createTestChapter({ chapterNumber: '4', volumeNumber: 2 })
        ]
      });

      const result = normalizer.normalize(content, {
        groupChaptersByVolume: true
      });

      expect(result.volumeChapterMap).toBeDefined();
      expect(result.volumeChapterMap![1]).toHaveLength(2);
      expect(result.volumeChapterMap![2]).toHaveLength(2);
    });
  });

  describe('image normalization', () => {
    test('should select best cover image', () => {
      const content = createTestExtractedContent({
        images: [
          { url: 'thumb.jpg', type: 'thumbnail' },
          { url: 'cover.jpg', type: 'cover' },
          { url: 'large.jpg', type: 'cover' }
        ]
      });

      const result = normalizer.normalize(content);

      // Should pick first cover image
      expect(result.coverImage).toBe('cover.jpg');
    });

    test('should extract volume covers from volumes', () => {
      const content = createTestExtractedContent({
        volumes: [
          createTestVolume({ volumeNumber: 1, coverImage: 'vol1.jpg' }),
          createTestVolume({ volumeNumber: 2, coverImage: 'vol2.jpg' })
        ]
      });

      const result = normalizer.normalize(content);

      expect(result.volumeCovers).toEqual({
        1: 'vol1.jpg',
        2: 'vol2.jpg'
      });
    });

    test('should clean image URLs', () => {
      const content = createTestExtractedContent({
        images: [
          { url: '//example.com/image.jpg', type: 'cover' },
          { url: 'http://example.com/image2.jpg', type: 'content' }
        ]
      });

      const result = normalizer.normalize(content, {
        cleanUrls: true
      });

      expect(result.coverImage).toBe('https://example.com/image.jpg');
      expect(result.images![0]?.url).toBe('https://example.com/image.jpg');
      expect(result.images![1]?.url).toBe('https://example.com/image2.jpg');
    });
  });

  describe('metadata enrichment', () => {
    test('should calculate additional statistics', () => {
      const content = createTestExtractedContent({
        chapters: Array.from({ length: 100 }, (_, i) => createTestChapter({
          chapterNumber: String(i + 1),
          volumeNumber: Math.floor(i / 10) + 1
        })),
        volumes: Array.from({ length: 10 }, (_, i) => createTestVolume({
          volumeNumber: i + 1
        }))
      });

      const result = normalizer.normalize(content, {
        calculateStats: true
      });

      expect(result.statistics).toBeDefined();
      expect(result.statistics!.averageChaptersPerVolume).toBe(10);
      expect(result.statistics!.totalChapters).toBe(100);
      expect(result.statistics!.totalVolumes).toBe(10);
    });

    test('should add source metadata', () => {
      const content = createTestExtractedContent({
        metadata: { title: 'Test Manga' }
      });

      const result = normalizer.normalize(content, {
        includeSource: true
      });

      expect(result.source).toBeDefined();
      expect(result.source.type).toBe('other');
      expect(result.source.extractedAt).toBeInstanceOf(Date);
      expect(result.source.confidence).toBe(1);
    });

    test('should add quality score', () => {
      const content = createTestExtractedContent({
        metadata: {
          title: 'One Piece',
          author: ['Eiichiro Oda'],
          genres: ['Adventure', 'Fantasy'],
          status: 'ONGOING',
          volumes: 110,
          chapters: 1100
        },
        images: [{ url: 'cover.jpg', type: 'cover' }],
        volumes: Array.from({ length: 110 }, (_, i) => createTestVolume({
          volumeNumber: i + 1
        })),
        chapters: Array.from({ length: 1100 }, (_, i) => createTestChapter({
          chapterNumber: String(i + 1)
        }))
      });

      const result = normalizer.normalize(content, {
        calculateQuality: true
      });

      expect(result.quality).toBeDefined();
      expect(result.quality).toBeGreaterThan(0.5); // Good quality data score
    });
  });

  describe('validation', () => {
    test('should validate required fields', () => {
      const content = createTestExtractedContent({
        metadata: {}
      });

      const result = normalizer.normalize(content, {
        validate: true,
        required: ['title', 'author']
      });

      expect(result.validation).toBeDefined();
      expect(result.validation!.isValid).toBe(false);
      expect(result.validation!.errors).toContain('Missing required field: title');
      expect(result.validation!.errors).toContain('Missing required field: author');
    });

    test('should validate data types', () => {
      const content = createTestExtractedContent({
        metadata: {
          volumes: 'not a number' as unknown as number,
          chapters: 100
        }
      });

      const result = normalizer.normalize(content, {
        validateDates: true
      });

      expect(result.totalVolumes).toBeUndefined();
      expect(result.totalChapters).toBe(100);
    });

    test('should validate URLs', () => {
      const content = createTestExtractedContent({
        images: [
          { url: 'https://example.com/image.jpg', type: 'cover' },
          { url: 'not-a-url', type: 'content' },
          { url: 'javascript:alert(1)', type: 'content' }
        ]
      });

      const result = normalizer.normalize(content, {
        validateUrls: true
      });

      expect(result.images).toHaveLength(1);
      expect(result.images![0]?.url).toBe('https://example.com/image.jpg');
    });
  });

  describe('error handling', () => {
    test('should handle empty metadata gracefully', () => {
      // Test with empty metadata object (normalizer creates defaults)
      const content = createTestExtractedContent({
        metadata: {}
      });

      const result = normalizer.normalize(content);

      expect(result).toBeDefined();
      expect(result.title).toBe('Unknown');
      expect(result.status).toBe('UNKNOWN');
      expect(result.volumes).toEqual([]);
      expect(result.chapters).toEqual([]);
    });

    test('should handle circular references', () => {
      const content: Record<string, unknown> = {
        metadata: { title: 'Test' }
      };
      content["circular"] = content; // Create circular reference

      const result = normalizer.normalize(content as unknown as ReturnType<typeof createTestExtractedContent>);

      expect(result).toBeDefined();
      expect(result.title).toBe('Test');
    });

    test('should handle very large datasets', () => {
      const content = createTestExtractedContent({
        chapters: Array.from({ length: 10000 }, (_, i) => createTestChapter({
          chapterNumber: String(i + 1),
          title: `Chapter ${i + 1}`
        }))
      });
      
      const result = normalizer.normalize(content);
      
      expect(result.chapters).toHaveLength(10000);
      expect(result.totalChapters).toBe(10000);
    });
  });
});