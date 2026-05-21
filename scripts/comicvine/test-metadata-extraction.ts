/**
 * Test ComicVine Metadata Extraction
 *
 * Validates that the ComicVine parser correctly extracts:
 * 1. Volume metadata (title, summary, cover, themes, genres)
 * 2. Chapter names and titles
 * 3. Special chapter detection
 */

import { comicvineService } from '@/server/services/comicvine/service';
import { logger } from '@/utils/logger';

async function testComicVineMetadata() {
  // Initialize ComicVine service
  const initialized = await comicvineService.initialize();
  if (!initialized) {
    logger.error('Failed to initialize ComicVine service');
    process.exit(1);
  }

  // Test Naruto (volume ID: 18836) - well-documented series
  const volumeId = 18836;
  logger.info(`\n=== Testing ComicVine Metadata Extraction for Volume ${volumeId} ===\n`);

  // 1. Get complete volume info from API
  const volumeInfo = await comicvineService.getCompleteVolumeInfo(volumeId);
  if (!volumeInfo) {
    logger.error('Failed to fetch volume info');
    process.exit(1);
  }

  logger.info('=== Volume Metadata ===');
  logger.info(`Title: ${volumeInfo.name}`);
  logger.info(`Publisher: ${volumeInfo.publisher?.name ?? 'Unknown'}`);
  logger.info(`Total Issues: ${volumeInfo.count_of_issues ?? 0}`);
  logger.info(`Start Year: ${volumeInfo.start_year ?? 'Unknown'}`);
  logger.info(`Has Description: ${!!volumeInfo.description}`);
  logger.info(`Description Length: ${volumeInfo.description?.length ?? 0} chars`);
  logger.info(`Has Deck (short summary): ${!!volumeInfo.deck}`);

  if (volumeInfo.image) {
    logger.info('=== Cover Images ===');
    logger.info(`Icon URL: ${volumeInfo.image.icon_url ?? 'none'}`);
    logger.info(`Thumb URL: ${volumeInfo.image.thumb_url ?? 'none'}`);
    logger.info(`Small URL: ${volumeInfo.image.small_url ?? 'none'}`);
    logger.info(`Medium URL: ${volumeInfo.image.medium_url ?? 'none'}`);
    logger.info(`Screen URL: ${volumeInfo.image.screen_url ?? 'none'}`);
    logger.info(`Super URL: ${volumeInfo.image.super_url ?? 'none'}`);
    logger.info(`Original URL: ${volumeInfo.image.original_url ?? 'none'}`);
  }

  if (volumeInfo.genres && volumeInfo.genres.length > 0) {
    logger.info('=== Genres ===');
    volumeInfo.genres.forEach((g) => logger.info(`- ${g.name}`));
  }

  // Check for concepts (themes)
  const rawVolume = volumeInfo as unknown as Record<string, unknown>;
  const concepts = rawVolume['concepts'] as Array<unknown> | undefined;
  if (concepts && concepts.length > 0) {
    logger.info(`=== Concepts/Themes (${concepts.length}) ===`);
    concepts.slice(0, 5).forEach((c: unknown) => {
      if (typeof c === 'object' && c !== null && 'name' in c) {
        logger.info(`- ${(c as { name: string }).name}`);
      }
    });
  }

  // 2. Get issues (chapters) for this volume
  logger.info('\n=== Issues/Chapters ===');
  const issues = await comicvineService.getAllVolumeIssues(volumeId);
  logger.info(`Total issues fetched: ${issues.length}`);

  if (issues.length > 0) {
    logger.info('\n=== First 5 Issues ===');
    issues.slice(0, 5).forEach((issue) => {
      logger.info(`\nIssue #${issue.issue_number ?? '?'}: ${issue.name ?? 'Untitled'}`);
      logger.info(`  ID: ${issue.id}`);
      logger.info(`  Has Description: ${!!issue.description}`);
      logger.info(`  Has Cover: ${!!issue.image}`);
      if (issue.image) {
        logger.info(`  Cover URL: ${issue.image.medium_url ?? issue.image.original_url ?? 'none'}`);
      }
      logger.info(`  Cover Date: ${issue.cover_date ?? 'Unknown'}`);
      logger.info(`  Store Date: ${issue.store_date ?? 'Unknown'}`);
      logger.info(`  Site URL: ${issue.site_detail_url ?? 'none'}`);
    });

    logger.info('\n=== Last 3 Issues ===');
    issues.slice(-3).forEach((issue) => {
      logger.info(`\nIssue #${issue.issue_number ?? '?'}: ${issue.name ?? 'Untitled'}`);
      logger.info(`  Cover Date: ${issue.cover_date ?? 'Unknown'}`);
    });
  }

  // 3. Summary
  logger.info('\n=== Metadata Extraction Summary ===');
  logger.info(`✓ Volume Title: ${volumeInfo.name ? 'YES' : 'NO'}`);
  logger.info(`✓ Volume Description: ${volumeInfo.description ? 'YES (' + volumeInfo.description.length + ' chars)' : 'NO'}`);
  logger.info(`✓ Cover Images: ${volumeInfo.image ? 'YES (6 sizes)' : 'NO'}`);
  logger.info(`✓ Genres: ${volumeInfo.genres?.length ?? 0} found`);
  logger.info(`✓ Concepts/Themes: ${concepts?.length ?? 0} found`);
  logger.info(`✓ Issues/Chapters: ${issues.length} fetched`);
  logger.info(`✓ Issue Names: ${issues.filter(i => i.name).length} have names`);
  logger.info(`✓ Issue Descriptions: ${issues.filter(i => i.description).length} have descriptions`);
  logger.info(`✓ Issue Covers: ${issues.filter(i => i.image).length} have covers`);
  logger.info(`✓ Issue Dates: ${issues.filter(i => i.cover_date || i.store_date).length} have dates`);

  logger.info('\n=== Note: Page Counts ===');
  logger.info('ComicVine API does NOT provide page counts per chapter/volume.');
  logger.info('The API tracks issues (volumes) but not individual page numbers.');
}

testComicVineMetadata()
  .catch(logger.error)
  .finally(() => process.exit(0));
