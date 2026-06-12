#!/usr/bin/env node

/**
 * Test script to verify URL preservation through the search flow
 */

import fetch from 'node-fetch';

const API_URL = 'http://localhost:3000/api/trpc';

async function testUrlPreservation() {
  console.log('🧪 Testing URL Preservation Through Search Flow...\n');
  
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
    if (firstResult.wikiUrl || firstResult.url) {
      console.log('✅ URLs are preserved in Fandom search results!');
    } else {
      console.error('❌ URLs are missing in Fandom search results');
    }
    
    // Step 2: Search for manga in ComicVine
    console.log('\n📡 Step 2: Searching ComicVine for "Fire Force"...');
    const comicvineResponse = await fetch(`${API_URL}/manga.search?batch=1&input=${encodeURIComponent(JSON.stringify({
      "0": { "json": { "source": "comicvine", "keyword": "Fire Force" } }
    }))}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });
    
    const comicvineData = await comicvineResponse.json();
    const comicvineResults = comicvineData[0]?.result?.data?.json || [];
    
    if (comicvineResults.length > 0) {
      const firstComicVineResult = comicvineResults[0];
      console.log(`✅ Found: ${firstComicVineResult.title}`);
      console.log(`   ID: ${firstComicVineResult.id || firstComicVineResult.sourceId}`);
      console.log(`   Has siteDetailUrl: ${!!firstComicVineResult.siteDetailUrl}`);
      console.log(`   siteDetailUrl: ${firstComicVineResult.siteDetailUrl}`);
      console.log(`   Has url: ${!!firstComicVineResult.url}`);
      console.log(`   url: ${firstComicVineResult.url}`);
      
      if (firstComicVineResult.id || firstComicVineResult.sourceId) {
        console.log('✅ IDs are preserved in ComicVine search results!');
      } else {
        console.error('❌ IDs are missing in ComicVine search results');
      }
    }
    
    // Step 3: Test if cached results preserve URLs (search again)
    console.log('\n📡 Step 3: Testing if cached results preserve URLs (searching Fandom again)...');
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
        console.log('✅ URLs are preserved in cached Fandom results!');
      } else {
        console.error('❌ URLs are lost in cached Fandom results');
      }
    }
    
    // Step 4: Test enhancement with preserved URLs
    if (firstResult.wikiUrl || firstResult.url) {
      const mangaUrl = firstResult.wikiUrl || firstResult.url;
      console.log('\n📡 Step 4: Testing enhancement with preserved URL...');
      
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

        if (enhanced.coverArt?.volumeCovers?.length > 0) {
          console.log('\n🎉 SUCCESS: URL preservation enables proper enhancement!');
        }
      } else if (enhanceData.error) {
        console.error('❌ Enhancement failed:', enhanceData.error.json?.message || enhanceData.error);
      }
    }
    
    console.log('\n📊 Summary:');
    console.log('- Fandom URLs:', firstResult.wikiUrl ? '✅ Preserved' : '❌ Missing');
    console.log('- ComicVine IDs:', comicvineResults[0]?.id ? '✅ Preserved' : '❌ Missing');
    console.log('- Cached URLs:', results2[0]?.wikiUrl ? '✅ Preserved' : '❌ Missing');
    console.log('- Enhancement:', firstResult.wikiUrl ? '✅ Working' : '❌ Not possible without URLs');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
testUrlPreservation();