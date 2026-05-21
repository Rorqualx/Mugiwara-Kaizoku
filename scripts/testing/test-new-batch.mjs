#!/usr/bin/env node

/**
 * Test new batch of manga for Fandom extraction
 * Includes different genres and wiki structures
 */

import axios from 'axios';
import * as cheerio from 'cheerio';

// New batch with varied manga types
const NEW_BATCH = [
  // Popular Ongoing
  { name: 'Spy x Family', wiki: 'spy-x-family', path: 'Spy_×_Family' },
  { name: 'One Punch Man', wiki: 'onepunchman', path: 'One-Punch_Man_(manga)' },
  { name: 'Mob Psycho 100', wiki: 'mob-psycho-100', path: 'Mob_Psycho_100_(manga)' },
  
  // Classic Series
  { name: 'Dragon Ball', wiki: 'dragonball', path: 'Dragon_Ball_(manga)' },
  { name: 'Fullmetal Alchemist', wiki: 'fma', path: 'Fullmetal_Alchemist_(manga)' },
  { name: 'Soul Eater', wiki: 'souleater', path: 'Soul_Eater_(manga)' },
  
  // Romance/Slice of Life
  { name: 'Kaguya-sama', wiki: 'kaguyasama-wa-kokurasetai', path: 'Kaguya-sama:_Love_is_War_(manga)' },
  { name: 'Horimiya', wiki: 'horimiya', path: 'Horimiya_(manga)' },
  { name: 'Komi Can\'t Communicate', wiki: 'komisan-wa-komyushou-desu', path: 'Komi_Can%27t_Communicate_(manga)' },
  
  // Horror/Psychological
  { name: 'Junji Ito Collection', wiki: 'junji-ito', path: 'Junji_Ito_Collection' },
  { name: 'Promised Neverland', wiki: 'yakusokunoneverland', path: 'The_Promised_Neverland_(Manga)' },
  { name: 'Another', wiki: 'another', path: 'Another_(manga)' },
  
  // Sports
  { name: 'Haikyuu', wiki: 'haikyuu', path: 'Haikyū!!_(manga)' },
  { name: 'Blue Lock', wiki: 'bluelock', path: 'Blue_Lock_(manga)' },
  { name: 'Kuroko no Basket', wiki: 'kurokonobasuke', path: 'Kuroko_no_Basuke_(manga)' },
  
  // Isekai
  { name: 'That Time I Got Reincarnated', wiki: 'tensura', path: 'That_Time_I_Got_Reincarnated_as_a_Slime_(manga)' },
  { name: 'Overlord', wiki: 'overlordmaruyama', path: 'Overlord_(manga)' },
  { name: 'Re:Zero', wiki: 'rezero', path: 'Re:Zero_Light_Novel' }
];

/**
 * Try multiple URL patterns for each wiki
 */
async function tryWikiUrls(config) {
  const urlPatterns = [
    `https://${config.wiki}.fandom.com/wiki/${config.path}`,
    `https://${config.wiki}.fandom.com/wiki/${config.name.replace(/[:\s]+/g, '_')}`,
    `https://${config.wiki}.fandom.com/wiki/${config.name.replace(/[:\s]+/g, '_')}_(manga)`,
    `https://${config.wiki}.fandom.com/wiki/${config.name.replace(/[:\s]+/g, '_')}_(Manga)`,
    `https://${config.wiki.replace(/-/g, '')}.fandom.com/wiki/${config.path}`,
  ];
  
  for (const url of urlPatterns) {
    try {
      const response = await axios.get(url, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        timeout: 3000,
        maxRedirects: 5
      });
      
      if (response.status === 200) {
        return { success: true, url, data: response.data };
      }
    } catch (error) {
      // Continue to next URL
    }
  }
  
  return { success: false };
}

/**
 * Enhanced URL cleaning
 */
function cleanImageUrl(url) {
  if (!url || url === 'none' || url.includes('data:image')) return '';
  
  let cleanUrl = url;
  cleanUrl = cleanUrl.replace(/\/revision\/[^\/]*/, '');
  cleanUrl = cleanUrl.replace(/\/scale-to-width-down\/\d+/, '');
  cleanUrl = cleanUrl.replace(/\/scale-to-width\/\d+/, '');
  cleanUrl = cleanUrl.replace(/\/smart\/width\/\d+\/height\/\d+/, '');
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
 * Get image URL with multiple checks
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
 * Extract main cover with comprehensive checks
 */
function extractMainCover($, wikiName) {
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
    '.pi-media-collection img:first',
    '.mw-parser-output .infobox img:first',
    'aside img:first'
  ];
  
  for (const selector of selectors) {
    const img = $(selector).first();
    if (img.length) {
      const url = getImageUrl($, img[0]);
      if (url) return url;
    }
  }
  
  // Check for wiki-specific patterns
  const wikiSpecific = [
    `img[alt*="${wikiName}"]`,
    `img[data-image-name*="${wikiName}"]`,
    `img[alt*="Cover"]`,
    `img[alt*="Volume"]`,
    `img[alt*="Manga"]`
  ];
  
  for (const selector of wikiSpecific) {
    const imgs = $(selector);
    for (let i = 0; i < imgs.length && i < 5; i++) {
      const url = getImageUrl($, imgs[i]);
      if (url && !url.includes('icon') && !url.includes('button') && !url.includes('Button')) {
        return url;
      }
    }
  }
  
  // Check linked images
  const linkedImages = $('a.image img, a[class*="image"] img');
  for (let i = 0; i < linkedImages.length && i < 15; i++) {
    const $img = $(linkedImages[i]);
    const dataImageName = $img.attr('data-image-name') || '';
    const alt = $img.attr('alt') || '';
    
    if (!dataImageName.includes('Button') && 
        !dataImageName.includes('Icon') &&
        !alt.includes('Button') &&
        !alt.includes('Icon')) {
      const url = getImageUrl($, linkedImages[i]);
      if (url) return url;
    }
  }
  
  return '';
}

/**
 * Extract comprehensive metadata
 */
function extractMetadata($, mangaName) {
  const metadata = {};
  
  // Comprehensive field mapping
  const fieldMap = {
    'written by': 'author',
    'author': 'author',
    'author(s)': 'author',
    'writer': 'author',
    'created by': 'author',
    'mangaka': 'author',
    'story by': 'author',
    'illustrated by': 'artist',
    'artist': 'artist',
    'artist(s)': 'artist',
    'art by': 'artist',
    'published by': 'publisher',
    'publisher': 'publisher',
    'publisher(s)': 'publisher',
    'english publisher': 'publisher_english',
    'magazine': 'magazine',
    'serialized in': 'magazine',
    'demographic': 'demographic',
    'original run': 'original_run',
    'published': 'original_run',
    'run': 'original_run',
    'status': 'status',
    'volumes': 'volumes',
    'no. of volumes': 'volumes',
    'volume count': 'volumes',
    'chapters': 'chapters',
    'no. of chapters': 'chapters',
    'chapter count': 'chapters',
    'genre': 'genres',
    'genre(s)': 'genres',
    'genres': 'genres'
  };
  
  // Extract from portable infobox
  $('.portable-infobox .pi-data, aside.portable-infobox .pi-data').each((_, element) => {
    const $element = $(element);
    const label = $element.find('.pi-data-label').text().trim();
    const value = $element.find('.pi-data-value').text().trim();
    
    if (label && value) {
      const normalizedLabel = label.toLowerCase().replace(/:/g, '');
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
      const normalizedLabel = label.toLowerCase().replace(/:/g, '');
      const key = fieldMap[normalizedLabel] || normalizedLabel.replace(/[^\w]/g, '_');
      if (!metadata[key]) {
        metadata[key] = value;
      }
    }
  });
  
  // Try content extraction if no infobox data
  if (Object.keys(metadata).length < 3) {
    const content = $('.mw-parser-output').text();
    
    const patterns = [
      { pattern: /(?:Author|Written by|Created by)[:\s]+([^\n]+)/i, field: 'author' },
      { pattern: /(?:Artist|Illustrated by|Art by)[:\s]+([^\n]+)/i, field: 'artist' },
      { pattern: /(?:Publisher|Published by)[:\s]+([^\n]+)/i, field: 'publisher' },
      { pattern: /(?:Magazine|Serialized in)[:\s]+([^\n]+)/i, field: 'magazine' },
      { pattern: /Genre[s]?[:\s]+([^\n]+)/i, field: 'genres' },
      { pattern: /Status[:\s]+([^\n]+)/i, field: 'status' },
      { pattern: /Demographic[:\s]+([^\n]+)/i, field: 'demographic' },
      { pattern: /Volumes?[:\s]+(\d+)/i, field: 'volumes' },
      { pattern: /Chapters?[:\s]+(\d+)/i, field: 'chapters' }
    ];
    
    patterns.forEach(({ pattern, field }) => {
      const match = content.match(pattern);
      if (match && !metadata[field]) {
        metadata[field] = match[1].trim();
      }
    });
  }
  
  // Get cover image
  const cover = extractMainCover($, mangaName);
  if (cover) {
    metadata.cover_image = cover;
  }
  
  // Get description
  const firstPara = $('.mw-parser-output > p').first().text().trim();
  if (firstPara && firstPara.length > 50 && 
      !firstPara.includes('may refer to') && 
      !firstPara.includes('disambiguation')) {
    metadata.description = firstPara.substring(0, 500);
  }
  
  // Get page title as fallback
  const pageTitle = $('h1.page-header__title, h1#firstHeading').first().text().trim();
  if (pageTitle) {
    metadata.page_title = pageTitle;
  }
  
  return metadata;
}

/**
 * Test a single manga
 */
async function testManga(config) {
  const result = {
    name: config.name,
    success: false,
    url: '',
    cover: false,
    author: false,
    artist: false,
    publisher: false,
    genres: false,
    description: false,
    status: false,
    volumes: false,
    chapters: false,
    metadata: {}
  };
  
  // Try to fetch the wiki page
  const wikiResult = await tryWikiUrls(config);
  
  if (!wikiResult.success) {
    result.error = 'Wiki not found';
    return result;
  }
  
  result.url = wikiResult.url;
  result.success = true;
  
  // Parse and extract metadata
  const $ = cheerio.load(wikiResult.data);
  const metadata = extractMetadata($, config.name);
  result.metadata = metadata;
  
  // Check extracted fields
  result.cover = !!metadata.cover_image;
  result.author = !!metadata.author;
  result.artist = !!metadata.artist;
  result.publisher = !!(metadata.publisher || metadata.publisher_english || metadata.magazine);
  result.genres = !!metadata.genres;
  result.description = !!metadata.description;
  result.status = !!metadata.status;
  result.volumes = !!metadata.volumes;
  result.chapters = !!metadata.chapters;
  
  return result;
}

/**
 * Main execution
 */
async function main() {
  console.log('🚀 New Batch Fandom Extraction Test');
  console.log(`Testing ${NEW_BATCH.length} manga across different genres\n`);
  
  const results = [];
  let processed = 0;
  
  for (const manga of NEW_BATCH) {
    process.stdout.write(`\rProcessing: ${++processed}/${NEW_BATCH.length} - ${manga.name}...`);
    
    const result = await testManga(manga);
    results.push(result);
    
    await new Promise(resolve => setTimeout(resolve, 300));
  }
  
  console.log('\n\n' + '='.repeat(60));
  console.log('📊 DETAILED RESULTS');
  console.log('='.repeat(60));
  
  // Group by success
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  
  // Display successful extractions
  if (successful.length > 0) {
    console.log('\n✅ SUCCESSFUL EXTRACTIONS:\n');
    successful.forEach(result => {
      const score = [
        result.cover,
        result.author || result.artist,
        result.publisher,
        result.genres,
        result.description,
        result.status
      ].filter(Boolean).length;
      
      const emoji = score >= 5 ? '🌟' : score >= 3 ? '✅' : score >= 2 ? '⚠️' : '❌';
      
      console.log(`${emoji} ${result.name} (${score}/6):`);
      console.log(`   URL: ${result.url}`);
      console.log(`   Cover: ${result.cover ? '✅' : '❌'} | Author: ${result.author ? '✅' : '❌'} | Artist: ${result.artist ? '✅' : '❌'}`);
      console.log(`   Publisher: ${result.publisher ? '✅' : '❌'} | Genres: ${result.genres ? '✅' : '❌'} | Status: ${result.status ? '✅' : '❌'}`);
      console.log(`   Description: ${result.description ? '✅' : '❌'} | Volumes: ${result.volumes ? '✅' : '❌'} | Chapters: ${result.chapters ? '✅' : '❌'}`);
      
      // Show sample metadata
      if (result.metadata.author) console.log(`   → Author: ${result.metadata.author}`);
      if (result.metadata.genres) console.log(`   → Genres: ${result.metadata.genres}`);
      console.log('');
    });
  }
  
  // Display failed extractions
  if (failed.length > 0) {
    console.log('\n❌ FAILED EXTRACTIONS:\n');
    failed.forEach(result => {
      console.log(`❌ ${result.name}: ${result.error}`);
    });
  }
  
  // Statistics
  console.log('\n' + '='.repeat(60));
  console.log('📈 STATISTICS');
  console.log('='.repeat(60));
  
  const withCovers = successful.filter(r => r.cover);
  const withAuthors = successful.filter(r => r.author);
  const withPublishers = successful.filter(r => r.publisher);
  const withGenres = successful.filter(r => r.genres);
  const withDescriptions = successful.filter(r => r.description);
  const highQuality = successful.filter(r => {
    const score = [r.cover, r.author || r.artist, r.publisher, r.genres, r.description].filter(Boolean).length;
    return score >= 4;
  });
  
  console.log(`\n📊 Overall Results:`);
  console.log(`   Success Rate: ${successful.length}/${results.length} (${(successful.length/results.length*100).toFixed(0)}%)`);
  console.log(`   High Quality (≥4/6): ${highQuality.length}/${successful.length} (${(highQuality.length/successful.length*100).toFixed(0)}%)`);
  
  console.log(`\n📈 Field Extraction (of successful):`);
  console.log(`   Cover Images: ${withCovers.length}/${successful.length} (${(withCovers.length/successful.length*100).toFixed(0)}%)`);
  console.log(`   Authors: ${withAuthors.length}/${successful.length} (${(withAuthors.length/successful.length*100).toFixed(0)}%)`);
  console.log(`   Publishers: ${withPublishers.length}/${successful.length} (${(withPublishers.length/successful.length*100).toFixed(0)}%)`);
  console.log(`   Genres: ${withGenres.length}/${successful.length} (${(withGenres.length/successful.length*100).toFixed(0)}%)`);
  console.log(`   Descriptions: ${withDescriptions.length}/${successful.length} (${(withDescriptions.length/successful.length*100).toFixed(0)}%)`);
  
  // Show best examples
  const bestExamples = successful
    .map(r => ({
      ...r,
      score: [r.cover, r.author || r.artist, r.publisher, r.genres, r.description, r.status].filter(Boolean).length
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
  
  if (bestExamples.length > 0) {
    console.log('\n🏆 TOP EXTRACTIONS:');
    bestExamples.forEach(example => {
      console.log(`\n${example.name} (${example.score}/6):`);
      if (example.metadata.cover_image) {
        console.log(`  Cover: ${example.metadata.cover_image.substring(0, 80)}...`);
      }
      if (example.metadata.author) console.log(`  Author: ${example.metadata.author}`);
      if (example.metadata.genres) console.log(`  Genres: ${example.metadata.genres}`);
      if (example.metadata.description) {
        console.log(`  Description: ${example.metadata.description.substring(0, 100)}...`);
      }
    });
  }
  
  console.log('\n✨ Test Complete!');
}

// Run the test
main().catch(console.error);