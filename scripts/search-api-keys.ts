/**
 * Search for all API keys in database configuration
 */

import { prisma } from '@/server/db';
import { logger } from '@/utils/logger';

async function main() {
  // Search for any config with "api" or "key" in the key name
  const apiConfigs = await prisma.config.findMany({
    where: {
      OR: [
        { key: { contains: 'api', mode: 'insensitive' } },
        { key: { contains: 'key', mode: 'insensitive' } },
        { key: { contains: 'comicvine', mode: 'insensitive' } },
      ]
    }
  });

  logger.info(`Found ${apiConfigs.length} API-related config entries`);

  for (const config of apiConfigs) {
    const value = config.value;
    const displayValue = value.length > 50 ? `${value.substring(0, 50)}...` : value;

    logger.info(`${config.key}:`, {
      value: displayValue,
      valueType: config.valueType,
      source: config.source
    });
  }
}

main()
  .catch(logger.error)
  .finally(() => process.exit(0));