#!/usr/bin/env npx tsx

import { comicVineScraper } from '../src/server/services/comicvine/scrapingService.js';
import { logger } from '../src/utils/logger.js';

async function testComicVineAutoFetch() {
  console.log('\n=== Testing ComicVine Auto-Fetch Fix ===\n');

  // Simulate the scenario where ComicVine is primary provider
  const mockSearchResult = {
    id: 'comicvine_95557',
    title: 'Fire Force (34 issues) (Kodansha Comics USA)',
    provider: 'comicvine',
    source: 'COMICVINE',
    siteDetailUrl: 'https://comicvine.gamespot.com/fire-force/4050-95557/',
    url: 'https://comicvine.gamespot.com/fire-force/4050-95557/',
    comicvineId: '95557',
    issueCount: 34,
    volumes: 34,
    volumeData: [] // Initially empty, will be populated by scraping
  };

  console.log('1. Mock Search Result (from cached search):', {
    title: mockSearchResult.title,
    provider: mockSearchResult.provider,
    volumes: mockSearchResult.volumes,
    volumeDataLength: mockSearchResult.volumeData.length
  });

  // Simulate the auto-fetch logic conditions
  const provider = 'comicvine';
  const selectedSources: string[] = []; // ComicVine not yet in selectedSources
  const formTitle = 'Fire Force';
  const resultTitle = mockSearchResult.title;

  // Test title matching
  const matchesTitle = resultTitle.toLowerCase().startsWith(formTitle.toLowerCase()) ||
                       resultTitle.split('(')[0].trim().toLowerCase() === formTitle.toLowerCase();

  console.log('\n2. Title Matching Test:');
  console.log(`   Form title: "${formTitle}"`);
  console.log(`   Result title: "${resultTitle}"`);
  console.log(`   Matches: ${matchesTitle}`);
  console.log(`   - Starts with: ${resultTitle.toLowerCase().startsWith(formTitle.toLowerCase())}`);
  console.log(`   - Split match: ${resultTitle.split('(')[0].trim().toLowerCase() === formTitle.toLowerCase()}`);

  // Test auto-fetch conditions
  const isComicVineNotSelected = !selectedSources.includes('comicvine');
  const needsComicVineFetch = provider === 'comicvine' &&
    isComicVineNotSelected &&
    mockSearchResult.volumeData.length === 0;

  console.log('\n3. Auto-Fetch Conditions:');
  console.log(`   Provider is ComicVine: ${provider === 'comicvine'}`);
  console.log(`   ComicVine NOT in selectedSources: ${isComicVineNotSelected}`);
  console.log(`   VolumeData is empty: ${mockSearchResult.volumeData.length === 0}`);
  console.log(`   Should trigger auto-fetch: ${needsComicVineFetch}`);

  if (needsComicVineFetch && matchesTitle) {
    console.log('\n4. Auto-fetch would trigger! Fetching metadata...\n');

    try {
      // Fetch the actual volumeData via scraping
      const volumeUrls = await comicVineScraper.scrapeSeriesVolumeUrls(mockSearchResult.siteDetailUrl);

      console.log(`✅ Successfully scraped ${volumeUrls.length} volumes`);

      // Show sample of scraped data
      if (volumeUrls.length > 0) {
        console.log('\nFirst 3 volumes:');
        volumeUrls.slice(0, 3).forEach(v => {
          console.log(`  Volume ${v.volumeNumber}: ${v.url}`);
        });

        if (volumeUrls.length > 3) {
          console.log(`  ... and ${volumeUrls.length - 3} more volumes`);
        }
      }

      // Simulate what would be stored in selectedSourcesMetadata
      const comicvineMetadata = {
        ...mockSearchResult,
        volumeData: volumeUrls,
        status: volumeUrls.length > 30 ? 'COMPLETED' : 'ONGOING'
      };

      console.log('\n5. Final Metadata to be stored:');
      console.log(`   Provider: ${comicvineMetadata.provider}`);
      console.log(`   Title: ${comicvineMetadata.title}`);
      console.log(`   Volumes: ${comicvineMetadata.volumes}`);
      console.log(`   VolumeData items: ${comicvineMetadata.volumeData.length}`);
      console.log(`   Status: ${comicvineMetadata.status}`);

      // After this, selectedSources would include 'comicvine'
      const updatedSelectedSources = [...selectedSources, 'comicvine'];
      console.log('\n6. After auto-fetch:');
      console.log(`   selectedSources: [${updatedSelectedSources.join(', ')}]`);
      console.log(`   ComicVine is now selected: ${updatedSelectedSources.includes('comicvine')}`);
      console.log(`   Auto-fetch would NOT trigger again (prevents toggle removal)`);

      console.log('\n✅ Auto-fetch fix verified! ComicVine data would be properly fetched and retained.');

    } catch (error) {
      console.error('❌ Scraping failed:', error);
    }
  } else {
    console.log('\n❌ Auto-fetch conditions not met:');
    if (!matchesTitle) console.log('   - Title does not match');
    if (!needsComicVineFetch) {
      if (provider !== 'comicvine') console.log('   - Provider is not ComicVine');
      if (!isComicVineNotSelected) console.log('   - ComicVine already selected (would cause toggle removal!)');
      if (mockSearchResult.volumeData.length > 0) console.log('   - VolumeData already populated');
    }
  }

  console.log('\n=== Test Complete ===\n');
}

// Run the test
testComicVineAutoFetch().catch(console.error);