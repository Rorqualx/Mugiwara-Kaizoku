/**
 * Test ComicVine Service
 *
 * Fetches Fire Force data from ComicVine API to see what data is returned.
 */

import { comicvineService } from '../src/server/services/comicvine/service';

async function main(): Promise<void> {
  console.log('='.repeat(60));
  console.log('Testing ComicVine Service - Fire Force');
  console.log('='.repeat(60));

  // Initialize the service (loads API key from config)
  const initialized = await comicvineService.initialize();
  console.log('\nService initialized:', initialized);

  if (!initialized) {
    console.log('Failed to initialize ComicVine service. Check API key in configuration.');
    return;
  }

  // Search for Fire Force volumes
  console.log('\n--- Test 1: Search Volumes ---');
  const searchResults = await comicvineService.searchBasicVolumes('Fire Force', 0, 5);

  console.log(`Found ${searchResults.length} results`);

  for (const result of searchResults) {
    console.log('\n  Volume:');
    console.log('    ID:', result.id);
    console.log('    Name:', result.name);
    console.log('    Publisher:', result.publisher?.name);
    console.log('    Start Year:', result.start_year);
    console.log('    Issue Count:', result.count_of_issues);
    console.log('    Description:', result.description?.substring(0, 200) + '...');
    console.log('    Site URL:', result.site_detail_url);
    console.log('    Has Genres:', !!result.genres);
    console.log('    Genres:', result.genres);
  }

  // Get detailed info for Fire Force USA (ID: 95557)
  console.log('\n--- Test 2: Get Complete Volume Info (Fire Force USA) ---');
  const volumeId = 95557;
  const volumeDetails = await comicvineService.getCompleteVolumeInfo(volumeId);

  if (volumeDetails) {
    console.log('\nVolume Details:');
    console.log('  ID:', volumeDetails.id);
    console.log('  Name:', volumeDetails.name);
    console.log('  Publisher:', volumeDetails.publisher?.name);
    console.log('  Start Year:', volumeDetails.start_year);
    console.log('  Issue Count:', volumeDetails.count_of_issues);
    console.log('  Description:', volumeDetails.description?.substring(0, 300) + '...');
    console.log('  Deck:', volumeDetails.deck);
    console.log('  Site URL:', volumeDetails.site_detail_url);

    // Genres
    console.log('\n  Genres:', volumeDetails.genres);

    // Characters
    if (volumeDetails.characters && volumeDetails.characters.length > 0) {
      console.log(`\n  Characters (${volumeDetails.characters.length}):`);
      volumeDetails.characters.slice(0, 10).forEach(char => {
        console.log(`    - ${char.name}`);
      });
    }

    // Creators
    if (volumeDetails.person_credits && volumeDetails.person_credits.length > 0) {
      console.log(`\n  Creators (${volumeDetails.person_credits.length}):`);
      volumeDetails.person_credits.slice(0, 10).forEach(creator => {
        console.log(`    - ${creator.name}: ${creator.role ?? 'unknown role'}`);
      });
    }

    // Log full object for inspection
    console.log('\n  === FULL VOLUME DATA (keys) ===');
    console.log('  Keys:', Object.keys(volumeDetails));

    // Check for concepts/themes
    const rawData = volumeDetails as Record<string, unknown>;
    console.log('\n  Has concepts:', 'concepts' in rawData);
    console.log('  Has themes:', 'themes' in rawData);
    if ('concepts' in rawData) {
      console.log('  Concepts:', rawData['concepts']);
    }
    if ('themes' in rawData) {
      console.log('  Themes:', rawData['themes']);
    }
  } else {
    console.log('Failed to get volume details');
  }

  // Get issues for Fire Force
  console.log('\n--- Test 3: Get Volume Issues ---');
  const issues = await comicvineService.getVolumeIssues(volumeId, 0, 10);

  console.log(`\nIssues (${issues.length}):`);
  for (const issue of issues.slice(0, 5)) {
    console.log(`  Issue #${issue.issue_number ?? 'N/A'}: ${issue.name ?? 'Untitled'}`);
    console.log(`    ID: ${issue.id}`);
    console.log(`    Cover Date: ${issue.cover_date ?? 'N/A'}`);
    console.log(`    Store Date: ${issue.store_date ?? 'N/A'}`);
  }

  // Get characters for Fire Force
  console.log('\n--- Test 4: Get Volume Characters ---');
  const characters = await comicvineService.getVolumeCharacters(volumeId, 0, 10);

  console.log(`\nCharacters (${characters.length}):`);
  for (const char of characters.slice(0, 10)) {
    console.log(`  - ${char.name} (ID: ${char.id})`);
    if (char.real_name) console.log(`    Real Name: ${char.real_name}`);
  }

  console.log('\n=== DONE ===');
}

main().catch(console.error);
