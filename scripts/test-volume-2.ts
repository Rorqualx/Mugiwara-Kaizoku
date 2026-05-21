#!/usr/bin/env npx tsx

import { comicVineScraper } from '../src/server/services/comicvine/scrapingService';

async function testVolume2() {
  console.log('Testing Volume 2 scraping...\n');
  
  // Try the expected ID pattern
  const volume2Url = 'https://comicvine.gamespot.com/fire-force-2/4000-541365/';
  
  const result = await comicVineScraper.scrapeVolumeChapters(volume2Url);
  
  if (result) {
    console.log('Volume Title:', result.volumeTitle);
    console.log('Total Chapters:', result.totalChapters);
    console.log('\nChapters:');
    result.chapters.forEach(ch => {
      console.log(`  ${ch.number}: ${ch.title}`);
    });
  } else {
    console.log('Failed to scrape volume');
  }
}

testVolume2();