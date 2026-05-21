#!/usr/bin/env node

/**
 * Test script to verify ComicVine enhancement works as additional source
 */

import fetch from 'node-fetch';

const API_URL = 'http://localhost:3000/api/trpc';

async function testComicVineEnhancement() {
  console.log('🧪 Testing ComicVine Enhancement as Additional Source...\n');
  
  try {
    // Step 1: Search for manga in ComicVine
    console.log('📡 Step 1: Searching ComicVine for "Fire Force"...');
    const searchResponse = await fetch(`${API_URL}/manga.search?batch=1&input=${encodeURIComponent(JSON.stringify({
      "0": { "json": { "source": "comicvine", "keyword": "Fire Force" } }
    }))}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });
    
    const searchData = await searchResponse.json();
    const results = searchData[0]?.result?.data?.json || [];
    
    if (results.length === 0) {
      console.error('❌ No ComicVine results found');
      return;
    }
    
    const firstResult = results[0];
    console.log(`✅ Found: ${firstResult.title}`);
    console.log(`   ID: ${firstResult.id}`);
    console.log(`   Has issues: ${!!firstResult.issues}`);
    console.log(`   Issues count: ${firstResult.issues?.length || 0}`);
    console.log(`   Has characters: ${!!firstResult.characters}`);
    console.log(`   Characters count: ${firstResult.characters?.length || 0}`);
    
    // Step 2: Test fetching volume details directly
    const volumeId = firstResult.id || firstResult.sourceId;
    if (!volumeId) {
      console.error('❌ No volume ID found');
      return;
    }
    
    console.log('\n📡 Step 2: Fetching ComicVine volume details...');
    const volumeResponse = await fetch(`${API_URL}/metadata.fetchComicvineVolumeDetails`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        json: {
          id: String(volumeId),
          type: 'volume'
        }
      })
    });
    
    const volumeData = await volumeResponse.json();
    
    console.log('🔍 Volume response structure:', {
      hasResult: !!volumeData.result,
      hasData: !!volumeData.result?.data,
      hasJson: !!volumeData.result?.data?.json,
      resultKeys: volumeData.result ? Object.keys(volumeData.result) : [],
      dataKeys: volumeData.result?.data ? Object.keys(volumeData.result.data) : []
    });
    
    if (volumeData.result?.data?.json) {
      const volume = volumeData.result.data.json;
      console.log('\n✅ Volume details received:');
      console.log(`   Title: ${volume.name || volume.title}`);
      console.log(`   Issues count: ${volume.issues?.length || volume.count_of_issues || 0}`);
      console.log(`   Publisher: ${volume.publisher?.name || 'N/A'}`);
      console.log(`   Start year: ${volume.start_year || 'N/A'}`);
      console.log(`   Has characters: ${!!volume.characters || !!volume.character_credits}`);
      console.log(`   Has creators: ${!!volume.creators || !!volume.person_credits}`);
      
      if (volume.issues && volume.issues.length > 0) {
        console.log('\n📚 Sample issues:');
        volume.issues.slice(0, 3).forEach((issue, idx) => {
          console.log(`   ${idx + 1}. Issue #${issue.issue_number || issue.issueNumber}: ${issue.name || ''}`);
          console.log(`      Has cover: ${!!issue.image || !!issue.cover}`);
        });
      }
      
      console.log('\n🎉 ComicVine enhancement provides detailed metadata!');
    } else {
      console.error('❌ Unexpected volume response structure:', JSON.stringify(volumeData, null, 2));
    }
    
    // Step 3: Test fetching issues separately
    console.log('\n📡 Step 3: Testing separate issues fetch...');
    const issuesResponse = await fetch(`${API_URL}/metadata.fetchComicVineIssues`, {
      method: 'POST', 
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        json: {
          volumeId: String(volumeId)
        }
      })
    });
    
    const issuesData = await issuesResponse.json();
    
    if (issuesData.result?.data?.json?.issues) {
      const issues = issuesData.result.data.json.issues;
      console.log(`✅ Fetched ${issues.length} issues separately`);
      
      // Check if issues have covers
      const issuesWithCovers = issues.filter(i => i.image || i.cover || i.coverImage);
      console.log(`   Issues with covers: ${issuesWithCovers.length}/${issues.length}`);
      
      if (issuesWithCovers.length > 0) {
        console.log('\n🎉 SUCCESS: ComicVine provides issue covers and detailed metadata!');
      }
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
testComicVineEnhancement();