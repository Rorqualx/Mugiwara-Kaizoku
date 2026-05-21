#!/usr/bin/env npx tsx

import { comicVineScraper } from '../src/server/services/comicvine/scrapingService';

async function testComicVineUrlParse() {
  const testUrl = 'https://comicvine.gamespot.com/fire-force-1-fire-walk-with-me/4000-557264/';
  
  console.log('Testing ComicVine URL parsing for:', testUrl);
  console.log('This should extract Chapter 0 and other chapters from Volume 1\n');
  
  try {
    const result = await comicVineScraper.scrapeVolumeChapters(testUrl);
    
    if (result) {
      console.log('✅ Successfully scraped ComicVine volume!');
      console.log('\nVolume Details:');
      console.log(`  Volume ${result.volumeNumber}: ${result.volumeTitle}`);
      console.log(`  Summary: ${result.summary || 'No summary'}`);
      console.log(`  Total Chapters: ${result.totalChapters}`);
      console.log('\n  Chapters:');
      result.chapters.forEach(ch => {
        console.log(`    Chapter ${ch.number}: ${ch.title}`);
      });
      
      // Check for Chapter 0
      const hasChapter0 = result.chapters.some(ch => ch.number === '0');
      
      if (hasChapter0) {
        console.log('\n✅ Chapter 0 found!');
      } else {
        console.log('\n❌ Chapter 0 is missing!');
      }
    } else {
      console.log('❌ Failed to scrape ComicVine volume');
    }
  } catch (error) {
    console.error('Error testing ComicVine URL parse:', error);
  }
}

testComicVineUrlParse();