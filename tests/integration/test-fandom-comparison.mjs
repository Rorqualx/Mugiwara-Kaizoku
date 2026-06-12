#!/usr/bin/env node

/**
 * Test to compare Fandom metadata when used as primary vs additional source
 */

import fetch from 'node-fetch';

const API_URL = 'http://localhost:3000/api/trpc';

async function compareFandomMetadata() {
  console.log('🔬 Comparing Fandom Metadata: Primary vs Additional Source\n');
  console.log('═'.repeat(60));
  
  try {
    // PART 1: Test Fandom as PRIMARY source
    console.log('\n📌 PART 1: Fandom as PRIMARY Source');
    console.log('─'.repeat(40));
    
    // Search with Fandom as primary
    const fandomPrimaryResponse = await fetch(`${API_URL}/manga.search?batch=1&input=${encodeURIComponent(JSON.stringify({
      "0": { "json": { "source": "fandom", "keyword": "Fire Force" } }
    }))}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });
    
    const fandomPrimaryData = await fandomPrimaryResponse.json();
    const fandomResults = fandomPrimaryData[0]?.result?.data?.json || [];
    
    if (fandomResults.length === 0) {
      console.error('❌ No Fandom results found');
      return;
    }
    
    const fandomPrimary = fandomResults[0];
    console.log(`✅ Found: ${fandomPrimary.title}`);
    console.log(`   URL: ${fandomPrimary.wikiUrl}`);
    
    // Enhance with Fandom as primary
    const primaryEnhanceResponse = await fetch(`${API_URL}/metadata.fetchEnhancedMangaMetadata`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        json: {
          mangaPageUrl: fandomPrimary.wikiUrl,
          includeGallery: true
        }
      })
    });
    
    const primaryEnhanceData = await primaryEnhanceResponse.json();
    let primaryMetadata = null;
    
    if (primaryEnhanceData.result?.data?.json) {
      primaryMetadata = primaryEnhanceData.result.data.json;
      console.log('\n📊 Fandom as PRIMARY - Metadata Available:');
      console.log(`   ✓ Volume covers: ${primaryMetadata.coverArt?.volumeCovers?.length || 0}`);
      console.log(`   ✓ Gallery images: ${primaryMetadata.coverArt?.gallery?.length || 0}`);
      console.log(`   ✓ Character art: ${primaryMetadata.coverArt?.characterArt?.length || 0}`);
      console.log(`   ✓ Volumes: ${primaryMetadata.volumeList?.length || 0}`);
      console.log(`   ✓ Chapters: ${primaryMetadata.chapters?.length || 0}`);
      
      // Show sample volume covers
      if (primaryMetadata.coverArt?.volumeCovers?.length > 0) {
        console.log('\n   Sample Volume Covers (first 3):');
        primaryMetadata.coverArt.volumeCovers.slice(0, 3).forEach((cover, i) => {
          console.log(`     ${i + 1}. ${cover.title || 'Volume ' + (i + 1)}`);
        });
      }
    }
    
    // PART 2: Test Fandom as ADDITIONAL source (with AniList primary)
    console.log('\n\n📌 PART 2: Fandom as ADDITIONAL Source (AniList Primary)');
    console.log('─'.repeat(40));
    
    // First search with AniList as primary
    const anilistResponse = await fetch(`${API_URL}/manga.search?batch=1&input=${encodeURIComponent(JSON.stringify({
      "0": { "json": { "source": "anilist", "keyword": "Fire Force" } }
    }))}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });
    
    const anilistData = await anilistResponse.json();
    const anilistResults = anilistData[0]?.result?.data?.json || [];
    
    console.log(`✅ AniList primary: ${anilistResults[0]?.title}`);
    
    // Then search Fandom as additional
    const fandomAdditionalResponse = await fetch(`${API_URL}/manga.search?batch=1&input=${encodeURIComponent(JSON.stringify({
      "0": { "json": { "source": "fandom", "keyword": "Fire Force" } }
    }))}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });
    
    const fandomAdditionalData = await fandomAdditionalResponse.json();
    const fandomAdditionalResults = fandomAdditionalData[0]?.result?.data?.json || [];
    
    const fandomAdditional = fandomAdditionalResults[0];
    console.log(`✅ Fandom additional: ${fandomAdditional?.title}`);
    console.log(`   URL preserved: ${!!fandomAdditional?.wikiUrl}`);
    
    // Enhance Fandom as additional source
    if (fandomAdditional?.wikiUrl) {
      const additionalEnhanceResponse = await fetch(`${API_URL}/metadata.fetchEnhancedMangaMetadata`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          json: {
            mangaPageUrl: fandomAdditional.wikiUrl,
            includeGallery: true
          }
        })
      });
      
      const additionalEnhanceData = await additionalEnhanceResponse.json();
      let additionalMetadata = null;
      
      if (additionalEnhanceData.result?.data?.json) {
        additionalMetadata = additionalEnhanceData.result.data.json;
        console.log('\n📊 Fandom as ADDITIONAL - Metadata Available:');
        console.log(`   ✓ Volume covers: ${additionalMetadata.coverArt?.volumeCovers?.length || 0}`);
        console.log(`   ✓ Gallery images: ${additionalMetadata.coverArt?.gallery?.length || 0}`);
        console.log(`   ✓ Character art: ${additionalMetadata.coverArt?.characterArt?.length || 0}`);
        console.log(`   ✓ Volumes: ${additionalMetadata.volumeList?.length || 0}`);
        console.log(`   ✓ Chapters: ${additionalMetadata.chapters?.length || 0}`);
        
        // Show sample volume covers
        if (additionalMetadata.coverArt?.volumeCovers?.length > 0) {
          console.log('\n   Sample Volume Covers (first 3):');
          additionalMetadata.coverArt.volumeCovers.slice(0, 3).forEach((cover, i) => {
            console.log(`     ${i + 1}. ${cover.title || 'Volume ' + (i + 1)}`);
          });
        }
      }
      
      // PART 3: COMPARISON
      console.log('\n\n📌 PART 3: COMPARISON');
      console.log('═'.repeat(60));
      
      if (primaryMetadata && additionalMetadata) {
        const comparison = {
          volumeCovers: {
            primary: primaryMetadata.coverArt?.volumeCovers?.length || 0,
            additional: additionalMetadata.coverArt?.volumeCovers?.length || 0,
            match: (primaryMetadata.coverArt?.volumeCovers?.length || 0) === (additionalMetadata.coverArt?.volumeCovers?.length || 0)
          },
          gallery: {
            primary: primaryMetadata.coverArt?.gallery?.length || 0,
            additional: additionalMetadata.coverArt?.gallery?.length || 0,
            match: (primaryMetadata.coverArt?.gallery?.length || 0) === (additionalMetadata.coverArt?.gallery?.length || 0)
          },
          volumes: {
            primary: primaryMetadata.volumeList?.length || 0,
            additional: additionalMetadata.volumeList?.length || 0,
            match: (primaryMetadata.volumeList?.length || 0) === (additionalMetadata.volumeList?.length || 0)
          },
          chapters: {
            primary: primaryMetadata.chapters?.length || 0,
            additional: additionalMetadata.chapters?.length || 0,
            match: (primaryMetadata.chapters?.length || 0) === (additionalMetadata.chapters?.length || 0)
          }
        };
        
        console.log('\n📊 Metadata Comparison:');
        console.log('┌─────────────────┬──────────┬────────────┬─────────┐');
        console.log('│ Field           │ Primary  │ Additional │ Match?  │');
        console.log('├─────────────────┼──────────┼────────────┼─────────┤');
        
        Object.entries(comparison).forEach(([field, data]) => {
          const fieldName = field.padEnd(15);
          const primary = String(data.primary).padEnd(8);
          const additional = String(data.additional).padEnd(10);
          const match = data.match ? '✅ Yes' : '❌ No';
          console.log(`│ ${fieldName} │ ${primary} │ ${additional} │ ${match}  │`);
        });
        
        console.log('└─────────────────┴──────────┴────────────┴─────────┘');
        
        // Overall assessment
        const allMatch = Object.values(comparison).every(c => c.match);
        console.log('\n🎯 Overall Result:');
        if (allMatch) {
          console.log('   ✅ SUCCESS: Fandom provides IDENTICAL metadata whether used as primary or additional source!');
        } else {
          console.log('   ⚠️  WARNING: Some differences detected between primary and additional source usage.');
          console.log('   Differences in:', Object.entries(comparison).filter(([_, c]) => !c.match).map(([field]) => field).join(', '));
        }
      }
    } else {
      console.error('❌ Cannot enhance Fandom as additional - URL not preserved');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the comparison
compareFandomMetadata();