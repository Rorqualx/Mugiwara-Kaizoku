/**
 * Chapter Factory
 *
 * Generates realistic chapter test data with proper relationships
 * to manga and variety for testing different scenarios.
 */

import type { Chapter } from '@prisma/client';

import { faker } from '@faker-js/faker';

const DOWNLOAD_STATUSES = [
'PENDING', 'DOWNLOADING', 'COMPLETED', 'ERROR', 'DELETED'] as
const;

const CHAPTER_LANGUAGES = ['en', 'jp', 'kr', 'zh', 'fr', 'es', 'de'];

const MIME_TYPES = [
'application/zip', 'application/x-cbz', 'application/x-cbr',
'application/pdf', 'image/jpeg', 'image/png'];


const RESOLUTION_LABELS = ['480p', '720p', '1080p', '1440p', '2160p'];

export interface ChapterFactoryOptions {
  id?: number;
  mangaId?: number;
  index?: number;
  title?: string;
  language?: string;
  downloadStatus?: typeof DOWNLOAD_STATUSES[number];
  withPages?: boolean;
  pageCount?: number;
  withDownloadInfo?: boolean;
  withErrors?: boolean;
  highQuality?: boolean;
  recentlyAdded?: boolean;
}

/**
 * Creates a single chapter with realistic data
 */
export const createChapter = (options: ChapterFactoryOptions = {}): Partial<Chapter> => {
  const baseDate = options.recentlyAdded ?
  faker.date.recent({ days: 7 }) :
  faker.date.past({ years: 1 });

  const index = options.index || faker.number.int({ min: 1, max: 1000 });
  const title = options["title"] || `Chapter ${index}: ${faker.lorem.words(3)}`;
  const fileName = `chapter-${String(index).padStart(3, '0')}.cbz`;

  // Generate realistic page counts and file sizes
  const pageCount = options.pageCount || faker.number.int({ min: 15, max: 45 });
  const avgPageSize = options.highQuality ? 2000000 : 800000; // 2MB vs 800KB per page
  const fileSize = pageCount * avgPageSize + faker.number.int({ min: -200000, max: 200000 });

  // High quality chapters have better resolution
  const resolutionWidth = options.highQuality ?
  faker.number.int({ min: 1920, max: 3840 }) :
  faker.number.int({ min: 1280, max: 1920 });
  const resolutionHeight = Math.floor(resolutionWidth * 1.4); // Manga aspect ratio

  return {
    id: options["id"] || faker.number.int({ min: 1, max: 100000 }),
    fileName,
    index,
    size: fileSize,
    pageCount,
    resolutionWidth,
    resolutionHeight,
    resolutionLabel: faker.helpers.arrayElement(RESOLUTION_LABELS),
    language: options.language || faker.helpers.arrayElement(CHAPTER_LANGUAGES),
    mangaId: options.mangaId || faker.number.int({ min: 1, max: 1000 }),
    title,
    createdAt: baseDate,
    updatedAt: faker.date.between({ from: baseDate, to: new Date() }),
    downloadStatus: options.downloadStatus || faker.helpers.arrayElement(DOWNLOAD_STATUSES),
    downloadUrl: options.withDownloadInfo ?
    `https://example.com/download/${faker.string.alphanumeric(20)}` :
    null,
    hash: faker.string.alphanumeric(64),
    mimeType: faker.helpers.arrayElement(MIME_TYPES)
  };
};

/**
 * Creates multiple chapters for a manga
 */
export const createChapterList = (
count: number = 10,
options: ChapterFactoryOptions = {})
: Partial<Chapter>[] => {
  return Array.from({ length: count }, (_, index) => {
    const chapterOptions: ChapterFactoryOptions = {
      ...options,
      index: (options.index || 1) + index,
    };

    // Only add id if it exists in options
    if (options['id'] !== undefined) {
      chapterOptions.id = options['id'] + index;
    }

    return createChapter(chapterOptions);
  });
};

/**
 * Creates chapters with specific scenarios for testing
 */
export const createChapterScenarios = (mangaId: number = 1) => ({
  // Recently added chapter
  newChapter: createChapter({
    mangaId,
    downloadStatus: 'COMPLETED',
    recentlyAdded: true,
    highQuality: true,
    withDownloadInfo: true
  }),

  // Chapter currently downloading
  downloadingChapter: createChapter({
    mangaId,
    downloadStatus: 'DOWNLOADING',
    withDownloadInfo: true
  }),

  // Failed download chapter
  failedChapter: createChapter({
    mangaId,
    downloadStatus: 'ERROR',
    withErrors: true,
    withDownloadInfo: true
  }),

  // Pending download chapter
  pendingChapter: createChapter({
    mangaId,
    downloadStatus: 'PENDING',
    withDownloadInfo: true
  }),

  // High quality chapter
  highQualityChapter: createChapter({
    mangaId,
    downloadStatus: 'COMPLETED',
    highQuality: true,
    pageCount: 35
  }),

  // Multi-language chapters
  englishChapter: createChapter({
    mangaId,
    language: 'en',
    downloadStatus: 'COMPLETED'
  }),

  japaneseChapter: createChapter({
    mangaId,
    language: 'jp',
    downloadStatus: 'COMPLETED'
  }),

  // Chapter with many pages
  longChapter: createChapter({
    mangaId,
    downloadStatus: 'COMPLETED',
    pageCount: 60,
    title: 'Special Long Chapter'
  })
});

/**
 * Creates a complete chapter series for testing
 */
export const createChapterSeries = (
mangaId: number,
totalChapters: number = 50,
options: {
  completedRatio?: number; // 0-1, how many are completed
  withErrors?: boolean;
  multiLanguage?: boolean;
  mixedQuality?: boolean;
} = {}) =>
{
  const chapters: Partial<Chapter>[] = [];
  const completedCount = Math.floor(totalChapters * (options.completedRatio ?? 0.8));

  for (let i = 1; i <= totalChapters; i++) {
    const isCompleted = i <= completedCount;
    const hasError = options.withErrors === true && Math.random() < 0.05; // 5% error rate

    chapters.push(createChapter({
      mangaId,
      index: i,
      downloadStatus: hasError ? 'ERROR' : isCompleted ? 'COMPLETED' : 'PENDING',
      language: options.multiLanguage ?
      faker.helpers.arrayElement(CHAPTER_LANGUAGES) :
      'en',
      highQuality: options.mixedQuality ? Math.random() > 0.5 : true,
      withErrors: hasError,
      withDownloadInfo: true
    }));
  }

  return chapters;
};

/**
 * Creates chapters for performance testing
 */
export const createLargeChapterDataset = (
mangaIds: number[],
chaptersPerManga: number = 100) =>
{
  const chapters: Partial<Chapter>[] = [];

  mangaIds.forEach((mangaId) => {
    const mangaChapters = createChapterSeries(mangaId, chaptersPerManga, {
      completedRatio: 0.9,
      withErrors: true,
      multiLanguage: true,
      mixedQuality: true
    });
    chapters.push(...mangaChapters);
  });

  return chapters;
};

/**
 * Creates chapters with different download patterns
 */
export const createDownloadPatterns = (mangaId: number) => ({
  // All completed
  allCompleted: createChapterList(20, {
    mangaId,
    downloadStatus: 'COMPLETED',
    withDownloadInfo: true
  }),

  // Mixed statuses
  mixedStatuses: [
  ...createChapterList(5, { mangaId, downloadStatus: 'COMPLETED' }),
  ...createChapterList(3, { mangaId, downloadStatus: 'DOWNLOADING' }),
  ...createChapterList(2, { mangaId, downloadStatus: 'PENDING' }),
  ...createChapterList(1, { mangaId, downloadStatus: 'ERROR', withErrors: true })],


  // All failed (for error testing)
  allFailed: createChapterList(10, {
    mangaId,
    downloadStatus: 'ERROR',
    withErrors: true,
    withDownloadInfo: true
  }),

  // Batch download simulation
  batchDownload: createChapterList(50, {
    mangaId,
    downloadStatus: 'PENDING',
    withDownloadInfo: true,
    recentlyAdded: true
  })
});