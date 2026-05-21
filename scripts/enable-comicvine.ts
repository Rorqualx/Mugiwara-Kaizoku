/**
 * Enable ComicVine and set API key from database
 *
 * This script:
 * 1. Enables ComicVine integration
 * 2. Sets the API key (if provided as argument)
 */

import { prisma } from '@/server/db';
import { logger } from '@/utils/logger';

async function main() {
  const args = process.argv.slice(2);
  const apiKey = args.find(a => a.startsWith('--api-key='))?.split('=')[1];

  logger.info('Updating ComicVine configuration...');

  // Enable ComicVine integration
  await prisma.config.update({
    where: { key: 'comicvine.enabled' },
    data: { value: 'true' }
  });
  logger.info('✓ Enabled ComicVine integration');

  // Set API key if provided
  if (apiKey) {
    await prisma.config.update({
      where: { key: 'comicvine.apiKey' },
      data: { value: apiKey }
    });
    logger.info('✓ Set ComicVine API key');
  } else {
    logger.warn('No API key provided. Use --api-key=YOUR_KEY to set it.');
    const currentKey = await prisma.config.findUnique({
      where: { key: 'comicvine.apiKey' }
    });
    logger.info(`Current API key: ${currentKey?.value || '(empty)'}`);
  }

  // Verify configuration
  const enabled = await prisma.config.findUnique({
    where: { key: 'comicvine.enabled' }
  });
  const keyConfig = await prisma.config.findUnique({
    where: { key: 'comicvine.apiKey' }
  });

  logger.info('Current ComicVine configuration:', {
    enabled: enabled?.value,
    hasApiKey: !!keyConfig?.value
  });
}

main()
  .catch(logger.error)
  .finally(() => process.exit(0));