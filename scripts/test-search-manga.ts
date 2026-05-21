#!/usr/bin/env tsx
/**
 * Test searching for Fire Force manga directly
 */

import { FandomService } from '../src/server/services/fandom/FandomService';

async function testDirectMangaSearch() {
  console.log('Testing direct manga search...\n');

  const service = new FandomService('fire-force');

  try {
    // Search for "Fire Force (manga)" specifically
    console.log('Searching for "Fire Force (manga)"...');
    const results = await service.search('Fire Force (manga)', {
      limit: 5,
      type: 'manga',
      includeDetails: true
    });

    console.log(`Found ${results.length} results\n`);

    if (results.length > 0) {
      const result = results[0];
      console.log('Result:');
      console.log(`- Title: ${result.title}`);
      console.log(`- Type: ${result.type}`);
      console.log(`- URL: ${result.url}`);
      console.log(`- Has metadata: ${!!result.metadata}`);
      if (result.metadata) {
        console.log('\nMetadata:');
        console.log(`- Volumes: ${result.metadata.volumes}`);
        console.log(`- Chapters: ${result.metadata.chapters}`);
        console.log(`- Author: ${result.metadata.author}`);
        console.log(`- Status: ${result.metadata.status}`);
        console.log(`- Publisher: ${result.metadata.publisher}`);

        const expectedVolumes = 34;
        if (result.metadata.volumes === expectedVolumes) {
          console.log(`\n✅ Volume count is correct: ${result.metadata.volumes}`);
        } else {
          console.log(`\n❌ Volume count incorrect: Expected ${expectedVolumes}, got ${result.metadata.volumes}`);
        }
      }
    }

    // Also try searching just for "manga"
    console.log('\n\nSearching for "manga"...');
    const mangaResults = await service.search('manga', {
      limit: 3,
      type: 'manga',
      includeDetails: false
    });

    console.log(`Found ${mangaResults.length} results:`);
    mangaResults.forEach(r => {
      console.log(`- ${r.title} (type: ${r.type})`);
    });

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    service.destroy();
  }
}

testDirectMangaSearch();