import { faker } from '@faker-js/faker';

interface MetadataFactoryOptions {
  id?: number;
  mangaId?: number;
  anilistId?: number;
  rating?: number;
  genres?: string[];
  author?: string;
  year?: number;
}

export const createMetadata = (options: MetadataFactoryOptions = {}) => ({
  id: options.id ?? faker.number.int({ min: 1, max: 10000 }),
  mangaId: options.mangaId ?? faker.number.int({ min: 1, max: 1000 }),
  anilistId: options.anilistId ?? faker.number.int({ min: 1000, max: 999999 }),
  rating: options.rating ?? faker.number.float({ min: 5.0, max: 10.0, fractionDigits: 1 }),
  genres: options.genres ?? faker.helpers.arrayElements(['Action', 'Adventure', 'Comedy', 'Drama'], { min: 1, max: 3 }),
  author: options.author ?? faker.person.fullName(),
  year: options.year ?? faker.number.int({ min: 1990, max: 2024 }),
});