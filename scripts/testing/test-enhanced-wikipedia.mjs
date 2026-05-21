#!/usr/bin/env node

/**
 * Test enhanced Wikipedia extraction
 * Verifies improved extraction rates and UI compatibility
 */

import { enhancedWikipediaExtractor } from '../src/server/services/wikipedia/enhancedWikipediaExtraction.js';

// Comprehensive test set
const TEST_MANGA = [
  'Fire Force',
  'One Piece', 
  'My Hero Academia',
  'Attack on Titan',
  'Death Note',
  'Dragon Ball',
  'Naruto',
  'Demon Slayer',
  'Chainsaw Man',
  'Tokyo Ghoul',
  'Jujutsu Kaisen',
  'Black Clover',
  'Dr. Stone',
  'Spy x Family',
  'One Punch Man'
];

/**
 * Validate UI data structure
 */
function validateUIData(data) {
  if (!data) return { score: 0, hasRequired: false };
  
  const required = ['id', 'title', 'source', 'provider'];
  const recommended = ['cover', 'description', 'status', 'genres', 'authors', 'publisher', 'volumes', 'chapters'];
  
  const validation = {
    hasRequired: required.every(field => data[field]),
    score: 0,
    fields: {}
  };
  
  recommended.forEach(field => {
    const hasField = !!(
      data[field] && 
      (Array.isArray(data[field]) ? data[field].length > 0 : 
       typeof data[field] === 'number' ? true : data[field])
    );
    validation.fields[field] = hasField;
    if (hasField) validation.score++;
  });
  
  validation.scorePercent = (validation.score / recommended.length * 100).toFixed(0);
  
  return validation;
}

/**
 * Test a single manga
 */
async function testManga(title) {
  console.log(`\n${'='.repeat(50)}`);
  console.log(`📚 ${title}`);
  console.log('='.repeat(50));
  
  try {
    // Search Wikipedia
    console.log('🔍 Searching Wikipedia...');
    const metadata = await enhancedWikipediaExtractor.searchWikipedia(title);
    
    if (!metadata) {
      console.log('❌ Not found on Wikipedia');
      return { title, success: false };
    }
    
    console.log(`✅ Found: ${metadata.title}`);
    console.log(`   URL: ${metadata.url}`);
    
    // Format for UI
    const uiData = enhancedWikipediaExtractor.formatForUI(metadata);
    const validation = validateUIData(uiData);
    
    // Display extracted data
    console.log('\n📊 Extracted Data:');
    console.log(`  Cover: ${metadata.coverImage ? '✅' : '❌'}`);
    console.log(`  Description: ${metadata.description ? '✅ ' + metadata.description.substring(0, 60) + '...' : '❌'}`)
    console.log(`  Author: ${metadata.author?.length > 0 ? '✅ ' + metadata.author.join(', ') : '❌'}`);
    console.log(`  Artist: ${metadata.artist?.length > 0 ? '✅ ' + metadata.artist.join(', ') : '❌'}`);
    console.log(`  Publisher: ${metadata.publisher || metadata.englishPublisher ? '✅ ' + (metadata.englishPublisher || metadata.publisher) : '❌'}`);
    console.log(`  Genres: ${metadata.genres?.length > 0 ? '✅ ' + metadata.genres.join(', ') : '❌'}`);
    console.log(`  Demographic: ${metadata.demographic ? '✅ ' + metadata.demographic : '❌'}`);
    console.log(`  Magazine: ${metadata.magazine || metadata.englishMagazine ? '✅ ' + (metadata.englishMagazine || metadata.magazine) : '❌'}`);
    console.log(`  Status: ${metadata.status || 'ONGOING'}`);
    console.log(`  Volumes/Chapters: ${metadata.volumes || '?'}/${metadata.chapters || '?'}`);
    
    if (metadata.chapterList && metadata.chapterList.length > 0) {
      console.log(`  Chapter List: ✅ ${metadata.chapterList.length} chapters`);
      // Show first 3 chapters
      metadata.chapterList.slice(0, 3).forEach(ch => {
        console.log(`    Ch ${ch.number}: ${ch.title || 'Untitled'}`);
      });
    }
    
    if (metadata.images && metadata.images.length > 0) {
      console.log(`  Additional Images: ✅ ${metadata.images.length} found`);
    }
    
    console.log(`\n✅ UI Compatibility: ${validation.score}/8 fields (${validation.scorePercent}%)`);
    
    return {
      title,
      success: true,
      validation,
      metadata,
      uiData
    };
    
  } catch (error) {
    console.log(`❌ Error: ${error.message}`);
    return { title, success: false, error: error.message };
  }
}

/**
 * Main execution
 */
async function main() {
  console.log('🌐 Enhanced Wikipedia Extraction Test');
  console.log('Testing improved extraction and UI compatibility\n');
  
  const results = [];
  
  for (const manga of TEST_MANGA) {
    const result = await testManga(manga);
    results.push(result);
    await new Promise(resolve => setTimeout(resolve, 300));
  }
  
  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 FINAL SUMMARY');
  console.log('='.repeat(60));
  
  const successful = results.filter(r => r.success);
  const highQuality = successful.filter(r => r.validation.score >= 5);
  const withCovers = successful.filter(r => r.metadata?.coverImage);
  const withChapters = successful.filter(r => r.metadata?.chapterList?.length > 0);
  
  console.log(`\n✅ Found on Wikipedia: ${successful.length}/${results.length} (${(successful.length/results.length*100).toFixed(0)}%)`);
  console.log(`🎯 UI-Ready (≥5/8): ${highQuality.length}/${successful.length} (${successful.length > 0 ? (highQuality.length/successful.length*100).toFixed(0) : 0}%)`);
  console.log(`🖼️ With Covers: ${withCovers.length}/${successful.length} (${successful.length > 0 ? (withCovers.length/successful.length*100).toFixed(0) : 0}%)`);
  console.log(`📖 With Chapter Lists: ${withChapters.length}/${successful.length} (${successful.length > 0 ? (withChapters.length/successful.length*100).toFixed(0) : 0}%)`);
  
  console.log('\n📈 Field Coverage:');
  const fieldStats = {};
  successful.forEach(result => {
    Object.entries(result.validation.fields).forEach(([field, hasIt]) => {
      if (!fieldStats[field]) fieldStats[field] = 0;
      if (hasIt) fieldStats[field]++;
    });
  });
  
  Object.entries(fieldStats).forEach(([field, count]) => {
    const percent = successful.length > 0 ? (count / successful.length * 100).toFixed(0) : 0;
    const emoji = percent >= 70 ? '✅' : percent >= 40 ? '⚠️' : '❌';
    console.log(`  ${emoji} ${field}: ${count}/${successful.length} (${percent}%)`);
  });
  
  console.log('\nPer-manga scores:');
  results.forEach(result => {
    if (result.success) {
      const emoji = result.validation.score >= 6 ? '🌟' : 
                    result.validation.score >= 4 ? '✅' : 
                    result.validation.score >= 2 ? '⚠️' : '❌';
      console.log(`  ${emoji} ${result.title}: ${result.validation.score}/8 (${result.validation.scorePercent}%)`);
    } else {
      console.log(`  ❌ ${result.title}: Not found`);
    }
  });
  
  // Compare with previous tests
  console.log('\n' + '='.repeat(60));
  console.log('📊 EXTRACTION COMPARISON');
  console.log('='.repeat(60));
  
  console.log('\n🎨 Fandom Results (Previous):');
  console.log('  • Discovery: 80%');
  console.log('  • Cover extraction: 84%');
  console.log('  • Overall quality: 67%');
  console.log('  • Strengths: Visual content, volume covers');
  
  console.log('\n📚 Wikipedia Results (Enhanced):');
  console.log(`  • Discovery: ${(successful.length/results.length*100).toFixed(0)}%`);
  console.log(`  • Cover extraction: ${successful.length > 0 ? (withCovers.length/successful.length*100).toFixed(0) : 0}%`);
  console.log(`  • Overall quality: ${successful.length > 0 ? (highQuality.length/successful.length*100).toFixed(0) : 0}%`);
  console.log('  • Strengths: Structured data, chapter lists, metadata');
  
  console.log('\n💡 COMBINED STRATEGY:');
  console.log('  1. Search both Wikipedia and Fandom in parallel');
  console.log('  2. Use Fandom for cover images and volume art');
  console.log('  3. Use Wikipedia for structured metadata');
  console.log('  4. Merge data with Fandom covers taking priority');
  console.log('  5. All data is UI-compatible');
  
  // Show best example
  const bestExample = successful.sort((a, b) => b.validation.score - a.validation.score)[0];
  if (bestExample) {
    console.log('\n' + '='.repeat(60));
    console.log('🏆 BEST EXAMPLE');
    console.log('='.repeat(60));
    console.log(`\n${bestExample.title} (${bestExample.validation.score}/8 fields):`);
    console.log('UI Data:');
    console.log(JSON.stringify(bestExample.uiData, null, 2));
  }
  
  console.log('\n✨ Test complete!');
}

// Run the test
main().catch(console.error);