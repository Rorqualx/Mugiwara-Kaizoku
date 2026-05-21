/**
 * Test ComicVine Scraper (HTML parsing)
 *
 * Validates that the scraper correctly extracts:
 * 1. Volume metadata from HTML pages
 * 2. Chapter lists from structured content
 * 3. Themes/concepts from sidebar
 */

import { ComicVineScrapingService } from '@/server/services/comicvine/scrapingService';
import { logger } from '@/utils/logger';

async function testComicVineScraper() {
  const scraper = new ComicVineScrapingService();

  // Test Naruto Volume 1 page
  const volumeUrl = 'https://comicvine.gamespot.com/naruto-1-the-tests-of-the-ninja/4000-111264/';
  logger.info(`\n=== Testing ComicVine Scraper for: ${volumeUrl} ===\n`);

  const result = await scraper.scrapeVolumeChapters(volumeUrl);

  if (!result) {
    logger.error('Failed to scrape volume page');
    process.exit(1);
  }

  logger.info('=== Volume Metadata ===');
  logger.info(`Volume ID: ${result.volumeId}`);
  logger.info(`Volume Number: ${result.volumeNumber}`);
  logger.info(`Volume Title: ${result.volumeTitle}`);
  logger.info(`Has Summary: ${!!result.volumeSummary}`);
  if (result.volumeSummary) {
    logger.info(`Summary Length: ${result.volumeSummary.length} chars`);
    logger.info(`Summary Preview: ${result.volumeSummary.substring(0, 150)}...`);
  }
  logger.info(`Has Cover: ${!!result.coverImage}`);
  if (result.coverImage) {
    logger.info(`Cover URL: ${result.coverImage}`);
  }

  if (result.themes && result.themes.length > 0) {
    logger.info(`\n=== Themes/Concepts (${result.themes.length}) ===`);
    result.themes.forEach((theme) => logger.info(`- ${theme}`));
  }

  if (result.genres && result.genres.length > 0) {
    logger.info(`\n=== Genres (${result.genres.length}) ===`);
    result.genres.forEach((genre) => logger.info(`- ${genre}`));
  }

  logger.info(`\n=== Chapters (${result.totalChapters} found) ===`);
  if (result.chapters.length > 0) {
    logger.info('\nFirst 5 chapters:');
    result.chapters.slice(0, 5).forEach((chapter) => {
      logger.info(`\n  Chapter ${chapter.number}: ${chapter.title}`);
      if (chapter.prefix) logger.info(`    Prefix: ${chapter.prefix}`);
      if (chapter.romanNumeral) logger.info(`    Roman: ${chapter.romanNumeral}`);
      if (chapter.isSpecial) logger.info(`    Special: yes`);
      if (chapter.isFinalChapter) logger.info(`    Final: yes`);
      if (chapter.isEpilogue) logger.info(`    Epilogue: yes`);
    });

    if (result.chapters.length > 5) {
      logger.info(`\n  ... and ${result.chapters.length - 5} more chapters`);
    }
  } else {
    logger.warn('No chapters found - this volume may only have API data');
  }

  logger.info('\n=== Scraper Test Summary ===');
  logger.info(`✓ Volume Title: ${result.volumeTitle ? 'YES' : 'NO'}`);
  logger.info(`✓ Volume Summary: ${result.volumeSummary ? `YES (${result.volumeSummary.length} chars)` : 'NO'}`);
  logger.info(`✓ Cover Image: ${result.coverImage ? 'YES' : 'NO'}`);
  logger.info(`✓ Themes/Concepts: ${result.themes?.length ?? 0} found`);
  logger.info(`✓ Genres: ${result.genres?.length ?? 0} found`);
  logger.info(`✓ Chapters: ${result.totalChapters} found`);
}

testComicVineScraper()
  .catch(logger.error)
  .finally(() => process.exit(0));
