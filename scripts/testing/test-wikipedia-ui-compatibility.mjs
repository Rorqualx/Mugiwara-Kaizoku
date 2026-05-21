#!/usr/bin/env node

/**
 * Test Wikipedia extraction for UI compatibility
 * Verifies that Wikipedia data is properly formatted for ConfirmationStep
 */

import axios from 'axios';
import * as cheerio from 'cheerio';

// Test set of popular manga with Wikipedia pages
const TEST_MANGA = [
  { name: 'One Piece', searchTerm: 'One Piece manga' },
  { name: 'Naruto', searchTerm: 'Naruto manga' },
  { name: 'Attack on Titan', searchTerm: 'Attack on Titan manga' },
  { name: 'My Hero Academia', searchTerm: 'My Hero Academia manga' },
  { name: 'Demon Slayer', searchTerm: 'Demon Slayer Kimetsu no Yaiba manga' },
  { name: 'Death Note', searchTerm: 'Death Note manga' },
  { name: 'Dragon Ball', searchTerm: 'Dragon Ball manga' },
  { name: 'Chainsaw Man', searchTerm: 'Chainsaw Man manga' },
  { name: 'Jujutsu Kaisen', searchTerm: 'Jujutsu Kaisen manga' },
  { name: 'Tokyo Ghoul', searchTerm: 'Tokyo Ghoul manga' }
];

/**
 * Search Wikipedia using OpenSearch API
 */
async function searchWikipedia(query) {
  const apiBase = 'https://en.wikipedia.org/w/api.php';
  const searchUrl = `${apiBase}?action=opensearch&search=${encodeURIComponent(query)}&limit=5&format=json&origin=*`;
  
  try {
    const response = await axios.get(searchUrl);
    const [_, titles, descriptions, urls] = response.data;
    
    if (titles && titles.length > 0) {
      return {
        title: titles[0],
        description: descriptions[0],
        url: urls[0]
      };
    }
  } catch (error) {
    console.error(`Search error: ${error.message}`);
  }
  
  return null;
}

/**
 * Get detailed page data from Wikipedia
 */
async function getWikipediaPageData(title) {
  const apiBase = 'https://en.wikipedia.org/w/api.php';
  
  try {
    // Get page content and extract
    const queryUrl = `${apiBase}?action=query&titles=${encodeURIComponent(title)}&prop=extracts|pageimages|revisions&exintro=true&explaintext=true&piprop=original&rvprop=content&rvslots=main&format=json&origin=*`;
    
    const response = await axios.get(queryUrl);
    const pages = response.data.query?.pages;
    
    if (pages) {
      const pageId = Object.keys(pages)[0];
      const page = pages[pageId];
      
      if (page && pageId !== '-1') {
        return {
          pageId: parseInt(pageId),
          title: page.title,
          extract: page.extract,
          imageUrl: page.original?.source || '',
          content: page.revisions?.[0]?.slots?.main?.['*'] || ''
        };
      }
    }
  } catch (error) {
    console.error(`Page data error: ${error.message}`);
  }
  
  return null;
}

/**
 * Parse infobox from Wikipedia page content
 */
function parseInfobox(content) {
  const metadata = {};
  
  // Common infobox patterns
  const patterns = [
    { pattern: /\|\s*author\s*=\s*([^\n|]+)/i, field: 'author' },
    { pattern: /\|\s*writer\s*=\s*([^\n|]+)/i, field: 'author' },
    { pattern: /\|\s*illustrator\s*=\s*([^\n|]+)/i, field: 'artist' },
    { pattern: /\|\s*artist\s*=\s*([^\n|]+)/i, field: 'artist' },
    { pattern: /\|\s*publisher\s*=\s*([^\n|]+)/i, field: 'publisher' },
    { pattern: /\|\s*publisher_en\s*=\s*([^\n|]+)/i, field: 'publisher_en' },
    { pattern: /\|\s*magazine\s*=\s*([^\n|]+)/i, field: 'magazine' },
    { pattern: /\|\s*magazine_en\s*=\s*([^\n|]+)/i, field: 'magazine_en' },
    { pattern: /\|\s*genre\s*=\s*([^\n|]+)/i, field: 'genre' },
    { pattern: /\|\s*demographic\s*=\s*([^\n|]+)/i, field: 'demographic' },
    { pattern: /\|\s*volumes\s*=\s*(\d+)/i, field: 'volumes' },
    { pattern: /\|\s*chapters\s*=\s*(\d+)/i, field: 'chapters' },
    { pattern: /\|\s*first\s*=\s*([^\n|]+)/i, field: 'first_published' },
    { pattern: /\|\s*last\s*=\s*([^\n|]+)/i, field: 'last_published' },
    { pattern: /\|\s*imprint\s*=\s*([^\n|]+)/i, field: 'imprint' }
  ];
  
  patterns.forEach(({ pattern, field }) => {
    const match = content.match(pattern);
    if (match) {
      // Clean wiki markup
      let value = match[1].trim();
      value = value.replace(/\[\[([^|\]]+)\|?[^\]]*\]\]/g, '$1'); // [[Link|Text]] -> Link
      value = value.replace(/'{2,}/g, ''); // Remove bold/italic markup
      value = value.replace(/<[^>]+>/g, ''); // Remove HTML tags
      value = value.replace(/&nbsp;/g, ' '); // Replace HTML spaces
      metadata[field] = value.trim();
    }
  });
  
  return metadata;
}

/**
 * Format Wikipedia data for UI (ConfirmationStep compatibility)
 */
function formatForUI(searchResult, pageData, metadata) {
  const uiData = {
    // Required fields
    id: pageData?.title?.toLowerCase().replace(/\s+/g, '-') || '',
    title: pageData?.title || searchResult?.title || '',
    source: 'wikipedia',
    provider: 'wikipedia',
    
    // Cover image (Wikipedia usually has a main image)
    cover: pageData?.imageUrl || '',
    coverImage: pageData?.imageUrl || '',
    coverUrl: pageData?.imageUrl || '',
    
    // Description from extract
    description: pageData?.extract?.substring(0, 500) || searchResult?.description || '',
    
    // Status (Wikipedia doesn't typically have this)
    status: metadata.last_published ? 'COMPLETED' : 'ONGOING',
    
    // Genres (parse from genre field)
    genres: metadata.genre ? 
      metadata.genre.split(/[,;]/).map(g => g.trim()).filter(Boolean) : [],
    
    // Alternative titles
    alternativeTitles: [],
    
    // Authors (clean and split)
    authors: metadata.author ? 
      [metadata.author.replace(/\[\[|\]\]/g, '')] : [],
    
    // Publisher
    publisher: metadata.publisher_en || metadata.publisher || '',
    
    // Volumes and chapters
    volumes: metadata.volumes ? parseInt(metadata.volumes, 10) : null,
    chapters: metadata.chapters ? parseInt(metadata.chapters, 10) : null,
    
    // Additional metadata
    metadata: {
      artist: metadata.artist || '',
      demographic: metadata.demographic || '',
      magazine: metadata.magazine_en || metadata.magazine || '',
      imprint: metadata.imprint || '',
      firstPublished: metadata.first_published || '',
      lastPublished: metadata.last_published || '',
      wikipediaUrl: searchResult?.url || `https://en.wikipedia.org/wiki/${encodeURIComponent(pageData?.title || '')}`
    }
  };
  
  return uiData;
}

/**
 * Validate UI data structure
 */
function validateUIData(data) {
  const required = ['id', 'title', 'source', 'provider'];
  const recommended = ['cover', 'coverImage', 'coverUrl', 'description', 'status', 'genres', 'authors'];
  
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
      (Array.isArray(data[field]) ? data[field].length > 0 : true)
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
async function testManga(config) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`📚 Testing: ${config.name}`);
  console.log(`${'='.repeat(60)}`);
  
  // Search Wikipedia
  console.log(`\n🔍 Searching Wikipedia for: "${config.searchTerm}"`);
  const searchResult = await searchWikipedia(config.searchTerm);
  
  if (!searchResult) {
    console.log('❌ Not found on Wikipedia');
    return { name: config.name, success: false };
  }
  
  console.log(`✅ Found: ${searchResult.title}`);
  console.log(`   URL: ${searchResult.url}`);
  
  // Get detailed page data
  console.log('\n📖 Fetching page data...');
  const pageData = await getWikipediaPageData(searchResult.title);
  
  if (!pageData) {
    console.log('❌ Could not fetch page data');
    return { name: config.name, success: false, searchResult };
  }
  
  // Parse infobox
  const metadata = parseInfobox(pageData.content);
  
  // Format for UI
  const uiData = formatForUI(searchResult, pageData, metadata);
  
  // Validate
  const validation = validateUIData(uiData);
  
  // Display results
  console.log('\n📊 Extracted UI Data:');
  console.log(`  ID: ${uiData.id}`);
  console.log(`  Title: ${uiData.title}`);
  console.log(`  Cover: ${uiData.cover ? '✅ ' + uiData.cover.substring(0, 60) + '...' : '❌ Not found'}`);
  console.log(`  Authors: ${uiData.authors.length > 0 ? '✅ ' + uiData.authors.join(', ') : '❌ Not found'}`);
  console.log(`  Publisher: ${uiData.publisher ? '✅ ' + uiData.publisher : '❌ Not found'}`);
  console.log(`  Genres: ${uiData.genres.length > 0 ? '✅ ' + uiData.genres.join(', ') : '❌ Not found'}`);
  console.log(`  Status: ${uiData.status}`);
  console.log(`  Description: ${uiData.description ? '✅ ' + uiData.description.substring(0, 80) + '...' : '❌ Not found'}`);
  
  if (uiData.volumes || uiData.chapters) {
    console.log(`  Volumes/Chapters: ${uiData.volumes || '?'}/${uiData.chapters || '?'}`);
  }
  
  console.log('\n✅ UI Data Validation:');
  console.log(`  Required fields: ${validation.hasRequired ? '✅ All present' : '❌ Missing'}`);
  console.log(`  Recommended fields: ${validation.score}/${Object.keys(validation.hasRecommended).length} (${validation.scorePercent}%)`);
  
  Object.entries(validation.hasRecommended).forEach(([field, hasIt]) => {
    console.log(`    ${field}: ${hasIt ? '✅' : '❌'}`);
  });
  
  if (validation.issues.length > 0) {
    console.log('\n⚠️ Issues:');
    validation.issues.forEach(issue => console.log(`  - ${issue}`));
  }
  
  // Show Wikipedia-specific metadata
  if (Object.keys(metadata).length > 0) {
    console.log('\n📚 Wikipedia Metadata:');
    Object.entries(metadata).forEach(([key, value]) => {
      if (value) console.log(`  ${key}: ${value}`);
    });
  }
  
  return {
    name: config.name,
    success: true,
    validation,
    uiData,
    metadata
  };
}

/**
 * Main execution
 */
async function main() {
  console.log('🌐 Wikipedia UI Compatibility Test');
  console.log('Verifying Wikipedia data format for ConfirmationStep\n');
  
  const results = [];
  
  for (const manga of TEST_MANGA) {
    const result = await testManga(manga);
    results.push(result);
    
    // Delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 SUMMARY');
  console.log('='.repeat(60));
  
  const successful = results.filter(r => r.success);
  const withHighScore = successful.filter(r => r.validation.score >= 5);
  
  console.log(`\n✅ Success rate: ${successful.length}/${results.length} (${(successful.length/results.length*100).toFixed(0)}%)`);
  console.log(`🎯 UI-ready (score ≥5): ${withHighScore.length}/${successful.length} (${(withHighScore.length/successful.length*100).toFixed(0)}%)`);
  
  console.log('\nPer-manga scores:');
  results.forEach(result => {
    if (result.success) {
      const emoji = result.validation.score >= 6 ? '🌟' : 
                    result.validation.score >= 4 ? '✅' : 
                    result.validation.score >= 2 ? '⚠️' : '❌';
      console.log(`  ${emoji} ${result.name}: ${result.validation.score}/7 fields (${result.validation.scorePercent}%)`);
    } else {
      console.log(`  ❌ ${result.name}: Not found`);
    }
  });
  
  // Field statistics
  console.log('\n📈 Field Extraction Statistics:');
  const fieldStats = {};
  successful.forEach(result => {
    Object.entries(result.validation.hasRecommended).forEach(([field, hasIt]) => {
      if (!fieldStats[field]) fieldStats[field] = 0;
      if (hasIt) fieldStats[field]++;
    });
  });
  
  Object.entries(fieldStats).forEach(([field, count]) => {
    const percent = (count / successful.length * 100).toFixed(0);
    console.log(`  ${field}: ${count}/${successful.length} (${percent}%)`);
  });
  
  // Compare with Fandom
  console.log('\n🔄 Wikipedia vs Fandom Comparison:');
  console.log('  Wikipedia Advantages:');
  console.log('    ✅ More reliable data structure');
  console.log('    ✅ Consistent infobox format');
  console.log('    ✅ Better descriptions/extracts');
  console.log('    ✅ Higher success rate for finding pages');
  console.log('  Wikipedia Limitations:');
  console.log('    ❌ Fewer cover images');
  console.log('    ❌ Less detailed volume/chapter data');
  console.log('    ❌ No tabbed content for variants');
  
  // Show best example
  const bestExample = successful.sort((a, b) => b.validation.score - a.validation.score)[0];
  if (bestExample) {
    console.log('\n' + '='.repeat(60));
    console.log('🏆 BEST EXAMPLE (for reference)');
    console.log('='.repeat(60));
    console.log(`\n${bestExample.name}:`);
    console.log(JSON.stringify(bestExample.uiData, null, 2));
  }
  
  console.log('\n✨ Test complete!');
}

// Run the test
main().catch(console.error);