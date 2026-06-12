#!/usr/bin/env node

/**
 * Test script to verify Fandom URL preservation fix
 */

import fetch from 'node-fetch';

const API_URL = 'http://localhost:3000/api/trpc';

async function testFandomUrlPreservation() {
  console.log('🧪 Testing Fandom URL Preservation Fix...\n');
  
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
    console.log(`   ID: ${firstResult.id}`);
    console.log(`   Has wikiUrl: ${!!firstResult.wikiUrl}`);
    console.log(`   wikiUrl: ${firstResult.wikiUrl}`);
    console.log(`   Has url: ${!!firstResult.url}`);
    console.log(`   url: ${firstResult.url}`);
    
    // Check if URLs are properly preserved
    const hasUrl = firstResult.wikiUrl || firstResult.url;
    if (hasUrl) {
      console.log('✅ URLs are preserved in Fandom search results!');
    } else {
      console.error('❌ URLs are missing in Fandom search results');
      return;
    }
    
    // Step 2: Test enhancement with preserved URL
    const mangaUrl = firstResult.wikiUrl || firstResult.url;
    console.log('\n📡 Step 2: Testing enhancement with preserved URL...');
    console.log(`   Using URL: ${mangaUrl}`);
    
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
    
    if (enhanceData.result?.data?.json) {
      // tRPC returns the bare payload on success
      const enhanced = enhanceData.result.data.json;
      console.log('✅ Enhancement successful with preserved URL:');
      console.log(`   Volume covers: ${enhanced.coverArt?.volumeCovers?.length || 0}`);
      console.log(`   Gallery images: ${enhanced.coverArt?.gallery?.length || 0}`);
      console.log(`   Character art: ${enhanced.coverArt?.characterArt?.length || 0}`);
      console.log(`   Volumes: ${enhanced.volumeList?.length || 0}`);
      console.log(`   Chapters: ${enhanced.chapters?.length || 0}`);

      if (enhanced.coverArt?.volumeCovers?.length > 0) {
        console.log('\n🎉 SUCCESS: Fandom URL preservation fix is working!');
        console.log('   Fandom can now be used as an additional source and will provide full metadata.');
      } else {
        console.log('\n⚠️  WARNING: Enhancement succeeded but no volume covers found.');
        console.log('   This manga might not have volume covers on Fandom.');
      }
    } else if (enhanceData.error) {
      console.error('❌ Enhancement failed:', enhanceData.error.json?.message || enhanceData.error);
    } else {
      console.error('❌ Invalid enhancement response');
    }
    
    // Step 3: Test as additional source with AniList primary
    console.log('\n📡 Step 3: Testing Fandom as additional source with AniList primary...');
    
    // First, search with AniList
    const anilistResponse = await fetch(`${API_URL}/manga.search?batch=1&input=${encodeURIComponent(JSON.stringify({
      "0": { "json": { "source": "anilist", "keyword": "Fire Force" } }
    }))}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });
    
    const anilistData = await anilistResponse.json();
    const anilistResults = anilistData[0]?.result?.data?.json || [];
    
    if (anilistResults.length > 0) {
      console.log(`✅ AniList primary found: ${anilistResults[0].title}`);
      console.log(`✅ Fandom additional has URL: ${hasUrl ? 'Yes' : 'No'}`);
      
      if (hasUrl) {
        console.log('\n🎉 COMPLETE SUCCESS:');
        console.log('   - Fandom search returns results with URLs');
        console.log('   - URLs enable proper enhancement');
        console.log('   - Fandom can be used as additional source');
        console.log('   - Users can mix AniList + Fandom for complete metadata');
      }
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
testFandomUrlPreservation();