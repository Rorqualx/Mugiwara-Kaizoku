/**
 * Check ComicVine Series Page Structure
 *
 * Series pages might have chapter lists that individual volume pages don't
 */

import { comicvineService } from '@/server/services/comicvine/service';
import { logger } from '@/utils/logger';

async function checkSeriesPage() {
  const seriesId = 18836; // Naruto series ID

  logger.info('Fetching series info...');

  const initialized = await comicvineService.initialize();
  if (!initialized) {
    logger.error('Failed to initialize ComicVine service');
    process.exit(1);
  }

  const volumeInfo = await comicvineService.getCompleteVolumeInfo(seriesId);
  if (!volumeInfo) {
    logger.error('Failed to fetch series info');
    process.exit(1);
  }

  logger.info('\n=== Series Info ===');
  logger.info(`ID: ${volumeInfo.id}`);
  logger.info(`Name: ${volumeInfo.name}`);
  logger.info(`Site URL: ${volumeInfo.site_detail_url ?? 'none'}`);
  logger.info(`API URL: ${volumeInfo.api_detail_url ?? 'none'}`);
  logger.info(`Count of Issues: ${volumeInfo.count_of_issues ?? 0}`);

  // Check if series page URL is different from volume page URL
  const seriesUrl = volumeInfo.site_detail_url;
  if (!seriesUrl) {
    logger.error('No site_detail_url available');
    process.exit(1);
  }

  logger.info(`\nSeries URL: ${seriesUrl}`);
  logger.info(`Volume URL example: https://comicvine.gamespot.com/naruto-1-the-tests-of-the-ninja/4000-111264/`);

  logger.info('\n=== Key Finding ===');
  logger.info('Series pages list volumes (issues), NOT individual chapters.');
  logger.info('Chapter titles must be scraped from individual volume pages.');
  logger.info('But individual volume pages might not have chapter lists either.');

  logger.info('\n=== Next Step ===');
  logger.info('Check if volume pages have chapter lists by inspecting more HTML');
  logger.info('Or check if ComicVine API provides chapter data');
}

checkSeriesPage()
  .catch(logger.error)
  .finally(() => process.exit(0));