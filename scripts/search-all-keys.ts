/**
 * Search for any config that might contain an API key (checking all configs)
 */

import { prisma } from '@/server/db';
import { logger } from '@/utils/logger';

async function main() {
  // Get ALL config entries
  const allConfigs = await prisma.config.findMany();

  logger.info(`Checking all ${allConfigs.length} config entries for potential API keys...`);

  // Look for configs with non-empty values that might be API keys
  const potentialApiKeys = allConfigs.filter(c =>
    c.valueType === 'STRING' &&
    c.value.length > 10 &&
    c.value.length < 100 &&
    !c.value.includes(' ') &&
    !c.value.includes('http') &&
    !c.key.includes('description') &&
    !c.key.includes('message') &&
    !c.key.includes('template') &&
    !c.key.includes('path') &&
    !c.key.includes('url') &&
    !c.key.includes('endpoint')
  );

  logger.info(`Found ${potentialApiKeys.length} potential API key entries`);

  for (const config of potentialApiKeys) {
    const maskedValue = config.value.substring(0, 4) + '...' + config.value.substring(config.value.length - 4);
    logger.info(`${config.key}:`, {
      maskedValue,
      length: config.value.length,
      valueType: config.valueType,
      scope: config.scope
    });
  }

  // Specifically check comicvine-related configs
  const comicvineConfigs = allConfigs.filter(c => c.key.toLowerCase().includes('comicvine'));
  logger.info(`=== ComicVine Configs (${comicvineConfigs.length}) ===`);
  for (const config of comicvineConfigs) {
    const value = config.value.length > 0 ? config.value : '(empty)';
    const masked = config.value.length > 8 ? `${config.value.substring(0, 4)}...${config.value.substring(config.value.length - 4)}` : value;
    logger.info(`${config.key}:`, { masked, length: config.value.length });
  }
}

main()
  .catch(logger.error)
  .finally(() => process.exit(0));