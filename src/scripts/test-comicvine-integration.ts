#!/usr/bin/env npx tsx

/**
 * Test script for complete ComicVine integration
 * Tests both API fetching and scraping for Fire Force manga
 */

import { comicVineScraper } from '../server/services/comicvine/scrapingService';
import { logger } from '../utils/logger';

async function testComicVineIntegration(): Promise<void> {
  try {
    logger.info('=== Testing Complete ComicVine Integration ===\n');

    // Test 1: Series-level scraping (all volumes)
    logger.info('Test 1: Scraping entire Fire Force series...');
    const seriesUrl = 'https://comicvine.gamespot.com/fire-force/4050-95557/';
    
    const allVolumes = await comicVineScraper.scrapeSeriesChapters(seriesUrl);
    
    logger.info(`\n✅ Successfully scraped ${allVolumes.length} volumes`);
    
    // Calculate total chapters
    const totalChapters = allVolumes.reduce((sum, vol) => sum + vol.totalChapters, 0);
    logger.info(`Total chapters across all volumes: ${totalChapters}`);
    
    // Show sample data from first and last volumes
    if (allVolumes.length > 0) {
      const firstVolume = allVolumes[0];
      if (firstVolume) {
        logger.info('\nFirst Volume:');
        logger.info(`  Volume ${firstVolume.volumeNumber}: ${firstVolume.volumeTitle}`);
        logger.info(`  Chapters: ${firstVolume.totalChapters}`);
        if (firstVolume["chapters"].length > 0) {
          logger.info('  First 3 chapters:');
          firstVolume["chapters"].slice(0, 3).forEach(ch => {
            logger.info(`    - Chapter ${ch.number}${ch.romanNumeral ? ` (${ch.romanNumeral})` : ''}: ${ch["title"]}`);
          });
        }
      }

      const lastVolume = allVolumes[allVolumes.length - 1];
      if (lastVolume) {
        logger.info('\nLast Volume:');
        logger.info(`  Volume ${lastVolume.volumeNumber}: ${lastVolume.volumeTitle}`);
        logger.info(`  Chapters: ${lastVolume.totalChapters}`);
        if (lastVolume["chapters"].length > 0) {
          logger.info('  Last 3 chapters:');
          lastVolume["chapters"].slice(-3).forEach(ch => {
            logger.info(`    - Chapter ${ch.number}${ch.romanNumeral ? ` (${ch.romanNumeral})` : ''}: ${ch["title"]}`);
          });
        }
      }
    }
    
    // Test 2: Individual volume scraping (parallel for performance)
    logger.info('\n\nTest 2: Scraping specific volumes...');
    const testVolumes = [
      { url: 'https://comicvine.gamespot.com/fire-force-1-shinra-kusakabe-joins-the-force/4000-557264/', name: 'Volume 1' },
      { url: 'https://comicvine.gamespot.com/fire-force-17-nuclear-falling-out/4000-728798/', name: 'Volume 17' },
      { url: 'https://comicvine.gamespot.com/fire-force-34-extinguish-the-flames-of-despair/4000-1020567/', name: 'Volume 34' }
    ];

    const volumeResults = await Promise.allSettled(
      testVolumes.map(async (testVol) => {
        logger.info(`\nScraping ${testVol["name"]}...`);
        const volumeData = await comicVineScraper.scrapeVolumeChapters(testVol.url);
        return { testVol, volumeData };
      })
    );

    volumeResults.forEach((result) => {
      if (result.status === 'fulfilled') {
        const { testVol, volumeData } = result.value;

        if (volumeData) {
          logger.info(`  ✅ Successfully scraped:`);
          logger.info(`     Chapters found: ${volumeData.totalChapters}`);
          if (volumeData["chapters"].length > 0) {
            logger.info(`     Sample chapters:`);
            volumeData["chapters"].slice(0, 2).forEach(ch => {
              logger.info(`       - Chapter ${ch.number}${ch.romanNumeral ? ` (${ch.romanNumeral})` : ''}: ${ch["title"]}`);
            });
          }
        } else {
          logger.info(`  ❌ Failed to scrape ${testVol["name"]}`);
        }
      } else {
        logger.info(`  ❌ Error occurred: ${result.reason}`);
      }
    });
    
    // Summary
    logger.info('\n\n=== Integration Test Summary ===');
    logger.info(`Total volumes scraped: ${allVolumes.length}`);
    logger.info(`Total chapters found: ${totalChapters}`);
    logger.info(`Expected Fire Force chapters: 305`);
    logger.info(`Accuracy: ${Math.round((totalChapters / 305) * 100)}%`);
    
    if (totalChapters < 305) {
      const volumesWithNoChapters = allVolumes.filter(v => v.totalChapters === 0);
      if (volumesWithNoChapters.length > 0) {
        logger.info(`\n⚠️ ${volumesWithNoChapters.length} volumes have no chapter data:`);
        volumesWithNoChapters.slice(0, 5).forEach(v => {
          logger.info(`  - Volume ${v.volumeNumber}: ${v.volumeTitle}`);
        });
      }
    }
    
  } catch (error: unknown) {
    console.error('\n❌ Integration test failed:', error);
    process.exit(1);
  }
}

// Run the test
testComicVineIntegration()
  .then(() => {
    logger.info('\n✅ Integration test completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Test script failed:', error);
    process.exit(1);
  });