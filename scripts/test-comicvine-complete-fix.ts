#!/usr/bin/env npx tsx

import { comicVineScraper } from '../src/server/services/comicvine/scrapingService.js';
import { logger } from '../src/utils/logger.js';

async function testComicVineCompleteFix() {
  console.log('\n=== Testing ComicVine Complete Fix (Cover Art + Chapters) ===\n');

  const seriesUrl = 'https://comicvine.gamespot.com/fire-force/4050-95557/';

  console.log('Step 1: Scraping volume URLs from series page...');
  console.log(`URL: ${seriesUrl}\n`);

  try {
    // Step 1: Get all volume URLs
    const volumeUrls = await comicVineScraper.scrapeSeriesVolumeUrls(seriesUrl);

    console.log(`✅ Found ${volumeUrls.length} volumes`);

    if (volumeUrls.length === 0) {
      console.error('❌ No volume URLs found! Scraping failed.');
      return;
    }

    // Initialize volumeData like the fix does
    const volumeData = volumeUrls.map((v) => ({
      volumeNumber: v.volumeNumber,
      title: `Volume ${v.volumeNumber}`,
      url: v.url,
      coverImageUrl: null,
      chapters: [],
      chapterCount: 0,
      status: 'pending_scrape'
    }));

    console.log(`\n✅ Initialized volumeData for ${volumeData.length} volumes`);

    // Step 2: Test scraping a specific volume for chapters AND cover art
    console.log('\nStep 2: Testing chapter and cover art scraping for selected volumes...\n');

    const testVolumes = [
      volumeUrls[0], // First volume
      volumeUrls[volumeUrls.length - 1] // Last volume
    ];

    for (const volume of testVolumes) {
      console.log(`\nScraping Volume ${volume.volumeNumber}: ${volume.url}`);

      const chapterData = await comicVineScraper.scrapeVolumeChapters(volume.url);

      if (chapterData) {
        console.log(`✅ Successfully scraped Volume ${volume.volumeNumber}:`);
        console.log(`  - Title: ${chapterData.volumeTitle}`);
        console.log(`  - Cover Image: ${chapterData.coverImage ? '✅ Found' : '❌ Not found'}`);
        if (chapterData.coverImage) {
          console.log(`    URL: ${chapterData.coverImage}`);
        }
        console.log(`  - Chapters: ${chapterData.totalChapters}`);
        console.log(`  - Summary: ${chapterData.volumeSummary ? 'Yes' : 'No'}`);

        if (chapterData.chapters.length > 0) {
          console.log(`  - First chapter: Chapter ${chapterData.chapters[0].number} - ${chapterData.chapters[0].title}`);
          console.log(`  - Last chapter: Chapter ${chapterData.chapters[chapterData.chapters.length - 1].number} - ${chapterData.chapters[chapterData.chapters.length - 1].title}`);
        }

        // Update volumeData like the fix does
        const volumeIndex = volume.volumeNumber - 1;
        if (volumeData[volumeIndex]) {
          volumeData[volumeIndex] = {
            ...volumeData[volumeIndex],
            title: chapterData.volumeTitle || volumeData[volumeIndex].title,
            coverImageUrl: chapterData.coverImage || null,
            chapters: chapterData.chapters || [],
            chapterCount: chapterData.chapters?.length || 0,
            status: 'scraped'
          };
        }
      } else {
        console.log(`❌ Failed to scrape Volume ${volume.volumeNumber}`);
      }
    }

    // Step 3: Verify the final data structure
    console.log('\n\nStep 3: Verifying Final Data Structure...\n');

    const scrapedVolumes = volumeData.filter(v => v.status === 'scraped');
    const volumesWithCover = volumeData.filter(v => v.coverImageUrl);
    const volumesWithChapters = volumeData.filter(v => v.chapterCount > 0);

    console.log('📊 Statistics:');
    console.log(`  - Total volumes: ${volumeData.length}`);
    console.log(`  - Scraped volumes: ${scrapedVolumes.length}`);
    console.log(`  - Volumes with cover art: ${volumesWithCover.length}`);
    console.log(`  - Volumes with chapters: ${volumesWithChapters.length}`);

    // Step 4: Test Summary
    console.log('\n\n=== Test Summary ===\n');
    const tests = [
      {
        name: 'Volume URL scraping',
        pass: volumeUrls.length === 34,
        expected: 34,
        actual: volumeUrls.length
      },
      {
        name: 'Volume data initialization',
        pass: volumeData.length === volumeUrls.length,
        expected: volumeUrls.length,
        actual: volumeData.length
      },
      {
        name: 'Cover art extraction',
        pass: volumesWithCover.length > 0,
        expected: 'At least 1',
        actual: volumesWithCover.length
      },
      {
        name: 'Chapter extraction',
        pass: volumesWithChapters.length > 0,
        expected: 'At least 1',
        actual: volumesWithChapters.length
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

    // Display sample of final data
    if (scrapedVolumes.length > 0) {
      console.log('\n📚 Sample Volume Data:');
      const sample = scrapedVolumes[0];
      console.log(JSON.stringify(sample, null, 2));
    }

  } catch (error) {
    console.error('Test failed:', error);
  }
}

// Run the test
testComicVineCompleteFix().catch(console.error);