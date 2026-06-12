#!/usr/bin/env node

/**
 * Test script to verify Fandom enhancement is working
 */

import fetch from 'node-fetch';

const API_URL = 'http://localhost:3000/api/trpc';

async function testFandomEnhancement() {
  console.log('🧪 Testing Fandom Enhancement...\n');
  
  try {
    // Step 1: Search for manga in Fandom
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
    console.log(`   URL: ${firstResult.wikiUrl || firstResult.url}`);
    console.log(`   Has volume covers: ${!!firstResult.volumeCovers}`);
    console.log(`   Volume covers count: ${firstResult.volumeCovers?.length || 0}`);
    
    // Step 2: Enhance the metadata
    const mangaUrl = firstResult.wikiUrl || firstResult.url;
    if (!mangaUrl) {
      console.error('❌ No URL found for enhancement');
      return;
    }
    
    console.log('\n📡 Step 2: Fetching enhanced metadata...');
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
    
    console.log('🔍 Response structure:', {
      hasResult: !!enhanceData.result,
      hasData: !!enhanceData.result?.data,
      hasJson: !!enhanceData.result?.data?.json,
      resultKeys: enhanceData.result ? Object.keys(enhanceData.result) : [],
      dataKeys: enhanceData.result?.data ? Object.keys(enhanceData.result.data) : []
    });
    
    // tRPC returns the bare payload on success; errors appear under enhanceData.error
    if (enhanceData.result?.data?.json) {
      const enhanced = enhanceData.result.data.json;
      console.log('\n📦 Payload structure:', {
        dataKeys: Object.keys(enhanced)
      });

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

      console.log('\n🎉 Fandom enhancement is working correctly!');
    } else if (enhanceData.error) {
      console.error('❌ Enhancement failed with error:', enhanceData.error.json?.message || enhanceData.error);
    } else {
      console.error('❌ Unexpected response structure:', JSON.stringify(enhanceData, null, 2));
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
testFandomEnhancement();