#!/usr/bin/env npx tsx

import { comicVineScraper } from '../src/server/services/comicvine/scrapingService';

async function testFinalVolumes() {
  console.log('Testing ComicVine final volumes for epilogue counting...\n');

  // Test the last few volumes which should contain the final chapter and epilogues
  const volumesToTest = [
    { num: 33, url: 'https://comicvine.gamespot.com/fire-force-33-the-inevitability-of-despair/4000-997470/' },
    { num: 34, url: 'https://comicvine.gamespot.com/fire-force-34-extinguish-the-flames-of-despair/4000-1020567/' }
  ];

  let totalChapters = 0;
  let highestChapterNumber = 0;
  let hasChapterZero = false;
  let hasFinalChapter = false;
  let epilogueCount = 0;

  // Also check Volume 1 for Chapter 0
  console.log('Checking Volume 1 for Chapter 0...');
  const vol1 = await comicVineScraper.scrapeVolumeChapters('https://comicvine.gamespot.com/fire-force-1-fire-walk-with-me/4000-557264/');
  if (vol1 && vol1.chapters) {
    const chapterZero = vol1.chapters.find(ch => ch.number === '0');
    if (chapterZero) {
      hasChapterZero = true;
      console.log(`✅ Found Chapter 0: "${chapterZero.title}"`);
    }
  }

  console.log('\nChecking final volumes...\n');

  for (const vol of volumesToTest) {
    console.log(`Scraping Volume ${vol.num}...`);
    const volumeData = await comicVineScraper.scrapeVolumeChapters(vol.url);

    if (volumeData && volumeData.chapters) {
      console.log(`  Found ${volumeData.chapters.length} chapters:`);

      volumeData.chapters.forEach(ch => {
        console.log(`    - Chapter ${ch.number}: "${ch.title}"`);

        const chNum = parseInt(ch.number);
        if (!isNaN(chNum) && chNum > highestChapterNumber) {
          highestChapterNumber = chNum;
        }

        if (ch.isFinalChapter) {
          hasFinalChapter = true;
          console.log(`      ⚠️ FINAL CHAPTER`);
        }
        if (ch.isEpilogue) {
          epilogueCount++;
          console.log(`      ⚠️ EPILOGUE ${ch.epilogueNumber || ''}`);
        }
      });

      totalChapters += volumeData.chapters.length;
    } else {
      console.log(`  ❌ No chapters found`);
    }
  }

  console.log('\n=== SUMMARY ===');
  console.log(`Has Chapter 0: ${hasChapterZero}`);
  console.log(`Has Final Chapter: ${hasFinalChapter}`);
  console.log(`Epilogue count: ${epilogueCount}`);
  console.log(`Highest chapter number: ${highestChapterNumber}`);

  console.log('\n=== CHAPTER COUNT CALCULATION ===');
  if (hasChapterZero && highestChapterNumber === 304) {
    console.log('Chapter 0 exists and highest number is 304');
    console.log('Total should be: 305 (0 + 1-304)');
    console.log('✅ This matches the expected count');
  } else if (!hasChapterZero && highestChapterNumber === 304) {
    console.log('No Chapter 0, highest number is 304');
    console.log('Total should be: 304');
    console.log('⚠️ Missing Chapter 0 - this explains showing 304 instead of 305');
  } else {
    console.log(`Unexpected state: Chapter 0=${hasChapterZero}, Highest=${highestChapterNumber}`);
  }
}

testFinalVolumes().catch(console.error);