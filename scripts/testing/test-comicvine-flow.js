#!/usr/bin/env node

/**
 * Test script to verify ComicVine metadata flow
 * This tests that ComicVine volume details are properly fetched and passed through the system
 */

const fetch = require('node-fetch');

async function testComicVineFlow() {
  console.log('Testing ComicVine metadata flow...\n');
  
  try {
    // Test 1: Fetch ComicVine volume details for Fire Force
    console.log('1. Testing fetchComicvineVolumeDetails endpoint...');
    const volumeDetailsResponse = await fetch('http://localhost:3001/api/trpc/metadata.fetchComicvineVolumeDetails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        json: {
          id: '104877', // Fire Force volume ID
          type: 'volume'
        }
      })
    });
    
    const volumeDetails = await volumeDetailsResponse.json();
    
    if (volumeDetails.result?.data?.status === 'success') {
      const data = volumeDetails.result.data.data;
      console.log('✅ Volume details fetched successfully:');
      console.log(`   - Name: ${data.name}`);
      console.log(`   - Issue Count: ${data.issueCount}`);
      console.log(`   - Issues: ${data.issues?.length || 0} issues found`);
      console.log(`   - Characters: ${data.characterCredits?.length || 0} characters`);
      console.log(`   - Creators: ${data.personCredits?.length || 0} creators`);
      console.log(`   - Publisher: ${data.publisher?.name || 'N/A'}`);
      
      // Show first 3 issues as examples
      if (data.issues && data.issues.length > 0) {
        console.log('\n   Sample Issues:');
        data.issues.slice(0, 3).forEach(issue => {
          console.log(`     - Issue #${issue.issue_number}: ${issue.name || 'Untitled'}`);
        });
      }
    } else {
      console.log('❌ Failed to fetch volume details:', volumeDetails.result?.data?.error || 'Unknown error');
    }
    
    // Test 2: Search for ComicVine manga
    console.log('\n2. Testing ComicVine search...');
    const searchResponse = await fetch('http://localhost:3001/api/trpc/search.searchManga', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        json: {
          query: 'Fire Force',
          providers: ['comicvine'],
          limit: 5
        }
      })
    });
    
    const searchResults = await searchResponse.json();
    
    if (searchResults.result?.data?.status === 'success') {
      const results = searchResults.result.data.data;
      console.log(`✅ Search returned ${results.length} results`);
      
      if (results.length > 0) {
        const firstResult = results[0];
        console.log('\n   First result:');
        console.log(`   - Title: ${firstResult.title}`);
        console.log(`   - ID: ${firstResult.id}`);
        console.log(`   - Source: ${firstResult.source}`);
        console.log(`   - Has metadata: ${Boolean(firstResult.metadata)}`);
        console.log(`   - Has providerSpecific: ${Boolean(firstResult.providerSpecific)}`);
        
        // Check if enrichment data is present
        if (firstResult.metadata?.issues || firstResult.providerSpecific?.issues) {
          console.log('   ✅ Result has issue data');
        } else {
          console.log('   ⚠️  Result missing issue data (will be fetched on selection)');
        }
      }
    } else {
      console.log('❌ Search failed:', searchResults.result?.data?.error || 'Unknown error');
    }
    
    console.log('\n✨ Test complete!');
    console.log('\nNext steps:');
    console.log('1. Search for "Fire Force" in the UI and select ComicVine as the provider');
    console.log('2. Select a Fire Force result from ComicVine');
    console.log('3. The confirmation screen should show issues, characters, and creators');
    console.log('4. After adding the manga, chapters should be created from the issues');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('\nMake sure the server is running on http://localhost:3001');
  }
}

// Run the test
testComicVineFlow();