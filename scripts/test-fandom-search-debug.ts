/**
 * Debug script to see what MediaWiki API returns for Fire Force search
 */

import { FandomService } from '@/server/services/fandom/FandomService';

async function debugSearch() {
  console.log('=== Debugging Fandom Search for "Fire Force" ===\n');

  // Create FandomService for fire-force wiki
  const service = new FandomService('fire-force', {
    name: 'Fire Force',
    subdomain: 'fire-force',
    categories: {
      characters: 'Characters',
      chapters: 'Chapters',
      volumes: 'Volumes',
      arcs: 'Story Arcs'
    }
  });

  try {
    console.log('1. Testing MediaWiki API search...');
    const searchResults = await service.search('Fire Force', {
      type: 'manga',
      limit: 20,
      includeDetails: false  // Just get raw results
    });

    console.log(`Raw search results count: ${searchResults.length}`);
    console.log('\nRaw search results:');
    searchResults.forEach((result, index) => {
      console.log(`${index + 1}. ${result.title} (${result.type})`);
    });

    console.log('\n2. Testing with includeDetails: true...');
    const detailedResults = await service.search('Fire Force', {
      type: 'manga',
      limit: 10,
      includeDetails: true
    });

    console.log(`Detailed results count: ${detailedResults.length}`);
    console.log('\nDetailed results:');
    detailedResults.forEach((result, index) => {
      console.log(`${index + 1}. ${result.title} (${result.type})`);
      if (result.description) {
        console.log(`   Description: ${result.description.substring(0, 100)}...`);
      }
    });

  } catch (error) {
    console.error('Error during search:', error);
  } finally {
    service.destroy();
  }
}

debugSearch().catch(console.error);