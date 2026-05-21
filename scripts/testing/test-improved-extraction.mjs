#!/usr/bin/env node

/**
 * Improved extraction test with better pattern recognition
 * Addresses issues found in new batch testing
 */

import axios from 'axios';
import * as cheerio from 'cheerio';

// Test set including problematic wikis
const TEST_SET = [
  // Previously problematic
  { name: 'Spy x Family', wiki: 'spy-x-family', altWikis: ['spyfamily', 'spy-family'] },
  { name: 'Kaguya-sama', wiki: 'kaguyasama-wa-kokurasetai', altWikis: ['kaguya-sama', 'kaguyasama'] },
  { name: 'Haikyuu', wiki: 'haikyuu', altWikis: ['haikyu'] },
  { name: 'That Time I Got Reincarnated', wiki: 'tensura', altWikis: ['tensei-shitara-slime-datta-ken', 'that-time-i-got-reincarnated-as-a-slime'] },
  { name: 'Re:Zero', wiki: 'rezero', altWikis: ['re-zero'] },
  
  // Low metadata extraction
  { name: 'Soul Eater', wiki: 'souleater', altWikis: [] },
  { name: 'Another', wiki: 'another', altWikis: [] },
  { name: 'Blue Lock', wiki: 'bluelock', altWikis: ['blue-lock'] },
  { name: 'Overlord', wiki: 'overlordmaruyama', altWikis: ['overlord'] },
  { name: 'Komi Can\'t Communicate', wiki: 'komisan-wa-komyushou-desu', altWikis: ['komi-san-wa-komyushou-desu', 'komisan'] }
];

/**
 * Enhanced wiki search with multiple fallbacks
 */
async function findWiki(config) {
  // Build comprehensive URL list
  const urlPatterns = [];
  const wikis = [config.wiki, ...config.altWikis];
  
  wikis.forEach(wiki => {
    // Try different path patterns
    const paths = [
      config.name.replace(/[:\s']+/g, '_'),
      config.name.replace(/[:\s']+/g, '_') + '_(manga)',
      config.name.replace(/[:\s']+/g, '_') + '_(Manga)',
      config.name.replace(/[:\s']+/g, '-'),
      config.name.replace(/[:\s']+/g, ''),
      'Main_Page'  // Fallback to main page to find correct path
    ];
    
    paths.forEach(path => {
      urlPatterns.push(`https://${wiki}.fandom.com/wiki/${path}`);
    });
  });
  
  // Try each URL
  for (const url of urlPatterns) {
    try {
      const response = await axios.get(url, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        timeout: 3000,
        maxRedirects: 5
      });
      
      if (response.status === 200) {
        const $ = cheerio.load(response.data);
        const title = $('h1').first().text();
        
        // Check if we found the right page
        if (title && (
          title.toLowerCase().includes(config.name.toLowerCase()) ||
          title.toLowerCase().includes('manga') ||
          url.includes('Main_Page')
        )) {
          // If main page, try to find manga link
          if (url.includes('Main_Page')) {
            const mangaLink = await findMangaLink($, config.name);
            if (mangaLink) {
              const mangaUrl = new URL(mangaLink, url).toString();
              const mangaResponse = await axios.get(mangaUrl, {
                headers: { 'User-Agent': 'Mozilla/5.0' },
                timeout: 3000
              });
              return { success: true, url: mangaUrl, data: mangaResponse.data };
            }
          }
          
          return { success: true, url, data: response.data };
        }
      }
    } catch (error) {
      // Continue to next URL
    }
  }
  
  return { success: false };
}

/**
 * Find manga link from main page
 */
function findMangaLink($, mangaName) {
  const links = $('a[href*="manga"], a[href*="Manga"]');
  
  for (let i = 0; i < links.length; i++) {
    const $link = $(links[i]);
    const text = $link.text();
    const href = $link.attr('href');
    
    if (text && (
      text.toLowerCase().includes(mangaName.toLowerCase()) ||
      text.toLowerCase().includes('manga')
    )) {
      return href;
    }
  }
  
  return null;
}

/**
 * Improved image extraction
 */
function extractCoverImage($, mangaName) {
  // Comprehensive selector list
  const selectors = [
    // Portable infobox
    '.portable-infobox .pi-image img',
    '.portable-infobox .pi-image-thumbnail img',
    'aside.portable-infobox .pi-image img',
    
    // Traditional infobox
    '.infobox .image img',
    '.infobox-image img',
    'table.infobox img:first',
    '.infobox img[alt*="cover" i]',
    '.infobox img[alt*="volume" i]',
    
    // Figure elements
    'figure.pi-item img',
    'figure.pi-image img',
    'figure img[alt*="cover" i]',
    'figure img[alt*="volume" i]',
    
    // Media collections
    '.pi-image-collection img:first',
    '.pi-media-collection img:first',
    
    // Gallery
    '.gallery img[alt*="cover" i]:first',
    '.gallery img[alt*="volume" i]:first',
    
    // Generic but filtered
    '.mw-parser-output img[alt*="cover" i]:first',
    '.mw-parser-output img[alt*="volume" i]:first',
    'img.thumbimage[alt*="cover" i]:first',
    'img.thumbimage[alt*="volume" i]:first'
  ];
  
  // Helper to clean URL
  const cleanUrl = (url) => {
    if (!url || url.includes('data:image')) return '';
    let clean = url;
    clean = clean.replace(/\/revision\/[^\/]*/, '');
    clean = clean.replace(/\/scale-to-width-down\/\d+/, '');
    clean = clean.replace(/\/thumb\//, '/');
    clean = clean.replace(/\/\d+px-[^\/]+$/, '');
    if (clean.includes('?')) clean = clean.split('?')[0];
    if (clean.startsWith('//')) clean = 'https:' + clean;
    else if (!clean.startsWith('http')) clean = 'https://' + clean;
    return clean;
  };
  
  // Helper to get URL from element
  const getUrl = ($img) => {
    return cleanUrl(
      $img.attr('src') || 
      $img.attr('data-src') || 
      $img.attr('data-image-url') ||
      $img.parent('a').attr('href')
    );
  };
  
  // Try selectors
  for (const selector of selectors) {
    const img = $(selector).first();
    if (img.length) {
      const url = getUrl(img);
      if (url && !url.includes('Button') && !url.includes('Icon')) {
        return url;
      }
    }
  }
  
  // Fallback: Check all images with data-image-name
  const allImages = $('img[data-image-name]');
  for (let i = 0; i < allImages.length && i < 20; i++) {
    const $img = $(allImages[i]);
    const imageName = $img.attr('data-image-name') || '';
    
    if (imageName && (
      imageName.includes('Cover') ||
      imageName.includes('Volume') ||
      imageName.includes(mangaName.replace(/\s+/g, ''))
    ) && !imageName.includes('Button') && !imageName.includes('Icon')) {
      const url = getUrl($img);
      if (url) return url;
    }
  }
  
  return '';
}

/**
 * Enhanced metadata extraction
 */
function extractMetadata($, mangaName, url) {
  const metadata = {
    title: '',
    cover: '',
    author: '',
    artist: '',
    publisher: '',
    genres: '',
    status: '',
    demographic: '',
    volumes: '',
    chapters: '',
    description: '',
    original_run: ''
  };
  
  // Get title
  metadata.title = $('h1.page-header__title, h1#firstHeading').first().text().trim() || mangaName;
  
  // Enhanced field mapping
  const fieldMap = {
    // Author variations
    'written by': 'author',
    'author': 'author',
    'author(s)': 'author',
    'writer': 'author',
    'writer(s)': 'author',
    'created by': 'author',
    'creator': 'author',
    'mangaka': 'author',
    'story': 'author',
    'story by': 'author',
    
    // Artist variations
    'illustrated by': 'artist',
    'illustrator': 'artist',
    'artist': 'artist',
    'artist(s)': 'artist',
    'art': 'artist',
    'art by': 'artist',
    'artwork': 'artist',
    'artwork by': 'artist',
    
    // Publisher variations
    'publisher': 'publisher',
    'publisher(s)': 'publisher',
    'published by': 'publisher',
    'english publisher': 'publisher',
    'magazine': 'publisher',
    'serialized in': 'publisher',
    'serialization': 'publisher',
    'imprint': 'publisher',
    
    // Other fields
    'demographic': 'demographic',
    'genre': 'genres',
    'genre(s)': 'genres',
    'genres': 'genres',
    'status': 'status',
    'volumes': 'volumes',
    'no. of volumes': 'volumes',
    'volume count': 'volumes',
    'chapters': 'chapters',
    'no. of chapters': 'chapters',
    'chapter count': 'chapters',
    'original run': 'original_run',
    'published': 'original_run',
    'run': 'original_run'
  };
  
  // Extract from portable infobox
  const extractFromElement = ($element) => {
    const label = $element.find('.pi-data-label, th').first().text().trim();
    const value = $element.find('.pi-data-value, td').first().text().trim();
    
    if (label && value) {
      const normalizedLabel = label.toLowerCase().replace(/[:\s]+$/, '');
      const key = fieldMap[normalizedLabel];
      
      if (key && !metadata[key]) {
        metadata[key] = value;
      }
      
      // Also check for compound fields
      if (normalizedLabel.includes('author') || normalizedLabel.includes('writer')) {
        if (!metadata.author) metadata.author = value;
      }
      if (normalizedLabel.includes('artist') || normalizedLabel.includes('illustrat')) {
        if (!metadata.artist) metadata.artist = value;
      }
      if (normalizedLabel.includes('publish') || normalizedLabel.includes('magazine')) {
        if (!metadata.publisher) metadata.publisher = value;
      }
    }
  };
  
  // Try different infobox selectors
  $('.portable-infobox .pi-data').each((_, el) => extractFromElement($(el)));
  $('.infobox tr').each((_, el) => extractFromElement($(el)));
  $('table.infobox tr').each((_, el) => extractFromElement($(el)));
  
  // Try content extraction as fallback
  if (!metadata.author || !metadata.genres) {
    const content = $('.mw-parser-output').text();
    
    const patterns = [
      { pattern: /(?:written by|author|created by|mangaka)[:\s]+([^\n,]+)/i, field: 'author' },
      { pattern: /(?:illustrated by|artist|art by)[:\s]+([^\n,]+)/i, field: 'artist' },
      { pattern: /(?:published by|publisher|magazine)[:\s]+([^\n,]+)/i, field: 'publisher' },
      { pattern: /genre[s]?[:\s]+([^\n]+)/i, field: 'genres' },
      { pattern: /status[:\s]+([^\n]+)/i, field: 'status' },
      { pattern: /demographic[:\s]+([^\n]+)/i, field: 'demographic' },
      { pattern: /(\d+)\s+volumes?/i, field: 'volumes' },
      { pattern: /(\d+)\s+chapters?/i, field: 'chapters' }
    ];
    
    patterns.forEach(({ pattern, field }) => {
      if (!metadata[field]) {
        const match = content.match(pattern);
        if (match) {
          metadata[field] = match[1].trim();
        }
      }
    });
  }
  
  // Get cover
  metadata.cover = extractCoverImage($, mangaName);
  
  // Get description
  const firstPara = $('.mw-parser-output > p').first().text().trim();
  if (firstPara && firstPara.length > 50 && 
      !firstPara.includes('may refer to') && 
      !firstPara.includes('disambiguation') &&
      !firstPara.includes('Main Page')) {
    metadata.description = firstPara.substring(0, 300);
  }
  
  return metadata;
}

/**
 * Test a single manga
 */
async function testManga(config) {
  console.log(`\nTesting: ${config.name}`);
  
  const wikiResult = await findWiki(config);
  
  if (!wikiResult.success) {
    console.log(`  ❌ Wiki not found`);
    return { name: config.name, success: false };
  }
  
  console.log(`  ✅ Found at: ${wikiResult.url}`);
  
  const $ = cheerio.load(wikiResult.data);
  const metadata = extractMetadata($, config.name, wikiResult.url);
  
  // Calculate score
  const fields = [
    metadata.cover,
    metadata.author,
    metadata.artist,
    metadata.publisher,
    metadata.genres,
    metadata.status,
    metadata.description,
    metadata.volumes,
    metadata.chapters
  ];
  
  const score = fields.filter(Boolean).length;
  
  console.log(`  📊 Score: ${score}/9`);
  console.log(`     Cover: ${metadata.cover ? '✅' : '❌'}`);
  console.log(`     Author: ${metadata.author ? '✅ ' + metadata.author.substring(0, 30) : '❌'}`);
  console.log(`     Publisher: ${metadata.publisher ? '✅ ' + metadata.publisher.substring(0, 30) : '❌'}`);
  console.log(`     Genres: ${metadata.genres ? '✅ ' + metadata.genres.substring(0, 50) : '❌'}`);
  
  return {
    name: config.name,
    success: true,
    score,
    metadata,
    url: wikiResult.url
  };
}

/**
 * Main execution
 */
async function main() {
  console.log('🚀 Improved Fandom Extraction Test');
  console.log('Testing with enhanced wiki discovery and metadata extraction\n');
  console.log('=' .repeat(60));
  
  const results = [];
  
  for (const manga of TEST_SET) {
    const result = await testManga(manga);
    results.push(result);
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 SUMMARY');
  console.log('='.repeat(60));
  
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  
  console.log(`\n✅ Success Rate: ${successful.length}/${results.length} (${(successful.length/results.length*100).toFixed(0)}%)`);
  
  if (successful.length > 0) {
    const avgScore = successful.reduce((sum, r) => sum + r.score, 0) / successful.length;
    console.log(`📈 Average Score: ${avgScore.toFixed(1)}/9`);
    
    const highQuality = successful.filter(r => r.score >= 5);
    console.log(`🌟 High Quality (≥5/9): ${highQuality.length}/${successful.length} (${(highQuality.length/successful.length*100).toFixed(0)}%)`);
  }
  
  if (failed.length > 0) {
    console.log(`\n❌ Failed Wikis: ${failed.map(r => r.name).join(', ')}`);
  }
  
  // Best example
  const best = successful.sort((a, b) => b.score - a.score)[0];
  if (best) {
    console.log(`\n🏆 Best Extraction: ${best.name} (${best.score}/9)`);
    console.log(`   URL: ${best.url}`);
    if (best.metadata.author) console.log(`   Author: ${best.metadata.author}`);
    if (best.metadata.genres) console.log(`   Genres: ${best.metadata.genres}`);
  }
  
  console.log('\n✨ Test Complete!');
}

// Run the test
main().catch(console.error);