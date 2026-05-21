#!/usr/bin/env npx tsx

import { comicVineScraper } from '../src/server/services/comicvine/scrapingService.js';
import { logger } from '../src/utils/logger.js';

async function testComicVineFullFlow() {
  console.log('\n=== Testing Complete ComicVine Flow ===\n');

  // Fire Force (Kodansha Comics USA) - ID 95557
  const seriesUrl = 'https://comicvine.gamespot.com/fire-force/4050-95557/';

  console.log('Step 1: Scraping volume URLs from series page...');
  console.log(`URL: ${seriesUrl}\n`);

  try {
    // Step 1: Get all volume URLs
    const volumeUrls = await comicVineScraper.scrapeSeriesVolumeUrls(seriesUrl);

    console.log(`✅ Found ${volumeUrls.length} volumes`);
    console.log('First 3 volumes:', volumeUrls.slice(0, 3));
    console.log('Last 3 volumes:', volumeUrls.slice(-3));

    if (volumeUrls.length === 0) {
      console.error('❌ No volume URLs found! Scraping failed.');
      return;
    }

    // Step 2: Test scraping a specific volume for chapters
    console.log('\nStep 2: Testing chapter scraping for Volume 1...');
    const testVolume = volumeUrls[0];

    if (testVolume) {
      console.log(`Fetching: ${testVolume.url}`);
      const chapterData = await comicVineScraper.scrapeVolumeChapters(testVolume.url);

      if (chapterData) {
        console.log(`✅ Successfully scraped Volume 1:`);
        console.log(`  - Title: ${chapterData.volumeTitle}`);
        console.log(`  - Chapters: ${chapterData.totalChapters}`);
        console.log(`  - Release Date: ${chapterData.releaseDate || 'N/A'}`);

        if (chapterData.chapters.length > 0) {
          console.log(`  - First chapter: Chapter ${chapterData.chapters[0].number} - ${chapterData.chapters[0].title}`);
          console.log(`  - Last chapter: Chapter ${chapterData.chapters[chapterData.chapters.length - 1].number} - ${chapterData.chapters[chapterData.chapters.length - 1].title}`);
        }
      } else {
        console.log('❌ Failed to scrape chapter data for Volume 1');
      }
    }

    // Step 3: Simulate what would be displayed in the UI
    console.log('\n\nStep 3: Simulating UI Display Data...');
    console.log('==================================\n');

    const volumeData = volumeUrls.map((v, index) => ({
      volumeNumber: v.volumeNumber,
      title: `Volume ${v.volumeNumber}`,
      url: v.url,
      coverImage: null, // Would be scraped separately
      releaseDate: null, // Would be scraped from individual volume pages
      chapterCount: 9, // Estimated, would be scraped
      chapters: [], // Would be populated when scraped
      status: 'pending_scrape'
    }));

    console.log('UI would show:');
    console.log(`📚 Total Volumes: ${volumeData.length}`);
    console.log(`📖 Estimated Chapters: ${volumeData.length * 9} (assuming 9 per volume)`);
    console.log(`✅ Status: Ready to import`);

    console.log('\nVolume dropdown would contain:');
    volumeData.slice(0, 5).forEach(v => {
      console.log(`  - ${v.title} (${v.chapterCount} chapters) [${v.status}]`);
    });
    if (volumeData.length > 5) {
      console.log(`  ... and ${volumeData.length - 5} more volumes`);
    }

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
        name: 'Volume order',
        pass: volumeUrls.every((v, i) => v.volumeNumber === i + 1),
        expected: 'Sequential 1-34',
        actual: volumeUrls.every((v, i) => v.volumeNumber === i + 1) ? 'Sequential 1-34' : 'Out of order'
      },
      {
        name: 'URL format',
        pass: volumeUrls.every(v => v.url.includes('/4000-')),
        expected: 'All URLs contain /4000-',
        actual: volumeUrls.every(v => v.url.includes('/4000-')) ? 'Valid' : 'Invalid URLs found'
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

    // Final note about the flow
    console.log('\n📝 Data Flow Summary:');
    console.log('1. Search returns Fire Force with site_detail_url');
    console.log('2. BasicInfoStep auto-fetches metadata when ComicVine selected');
    console.log('3. fetchComicvineMetadata scrapes all 34 volume URLs');
    console.log('4. volumeData is populated and stored in selectedSourcesMetadata');
    console.log('5. getVolumesForSource retrieves volumeData from metadata');
    console.log('6. UI dropdowns display all 34 volumes');

  } catch (error) {
    console.error('Test failed:', error);
  }
}

// Run the test
testComicVineFullFlow().catch(console.error);