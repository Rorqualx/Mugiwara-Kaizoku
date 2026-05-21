#!/usr/bin/env npx tsx

/**
 * Test script for ComicVine scraping service
 * Tests chapter extraction from ComicVine volume pages
 */

import { comicVineScraper } from '../src/server/services/comicvine/scrapingService';
import { logger } from '../src/utils/logger';

async function testComicVineScraper() {
  try {
    console.log('=== Testing ComicVine Scraper ===\n');

    // Test 1: Scrape Fire Force Volume 1
    console.log('Test 1: Scraping Fire Force Volume 1...');
    const volume1Url = 'https://comicvine.gamespot.com/fire-force-1-shinra-kusakabe-joins-the-force/4000-557264/';
    
    const volume1Data = await comicVineScraper.scrapeVolumeChapters(volume1Url);
    
    if (volume1Data) {
      console.log('\n✅ Successfully scraped volume 1:');
      console.log(`  Volume ID: ${volume1Data.volumeId}`);
      console.log(`  Volume Number: ${volume1Data.volumeNumber}`);
      console.log(`  Volume Title: ${volume1Data.volumeTitle}`);
      console.log(`  Volume Summary: ${volume1Data.volumeSummary ? volume1Data.volumeSummary.substring(0, 100) + '...' : 'None'}`);
      console.log(`  Total Chapters: ${volume1Data.totalChapters}`);
      console.log('\n  Chapters:');
      volume1Data.chapters.forEach((chapter) => {
        console.log(`    - Chapter ${chapter.number}${chapter.romanNumeral ? ` (${chapter.romanNumeral})` : ''}: ${chapter.title}`);
      });
    } else {
      console.log('❌ Failed to scrape volume 1');
    }

    // Test 2: Scrape Fire Force Volume 34 (last volume)
    console.log('\n\nTest 2: Scraping Fire Force Volume 34...');
    const volume34Url = 'https://comicvine.gamespot.com/fire-force-34-extinguish-the-flames-of-despair/4000-1020567/';
    
    const volume34Data = await comicVineScraper.scrapeVolumeChapters(volume34Url);
    
    if (volume34Data) {
      console.log('\n✅ Successfully scraped volume 34:');
      console.log(`  Volume ID: ${volume34Data.volumeId}`);
      console.log(`  Volume Number: ${volume34Data.volumeNumber}`);
      console.log(`  Volume Title: ${volume34Data.volumeTitle}`);
      console.log(`  Volume Summary: ${volume34Data.volumeSummary ? volume34Data.volumeSummary.substring(0, 100) + '...' : 'None'}`);
      console.log(`  Total Chapters: ${volume34Data.totalChapters}`);
      console.log('\n  Chapters:');
      volume34Data.chapters.forEach((chapter) => {
        console.log(`    - Chapter ${chapter.number}${chapter.romanNumeral ? ` (${chapter.romanNumeral})` : ''}: ${chapter.title}`);
      });
    } else {
      console.log('❌ Failed to scrape volume 34');
    }

    // Calculate total chapters across all volumes
    if (volume1Data && volume34Data) {
      const estimatedTotalChapters = 34 * 9; // 34 volumes * ~9 chapters per volume
      console.log('\n\n=== Summary ===');
      console.log(`Estimated total chapters: ~${estimatedTotalChapters}`);
      console.log('This should be close to the actual 305 chapters in Fire Force');
    }

  } catch (error) {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  }
}

// Run the test
testComicVineScraper()
  .then(() => {
    console.log('\n✅ All tests completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Test script failed:', error);
    process.exit(1);
  });