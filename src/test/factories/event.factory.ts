// Helper functions for safe type handling
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

import { faker } from '@faker-js/faker';

export const createEvent = (options: Record<string, unknown> = {}) => ({
  id: options["id"] || faker.string.uuid(),
  timestamp: faker.date.recent({ days: 7 }),
  type: options["type"] || faker.helpers.arrayElement(['info', 'warning', 'error']),
  source: options["source"] || faker.helpers.arrayElement(['system', 'USER', 'integration']),
  level: options["level"] || 'INFO',
  message: faker.lorem.sentence(),
  details: options["details"] ?? {},
});