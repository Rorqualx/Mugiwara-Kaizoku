/**
 * Test script for AniList adult content filter
 * 
 * This script tests whether the adult content filter is working properly
 * by searching for known adult content and verifying it's filtered out.
 */

import { anilistService } from '../src/server/services/anilist/service';
import { anilistConfigService } from '../src/server/services/anilist/configService';
import { logger } from '../src/utils/logger';

interface SearchTestCase {
  query: string;
  expectedWithFilter: boolean; // Whether we expect results with filter on
  expectedWithoutFilter: boolean; // Whether we expect results without filter
  description: string;
}

const testCases: SearchTestCase[] = [
  {
    query: "One Piece",
    expectedWithFilter: true,
    expectedWithoutFilter: true,
    description: "Normal manga should appear in both filtered and unfiltered searches"
  },
  {
    query: "Attack on Titan",
    expectedWithFilter: true,
    expectedWithoutFilter: true,
    description: "Popular non-adult manga should always appear"
  },
  {
    query: "High School DxD", // Known ecchi/borderline series
    expectedWithFilter: false,
    expectedWithoutFilter: true,
    description: "Ecchi/adult content should be filtered when filter is enabled"
  }
];

async function testAdultFilter() {
  console.log('\n=== Testing AniList Adult Content Filter ===\n');

  try {
    // Get current configuration
    const currentConfig = await anilistConfigService.loadConfig();
    console.log('Current filter setting:', currentConfig?.filterAdultContent ?? true);
    
    // Test with filter ENABLED (default)
    console.log('\n--- Testing with adult filter ENABLED ---');
    await anilistConfigService.updateConfig({ filterAdultContent: true });
    
    for (const testCase of testCases) {
      console.log(`\nSearching for: "${testCase.query}"`);
      console.log(`Description: ${testCase.description}`);
      
      try {
        const results = await anilistService.searchManga(testCase.query, { limit: 5 });
        const hasResults = results && results.length > 0;
        
        if (hasResults) {
          console.log(`✓ Found ${results.length} results`);
          // Check if any results are adult content
          const titles = results.slice(0, 3).map(r => r.title || r.title?.english || r.title?.romaji).join(', ');
          console.log(`  Top results: ${titles}`);
        } else {
          console.log('✗ No results found');
        }
        
        if (hasResults !== testCase.expectedWithFilter) {
          console.log(`⚠️  UNEXPECTED: Expected ${testCase.expectedWithFilter ? 'results' : 'no results'} with filter enabled`);
        }
      } catch (error) {
        console.error(`Error searching: ${error}`);
      }
    }
    
    // Test with filter DISABLED
    console.log('\n--- Testing with adult filter DISABLED ---');
    await anilistConfigService.updateConfig({ filterAdultContent: false });
    
    for (const testCase of testCases) {
      console.log(`\nSearching for: "${testCase.query}"`);
      
      try {
        const results = await anilistService.searchManga(testCase.query, { limit: 5 });
        const hasResults = results && results.length > 0;
        
        if (hasResults) {
          console.log(`✓ Found ${results.length} results`);
          const titles = results.slice(0, 3).map(r => r.title || r.title?.english || r.title?.romaji).join(', ');
          console.log(`  Top results: ${titles}`);
        } else {
          console.log('✗ No results found');
        }
        
        if (hasResults !== testCase.expectedWithoutFilter) {
          console.log(`⚠️  UNEXPECTED: Expected ${testCase.expectedWithoutFilter ? 'results' : 'no results'} with filter disabled`);
        }
      } catch (error) {
        console.error(`Error searching: ${error}`);
      }
    }
    
    // Test explicit filterAdultContent parameter override
    console.log('\n--- Testing explicit parameter override ---');
    await anilistConfigService.updateConfig({ filterAdultContent: true }); // Set filter to true
    
    console.log('\nConfig has filter=true, but passing filterAdultContent=false to search:');
    const overrideResults = await anilistService.searchManga("High School DxD", { 
      limit: 5,
      filterAdultContent: false // Explicitly override
    });
    
    if (overrideResults && overrideResults.length > 0) {
      console.log(`✓ Override worked - found ${overrideResults.length} results despite filter config`);
    } else {
      console.log('✗ Override may not be working - no results found');
    }
    
    // Restore original configuration
    if (currentConfig) {
      await anilistConfigService.updateConfig(currentConfig);
      console.log('\n✓ Restored original configuration');
    }
    
    console.log('\n=== Adult Filter Test Complete ===\n');
    
  } catch (error) {
    console.error('Test failed:', error);
    process.exit(1);
  }
}

// Run the test
testAdultFilter().then(() => {
  console.log('All tests completed successfully');
  process.exit(0);
}).catch(error => {
  console.error('Test execution failed:', error);
  process.exit(1);
});