/**
 * Check ComicVine configuration in database
 */

import { prisma } from '@/server/db';
import { logger } from '@/utils/logger';

async function main() {
  const comicvineConfig = await prisma.config.findMany({
    where: {
      key: {
        contains: 'comicvine',
        mode: 'insensitive'
      }
    }
  });

  logger.info('ComicVine config:', { config: comicvineConfig });

  if (comicvineConfig.length === 0) {
    logger.warn('No ComicVine configuration found in database!');
  }
}

main()
  .catch(logger.error)
  .finally(() => process.exit(0));
