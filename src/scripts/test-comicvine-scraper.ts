#!/usr/bin/env npx tsx

/**
 * Test script for ComicVine scraping service
 * Tests chapter extraction from ComicVine volume pages
 */

import { comicVineScraper } from '../server/services/comicvine/scrapingService';
import { logger } from '../utils/logger';

async function testComicVineScraper(): Promise<void> {
  try {
    logger.info('=== Testing ComicVine Scraper ===\n');

    // Test 1: Scrape Fire Force Volume 1
    logger.info('Test 1: Scraping Fire Force Volume 1...');
    const volume1Url = 'https://comicvine.gamespot.com/fire-force-1-shinra-kusakabe-joins-the-force/4000-557264/';
    
    const volume1Data = await comicVineScraper.scrapeVolumeChapters(volume1Url);
    
    if (volume1Data) {
      logger.info('\n✅ Successfully scraped volume 1:');
      logger.info(`  Volume ID: ${volume1Data.volumeId}`);
      logger.info(`  Volume Number: ${volume1Data.volumeNumber}`);
      logger.info(`  Volume Title: ${volume1Data.volumeTitle}`);
      logger.info(`  Total Chapters: ${volume1Data.totalChapters}`);
      logger.info('\n  Chapters:');
      volume1Data["chapters"].forEach((chapter) => {
        logger.info(`    - Chapter ${chapter.number}${chapter.romanNumeral ? ` (${chapter.romanNumeral})` : ''}: ${chapter["title"]}`);
      });
    } else {
      logger.info('❌ Failed to scrape volume 1');
    }

    // Test 2: Scrape Fire Force Volume 34 (last volume)
    logger.info('\n\nTest 2: Scraping Fire Force Volume 34...');
    const volume34Url = 'https://comicvine.gamespot.com/fire-force-34-extinguish-the-flames-of-despair/4000-1020567/';
    
    const volume34Data = await comicVineScraper.scrapeVolumeChapters(volume34Url);
    
    if (volume34Data) {
      logger.info('\n✅ Successfully scraped volume 34:');
      logger.info(`  Volume ID: ${volume34Data.volumeId}`);
      logger.info(`  Volume Number: ${volume34Data.volumeNumber}`);
      logger.info(`  Volume Title: ${volume34Data.volumeTitle}`);
      logger.info(`  Total Chapters: ${volume34Data.totalChapters}`);
      logger.info('\n  Chapters:');
      volume34Data["chapters"].forEach((chapter) => {
        logger.info(`    - Chapter ${chapter.number}${chapter.romanNumeral ? ` (${chapter.romanNumeral})` : ''}: ${chapter["title"]}`);
      });
    } else {
      logger.info('❌ Failed to scrape volume 34');
    }

    // Calculate total chapters across all volumes
    if (volume1Data && volume34Data) {
      const estimatedTotalChapters = 34 * 9; // 34 volumes * ~9 chapters per volume
      logger.info('\n\n=== Summary ===');
      logger.info(`Estimated total chapters: ~${estimatedTotalChapters}`);
      logger.info('This should be close to the actual 305 chapters in Fire Force');
    }

  } catch (error: unknown) {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  }
}

// Run the test
testComicVineScraper()
  .then(() => {
    logger.info('\n✅ All tests completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Test script failed:', error);
    process.exit(1);
  });