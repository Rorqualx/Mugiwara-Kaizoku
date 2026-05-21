/**
 * Test the stealth scraper service
 *
 * Uses the correct Fire Force USA URL: https://comicvine.gamespot.com/fire-force/4050-95557/
 */

import { scrapeComicVinePage, clearBrowserCache } from '../src/server/services/comicvine/stealthScraper';

async function main(): Promise<void> {
  console.log('='.repeat(60));
  console.log('Testing Stealth Scraper Service');
  console.log('='.repeat(60));

  // Clear cache for fresh test
  clearBrowserCache();

  // Test with correct Fire Force USA volume
  const volumeUrl = 'https://comicvine.gamespot.com/fire-force/4050-95557/';
  console.log('\n--- Test 1: Fire Force Volume (USA) ---');
  console.log('URL:', volumeUrl);

  const volumeResult = await scrapeComicVinePage(volumeUrl);

  if (volumeResult) {
    console.log('\nVolume Result:');
    console.log('  Title:', volumeResult.title);
    console.log('  THEMES:', volumeResult.themes);
    console.log('  Concepts:', volumeResult.concepts);
    console.log('  Characters:', volumeResult.characters.slice(0, 5));
    console.log('  Locations:', volumeResult.locations);
    console.log('  Creators:', volumeResult.creators);
    console.log('  Publisher:', volumeResult.publisher);
    console.log('  Year:', volumeResult.year);
  } else {
    console.log('Failed to scrape volume');
  }

  // Test with an issue page
  const issueUrl = 'https://comicvine.gamespot.com/fire-force-1-fire-walk-with-me/4000-557264/';
  console.log('\n--- Test 2: Fire Force Issue #1 ---');
  console.log('URL:', issueUrl);

  const issueResult = await scrapeComicVinePage(issueUrl, {
    visitHomepageFirst: false, // Already have session from previous scrape
  });

  if (issueResult) {
    console.log('\nIssue Result:');
    console.log('  Title:', issueResult.title);
    console.log('  Concepts:', issueResult.concepts);
    console.log('  Characters:', issueResult.characters.slice(0, 5));
    console.log('  Locations:', issueResult.locations);
    console.log('  Creators:', issueResult.creators);
  } else {
    console.log('Failed to scrape issue');
  }

  console.log('\n=== DONE ===');
}

main().catch(console.error);
