import { faker } from '@faker-js/faker';

interface SearchResultFactoryOptions {
  title?: string;
  source?: string;
  externalId?: string;
  coverUrl?: string;
  summary?: string;
  status?: string;
  year?: number;
}

export const createSearchResult = (options: SearchResultFactoryOptions = {}) => ({
  title: options.title ?? faker.helpers.arrayElement(['One Piece', 'Naruto', 'Attack on Titan']),
  source: options.source ?? faker.helpers.arrayElement(['anilist', 'comicvine', 'fandom']),
  externalId: options.externalId ?? faker.string.alphanumeric(10),
  coverUrl: options.coverUrl ?? faker.image.url(),
  summary: options.summary ?? faker.lorem.paragraph(),
  status: options.status ?? faker.helpers.arrayElement(['ONGOING', 'COMPLETED', 'HIATUS']),
  year: options.year ?? faker.number.int({ min: 2000, max: 2024 }),
});