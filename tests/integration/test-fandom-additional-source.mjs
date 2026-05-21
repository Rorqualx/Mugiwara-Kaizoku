#!/usr/bin/env node

/**
 * Test script to verify Fandom enhancement works when used as an additional source
 */

import fetch from 'node-fetch';

const API_URL = 'http://localhost:3000/api/trpc';

async function testFandomAsAdditionalSource() {
  console.log('🧪 Testing Fandom Enhancement as Additional Source...\n');
  
  try {
    // Step 1: Search for manga in Fandom (to simulate cached results)
    console.log('📡 Step 1: Searching Fandom for "Fire Force"...');
    const searchResponse = await fetch(`${API_URL}/manga.search?batch=1&input=${encodeURIComponent(JSON.stringify({
      "0": { "json": { "source": "fandom", "keyword": "Fire Force" } }
    }))}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });
    
    const searchData = await searchResponse.json();
    const results = searchData[0]?.result?.data?.json || [];
    
    if (results.length === 0) {
      console.error('❌ No Fandom results found');
      return;
    }
    
    const firstResult = results[0];
    console.log(`✅ Found: ${firstResult.title}`);
    console.log(`   ID: ${firstResult.id}`);
    console.log(`   Has wikiUrl: ${!!firstResult.wikiUrl}`);
    console.log(`   wikiUrl: ${firstResult.wikiUrl}`);
    console.log(`   Has url: ${!!firstResult.url}`);
    console.log(`   url: ${firstResult.url}`);
    console.log(`   Has volume covers: ${!!firstResult.volumeCovers}`);
    console.log(`   Volume covers count: ${firstResult.volumeCovers?.length || 0}`);
    
    // Step 2: Simulate selecting this as an additional source (test enhancement directly)
    const mangaUrl = firstResult.wikiUrl || firstResult.url;
    if (!mangaUrl) {
      console.error('❌ No URL found in search results - URLs not preserved!');
      return;
    }
    
    console.log('\n📡 Step 2: Testing enhancement with the URL from search results...');
    const enhanceResponse = await fetch(`${API_URL}/metadata.fetchEnhancedMangaMetadata`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        json: {
          mangaPageUrl: mangaUrl,
          includeGallery: true
        }
      })
    });
    
    const enhanceData = await enhanceResponse.json();
    
    // Check if it's an AsyncResult
    if (enhanceData.result?.data?.json) {
      const asyncResult = enhanceData.result.data.json;
      
      if (asyncResult.status === 'success' && asyncResult.data) {
        const enhanced = asyncResult.data;
        console.log('\n✅ Enhanced metadata received:');
        console.log(`   Title: ${enhanced.title}`);
        console.log(`   Alternative titles: ${enhanced.alternativeTitles?.length || 0}`);
        console.log(`   Volume covers: ${enhanced.coverArt?.volumeCovers?.length || 0}`);
        console.log(`   Gallery images: ${enhanced.coverArt?.gallery?.length || 0}`);
        console.log(`   Character art: ${enhanced.coverArt?.characterArt?.length || 0}`);
        
        if (enhanced.coverArt?.volumeCovers?.length > 0) {
          console.log('\n📚 Sample volume covers:');
          enhanced.coverArt.volumeCovers.slice(0, 3).forEach((cover, idx) => {
            console.log(`   ${idx + 1}. ${cover.title || 'Volume ' + cover.volume}`);
            console.log(`      URL: ${cover.url?.substring(0, 50)}...`);
          });
        }
        
        console.log('\n🎉 SUCCESS: Fandom enhancement works when used as additional source!');
        console.log('   URLs are properly preserved in search results!');
      } else if (asyncResult.status === 'error') {
        console.error('❌ Enhancement failed with error:', asyncResult.error);
      }
    } else {
      console.error('❌ Unexpected response structure:', JSON.stringify(enhanceData, null, 2));
    }
    
    // Step 3: Test that cached results also preserve URLs
    console.log('\n📡 Step 3: Testing if cached results preserve URLs (searching again)...');
    const searchResponse2 = await fetch(`${API_URL}/manga.search?batch=1&input=${encodeURIComponent(JSON.stringify({
      "0": { "json": { "source": "fandom", "keyword": "Fire Force" } }
    }))}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });
    
    const searchData2 = await searchResponse2.json();
    const results2 = searchData2[0]?.result?.data?.json || [];
    
    if (results2.length > 0) {
      const firstCachedResult = results2[0];
      console.log(`✅ Cached result: ${firstCachedResult.title}`);
      console.log(`   Has wikiUrl: ${!!firstCachedResult.wikiUrl}`);
      console.log(`   wikiUrl: ${firstCachedResult.wikiUrl}`);
      console.log(`   Has url: ${!!firstCachedResult.url}`);
      console.log(`   url: ${firstCachedResult.url}`);
      
      if (firstCachedResult.wikiUrl || firstCachedResult.url) {
        console.log('\n🎉 SUCCESS: Cached results also preserve URLs!');
      } else {
        console.error('❌ Cached results lost URLs');
      }
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
testFandomAsAdditionalSource();