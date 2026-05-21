// Helper functions for safe type handling
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

import { faker } from '@faker-js/faker';

export const createDownload = (options: Record<string, unknown> = {}) => ({
  id: options["id"] || faker.string.uuid(),
  url: faker.internet.url(),
  status: options["status"] || faker.helpers.arrayElement(['PENDING', 'DOWNLOADING', 'COMPLETED', 'FAILED']),
  progress: faker.number.float({ min: 0, max: 100, fractionDigits: 1 }),
  mangaId: options["mangaId"] || faker.number.int({ min: 1, max: 1000 }),
  chapterId: options["chapterId"] || faker.number.int({ min: 1, max: 10000 }),
  createdAt: faker.date.recent({ days: 7 }),
});