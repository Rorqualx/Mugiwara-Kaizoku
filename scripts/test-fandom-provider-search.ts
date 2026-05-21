#!/usr/bin/env tsx
/**
 * Test script to debug Fandom search issues
 */

import { FandomProvider } from '../src/server/services/search/providers/FandomProvider.js';
import { FandomService } from '../src/server/services/fandom/FandomService.js';

async function testDirectSearch() {
  console.log('\n=== Testing Direct FandomService Search ===\n');

  // Test direct FandomService with fire-force subdomain
  const service = new FandomService('fire-force');

  try {
    const results = await service.search('Fire Force', {
      type: 'manga',
      limit: 5,
      includeDetails: true
    });

    console.log(`Direct search results: ${results.length}`);
    if (results.length > 0) {
      console.log('First result:', JSON.stringify(results[0], null, 2));
    }
  } catch (error) {
    console.error('Direct search error:', error);
  }
}

async function testProviderSearch() {
  console.log('\n=== Testing FandomProvider Search ===\n');

  const provider = new FandomProvider();

  try {
    const results = await provider.search('Fire Force', {
      limit: 5
    });

    console.log(`Provider search results: ${results.length}`);
    if (results.length > 0) {
      const firstResult = results[0];
      console.log('First result:');
      console.log('- Title:', firstResult.title);
      console.log('- Provider:', firstResult.provider);
      console.log('- Has coverImage:', !!firstResult.coverImage);
      console.log('- CoverImage URL:', firstResult.coverImage);
      console.log('- Has gallery:', !!firstResult.gallery);
      console.log('- Gallery length:', firstResult.gallery?.length || 0);

      if (firstResult.metadata) {
        console.log('- Metadata gallery:', (firstResult.metadata as any).gallery?.length || 0);
      }
    } else {
      console.log('No results found from provider!');

      // Try searching individual wikis to debug
      console.log('\n=== Debugging Individual Wiki Searches ===\n');

      const wikis = ['fireforce', 'fire-force', 'naruto', 'onepiece'];
      for (const wiki of wikis) {
        try {
          const wikiService = new FandomService(wiki);
          const wikiResults = await wikiService.search('Fire Force', {
            type: 'manga',
            limit: 1
          });
          console.log(`Wiki ${wiki}: ${wikiResults.length} results`);
        } catch (error: any) {
          console.log(`Wiki ${wiki}: Error - ${error.message}`);
        }
      }
    }
  } catch (error) {
    console.error('Provider search error:', error);
  }
}

async function main() {
  console.log('Starting Fandom search debug...');

  await testDirectSearch();
  await testProviderSearch();

  process.exit(0);
}

main().catch(console.error);