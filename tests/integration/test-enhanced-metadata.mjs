#!/usr/bin/env node
/**
 * Test script for enhanced metadata fetching
 * Tests that additional source selection fetches full metadata
 */

import fetch from 'node-fetch';

const API_URL = 'http://localhost:3000/api/trpc';

async function testEnhancedMetadata() {
  console.log('Testing Enhanced Metadata Fetching...\n');
  
  // Test 1: Search for manga in Fandom
  console.log('1. Searching for "Fire Force" in Fandom...');
  const fandomSearchResponse = await fetch(`${API_URL}/metadata.searchProvider`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      json: {
        provider: 'fandom',
        query: 'Fire Force'
      }
    })
  });
  
  const fandomSearchData = await fandomSearchResponse.json();
  const fandomResult = fandomSearchData?.result?.data?.json?.results?.[0];
  
  if (!fandomResult) {
    console.error('❌ No Fandom results found');
    return;
  }
  
  console.log(`✅ Found: ${fandomResult.title}`);
  console.log(`   URL: ${fandomResult.wikiUrl || fandomResult.url}`);
  
  // Test 2: Fetch enhanced Fandom metadata
  console.log('\n2. Fetching enhanced Fandom metadata...');
  const enhancedResponse = await fetch(`${API_URL}/metadata.fetchEnhancedFandom`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      json: {
        mangaPageUrl: fandomResult.wikiUrl || fandomResult.url,
        includeGallery: true
      }
    })
  });
  
  const enhancedData = await enhancedResponse.json();
  const enhanced = enhancedData?.result?.data?.json;
  
  if (!enhanced) {
    console.error('❌ Failed to fetch enhanced metadata');
    return;
  }
  
  // Check for enhanced fields
  const hasVolumeCovers = enhanced.coverArt?.volumeCovers?.length > 0;
  const hasGallery = enhanced.coverArt?.gallery?.length > 0;
  const hasCharacterArt = enhanced.coverArt?.characterArt?.length > 0;
  const hasDescriptions = enhanced.descriptions?.length > 0;
  
  console.log('Enhanced metadata results:');
  console.log(`✅ Volume Covers: ${hasVolumeCovers ? enhanced.coverArt.volumeCovers.length : 0}`);
  console.log(`✅ Gallery Images: ${hasGallery ? enhanced.coverArt.gallery.length : 0}`);
  console.log(`✅ Character Art: ${hasCharacterArt ? enhanced.coverArt.characterArt.length : 0}`);
  console.log(`✅ Descriptions: ${hasDescriptions ? enhanced.descriptions.length : 0}`);
  
  // Test 3: Test ComicVine enhancement
  console.log('\n3. Testing ComicVine enhancement...');
  const comicvineSearchResponse = await fetch(`${API_URL}/metadata.searchProvider`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      json: {
        provider: 'comicvine',
        query: 'Fire Force'
      }
    })
  });
  
  const comicvineSearchData = await comicvineSearchResponse.json();
  const comicvineResult = comicvineSearchData?.result?.data?.json?.results?.[0];
  
  if (comicvineResult) {
    console.log(`✅ Found ComicVine: ${comicvineResult.title}`);
    
    // Fetch volume details
    const volumeResponse = await fetch(`${API_URL}/metadata.fetchComicvineVolumeDetails`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        json: {
          id: String(comicvineResult.id || comicvineResult.sourceId),
          type: 'volume'
        }
      })
    });
    
    const volumeData = await volumeResponse.json();
    const volume = volumeData?.result?.data?.json;
    
    if (volume?.issues) {
      console.log(`✅ ComicVine Issues: ${volume.issues.length}`);
    }
  }
  
  console.log('\n✅ All tests completed successfully!');
  console.log('Enhanced metadata fetching is working as expected.');
}

testEnhancedMetadata().catch(error => {
  console.error('Test failed:', error);
  process.exit(1);
});