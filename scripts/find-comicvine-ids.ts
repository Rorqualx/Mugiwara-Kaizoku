/**
 * Quick test to find correct ComicVine volume IDs for popular manga
 */

import { comicvineService } from '@/server/services/comicvine/service';
import { logger } from '@/utils/logger';

async function main() {
  logger.info('Initializing ComicVine service...');
  const initialized = await comicvineService.initialize();

  if (!initialized) {
    logger.error('Failed to initialize ComicVine service');
    return;
  }

  logger.info('✓ ComicVine service initialized');

  // Search for popular manga titles
  const searchTitles = [
    'One Piece',
    'Naruto',
    'Dragon Ball',
    'My Hero Academia',
    'Demon Slayer'
  ];

  for (const title of searchTitles) {
    logger.info(`\nSearching for: ${title}`);

    try {
      const results = await comicvineService.searchBasicVolumes(title, 0, 5);

      if (results.length === 0) {
        logger.warn(`  No results found`);
        continue;
      }

      logger.info(`  Found ${results.length} results:`);

      for (const result of results.slice(0, 3)) {
        const publisher = typeof result.publisher === 'string'
          ? result.publisher
          : result.publisher?.name || 'Unknown';

        logger.info(`    - ID: ${result.id}`);
        logger.info(`      Name: ${result.name}`);
        logger.info(`      Publisher: ${publisher}`);
        logger.info(`      Issues: ${result.count_of_issues ?? 0}`);
        logger.info(`      URL: ${result.site_detail_url ?? 'N/A'}`);
      }
    } catch (error) {
      logger.error(`  Error: ${error instanceof Error ? error.message : String(error)}`);
    }

    // Rate limiting - ComicVine free tier is 200 requests/hour
    await new Promise(resolve => setTimeout(resolve, 3000));
  }

  logger.info('\n✓ Search complete');
}

main()
  .catch(logger.error)
  .finally(() => process.exit(0));