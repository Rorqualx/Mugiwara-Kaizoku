/**
 * Test ComicVine Scraping Service
 *
 * Tests the scraping service with Fire Force USA (Kodansha Comics USA)
 * to see what data is returned from web scraping.
 */

import { comicVineScraper } from '../src/server/services/comicvine/scrapingService';

async function main(): Promise<void> {
  console.log('='.repeat(60));
  console.log('Testing ComicVine Scraping Service - Fire Force USA');
  console.log('='.repeat(60));

  // Fire Force USA volume URL (Kodansha Comics USA)
  const volumeUrl = 'https://comicvine.gamespot.com/fire-force/4050-95557/';

  console.log('\n--- Test 1: Scrape Volume Chapters ---');
  console.log('URL:', volumeUrl);

  const result = await comicVineScraper.scrapeVolumeChapters(volumeUrl);

  if (result) {
    console.log('\n=== SCRAPING RESULT ===');
    console.log('Volume ID:', result.volumeId);
    console.log('Volume Number:', result.volumeNumber);
    console.log('Volume Title:', result.volumeTitle);
    console.log('Total Chapters:', result.totalChapters);

    // Themes
    if (result.themes && result.themes.length > 0) {
      console.log('\nTHEMES:', result.themes);
    } else {
      console.log('\nTHEMES: None found');
    }

    // Genres
    if (result.genres && result.genres.length > 0) {
      console.log('GENRES:', result.genres);
    } else {
      console.log('GENRES: None found');
    }

    // Publisher
    if (result.publisher) {
      console.log('PUBLISHER:', result.publisher);
    }

    // Cover Image
    if (result.coverImage) {
      console.log('COVER IMAGE:', result.coverImage);
    }

    // Summary
    if (result.summary) {
      console.log('SUMMARY:', result.summary.substring(0, 200) + '...');
    }

    // Chapters
    if (result.chapters && result.chapters.length > 0) {
      console.log(`\nCHAPTERS (${result.chapters.length}):`);
      result.chapters.slice(0, 10).forEach(chapter => {
        console.log(`  Ch. ${chapter.chapterNumber}: ${chapter.title ?? 'Untitled'}`);
      });
      if (result.chapters.length > 10) {
        console.log(`  ... and ${result.chapters.length - 10} more`);
      }
    } else {
      console.log('\nCHAPTERS: None found');
    }

    // Log all keys
    console.log('\n=== ALL RESULT KEYS ===');
    console.log(Object.keys(result));

    // Log the full result for debugging
    console.log('\n=== FULL RESULT (JSON) ===');
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log('\nFailed to scrape volume');
  }

  console.log('\n=== DONE ===');
}

main().catch(console.error);
