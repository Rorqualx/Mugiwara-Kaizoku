#!/usr/bin/env node

/**
 * Comprehensive test for Fandom extraction across multiple manga series
 * Tests extraction success rate and data flow to UI
 */

import axios from 'axios';
import * as cheerio from 'cheerio';

// Expanded test set with various popular manga
const MANGA_TEST_SET = [
  // Shonen Jump
  { name: 'One Piece', wiki: 'onepiece', path: 'One_Piece_(Manga)' },
  { name: 'Naruto', wiki: 'naruto', path: 'Naruto_(manga)' },
  { name: 'Bleach', wiki: 'bleach', path: 'Bleach_(manga)' },
  { name: 'My Hero Academia', wiki: 'myheroacademia', path: 'My_Hero_Academia_(Manga)' },
  { name: 'Demon Slayer', wiki: 'kimetsu-no-yaiba', path: 'Kimetsu_no_Yaiba_(manga)' },
  { name: 'Jujutsu Kaisen', wiki: 'jujutsu-kaisen', path: 'Jujutsu_Kaisen_(manga)' },
  
  // Seinen
  { name: 'Attack on Titan', wiki: 'attackontitan', path: 'Attack_on_Titan_(manga)' },
  { name: 'Tokyo Ghoul', wiki: 'tokyoghoul', path: 'Tokyo_Ghoul_(manga)' },
  { name: 'Chainsaw Man', wiki: 'chainsaw-man', path: 'Chainsaw_Man_(manga)' },
  { name: 'Fire Force', wiki: 'fire-force', path: 'Fire_Force_(manga)' },
  
  // Other Popular
  { name: 'Death Note', wiki: 'deathnote', path: 'Death_Note_(manga)' },
  { name: 'Hunter x Hunter', wiki: 'hunterxhunter', path: 'Hunter_×_Hunter_(manga)' },
  { name: 'Fairy Tail', wiki: 'fairytail', path: 'Fairy_Tail' },
  { name: 'Black Clover', wiki: 'blackclover', path: 'Black_Clover' },
  { name: 'Dr. Stone', wiki: 'dr-stone', path: 'Dr._Stone' }
];

/**
 * Enhanced URL cleaning
 */
function cleanImageUrl(url) {
  if (!url || url === 'none' || url.includes('data:image')) return '';
  
  let cleanUrl = url;
  
  // Remove revision parameters
  cleanUrl = cleanUrl.replace(/\/revision\/[^\/]*/, '');
  
  // Remove scaling
  cleanUrl = cleanUrl.replace(/\/scale-to-width-down\/\d+/, '');
  cleanUrl = cleanUrl.replace(/\/scale-to-width\/\d+/, '');
  cleanUrl = cleanUrl.replace(/\/smart\/width\/\d+\/height\/\d+/, '');
  
  // Remove thumbnail markers
  cleanUrl = cleanUrl.replace(/\/thumb\//, '/');
  cleanUrl = cleanUrl.replace(/\/\d+px-[^\/]+$/, '');
  
  // Remove query parameters
  if (cleanUrl.includes('?')) {
    cleanUrl = cleanUrl.split('?')[0];
  }
  
  // Clean file extension parameters
  cleanUrl = cleanUrl.replace(/(\.(png|jpg|jpeg|gif|webp))[^\/]*$/i, '$1');
  
  // Ensure HTTPS
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
    if (cleaned) {
      return cleaned;
    }
  }
  
  return '';
}

/**
 * Extract main cover image
 */
function extractMainCover($) {
  const selectors = [
    // Portable infobox
    '.portable-infobox .pi-image img',
    '.portable-infobox .pi-image-thumbnail img',
    'aside.portable-infobox .pi-image img',
    
    // Traditional infobox
    '.infobox .image img',
    '.infobox-image img',
    'table.infobox img:first',
    
    // Figure elements
    'figure.pi-item img',
    'figure.pi-image img',
    
    // Media collections
    '.pi-image-collection img:first',
    '.pi-media-collection img:first',
    
    // Generic
    '.mw-parser-output .infobox img:first',
    'aside img:first'
  ];
  
  for (const selector of selectors) {
    const img = $(selector).first();
    if (img.length) {
      const url = getImageUrl($, img[0]);
      if (url) {
        return url;
      }
    }
  }
  
  // Fallback: Look for images with relevant attributes
  const fallbackImgs = $('img[alt*="cover" i], img[alt*="volume" i], img[alt*="manga" i]');
  for (let i = 0; i < fallbackImgs.length && i < 5; i++) {
    const url = getImageUrl($, fallbackImgs[i]);
    if (url && !url.includes('icon') && !url.includes('button')) {
      return url;
    }
  }
  
  // Check linked images with data attributes
  const linkedImages = $('a.image img, a[class*="image"] img');
  for (let i = 0; i < linkedImages.length && i < 10; i++) {
    const $img = $(linkedImages[i]);
    const dataImageName = $img.attr('data-image-name') || '';
    
    if (dataImageName && (
      dataImageName.includes('Cover') || 
      dataImageName.includes('Volume') ||
      dataImageName.includes('Manga')
    )) {
      const url = getImageUrl($, linkedImages[i]);
      if (url) {
        return url;
      }
    }
  }
  
  return '';
}

/**
 * Extract metadata with field normalization
 */
function extractMetadata($) {
  const metadata = {};
  
  // Field mapping for normalization
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
    'demographic': 'demographic',
    'original run': 'original_run',
    'published': 'original_run',
    'status': 'status',
    'volumes': 'volumes',
    'no. of volumes': 'volumes',
    'chapters': 'chapters',
    'no. of chapters': 'chapters',
    'genre': 'genres',
    'genre(s)': 'genres'
  };
  
  // Extract from portable infobox
  $('.portable-infobox .pi-data, aside.portable-infobox .pi-data').each((_, element) => {
    const $element = $(element);
    const label = $element.find('.pi-data-label').text().trim();
    const value = $element.find('.pi-data-value').text().trim();
    
    if (label && value) {
      const normalizedLabel = label.toLowerCase();
      const key = fieldMap[normalizedLabel] || normalizedLabel.replace(/[^\w]/g, '_');
      metadata[key] = value;
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
      if (!metadata[key]) {
        metadata[key] = value;
      }
    }
  });
  
  // Look for metadata in content if no infobox
  if (Object.keys(metadata).length === 0) {
    const content = $('.mw-parser-output').text();
    
    // Try to extract from text patterns
    const patterns = [
      { pattern: /Author[:\s]+([^\n]+)/i, field: 'author' },
      { pattern: /Written by[:\s]+([^\n]+)/i, field: 'author' },
      { pattern: /Publisher[:\s]+([^\n]+)/i, field: 'publisher' },
      { pattern: /Genre[:\s]+([^\n]+)/i, field: 'genres' },
      { pattern: /Status[:\s]+([^\n]+)/i, field: 'status' },
      { pattern: /Demographic[:\s]+([^\n]+)/i, field: 'demographic' }
    ];
    
    patterns.forEach(({ pattern, field }) => {
      const match = content.match(pattern);
      if (match && !metadata[field]) {
        metadata[field] = match[1].trim();
      }
    });
  }
  
  // Get cover image
  const cover = extractMainCover($);
  if (cover) {
    metadata.cover_image = cover;
  }
  
  // Get description
  const firstPara = $('.mw-parser-output > p').first().text().trim();
  if (firstPara && firstPara.length > 50 && !firstPara.includes('may refer to')) {
    metadata.description = firstPara.substring(0, 300);
  }
  
  return metadata;
}

/**
 * Format metadata for UI display (matching ConfirmationStep expectations)
 */
function formatForUI(metadata, mangaName, wikiUrl) {
  return {
    id: mangaName.toLowerCase().replace(/\s+/g, '-'),
    title: mangaName,
    source: 'fandom',
    provider: 'fandom',
    
    // Main cover image - UI expects these fields
    cover: metadata.cover_image || '',
    coverImage: metadata.cover_image || '',
    coverUrl: metadata.cover_image || '',
    
    // Description
    description: metadata.description || '',
    
    // Status
    status: metadata.status || 'UNKNOWN',
    
    // Genres - ensure it's an array
    genres: metadata.genres ? 
      (typeof metadata.genres === 'string' ? 
        metadata.genres.split(',').map(g => g.trim()) : 
        metadata.genres) : [],
    
    // Alternative titles
    alternativeTitles: [],
    
    // Authors - ensure it's an array
    authors: metadata.author ? 
      [metadata.author] : [],
    
    // Publisher
    publisher: metadata.publisher || metadata.publisher_english || '',
    
    // Volumes and chapters
    volumes: metadata.volumes ? parseInt(metadata.volumes, 10) : null,
    chapters: metadata.chapters ? parseInt(metadata.chapters, 10) : null,
    
    // Additional metadata
    metadata: {
      demographic: metadata.demographic || '',
      artist: metadata.artist || '',
      original_run: metadata.original_run || '',
      wikiUrl: wikiUrl
    }
  };
}

/**
 * Test a single manga
 */
async function testManga(config) {
  const url = `https://${config.wiki}.fandom.com/wiki/${config.path}`;
  
  try {
    const response = await axios.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      timeout: 5000
    });
    
    const $ = cheerio.load(response.data);
    const metadata = extractMetadata($);
    const uiData = formatForUI(metadata, config.name, url);
    
    // Check success criteria
    const hasMainFields = !!(
      uiData.cover &&
      (uiData.authors.length > 0 || uiData.publisher) &&
      (uiData.genres.length > 0 || uiData.description)
    );
    
    return {
      name: config.name,
      success: true,
      hasMainFields,
      cover: !!uiData.cover,
      author: uiData.authors.length > 0,
      publisher: !!uiData.publisher,
      genres: uiData.genres.length > 0,
      description: !!uiData.description,
      status: uiData.status !== 'UNKNOWN',
      volumes: uiData.volumes !== null,
      chapters: uiData.chapters !== null,
      uiData
    };
    
  } catch (error) {
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
  console.log('🚀 Comprehensive Fandom Extraction Test');
  console.log(`Testing ${MANGA_TEST_SET.length} popular manga series\n`);
  
  const results = [];
  let processed = 0;
  
  // Test each manga
  for (const manga of MANGA_TEST_SET) {
    process.stdout.write(`\rProcessing: ${++processed}/${MANGA_TEST_SET.length} - ${manga.name}...`);
    
    const result = await testManga(manga);
    results.push(result);
    
    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  
  console.log('\n\n' + '='.repeat(60));
  console.log('📊 DETAILED RESULTS');
  console.log('='.repeat(60));
  
  // Display results
  results.forEach(result => {
    if (!result.success) {
      console.log(`\n❌ ${result.name}: Failed - ${result.error}`);
    } else {
      const fields = [
        result.cover ? '🖼️' : '❌',
        result.author ? '✍️' : '❌', 
        result.genres ? '🏷️' : '❌',
        result.description ? '📝' : '❌'
      ];
      
      const score = [
        result.cover,
        result.author || result.publisher,
        result.genres || result.description,
        result.status
      ].filter(Boolean).length;
      
      const emoji = score >= 3 ? '✅' : score >= 2 ? '⚠️' : '❌';
      
      console.log(`\n${emoji} ${result.name}: ${fields.join(' ')} (${score}/4)`);
      console.log(`   Cover: ${result.cover ? '✅' : '❌'}`);
      console.log(`   Author: ${result.author ? '✅' : '❌'}`);
      console.log(`   Publisher: ${result.publisher ? '✅' : '❌'}`);
      console.log(`   Genres: ${result.genres ? '✅' : '❌'}`);
      console.log(`   Description: ${result.description ? '✅' : '❌'}`);
      
      if (result.volumes || result.chapters) {
        console.log(`   Volumes/Chapters: ${result.volumes || '?'}/${result.chapters || '?'}`);
      }
    }
  });
  
  // Calculate statistics
  console.log('\n' + '='.repeat(60));
  console.log('📈 STATISTICS');
  console.log('='.repeat(60));
  
  const successful = results.filter(r => r.success);
  const withCovers = successful.filter(r => r.cover);
  const withAuthors = successful.filter(r => r.author);
  const withPublishers = successful.filter(r => r.publisher);
  const withGenres = successful.filter(r => r.genres);
  const withDescriptions = successful.filter(r => r.description);
  const withMainFields = successful.filter(r => r.hasMainFields);
  
  console.log(`\n✅ Success Rate: ${successful.length}/${results.length} (${(successful.length/results.length*100).toFixed(0)}%)`);
  console.log(`🖼️ Cover Images: ${withCovers.length}/${successful.length} (${(withCovers.length/successful.length*100).toFixed(0)}%)`);
  console.log(`✍️ Authors: ${withAuthors.length}/${successful.length} (${(withAuthors.length/successful.length*100).toFixed(0)}%)`);
  console.log(`📚 Publishers: ${withPublishers.length}/${successful.length} (${(withPublishers.length/successful.length*100).toFixed(0)}%)`);
  console.log(`🏷️ Genres: ${withGenres.length}/${successful.length} (${(withGenres.length/successful.length*100).toFixed(0)}%)`);
  console.log(`📝 Descriptions: ${withDescriptions.length}/${successful.length} (${(withDescriptions.length/successful.length*100).toFixed(0)}%)`);
  console.log(`\n🎯 UI-Ready (has main fields): ${withMainFields.length}/${successful.length} (${(withMainFields.length/successful.length*100).toFixed(0)}%)`);
  
  // Show sample UI data
  console.log('\n' + '='.repeat(60));
  console.log('📱 SAMPLE UI DATA (for ConfirmationStep)');
  console.log('='.repeat(60));
  
  const sampleManga = successful.find(r => r.hasMainFields);
  if (sampleManga) {
    console.log(`\n${sampleManga.name}:`);
    console.log(JSON.stringify(sampleManga.uiData, null, 2));
  }
  
  console.log('\n✨ Test Complete!');
}

// Run the test
main().catch(console.error);