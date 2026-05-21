#!/usr/bin/env npx tsx

import { comicVineScraper } from '../src/server/services/comicvine/scrapingService';

async function testTotalCount() {
  console.log('Testing ComicVine total chapter count for Fire Force...\n');

  // Get all volume URLs from series page
  const seriesUrl = 'https://comicvine.gamespot.com/fire-force/4050-95557/';
  console.log(`Getting all volumes from: ${seriesUrl}\n`);

  const volumeUrls = await comicVineScraper.scrapeSeriesVolumeUrls(seriesUrl);
  console.log(`Found ${volumeUrls.length} volumes\n`);

  if (volumeUrls.length === 0) {
    console.log('❌ No volumes found');
    return;
  }

  let totalChapterCount = 0;
  let hasChapterZero = false;
  let finalChapterNumber = 0;
  let epilogueCount = 0;

  // Scrape all volumes to get exact chapter count
  console.log('Scraping all volumes for chapters...');

  for (let i = 0; i < volumeUrls.length; i++) {
    const vol = volumeUrls[i];
    process.stdout.write(`\rScraping volume ${i + 1}/${volumeUrls.length}...`);

    const volumeData = await comicVineScraper.scrapeVolumeChapters(vol.url);

    if (volumeData && volumeData.chapters) {
      totalChapterCount += volumeData.chapters.length;

      // Check for special chapters
      volumeData.chapters.forEach(ch => {
        if (ch.number === '0') {
          hasChapterZero = true;
        }
        if (ch.isFinalChapter) {
          finalChapterNumber = parseInt(ch.number);
        }
        if (ch.isEpilogue) {
          epilogueCount++;
        }
      });
    }
  }

  console.log('\n\n=== RESULTS ===');
  console.log(`Total volumes: ${volumeUrls.length}`);
  console.log(`Total chapters scraped: ${totalChapterCount}`);
  console.log(`Has Chapter 0: ${hasChapterZero}`);
  console.log(`Final Chapter Number: ${finalChapterNumber || 'Not found'}`);
  console.log(`Epilogue count: ${epilogueCount}`);

  // Calculate what the count should be
  console.log('\n=== ANALYSIS ===');
  if (hasChapterZero) {
    console.log('✅ Chapter 0 detected (should be included in count)');
  }
  if (finalChapterNumber > 0) {
    console.log(`✅ Final Chapter is #${finalChapterNumber}`);
  }
  if (epilogueCount > 0) {
    console.log(`✅ ${epilogueCount} epilogue(s) detected`);
  }

  console.log(`\n=== EXPECTED VS ACTUAL ===`);
  console.log(`Expected: 305 chapters (Chapter 0 + 301 regular + 1 final + 2 epilogues)`);
  console.log(`Actual scraped: ${totalChapterCount} chapters`);

  if (totalChapterCount === 305) {
    console.log('✅ Count is correct!');
  } else if (totalChapterCount === 304) {
    console.log('⚠️ Missing 1 chapter - likely Chapter 0 not being counted properly');
  } else {
    console.log(`❌ Count mismatch: expected 305, got ${totalChapterCount}`);
  }
}

testTotalCount().catch(console.error);