/**
 * Simple test script for AniList adult content filter
 * 
 * This script tests the adult filter directly through the AniList adapter
 * without requiring database connections.
 */

import { AniListAdapter } from '../src/server/parsers/adapters/AniListAdapter';

interface TestCase {
  query: string;
  isAdult: boolean | undefined;
  description: string;
}

const testCases: TestCase[] = [
  {
    query: "One Piece",
    isAdult: false,
    description: "Normal manga with adult filter ON (isAdult=false)"
  },
  {
    query: "One Piece",
    isAdult: undefined,
    description: "Normal manga with no filter specified"
  },
  {
    query: "High School DxD",
    isAdult: false,
    description: "Adult/ecchi content with filter ON (isAdult=false)"
  },
  {
    query: "High School DxD",
    isAdult: undefined,
    description: "Adult/ecchi content with no filter specified"
  }
];

async function testAdultFilter() {
  console.log('\n=== Testing AniList Adult Content Filter (Direct API) ===\n');

  const adapter = new AniListAdapter();

  for (const testCase of testCases) {
    console.log(`\n--- ${testCase.description} ---`);
    console.log(`Query: "${testCase.query}"`);
    console.log(`isAdult parameter: ${testCase.isAdult}`);

    try {
      const results = await adapter.search(testCase.query, {
        perPage: 5,
        isAdult: testCase.isAdult
      });

      if (results && results.length > 0) {
        console.log(`✓ Found ${results.length} results`);
        const titles = results.slice(0, 3).map(r => r.title).join(', ');
        console.log(`  Top results: ${titles}`);
        
        // Check if any results might be adult content based on genres/tags
        const hasAdultContent = results.some(r => {
          const genres = r.genres || [];
          const tags = r.tags || [];
          return genres.some(g => g.toLowerCase().includes('hentai') || g.toLowerCase().includes('ecchi')) ||
                 tags.some(t => t.toLowerCase().includes('sexual') || t.toLowerCase().includes('nudity'));
        });
        
        if (hasAdultContent && testCase.isAdult === false) {
          console.log('⚠️  WARNING: Adult content found despite filter being enabled');
        } else if (!hasAdultContent && testCase.isAdult === false) {
          console.log('✓ No adult content detected (filter working)');
        }
      } else {
        console.log('✗ No results found');
        if (testCase.query === "High School DxD" && testCase.isAdult === false) {
          console.log('✓ This is expected - adult content blocked by filter');
        }
      }
    } catch (error) {
      console.error(`Error searching: ${error}`);
    }
  }

  console.log('\n=== Direct API Filter Test Complete ===\n');
}

// Run the test
testAdultFilter().then(() => {
  console.log('Test completed successfully');
  process.exit(0);
}).catch(error => {
  console.error('Test execution failed:', error);
  process.exit(1);
});