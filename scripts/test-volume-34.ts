#!/usr/bin/env npx tsx

import { comicVineScraper } from '../src/server/services/comicvine/scrapingService';

async function testVolume34() {
  console.log('Testing Volume 34 scraping...\n');
  
  const volume34Url = 'https://comicvine.gamespot.com/fire-force-34-extinguish-the-flames-of-despair/4000-1020567/';
  
  const result = await comicVineScraper.scrapeVolumeChapters(volume34Url);
  
  if (result) {
    console.log('Volume Title:', result.volumeTitle);
    console.log('Total Chapters:', result.totalChapters);
    console.log('\nChapters:');
    result.chapters.forEach(ch => {
      console.log(`  ${ch.number}: ${ch.title}`);
    });
    
    // Check for missing chapters
    const expectedChapters = [296, 297, 298, 299, 300, 301, 302, 303, 304];
    const foundChapters = result.chapters.map(ch => parseInt(ch.number));
    const missingChapters = expectedChapters.filter(num => !foundChapters.includes(num));
    
    if (missingChapters.length > 0) {
      console.log('\n❌ Missing chapters:', missingChapters);
    } else {
      console.log('\n✅ All expected chapters found!');
    }
  } else {
    console.log('Failed to scrape volume');
  }
}

testVolume34();