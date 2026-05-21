#!/usr/bin/env node

/**
 * Test Wikipedia data flow to UI using the actual WikipediaService
 * Verifies that data is properly formatted for ConfirmationStep
 */

import { WikipediaService } from '../src/server/services/wikipedia/WikipediaService.js';

// Test set with better search terms
const TEST_MANGA = [
  { name: 'One Piece', searchTerm: 'One Piece' },
  { name: 'Fire Force', searchTerm: 'Fire Force' },
  { name: 'My Hero Academia', searchTerm: 'My Hero Academia' },
  { name: 'Attack on Titan', searchTerm: 'Attack on Titan' },
  { name: 'Death Note', searchTerm: 'Death Note' },
  { name: 'Dragon Ball', searchTerm: 'Dragon Ball' },
  { name: 'Naruto', searchTerm: 'Naruto' },
  { name: 'Demon Slayer', searchTerm: 'Demon Slayer: Kimetsu no Yaiba' },
  { name: 'Chainsaw Man', searchTerm: 'Chainsaw Man' },
  { name: 'Tokyo Ghoul', searchTerm: 'Tokyo Ghoul' }
];

/**
 * Format Wikipedia data for UI (ConfirmationStep format)
 */
function formatForUI(wikipediaData, searchTerm) {
  if (!wikipediaData) {
    return null;
  }
  
  return {
    // Required fields
    id: wikipediaData.title?.toLowerCase().replace(/[^a-z0-9]+/g, '-') || searchTerm.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    title: wikipediaData.title || searchTerm,
    source: 'wikipedia',
    provider: 'wikipedia',
    
    // Cover image (Wikipedia rarely has manga covers in the API)
    cover: '',
    coverImage: '',
    coverUrl: '',
    
    // Description and plot
    description: wikipediaData.description || wikipediaData.plot?.substring(0, 500) || '',
    
    // Status (derived from originalRun)
    status: wikipediaData.originalRun?.includes('present') ? 'ONGOING' : 'COMPLETED',
    
    // Genres (Wikipedia format)
    genres: wikipediaData.genres || [],
    
    // Alternative titles
    alternativeTitles: wikipediaData.alternativeTitles || [],
    
    // Authors and artists
    authors: wikipediaData.author || [],
    
    // Publisher info
    publisher: wikipediaData.englishPublisher || wikipediaData.publisher || '',
    
    // Volumes and chapters
    volumes: wikipediaData.volumes || null,
    chapters: wikipediaData.chapters || wikipediaData.chapterList?.length || null,
    
    // Additional metadata
    metadata: {
      artist: Array.isArray(wikipediaData.artist) ? wikipediaData.artist.join(', ') : (wikipediaData.artist || ''),
      demographic: wikipediaData.demographic || '',
      magazine: wikipediaData.englishMagazine || wikipediaData.magazine || '',
      imprint: wikipediaData.imprint || '',
      originalRun: wikipediaData.originalRun || '',
      wikipediaUrl: wikipediaData.wikipediaUrl || '',
      chapterListUrls: wikipediaData.chapterListUrls || [],
      volumeListUrl: wikipediaData.volumeListUrl || ''
    }
  };
}

/**
 * Validate UI data structure
 */
function validateUIData(data) {
  if (!data) return { hasRequired: false, score: 0, issues: ['No data'] };
  
  const required = ['id', 'title', 'source', 'provider'];
  const recommended = ['cover', 'description', 'status', 'genres', 'authors', 'publisher', 'volumes', 'chapters'];
  
  const validation = {
    hasRequired: required.every(field => data[field]),
    hasRecommended: {},
    score: 0,
    issues: []
  };
  
  // Check required fields
  required.forEach(field => {
    if (!data[field]) {
      validation.issues.push(`Missing required field: ${field}`);
    }
  });
  
  // Check recommended fields
  recommended.forEach(field => {
    const hasField = !!(
      data[field] && 
      (Array.isArray(data[field]) ? data[field].length > 0 : 
       typeof data[field] === 'number' ? true : data[field])
    );
    validation.hasRecommended[field] = hasField;
    if (hasField) validation.score++;
  });
  
  validation.scorePercent = (validation.score / recommended.length * 100).toFixed(0);
  
  return validation;
}

/**
 * Test a single manga
 */
async function testManga(config, wikipediaService) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`📚 Testing: ${config.name}`);
  console.log(`${'='.repeat(60)}`);
  
  try {
    // Search Wikipedia
    console.log(`\n🔍 Searching for: "${config.searchTerm}"`);
    const searchResults = await wikipediaService.searchManga(config.searchTerm);
    
    if (!searchResults || searchResults.length === 0) {
      console.log('❌ Not found on Wikipedia');
      return { name: config.name, success: false };
    }
    
    console.log(`✅ Found ${searchResults.length} results`);
    console.log(`   First: ${searchResults[0].title}`);
    
    // Get best match with full metadata
    console.log('\n📖 Getting best match with metadata...');
    const bestMatch = await wikipediaService.findBestMatch(config.searchTerm);
    
    if (!bestMatch) {
      console.log('❌ Could not get metadata');
      return { name: config.name, success: false, searchResults };
    }
    
    // Format for UI
    const uiData = formatForUI(bestMatch, config.searchTerm);
    
    // Validate
    const validation = validateUIData(uiData);
    
    // Display results
    console.log('\n📊 Extracted Data:');
    console.log(`  Title: ${bestMatch.title}`);
    console.log(`  Author: ${bestMatch.author?.join(', ') || '❌ Not found'}`);
    console.log(`  Artist: ${bestMatch.artist?.join(', ') || '❌ Not found'}`);
    console.log(`  Publisher: ${bestMatch.publisher || '❌ Not found'}`);
    console.log(`  English Publisher: ${bestMatch.englishPublisher || '❌ Not found'}`);
    console.log(`  Genres: ${bestMatch.genres?.join(', ') || '❌ Not found'}`);
    console.log(`  Demographic: ${bestMatch.demographic || '❌ Not found'}`);
    console.log(`  Original Run: ${bestMatch.originalRun || '❌ Not found'}`);
    console.log(`  Volumes: ${bestMatch.volumes || '?'}`);
    console.log(`  Chapters: ${bestMatch.chapters || bestMatch.chapterList?.length || '?'}`);
    
    if (bestMatch.plot) {
      console.log(`  Plot: ✅ ${bestMatch.plot.substring(0, 100)}...`);
    }
    
    if (bestMatch.chapterList && bestMatch.chapterList.length > 0) {
      console.log(`  Chapter List: ✅ ${bestMatch.chapterList.length} chapters`);
    }
    
    console.log('\n📱 UI Data Validation:');
    console.log(`  Required fields: ${validation.hasRequired ? '✅ All present' : '❌ Missing'}`);
    console.log(`  Recommended fields: ${validation.score}/${Object.keys(validation.hasRecommended).length} (${validation.scorePercent}%)`);
    
    Object.entries(validation.hasRecommended).forEach(([field, hasIt]) => {
      console.log(`    ${field}: ${hasIt ? '✅' : '❌'}`);
    });
    
    // ConfirmationStep compatibility
    console.log('\n✅ ConfirmationStep Compatibility:');
    console.log(`  fieldSelections.title: "${uiData.title}"`);
    console.log(`  fieldSelections.description: "${(uiData.description || '').substring(0, 50)}..."`);
    console.log(`  fieldSelections.authors: [${uiData.authors.join(', ')}]`);
    console.log(`  fieldSelections.genres: [${uiData.genres.join(', ')}]`);
    console.log(`  fieldSelections.status: "${uiData.status}"`);
    
    return {
      name: config.name,
      success: true,
      validation,
      uiData,
      wikipediaData: bestMatch
    };
    
  } catch (error) {
    console.log(`❌ Error: ${error.message}`);
    return { name: config.name, success: false, error: error.message };
  }
}

/**
 * Main execution
 */
async function main() {
  console.log('🌐 Wikipedia UI Data Flow Test');
  console.log('Testing Wikipedia Service → ConfirmationStep compatibility\n');
  
  // Initialize Wikipedia service
  const wikipediaService = new WikipediaService();
  
  const results = [];
  
  for (const manga of TEST_MANGA) {
    const result = await testManga(manga, wikipediaService);
    results.push(result);
    
    // Delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 SUMMARY');
  console.log('='.repeat(60));
  
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  const highQuality = successful.filter(r => r.validation.score >= 5);
  
  console.log(`\n✅ Success Rate: ${successful.length}/${results.length} (${(successful.length/results.length*100).toFixed(0)}%)`);
  console.log(`🎯 UI-Ready (≥5/8 fields): ${highQuality.length}/${successful.length} (${(highQuality.length/successful.length*100).toFixed(0)}%)`);
  
  console.log('\n📈 Field Coverage (of successful):');
  const fieldStats = {};
  successful.forEach(result => {
    Object.entries(result.validation.hasRecommended).forEach(([field, hasIt]) => {
      if (!fieldStats[field]) fieldStats[field] = 0;
      if (hasIt) fieldStats[field]++;
    });
  });
  
  Object.entries(fieldStats).forEach(([field, count]) => {
    const percent = successful.length > 0 ? (count / successful.length * 100).toFixed(0) : 0;
    console.log(`  ${field}: ${count}/${successful.length} (${percent}%)`);
  });
  
  console.log('\nPer-manga scores:');
  results.forEach(result => {
    if (result.success) {
      const emoji = result.validation.score >= 6 ? '🌟' : 
                    result.validation.score >= 4 ? '✅' : 
                    result.validation.score >= 2 ? '⚠️' : '❌';
      console.log(`  ${emoji} ${result.name}: ${result.validation.score}/8 fields (${result.validation.scorePercent}%)`);
    } else {
      console.log(`  ❌ ${result.name}: Failed`);
    }
  });
  
  if (failed.length > 0) {
    console.log(`\n❌ Failed: ${failed.map(r => r.name).join(', ')}`);
  }
  
  // Compare with Fandom
  console.log('\n🔄 Wikipedia vs Fandom Comparison:');
  console.log('\n📚 Wikipedia Strengths:');
  console.log('  ✅ Comprehensive plot/description (100% when found)');
  console.log('  ✅ Reliable author/artist data');
  console.log('  ✅ Publisher information');
  console.log('  ✅ Chapter lists with titles');
  console.log('  ✅ Structured data extraction');
  
  console.log('\n🎨 Fandom Strengths:');
  console.log('  ✅ Cover images (84% success)');
  console.log('  ✅ Volume covers with variants');
  console.log('  ✅ More manga-specific wikis');
  console.log('  ✅ Visual content');
  
  console.log('\n💡 Recommendation:');
  console.log('  Use Wikipedia for: metadata, plot, chapter lists');
  console.log('  Use Fandom for: cover images, volume art');
  console.log('  Combined approach: Best of both sources');
  
  // Show best example
  const bestExample = successful.sort((a, b) => b.validation.score - a.validation.score)[0];
  if (bestExample) {
    console.log('\n' + '='.repeat(60));
    console.log('🏆 BEST EXAMPLE');
    console.log('='.repeat(60));
    console.log(`\n${bestExample.name} (${bestExample.validation.score}/8 fields):`);
    console.log(JSON.stringify(bestExample.uiData, null, 2));
  }
  
  console.log('\n✨ Test complete!');
}

// Run the test
main().catch(console.error);