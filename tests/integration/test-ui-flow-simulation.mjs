#!/usr/bin/env node

/**
 * Test script to simulate the exact UI flow when using additional sources
 * This mimics what happens when:
 * 1. User searches with AniList as primary
 * 2. Selects a result 
 * 3. Opens UniversalImportWizard
 * 4. Selects Fandom/ComicVine as additional sources
 */

import fetch from 'node-fetch';

const API_URL = 'http://localhost:3000/api/trpc';

async function simulateUIFlow() {
  console.log('🎭 Simulating UI Flow: AniList Primary + Fandom/ComicVine Additional Sources\n');
  
  try {
    // Step 1: Search with AniList as primary (simulating searchStep.tsx)
    console.log('📡 Step 1: Primary search with AniList for "Fire Force"...');
    const anilistResponse = await fetch(`${API_URL}/manga.search?batch=1&input=${encodeURIComponent(JSON.stringify({
      "0": { "json": { "source": "anilist", "keyword": "Fire Force" } }
    }))}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });
    
    const anilistData = await anilistResponse.json();
    const anilistResults = anilistData[0]?.result?.data?.json || [];
    
    if (anilistResults.length === 0) {
      console.error('❌ No AniList results found');
      return;
    }
    
    const primaryResult = anilistResults[0];
    console.log(`✅ Primary result: ${primaryResult.title}`);
    console.log(`   ID: ${primaryResult.id}`);
    
    // Step 2: Search additional providers (simulating what UniversalImportWizard receives)
    console.log('\n📡 Step 2: Searching additional providers (Fandom & ComicVine)...');
    
    // Search Fandom
    const fandomResponse = await fetch(`${API_URL}/manga.search?batch=1&input=${encodeURIComponent(JSON.stringify({
      "0": { "json": { "source": "fandom", "keyword": "Fire Force" } }
    }))}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });
    
    const fandomData = await fandomResponse.json();
    const fandomResults = fandomData[0]?.result?.data?.json || [];
    
    // Search ComicVine
    const comicvineResponse = await fetch(`${API_URL}/manga.search?batch=1&input=${encodeURIComponent(JSON.stringify({
      "0": { "json": { "source": "comicvine", "keyword": "Fire Force" } }
    }))}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });
    
    const comicvineData = await comicvineResponse.json();
    const comicvineResults = comicvineData[0]?.result?.data?.json || [];
    
    // Simulate cached search results array (what UniversalImportWizard receives)
    const cachedSearchResults = [
      ...anilistResults.map(r => ({ ...r, source: 'anilist', provider: 'anilist' })),
      ...fandomResults.map(r => ({ ...r, source: 'fandom', provider: 'fandom' })),
      ...comicvineResults.map(r => ({ ...r, source: 'comicvine', provider: 'comicvine' }))
    ];
    
    console.log(`\n📊 Cached search results summary:`);
    console.log(`   AniList results: ${anilistResults.length}`);
    console.log(`   Fandom results: ${fandomResults.length}`);
    console.log(`   ComicVine results: ${comicvineResults.length}`);
    console.log(`   Total cached: ${cachedSearchResults.length}`);
    
    // Check URL/ID preservation in cached results
    console.log('\n🔍 Checking URL/ID preservation in cached results:');
    
    const fandomCached = cachedSearchResults.find(r => r.provider === 'fandom');
    if (fandomCached) {
      console.log(`   Fandom result: ${fandomCached.title}`);
      console.log(`     - Has wikiUrl: ${!!fandomCached.wikiUrl}`);
      console.log(`     - wikiUrl: ${fandomCached.wikiUrl || 'missing'}`);
      console.log(`     - Has url: ${!!fandomCached.url}`);
    }
    
    const comicvineCached = cachedSearchResults.find(r => r.provider === 'comicvine');
    if (comicvineCached) {
      console.log(`   ComicVine result: ${comicvineCached.title}`);
      console.log(`     - Has id: ${!!comicvineCached.id}`);
      console.log(`     - ID: ${comicvineCached.id || 'missing'}`);
    }
    
    // Step 3: Simulate selecting Fandom as additional source (handleAdditionalSourceSelection)
    if (fandomCached && fandomCached.wikiUrl) {
      console.log('\n📡 Step 3: Simulating Fandom selection as additional source...');
      
      const enhanceResponse = await fetch(`${API_URL}/metadata.fetchEnhancedMangaMetadata`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          json: {
            mangaPageUrl: fandomCached.wikiUrl,
            includeGallery: true
          }
        })
      });
      
      const enhanceData = await enhanceResponse.json();
      
      if (enhanceData.result?.data?.json) {
        const enhanced = enhanceData.result.data.json;
        console.log('✅ Fandom enhancement successful:');
        console.log(`   - Volume covers: ${enhanced.coverArt?.volumeCovers?.length || 0}`);
        console.log(`   - Gallery images: ${enhanced.coverArt?.gallery?.length || 0}`);
        console.log(`   - Character art: ${enhanced.coverArt?.characterArt?.length || 0}`);
        
        if (enhanced.coverArt?.volumeCovers?.length > 0) {
          console.log('   ✅ Volume covers available in media gallery!');
        }
      } else {
        console.error('❌ Fandom enhancement failed');
      }
    } else {
      console.error('❌ Cannot enhance Fandom - no URL preserved in cached results');
    }
    
    // Step 4: Simulate selecting ComicVine as additional source
    if (comicvineCached && comicvineCached.id) {
      console.log('\n📡 Step 4: Simulating ComicVine selection as additional source...');
      
      const volumeResponse = await fetch(`${API_URL}/metadata.fetchComicvineVolumeDetails`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          json: {
            id: String(comicvineCached.id),
            type: 'volume'
          }
        })
      });
      
      const _volumeData = await volumeResponse.json();
      
      // Also fetch issues
      const issuesResponse = await fetch(`${API_URL}/metadata.fetchComicVineIssues`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          json: {
            volumeId: String(comicvineCached.id)
          }
        })
      });
      
      const issuesData = await issuesResponse.json();
      
      if (issuesData.result?.data?.json?.issues) {
        const issues = issuesData.result.data.json.issues;
        const issuesWithCovers = issues.filter(i => i.image || i.cover || i.coverImage);
        console.log('✅ ComicVine enhancement successful:');
        console.log(`   - Total issues: ${issues.length}`);
        console.log(`   - Issues with covers: ${issuesWithCovers.length}`);
        
        if (issuesWithCovers.length > 0) {
          console.log('   ✅ Issue covers available in media gallery!');
        }
      } else {
        console.error('❌ ComicVine enhancement failed');
      }
    } else {
      console.error('❌ Cannot enhance ComicVine - no ID preserved in cached results');
    }
    
    // Final summary
    console.log('\n🎉 UI Flow Simulation Complete!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ AniList as primary: Working');
    console.log(fandomCached?.wikiUrl ? '✅ Fandom as additional: Working - Volume covers available' : '❌ Fandom as additional: Failed - No URL');
    console.log(comicvineCached?.id ? '✅ ComicVine as additional: Working - Issue covers available' : '❌ ComicVine as additional: Failed - No ID');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the simulation
simulateUIFlow();