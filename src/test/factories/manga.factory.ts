/**
 * Manga Factory
 *
 * Generates realistic manga test data with proper relationships
 * and variety for comprehensive testing scenarios.
 */

import type { Manga } from '@prisma/client';

import { faker } from '@faker-js/faker';
import { toNumberId } from '@/utils/id-converters';

// Predefined manga titles for realistic data
const POPULAR_MANGA_TITLES = [
  'One Piece', 'Naruto', 'Attack on Titan', 'Death Note', 'Dragon Ball',
  'Demon Slayer', 'My Hero Academia', 'Hunter x Hunter', 'Fullmetal Alchemist',
  'Tokyo Ghoul', 'Bleach', 'JoJo\'s Bizarre Adventure', 'Code Geass',
  'Cowboy Bebop', 'Spirited Away', 'Princess Mononoke', 'Akira',
  'Ghost in the Shell', 'Evangelion', 'One Punch Man', 'Mob Psycho 100',
  'Dr. Stone', 'Black Clover', 'Fairy Tail', 'Seven Deadly Sins'
];

const MANGA_SOURCES = [
  'anilist', 'comicvine', 'fandom', 'local'
];

const MANGA_STATUSES = [
  'ONGOING', 'COMPLETED', 'HIATUS', 'CANCELLED', 'NOT_YET_PUBLISHED', 'UNKNOWN'
] as const;

const SEARCH_PROVIDERS = [
  'anilist', 'comicvine', 'fandom'
];

export interface MangaFactoryOptions {
  id?: number;
  title?: string;
  source?: string;
  status?: typeof MANGA_STATUSES[number];
  libraryId?: number;
  metadataId?: number;
  searchProvider?: string;
  syncCount?: number;
  withChapters?: boolean;
  chapterCount?: number;
  withMetadata?: boolean;
  withErrors?: boolean;
  lastSyncDaysAgo?: number;
}

/**
 * Creates a single manga with realistic data
 */
export const createManga = (options: MangaFactoryOptions = {}): Partial<Manga> => {
  const baseDate = faker.date.past({ years: 2 });
  const lastChecked = options.lastSyncDaysAgo 
    ? faker.date.recent({ days: options.lastSyncDaysAgo })
    : faker.date.recent({ days: 7 });

  const title = options["title"] || faker.helpers.arrayElement(POPULAR_MANGA_TITLES);
  const cleanTitle = title.toLowerCase().replace(/[^a-z0-9]/g, '-');

  return {
    id: options["id"] || faker.number.int({ min: 1, max: 10000 }),
    title,
    source: options["source"] || faker.helpers.arrayElement(MANGA_SOURCES),
    libraryId: options.libraryId || faker.number.int({ min: 1, max: 10 }),
    metadataId: options.metadataId || faker.number.int({ min: 1, max: 10000 }),
    lastChecked,
    libraryPath: `/manga/${cleanTitle}`,
    mangaTitle: title,
    createdAt: baseDate,
    // error field removed - not in Manga type
    lastErrorAt: options.withErrors ? faker.date.recent({ days: 1 }) : null,
    lastSyncAt: lastChecked,
    summary: faker.lorem.paragraphs(2),
    syncCount: faker.number.int({ min: 0, max: 50 }),
    updatedAt: faker.date.between({ from: baseDate, to: new Date() }),
    publicationStatus: options["status"] || faker.helpers.arrayElement(MANGA_STATUSES),
    fileStatus: 'PENDING',
    libraryStatus: 'ACTIVE',
    searchProvider: options.searchProvider || faker.helpers.arrayElement(SEARCH_PROVIDERS),
    providerMetadata: options.withMetadata ? {
      anilistId: faker.number.int({ min: 1000, max: 999999 }),
      comicvineId: faker.number.int({ min: 1000, max: 999999 }),
      rating: faker.number.float({ min: 5.0, max: 10.0, fractionDigits: 1 }),
      genres: faker.helpers.arrayElements([
        'Action', 'Adventure', 'Comedy', 'Drama', 'Fantasy', 'Horror',
        'Mystery', 'Romance', 'Sci-Fi', 'Slice of Life', 'Sports', 'Supernatural'
      ], { min: 1, max: 5 }),
      tags: faker.helpers.arrayElements([
        'School', 'Magic', 'Demons', 'Super Power', 'Military', 'Police',
        'Psychological', 'Vampire', 'Zombie', 'Time Travel', 'Parallel World'
      ], { min: 0, max: 8 }),
      year: faker.number.int({ min: 1990, max: 2024 }),
      status: faker.helpers.arrayElement(['ONGOING', 'COMPLETED', 'HIATUS', 'CANCELLED']),
      author: faker.person.fullName(),
      artist: Math.random() > 0.7 ? faker.person.fullName() : undefined,
    } : {},
    monitoringConfig: {
      checkInterval: faker.helpers.arrayElement(['daily', 'weekly', 'monthly']),
      autoDownload: faker.datatype.boolean(),
      qualityProfile: faker.helpers.arrayElement(['high', 'medium', 'low']),
      languagePreference: faker.helpers.arrayElement(['en', 'jp', 'kr', 'any']),
      notificationEnabled: faker.datatype.boolean(),
    },
  };
};

/**
 * Creates multiple manga with variety
 */
export const createMangaList = (count: number = 10, options: MangaFactoryOptions = {}): Partial<Manga>[] => {
  return Array.from({ length: count }, (_, index) => {
    const mangaOptions: MangaFactoryOptions = { ...options };

    // Only add id if it exists in options
    if (options['id'] !== undefined) {
      mangaOptions.id = options['id'] + index;
    }

    return createManga(mangaOptions);
  });
};

/**
 * Creates manga with specific scenarios for testing
 */
export const createMangaScenarios = () => ({
  // Recently added manga
  newManga: createManga({
    status: 'ONGOING',
    lastSyncDaysAgo: 1,
    syncCount: 1,
    withChapters: false,
  }),

  // Manga with many chapters
  popularManga: createManga({
    title: 'One Piece',
    status: 'ONGOING',
    chapterCount: 1000,
    withChapters: true,
    syncCount: 25,
    withMetadata: true,
  }),

  // Completed manga
  completedManga: createManga({
    status: 'COMPLETED',
    lastSyncDaysAgo: 30,
    chapterCount: 50,
    withChapters: true,
    withMetadata: true,
  }),

  // Manga with sync errors
  errorManga: createManga({
    status: 'ONGOING',
    withErrors: true,
    lastSyncDaysAgo: 7,
    syncCount: 10,
  }),

  // Manga without metadata
  basicManga: createManga({
    status: 'ONGOING',
    withMetadata: false,
    searchProvider: 'local',
  }),

  // Manga from different sources
  anilistManga: createManga({
    source: 'anilist',
    searchProvider: 'anilist',
    withMetadata: true,
  }),

  localManga: createManga({
    source: 'local',
    searchProvider: 'local',
    withMetadata: false,
  }),
});

/**
 * Creates manga with realistic relationships
 */
export const createMangaWithRelations = (options: MangaFactoryOptions & {
  includeChapters?: boolean;
  includeLibrary?: boolean;
  includeMetadata?: boolean;
} = {}) => {
  const manga = createManga(options);

  const relations: Record<string, unknown> = { manga };

  if (options.includeChapters) {
    // Dynamic import to avoid circular dependency

    const { createChapterList } = require('./chapter.factory') as {
      createChapterList: (count: number, options: { mangaId?: number }) => unknown[];
    };
    const mangaId = manga["id"];
    const chapterOptions = mangaId !== undefined ? { mangaId } : {};
    relations["chapters"] = createChapterList(
      options.chapterCount ?? faker.number.int({ min: 1, max: 100 }),
      chapterOptions
    );
  }

  if (options.includeLibrary) {

    const { createLibrary } = require('./library.factory') as {
      createLibrary: (options: { id?: number }) => unknown;
    };
    const libraryId = manga["libraryId"];
    const libraryOptions = libraryId !== undefined ? { id: libraryId } : {};
    relations['library'] = createLibrary(libraryOptions);
  }

  if (options.includeMetadata) {

    const { createMetadata } = require('./metadata.factory') as {
      createMetadata: (options: { id?: number; mangaId?: number }) => unknown;
    };
    const metadataId = manga["metadataId"];
    const mangaId = manga["id"];
    const metadataOptions: { id?: number; mangaId?: number } = {};
    if (metadataId !== undefined && metadataId !== null) {
      metadataOptions.id = metadataId;
    }
    if (mangaId !== undefined) {
      metadataOptions.mangaId = mangaId;
    }
    relations["metadata"] = createMetadata(metadataOptions);
  }

  return relations;
};

/**
 * Creates manga for performance testing
 */
export const createLargeMangaDataset = (count: number = 1000) => {
  const libraries = Array.from({ length: 10 }, (_, i) => i + 1);
  
  return Array.from({ length: count }, (_, index) => 
    createManga({
      id: index + 1,
      libraryId: faker.helpers.arrayElement(libraries),
      withMetadata: Math.random() > 0.3, // 70% have metadata
      withErrors: Math.random() > 0.9, // 10% have errors
      lastSyncDaysAgo: faker.number.int({ min: 1, max: 365 }),
    })
  );
};