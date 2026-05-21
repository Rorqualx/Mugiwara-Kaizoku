/**
 * Check raw ComicVine API key from database (no masking)
 */

import { prisma } from '@/server/db';
import { logger } from '@/utils/logger';

async function main() {
  // Get the raw config entry
  const config = await prisma.config.findUnique({
    where: { key: 'comicvine.apiKey' }
  });

  if (!config) {
    logger.warn('comicvine.apiKey config entry not found');
    return;
  }

  logger.info('Raw comicvine.apiKey config:', {
    key: config.key,
    value: config.value,
    valueType: config.valueType,
    valueLength: config.value.length,
    isEmpty: config.value === '',
    firstChar: config.value.length > 0 ? config.value[0] : '(empty)',
    lastChar: config.value.length > 0 ? config.value[config.value.length - 1] : '(empty)'
  });

  // Also check if there's an environment variable
  const envKey = process.env.COMICVINE_API_KEY;
  logger.info('Environment variable COMICVINE_API_KEY:', {
    exists: !!envKey,
    length: envKey?.length ?? 0,
    firstChar: envKey?.length > 0 ? envKey[0] : '(empty)',
    lastChar: envKey?.length > 0 ? envKey[envKey.length - 1] : '(empty)'
  });
}

main()
  .catch(logger.error)
  .finally(() => process.exit(0));