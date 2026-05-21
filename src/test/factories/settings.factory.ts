import { faker } from '@faker-js/faker';

// Helper functions for safe type handling
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export const createSettings = (options: Record<string, unknown> = {}) => ({
  id: options['id'] || 1,
  anilistEnabled: options['anilistEnabled'] ?? faker.datatype.boolean(),
  anilistUseForMetadata: options['anilistUseForMetadata'] ?? faker.datatype.boolean(),
  prowlarrEnabled: options['prowlarrEnabled'] ?? faker.datatype.boolean(),
  prowlarrBaseURL: options['prowlarrBaseURL'] || (Math.random() > 0.5 ? faker.internet.url() : null),
  prowlarrApiKey: options['prowlarrApiKey'] || (Math.random() > 0.5 ? faker.string.alphanumeric(32) : null),
  metadata: JSON.stringify(options['metadata'] ?? {}),
  eventSettings: JSON.stringify(options['eventSettings'] ?? {}),
});