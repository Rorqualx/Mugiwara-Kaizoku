#!/usr/bin/env npx tsx

import { comicVineScraper } from '../src/server/services/comicvine/scrapingService.js';
import { logger } from '../src/utils/logger.js';

async function testCompleteComicVineFlow() {
  console.log('\n=== Testing Complete ComicVine Flow ===\n');

  const seriesUrl = 'https://comicvine.gamespot.com/fire-force/4050-95557/';

  console.log('Step 1: Scraping volume URLs from series page...');
  console.log(`URL: ${seriesUrl}\n`);

  // Step 1: Get all volume URLs
  const volumeUrls = await comicVineScraper.scrapeSeriesVolumeUrls(seriesUrl);

  console.log(`✅ Found ${volumeUrls.length} volumes\n`);

  if (volumeUrls.length === 0) {
    console.error('❌ No volume URLs found! Scraping failed.');
    return;
  }

  // Step 2: Scrape chapters from a few volumes
  console.log('Step 2: Scraping chapters from selected volumes...\n');

  const testVolumes = [
    volumeUrls[0], // First volume
    volumeUrls[Math.floor(volumeUrls.length / 2)], // Middle volume
    volumeUrls[volumeUrls.length - 1] // Last volume
  ];

  const volumeData = [];

  for (const volume of testVolumes) {
    console.log(`Scraping Volume ${volume.volumeNumber}: ${volume.url}`);

    const chapterData = await comicVineScraper.scrapeVolumeChapters(volume.url);

    if (chapterData) {
      console.log(`  ✅ Found ${chapterData.totalChapters} chapters`);
      console.log(`  Title: ${chapterData.volumeTitle}`);

      if (chapterData.chapters.length > 0) {
        console.log(`  First chapter: ${chapterData.chapters[0].number} - ${chapterData.chapters[0].title}`);
        console.log(`  Last chapter: ${chapterData.chapters[chapterData.chapters.length - 1].number} - ${chapterData.chapters[chapterData.chapters.length - 1].title}`);
      }

      volumeData.push({
        volumeNumber: volume.volumeNumber,
        volumeUrl: volume.url,
        volumeTitle: chapterData.volumeTitle,
        chapterCount: chapterData.totalChapters,
        chapters: chapterData.chapters.map(ch => ({
          number: ch.number,
          title: ch.title,
          romanNumeral: ch.romanNumeral
        }))
      });
    } else {
      console.log(`  ❌ Failed to scrape chapters`);
    }

    console.log('');
  }

  // Step 3: Simulate what would be returned to the UI
  console.log('Step 3: Data structure for UI...\n');

  const uiData = {
    id: 'comicvine_95557',
    title: 'Fire Force',
    provider: 'COMICVINE',
    metadata: {
      volumes: volumeUrls.length,
      chapters: volumeData.reduce((sum, v) => sum + v.chapterCount, 0),
      volumeData: volumeUrls.map(v => {
        const scraped = volumeData.find(vd => vd.volumeNumber === v.volumeNumber);
        return {
          volumeNumber: v.volumeNumber,
          volumeUrl: v.url,
          title: scraped?.volumeTitle || `Volume ${v.volumeNumber}`,
          chapterCount: scraped?.chapterCount || 9, // Estimate 9 chapters per volume
          chapters: scraped?.chapters || [],
          status: scraped ? 'scraped' : 'pending_scrape'
        };
      })
    }
  };

  console.log('UI Data Summary:');
  console.log(`- Total volumes: ${uiData.metadata.volumes}`);
  console.log(`- Total chapters (from scraped volumes): ${uiData.metadata.chapters}`);
  console.log(`- Estimated total chapters (all volumes): ${uiData.metadata.volumes * 9}`);
  console.log(`- Volume data array length: ${uiData.metadata.volumeData.length}`);
  console.log(`- Scraped volumes: ${volumeData.length}`);
  console.log(`- Pending scrape: ${uiData.metadata.volumeData.length - volumeData.length}`);

  console.log('\nFirst 3 volumes in UI data:');
  uiData.metadata.volumeData.slice(0, 3).forEach(v => {
    console.log(`  Volume ${v.volumeNumber}: ${v.title} (${v.chapterCount} chapters) - ${v.status}`);
  });

  console.log('\nLast 3 volumes in UI data:');
  uiData.metadata.volumeData.slice(-3).forEach(v => {
    console.log(`  Volume ${v.volumeNumber}: ${v.title} (${v.chapterCount} chapters) - ${v.status}`);
  });

  // Step 4: Test results
  console.log('\n\n=== Test Results ===\n');

  const tests = [
    {
      name: 'Found all 34 Fire Force volumes',
      pass: volumeUrls.length === 34,
      expected: 34,
      actual: volumeUrls.length
    },
    {
      name: 'Volumes are in correct order',
      pass: volumeUrls.every((v, i) => v.volumeNumber === i + 1),
      expected: 'Sequential 1-34',
      actual: volumeUrls.every((v, i) => v.volumeNumber === i + 1) ? 'Sequential 1-34' : 'Out of order'
    },
    {
      name: 'Successfully scraped test volumes',
      pass: volumeData.length === testVolumes.length,
      expected: testVolumes.length,
      actual: volumeData.length
    },
    {
      name: 'Each scraped volume has chapters',
      pass: volumeData.every(v => v.chapterCount > 0),
      expected: 'All > 0',
      actual: volumeData.every(v => v.chapterCount > 0) ? 'All > 0' : 'Some missing'
    },
    {
      name: 'UI data structure is complete',
      pass: uiData.metadata.volumeData.length === 34,
      expected: 34,
      actual: uiData.metadata.volumeData.length
    }
  ];

  tests.forEach(test => {
    const symbol = test.pass ? '✅' : '❌';
    console.log(`${symbol} ${test.name}`);
    if (!test.pass) {
      console.log(`   Expected: ${test.expected}, Actual: ${test.actual}`);
    }
  });

  const allPassed = tests.every(t => t.pass);
  console.log('\n' + (allPassed ? '🎉 All tests passed!' : '❌ Some tests failed'));
}

// Run the test
testCompleteComicVineFlow().catch(console.error);