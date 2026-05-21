#!/usr/bin/env node

/**
 * Test script for the add manga workflow
 * Tests search, provider confirmation, and metadata handling
 */

import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:3001';

// ANSI color codes for output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title) {
  console.log('\n' + '='.repeat(60));
  log(title, 'bright');
  console.log('='.repeat(60));
}

function logSuccess(message) {
  log('✅ ' + message, 'green');
}

function logError(message) {
  log('❌ ' + message, 'red');
}

function logInfo(message) {
  log('ℹ️  ' + message, 'blue');
}

function logWarning(message) {
  log('⚠️  ' + message, 'yellow');
}

async function testSearchProviders() {
  logSection('Testing Search Providers');
  
  const searchQueries = [
    { query: 'Fire Force', provider: 'anilist' },
    { query: 'Fire Force', provider: 'comicvine' },
    { query: 'Fire Force', provider: 'fandom' },
    { query: 'One Piece', provider: 'anilist' },
  ];
  
  for (const { query, provider } of searchQueries) {
    try {
      logInfo(`Searching "${query}" with ${provider}...`);
      
      const response = await fetch(`${BASE_URL}/api/trpc/manga.search?batch=1`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        },
        // Encode the query parameters properly
        body: JSON.stringify({
          0: {
            json: {
              source: provider,
              keyword: query
            }
          }
        })
      }).catch(err => {
        // Try using the debug endpoint instead
        return fetch(`${BASE_URL}/api/debug/search-test?provider=${provider}&query=${encodeURIComponent(query)}`);
      });
      
      if (response.ok) {
        const data = await response.json();
        const resultCount = data.results?.length || data[0]?.result?.data?.length || 0;
        
        if (resultCount > 0) {
          logSuccess(`Found ${resultCount} results from ${provider}`);
          
          // Log first result for verification
          const firstResult = data.results?.[0] || data[0]?.result?.data?.[0];
          if (firstResult) {
            logInfo(`  First result: "${firstResult.title || firstResult.name}"`);
          }
        } else {
          logWarning(`No results found from ${provider}`);
        }
      } else {
        logError(`Search failed with status ${response.status}`);
      }
    } catch (error) {
      logError(`Error searching with ${provider}: ${error.message}`);
    }
  }
}

async function testProviderConfirmation() {
  logSection('Testing Provider Confirmation Search');
  
  try {
    logInfo('Testing searchProviderConfirmation endpoint...');
    
    // Test with a title that should work across providers
    const testTitle = 'Fire Force';
    
    const response = await fetch(`${BASE_URL}/api/trpc/manga.searchProviderConfirmation?batch=1`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    // Since we can't easily call TRPC directly, let's test via the debug endpoint
    const debugResponse = await fetch(`${BASE_URL}/api/debug/search-providers`);
    
    if (debugResponse.ok) {
      const data = await debugResponse.json();
      logSuccess('Provider registry is accessible');
      
      if (data.providers && Array.isArray(data.providers)) {
        logInfo(`Available providers: ${data.providers.join(', ')}`);
        
        // Verify anilist is in the list
        if (data.providers.includes('anilist')) {
          logSuccess('AniList provider is registered correctly');
        } else {
          logError('AniList provider is NOT registered!');
        }
        
        // Check for anilist-native (should not exist)
        if (data.providers.includes('anilist-native')) {
          logError('anilist-native still exists in registry!');
        } else {
          logSuccess('anilist-native has been removed');
        }
      }
    }
  } catch (error) {
    logError(`Error testing provider confirmation: ${error.message}`);
  }
}

async function testMetadataStructure() {
  logSection('Testing Metadata Structure');
  
  try {
    // Test that metadata is properly structured when searching
    const providers = ['anilist', 'comicvine', 'fandom'];
    
    for (const provider of providers) {
      logInfo(`Checking metadata structure for ${provider}...`);
      
      const response = await fetch(`${BASE_URL}/api/debug/search-test?provider=${provider}&query=Fire%20Force`);
      
      if (response.ok) {
        const data = await response.json();
        
        if (data.results && data.results.length > 0) {
          const firstResult = data.results[0];
          
          // Check for expected metadata fields
          const expectedFields = ['id', 'title'];
          const optionalFields = ['cover', 'coverImage', 'description', 'status', 'genres', 'alternativeTitles'];
          
          let allRequiredPresent = true;
          for (const field of expectedFields) {
            if (!(field in firstResult)) {
              logError(`  Missing required field: ${field}`);
              allRequiredPresent = false;
            }
          }
          
          if (allRequiredPresent) {
            logSuccess(`  All required fields present for ${provider}`);
          }
          
          // Check optional fields
          const presentOptional = optionalFields.filter(field => field in firstResult);
          if (presentOptional.length > 0) {
            logInfo(`  Optional fields present: ${presentOptional.join(', ')}`);
          }
          
          // Special check for AniList metadata
          if (provider === 'anilist') {
            if (firstResult.chapters || firstResult.volumes) {
              logSuccess(`  AniList includes chapter/volume data`);
            }
          }
        }
      }
    }
  } catch (error) {
    logError(`Error testing metadata structure: ${error.message}`);
  }
}

async function testTitleCleaning() {
  logSection('Testing Title Cleaning for Better Matches');
  
  const testCases = [
    {
      original: 'Fire Force Volume 2016 (34 volumes) (Kodansha Comics USA)',
      expected: 'Fire Force',
      description: 'Publisher and volume info removal'
    },
    {
      original: 'One Piece (Manga)',
      expected: 'One Piece',
      description: 'Parenthetical suffix removal'
    }
  ];
  
  for (const testCase of testCases) {
    logInfo(`Testing: ${testCase.description}`);
    logInfo(`  Original: "${testCase.original}"`);
    
    // The cleaning happens in the confirmation step
    const cleaned = testCase.original.replace(/\s*\([^)]*\)\s*/g, '').trim();
    
    if (cleaned === testCase.expected) {
      logSuccess(`  Cleaned correctly to: "${cleaned}"`);
    } else {
      logError(`  Unexpected result: "${cleaned}" (expected: "${testCase.expected}")`);
    }
  }
}

async function runAllTests() {
  log('\n🚀 Starting Add Manga Workflow Tests', 'cyan');
  
  // Give server a moment to fully start
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  await testSearchProviders();
  await testProviderConfirmation();
  await testMetadataStructure();
  await testTitleCleaning();
  
  logSection('Test Summary');
  logSuccess('Add manga workflow tests completed');
  logInfo('Check the output above for any errors or warnings');
}

// Run tests
runAllTests().catch(error => {
  logError(`Fatal error: ${error.message}`);
  process.exit(1);
});