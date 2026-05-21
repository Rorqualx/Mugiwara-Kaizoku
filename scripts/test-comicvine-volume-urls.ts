#!/usr/bin/env npx tsx

/**
 * Test script for ComicVine volume URL scraping
 * Scrapes volume URLs from the series page instead of predicting them
 */

import { comicVineScraper } from '../src/server/services/comicvine/scrapingService';

async function testVolumeUrlScraping() {
  try {
    console.log('=== Testing ComicVine Volume URL Scraping ===\n');

    // Test scraping Fire Force series page
    const fireForceSeriesUrl = 'https://comicvine.gamespot.com/fire-force/4050-91513/';
    
    console.log('Scraping volume URLs from Fire Force series page...');
    console.log('Series URL:', fireForceSeriesUrl);
    console.log('');
    
    const volumeUrls = await comicVineScraper.scrapeSeriesVolumeUrls(fireForceSeriesUrl);
    
    if (volumeUrls && volumeUrls.length > 0) {
      console.log(`✅ Successfully scraped ${volumeUrls.length} volume URLs\n`);
      
      // Show first 5 volumes
      console.log('First 5 volumes:');
      volumeUrls.slice(0, 5).forEach(vol => {
        console.log(`  Volume ${vol.volumeNumber}: ${vol.url}`);
      });
      
      // Show volumes 26-34 specifically (the ones that had issues)
      console.log('\nVolumes 26-34 (previously problematic):');
      volumeUrls.filter(vol => vol.volumeNumber >= 26 && vol.volumeNumber <= 34).forEach(vol => {
        console.log(`  Volume ${vol.volumeNumber}: ${vol.url}`);
      });
      
      // Verify we got the correct URLs for volumes 26-34
      const expectedUrls = {
        26: 'https://comicvine.gamespot.com/fire-force-26-facing-his-demons/4000-912509/',
        27: 'https://comicvine.gamespot.com/fire-force-27-calling-all-heroes-and-angels/4000-931899/',
        28: 'https://comicvine.gamespot.com/fire-force-28-the-ultimate-showdown/4000-943121/',
        29: 'https://comicvine.gamespot.com/fire-force-29-doomsday-approaches/4000-952665/',
        30: 'https://comicvine.gamespot.com/fire-force-30-the-great-cataclysm-has-begun/4000-962519/',
        31: 'https://comicvine.gamespot.com/fire-force-31-cataclysm-approaches/4000-971784/',
        32: 'https://comicvine.gamespot.com/fire-force-32-the-great-cataclysm-commences/4000-982073/',
        33: 'https://comicvine.gamespot.com/fire-force-33-the-cataclysm-continues/4000-992365/',
        34: 'https://comicvine.gamespot.com/fire-force-34-extinguish-the-flames-of-despair/4000-1020567/'
      };
      
      console.log('\n=== Verification ===');
      let allCorrect = true;
      for (const [volNum, expectedUrl] of Object.entries(expectedUrls)) {
        const volumeNumber = parseInt(volNum);
        const scrapedVolume = volumeUrls.find(v => v.volumeNumber === volumeNumber);
        
        if (!scrapedVolume) {
          console.log(`❌ Volume ${volumeNumber}: NOT FOUND`);
          allCorrect = false;
        } else if (scrapedVolume.url.includes(`/4000-${expectedUrl.match(/4000-(\d+)/)?.[1]}/`)) {
          console.log(`✅ Volume ${volumeNumber}: Correct ID`);
        } else {
          console.log(`❌ Volume ${volumeNumber}: WRONG URL`);
          console.log(`   Expected ID: ${expectedUrl.match(/4000-(\d+)/)?.[1]}`);
          console.log(`   Got: ${scrapedVolume.url}`);
          allCorrect = false;
        }
      }
      
      if (allCorrect) {
        console.log('\n✅ All problematic volumes have correct URLs!');
      } else {
        console.log('\n⚠️ Some volumes have incorrect URLs');
      }
      
    } else {
      console.log('❌ Failed to scrape volume URLs');
    }

  } catch (error) {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  }
}

// Run the test
testVolumeUrlScraping()
  .then(() => {
    console.log('\n✅ Test completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Test script failed:', error);
    process.exit(1);
  });