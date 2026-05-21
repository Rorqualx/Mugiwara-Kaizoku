#!/usr/bin/env npx tsx

import { comicVineScraper } from '../src/server/services/comicvine/scrapingService';

async function testVolume1() {
  console.log('Testing Volume 1 scraping (should contain Chapter 0)...\n');
  
  const volume1Url = 'https://comicvine.gamespot.com/fire-force-1-fire-walk-with-me/4000-557264/';
  
  const result = await comicVineScraper.scrapeVolumeChapters(volume1Url);
  
  if (result) {
    console.log('Volume Title:', result.volumeTitle);
    console.log('Total Chapters:', result.totalChapters);
    console.log('\nChapters:');
    result.chapters.forEach(ch => {
      console.log(`  ${ch.number}: ${ch.title}`);
    });
    
    // Check for Chapter 0
    const hasChapter0 = result.chapters.some(ch => ch.number === '0');
    
    if (hasChapter0) {
      console.log('\n✅ Chapter 0 found!');
    } else {
      console.log('\n❌ Chapter 0 is missing!');
    }
  } else {
    console.log('Failed to scrape volume');
  }
}

testVolume1();