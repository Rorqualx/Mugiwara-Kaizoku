#!/usr/bin/env node

/**
 * Test UI data flow for Fandom extraction
 * Verifies that extracted data matches what ConfirmationStep expects
 */

import axios from 'axios';
import * as cheerio from 'cheerio';

// Test with known working wikis
const TEST_WIKIS = [
  {
    name: 'Fire Force',
    url: 'https://fire-force.fandom.com/wiki/Fire_Force_(manga)',
    volumeUrl: 'https://fire-force.fandom.com/wiki/List_of_Volumes'
  },
  {
    name: 'My Hero Academia', 
    url: 'https://myheroacademia.fandom.com/wiki/My_Hero_Academia_(Manga)',
    volumeUrl: 'https://myheroacademia.fandom.com/wiki/Volumes_%26_Chapters'
  },
  {
    name: 'One Piece',
    url: 'https://onepiece.fandom.com/wiki/One_Piece_(Manga)',
    volumeUrl: 'https://onepiece.fandom.com/wiki/Chapters_and_Volumes'
  },
  {
    name: 'Death Note',
    url: 'https://deathnote.fandom.com/wiki/Death_Note_(manga)',
    volumeUrl: 'https://deathnote.fandom.com/wiki/Chapters'
  },
  {
    name: 'Tokyo Ghoul',
    url: 'https://tokyoghoul.fandom.com/wiki/Tokyo_Ghoul_(manga)',
    volumeUrl: 'https://tokyoghoul.fandom.com/wiki/Chapters'
  }
];

/**
 * Clean image URL
 */
function cleanImageUrl(url) {
  if (!url || url === 'none' || url.includes('data:image')) return '';
  
  let cleanUrl = url;
  cleanUrl = cleanUrl.replace(/\/revision\/[^\/]*/, '');
  cleanUrl = cleanUrl.replace(/\/scale-to-width-down\/\d+/, '');
  cleanUrl = cleanUrl.replace(/\/scale-to-width\/\d+/, '');
  cleanUrl = cleanUrl.replace(/\/thumb\//, '/');
  cleanUrl = cleanUrl.replace(/\/\d+px-[^\/]+$/, '');
  
  if (cleanUrl.includes('?')) {
    cleanUrl = cleanUrl.split('?')[0];
  }
  
  cleanUrl = cleanUrl.replace(/(\.(png|jpg|jpeg|gif|webp))[^\/]*$/i, '$1');
  
  if (cleanUrl.startsWith('//')) {
    cleanUrl = 'https:' + cleanUrl;
  } else if (!cleanUrl.startsWith('http')) {
    cleanUrl = 'https://' + cleanUrl;
  }
  
  return cleanUrl;
}

/**
 * Get image URL from element
 */
function getImageUrl($, element) {
  const $img = $(element);
  const urlSources = [
    $img.attr('src'),
    $img.attr('data-src'),
    $img.attr('data-image-url'),
    $img.attr('data-original'),
    $img.parent('a').attr('href'),
  ];
  
  for (const url of urlSources) {
    const cleaned = cleanImageUrl(url);
    if (cleaned) return cleaned;
  }
  
  return '';
}

/**
 * Extract main cover
 */
function extractMainCover($) {
  // Priority selectors
  const selectors = [
    '.portable-infobox .pi-image img',
    '.portable-infobox .pi-image-thumbnail img',
    'aside.portable-infobox .pi-image img',
    '.infobox .image img',
    '.infobox-image img',
    'table.infobox img:first',
    'figure.pi-item img',
    'figure.pi-image img',
    '.pi-image-collection img:first',
    '.pi-media-collection img:first'
  ];
  
  for (const selector of selectors) {
    const img = $(selector).first();
    if (img.length) {
      const url = getImageUrl($, img[0]);
      if (url) return url;
    }
  }
  
  // Check linked images with data-image-name
  const linkedImages = $('a.image img, a[class*="image"] img');
  for (let i = 0; i < linkedImages.length && i < 10; i++) {
    const $img = $(linkedImages[i]);
    const dataImageName = $img.attr('data-image-name') || '';
    
    if (dataImageName && !dataImageName.includes('Button') && !dataImageName.includes('Icon')) {
      const url = getImageUrl($, linkedImages[i]);
      if (url) return url;
    }
  }
  
  return '';
}

/**
 * Extract comprehensive metadata
 */
function extractMetadata($, url) {
  const metadata = {
    // Fields expected by ConfirmationStep
    id: '',
    title: '',
    source: 'fandom',
    provider: 'fandom',
    cover: '',
    coverImage: '',
    coverUrl: '',
    description: '',
    status: 'UNKNOWN',
    genres: [],
    alternativeTitles: [],
    authors: [],
    publisher: '',
    volumes: null,
    chapters: null,
    metadata: {}
  };
  
  // Get title
  const title = $('h1.page-header__title, h1#firstHeading').first().text().trim();
  metadata.title = title;
  metadata.id = title.toLowerCase().replace(/[^\w]+/g, '-');
  
  // Field mapping
  const fieldMap = {
    'written by': 'author',
    'author(s)': 'author',
    'writer': 'author',
    'created by': 'author',
    'mangaka': 'author',
    'illustrated by': 'artist',
    'artist(s)': 'artist',
    'published by': 'publisher',
    'publisher(s)': 'publisher',
    'english publisher': 'publisher_english',
    'magazine': 'magazine',
    'demographic': 'demographic',
    'original run': 'original_run',
    'status': 'status',
    'volumes': 'volumes',
    'no. of volumes': 'volumes',
    'chapters': 'chapters',
    'no. of chapters': 'chapters',
    'genre': 'genres',
    'genre(s)': 'genres'
  };
  
  const extractedData = {};
  
  // Extract from portable infobox
  $('.portable-infobox .pi-data, aside.portable-infobox .pi-data').each((_, element) => {
    const $element = $(element);
    const label = $element.find('.pi-data-label').text().trim();
    const value = $element.find('.pi-data-value').text().trim();
    
    if (label && value) {
      const normalizedLabel = label.toLowerCase();
      const key = fieldMap[normalizedLabel] || normalizedLabel.replace(/[^\w]/g, '_');
      extractedData[key] = value;
    }
  });
  
  // Extract from traditional infobox
  $('.infobox tr, table.infobox tr').each((_, row) => {
    const $row = $(row);
    const label = $row.find('th').text().trim();
    const value = $row.find('td').text().trim();
    
    if (label && value) {
      const normalizedLabel = label.toLowerCase();
      const key = fieldMap[normalizedLabel] || normalizedLabel.replace(/[^\w]/g, '_');
      if (!extractedData[key]) {
        extractedData[key] = value;
      }
    }
  });
  
  // If no infobox, try content extraction
  if (Object.keys(extractedData).length === 0) {
    const content = $('.mw-parser-output').text();
    
    const patterns = [
      { pattern: /Author[:\s]+([^\n]+)/i, field: 'author' },
      { pattern: /Written by[:\s]+([^\n]+)/i, field: 'author' },
      { pattern: /Publisher[:\s]+([^\n]+)/i, field: 'publisher' },
      { pattern: /Magazine[:\s]+([^\n]+)/i, field: 'magazine' },
      { pattern: /Genre[:\s]+([^\n]+)/i, field: 'genres' },
      { pattern: /Status[:\s]+([^\n]+)/i, field: 'status' },
      { pattern: /Demographic[:\s]+([^\n]+)/i, field: 'demographic' }
    ];
    
    patterns.forEach(({ pattern, field }) => {
      const match = content.match(pattern);
      if (match && !extractedData[field]) {
        extractedData[field] = match[1].trim();
      }
    });
  }
  
  // Map to UI fields
  if (extractedData.author) {
    metadata.authors = [extractedData.author];
  }
  
  if (extractedData.publisher || extractedData.publisher_english || extractedData.magazine) {
    metadata.publisher = extractedData.publisher || extractedData.publisher_english || extractedData.magazine;
  }
  
  if (extractedData.genres) {
    metadata.genres = typeof extractedData.genres === 'string' ?
      extractedData.genres.split(',').map(g => g.trim()) :
      [extractedData.genres];
  }
  
  if (extractedData.status) {
    metadata.status = extractedData.status.toUpperCase();
  }
  
  if (extractedData.volumes) {
    const volNum = parseInt(extractedData.volumes.match(/\d+/)?.[0] || '0', 10);
    if (volNum > 0) metadata.volumes = volNum;
  }
  
  if (extractedData.chapters) {
    const chapNum = parseInt(extractedData.chapters.match(/\d+/)?.[0] || '0', 10);
    if (chapNum > 0) metadata.chapters = chapNum;
  }
  
  // Get cover image
  const cover = extractMainCover($);
  if (cover) {
    metadata.cover = cover;
    metadata.coverImage = cover;
    metadata.coverUrl = cover;
  }
  
  // Get description
  const firstPara = $('.mw-parser-output > p').first().text().trim();
  if (firstPara && firstPara.length > 50 && !firstPara.includes('may refer to')) {
    metadata.description = firstPara.substring(0, 500);
  }
  
  // Store additional metadata
  metadata.metadata = {
    artist: extractedData.artist || '',
    demographic: extractedData.demographic || '',
    original_run: extractedData.original_run || '',
    wikiUrl: url,
    ...extractedData
  };
  
  return metadata;
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
 * Test a single wiki
 */
async function testWiki(config) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`📚 Testing: ${config.name}`);
  console.log(`${'='.repeat(60)}`);
  
  try {
    const response = await axios.get(config.url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      timeout: 5000
    });
    
    const $ = cheerio.load(response.data);
    const uiData = extractMetadata($, config.url);
    const validation = validateUIData(uiData);
    
    console.log('\n📊 Extracted UI Data:');
    console.log(`  ID: ${uiData.id}`);
    console.log(`  Title: ${uiData.title}`);
    console.log(`  Cover: ${uiData.cover ? '✅ ' + uiData.cover.substring(0, 60) + '...' : '❌ Not found'}`);
    console.log(`  Authors: ${uiData.authors.length > 0 ? '✅ ' + uiData.authors.join(', ') : '❌ Not found'}`);
    console.log(`  Publisher: ${uiData.publisher ? '✅ ' + uiData.publisher : '❌ Not found'}`);
    console.log(`  Genres: ${uiData.genres.length > 0 ? '✅ ' + uiData.genres.join(', ') : '❌ Not found'}`);
    console.log(`  Status: ${uiData.status !== 'UNKNOWN' ? '✅ ' + uiData.status : '❌ Unknown'}`);
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
    
    // Test what ConfirmationStep would receive
    console.log('\n📱 ConfirmationStep compatibility:');
    console.log(`  fieldSelections.title: "${uiData.title}"`);
    console.log(`  fieldSelections.cover: "${uiData.cover || ''}"`);
    console.log(`  fieldSelections.description: "${(uiData.description || '').substring(0, 50)}..."`);
    console.log(`  fieldSelections.genres: [${uiData.genres.join(', ')}]`);
    console.log(`  fieldSelections.authors: [${uiData.authors.join(', ')}]`);
    
    return {
      name: config.name,
      success: true,
      validation,
      uiData
    };
    
  } catch (error) {
    console.log(`\n❌ Error: ${error.message}`);
    return {
      name: config.name,
      success: false,
      error: error.message
    };
  }
}

/**
 * Main execution
 */
async function main() {
  console.log('🚀 UI Data Flow Test for Fandom Extraction');
  console.log('Verifying data format for ConfirmationStep component\n');
  
  const results = [];
  
  for (const wiki of TEST_WIKIS) {
    const result = await testWiki(wiki);
    results.push(result);
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
  
  console.log('\nPer-wiki scores:');
  results.forEach(result => {
    if (result.success) {
      const emoji = result.validation.score >= 6 ? '🌟' : 
                    result.validation.score >= 4 ? '✅' : 
                    result.validation.score >= 2 ? '⚠️' : '❌';
      console.log(`  ${emoji} ${result.name}: ${result.validation.score}/7 fields (${result.validation.scorePercent}%)`);
    } else {
      console.log(`  ❌ ${result.name}: Failed`);
    }
  });
  
  // Show best example for reference
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