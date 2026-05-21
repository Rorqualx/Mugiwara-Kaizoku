#!/usr/bin/env npx tsx

import { comicVineScraper } from '../src/server/services/comicvine/scrapingService';

async function testDirectScraping() {
  console.log('Testing ComicVine scraping directly...\n');

  // Test with Fire Force Volume 1
  const volumeUrl = 'https://comicvine.gamespot.com/fire-force-1-fire-walk-with-me/4000-557264/';

  console.log(`Scraping: ${volumeUrl}\n`);

  const result = await comicVineScraper.scrapeVolumeChapters(volumeUrl);

  if (result) {
    console.log('✅ Scraping successful!');
    console.log(`Volume ${result.volumeNumber}: "${result.volumeTitle}"`);
    console.log(`Total chapters: ${result.totalChapters}`);

    if (result.chapters && result.chapters.length > 0) {
      console.log('\nChapters found:');
      result.chapters.forEach(ch => {
        console.log(`  - Chapter ${ch.number}: "${ch.title}"`);
        if (ch.number === '0') {
          console.log('    ⚠️ Chapter 0 detected!');
        }
      });
    } else {
      console.log('\n❌ No chapters found');
    }
  } else {
    console.log('❌ Scraping failed - returned null');
  }

  // Also test series page to get all volume URLs
  console.log('\n\n---Testing series page---\n');
  const seriesUrl = 'https://comicvine.gamespot.com/fire-force/4050-95557/';
  console.log(`Getting volume URLs from: ${seriesUrl}\n`);

  const volumeUrls = await comicVineScraper.scrapeSeriesVolumeUrls(seriesUrl);
  console.log(`Found ${volumeUrls.length} volumes`);

  if (volumeUrls.length > 0) {
    console.log('First 5 volumes:');
    volumeUrls.slice(0, 5).forEach(v => {
      console.log(`  Volume ${v.volumeNumber}: ${v.url}`);
    });
  }

  // Test scraping all volumes for total chapter count
  console.log('\n\n---Testing total chapter count---\n');
  if (volumeUrls.length > 0) {
    let totalChapterCount = 0;
    let hasChapterZero = false;

    // Scrape first few volumes to check for chapters
    const volumesToCheck = volumeUrls.slice(0, 3);
    console.log(`Checking first ${volumesToCheck.length} volumes for chapters...\n`);

    for (const vol of volumesToCheck) {
      console.log(`Scraping volume ${vol.volumeNumber}...`);
      const volumeData = await comicVineScraper.scrapeVolumeChapters(vol.url);

      if (volumeData && volumeData.chapters) {
        console.log(`  Found ${volumeData.chapters.length} chapters`);
        totalChapterCount += volumeData.chapters.length;

        // Check for Chapter 0
        const chapterZero = volumeData.chapters.find(ch => ch.number === '0');
        if (chapterZero) {
          hasChapterZero = true;
          console.log(`  ⚠️ Chapter 0 found: "${chapterZero.title}"`);
        }
      } else {
        console.log(`  ❌ No chapters found`);
      }
    }

    console.log(`\nTotal chapters in first ${volumesToCheck.length} volumes: ${totalChapterCount}`);
    console.log(`Has Chapter 0: ${hasChapterZero}`);

    // Estimate total chapters
    if (totalChapterCount > 0) {
      const avgChaptersPerVolume = totalChapterCount / volumesToCheck.length;
      const estimatedTotal = Math.round(avgChaptersPerVolume * volumeUrls.length);
      console.log(`Average chapters per volume: ${avgChaptersPerVolume.toFixed(1)}`);
      console.log(`Estimated total chapters across ${volumeUrls.length} volumes: ~${estimatedTotal}`);
    }
  }
}

testDirectScraping().catch(console.error);