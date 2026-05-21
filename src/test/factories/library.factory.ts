/**
 * Library Factory
 */

import type { Library } from '@prisma/client';

import { faker } from '@faker-js/faker';

export interface LibraryFactoryOptions {
  id?: number;
  name?: string;
  path?: string;
  withManga?: boolean;
  mangaCount?: number;
}

export const createLibrary = (options: LibraryFactoryOptions = {}): Partial<Library> => ({
  id: options['id'] || faker.number.int({ min: 1, max: 100 }),
  name: options['name'] || faker.helpers.arrayElement(['Main Library', 'Manga Collection', 'Downloads', 'Archive']),
  path: options['path'] || `/library/${faker.string.alphanumeric(8)}`,
  createdAt: faker.date.past({ years: 1 }),
});

export const createLibraryList = (count: number = 5, options: LibraryFactoryOptions = {}): Partial<Library>[] =>
  Array.from({ length: count }, (_, i) => {
    const libraryOptions: LibraryFactoryOptions = { ...options };

    // Only add id if it exists in options
    if (options['id'] !== undefined) {
      libraryOptions.id = options['id'] + i;
    }

    return createLibrary(libraryOptions);
  });