#!/usr/bin/env npx tsx

import { comicVineScraper } from '../src/server/services/comicvine/scrapingService';

async function testEpilogueScraping() {
  console.log('Testing epilogue detection in ComicVine scraping...\n');

  // Test with Fire Force Volume 34 which has the epilogues
  const volumeUrl = 'https://comicvine.gamespot.com/fire-force-34-extinguish-the-flames-of-despair/4000-1020567/';

  console.log(`Scraping: ${volumeUrl}\n`);

  const result = await comicVineScraper.scrapeVolumeChapters(volumeUrl);

  if (result) {
    console.log('✅ Scraping successful!');
    console.log(`Volume ${result.volumeNumber}: "${result.volumeTitle}"`);
    console.log(`Total chapters: ${result.totalChapters}`);

    if (result.chapters && result.chapters.length > 0) {
      console.log('\nChapters found:');
      result.chapters.forEach(ch => {
        let type = '';
        if (ch.isFinalChapter) type = ' [FINAL CHAPTER]';
        if (ch.isEpilogue) type = ` [EPILOGUE ${ch.epilogueNumber || ''}]`;
        if (ch.isSpecial) type = ' [SPECIAL]';

        console.log(`  - Chapter ${ch.number}: "${ch.title}"${type}`);
      });

      // Check for epilogues specifically
      const epilogues = result.chapters.filter(ch => ch.isEpilogue || ch.title?.toLowerCase().includes('epilogue'));
      if (epilogues.length > 0) {
        console.log(`\n⚠️ Found ${epilogues.length} epilogue(s):`);
        epilogues.forEach(ep => {
          console.log(`  - ${ep.title} (numbered as Chapter ${ep.number})`);
        });
      } else {
        console.log('\n❌ No epilogues found - this might be the issue!');
      }

      // Check for final chapter
      const finalChapter = result.chapters.find(ch => ch.isFinalChapter || ch.title?.toLowerCase().includes('final'));
      if (finalChapter) {
        console.log(`\n✅ Final Chapter found: "${finalChapter.title}" (Chapter ${finalChapter.number})`);
      }
    } else {
      console.log('\n❌ No chapters found');
    }
  } else {
    console.log('❌ Scraping failed - returned null');
  }
}

testEpilogueScraping().catch(console.error);