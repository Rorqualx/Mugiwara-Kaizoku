#!/usr/bin/env node

/**
 * Test script for refined Fandom extraction
 * Tests the improvements made to cover extraction and metadata parsing
 */

import axios from 'axios';
import * as cheerio from 'cheerio';

// Test configurations for problematic wikis
const TEST_CASES = [
  {
    name: 'One Piece',
    mainPage: 'https://onepiece.fandom.com/wiki/One_Piece_(Manga)',
    volumePage: 'https://onepiece.fandom.com/wiki/Chapters_and_Volumes',
    expectedMainCover: true
  },
  {
    name: 'Fire Force',
    mainPage: 'https://fire-force.fandom.com/wiki/Fire_Force_(manga)',
    volumePage: 'https://fire-force.fandom.com/wiki/List_of_Volumes',
    expectedTabbed: true
  },
  {
    name: 'Chainsaw Man',
    mainPage: 'https://chainsaw-man.fandom.com/wiki/Chainsaw_Man_(manga)',
    volumePage: 'https://chainsaw-man.fandom.com/wiki/Volumes',
    expectedMainCover: true
  }
];

/**
 * Enhanced URL cleaning with data-src support
 */
function cleanImageUrl(url) {
  if (!url || url === 'none' || url.includes('data:image/gif')) return '';
  
  let cleanUrl = url;
  
  // Handle data URIs - skip these
  if (cleanUrl.startsWith('data:')) {
    return '';
  }
  
  // Remove revision parameters more aggressively
  cleanUrl = cleanUrl.replace(/\/revision\/[^\/]*/, '');
  
  // Remove scale parameters
  cleanUrl = cleanUrl.replace(/\/scale-to-width-down\/\d+/, '');
  cleanUrl = cleanUrl.replace(/\/scale-to-width\/\d+/, '');
  cleanUrl = cleanUrl.replace(/\/smart\/width\/\d+\/height\/\d+/, '');
  
  // Remove thumbnail markers
  cleanUrl = cleanUrl.replace(/\/thumb\//, '/');
  
  // Remove size suffixes
  cleanUrl = cleanUrl.replace(/\/\d+px-[^\/]+$/, '');
  
  // Remove query parameters
  if (cleanUrl.includes('?')) {
    cleanUrl = cleanUrl.split('?')[0];
  }
  
  // Remove trailing parameters after image extension
  cleanUrl = cleanUrl.replace(/(\.(png|jpg|jpeg|gif|webp))[^\/]*$/i, '$1');
  
  // Ensure HTTPS
  if (cleanUrl.startsWith('//')) {
    cleanUrl = 'https:' + cleanUrl;
  } else if (!cleanUrl.startsWith('http')) {
    cleanUrl = 'https://' + cleanUrl;
  }
  
  // Fix double slashes in path
  cleanUrl = cleanUrl.replace(/([^:])\/\/+/g, '$1/');
  
  return cleanUrl;
}

/**
 * Get image URL from element with multiple attribute checks
 */
function getImageUrl($, element) {
  const $img = $(element);
  
  // Check various attributes in priority order
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
 * Extract main cover with improved detection
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
    
    // Generic candidates
    '.mw-parser-output .infobox img:first',
    'aside img:first'
  ];
  
  for (const selector of selectors) {
    const img = $(selector).first();
    if (img.length) {
      const url = getImageUrl($, img[0]);
      if (url) {
        return { url, selector };
      }
    }
  }
  
  // Fallback: alt text search
  const fallbackImgs = $('img[alt*="cover" i], img[alt*="volume" i], img[alt*="manga" i]');
  for (let i = 0; i < fallbackImgs.length && i < 5; i++) {
    const url = getImageUrl($, fallbackImgs[i]);
    if (url && !url.includes('icon') && !url.includes('button')) {
      return { url, selector: 'alt text fallback' };
    }
  }
  
  return null;
}

/**
 * Extract volume covers with tabbed content support
 */
function extractVolumeCovers($) {
  const volumes = [];
  
  $('table').each((_, table) => {
    const $table = $(table);
    const tableText = $table.text();
    
    if (tableText.toLowerCase().includes('volume')) {
      // Check for volume number
      let volumeNumber = 0;
      const header = $table.find('th:contains("Volume"), caption:contains("Volume")').first().text();
      const volumeMatch = header.match(/volume\s+(\d+)/i);
      if (volumeMatch) {
        volumeNumber = parseInt(volumeMatch[1], 10);
      }
      
      // Check for tabbed content
      const tabber = $table.find('.wds-tabber, .tabber').first();
      if (tabber.length) {
        // Extract from tabs
        const tabs = tabber.find('.wds-tab__content, .tabbertab');
        tabs.each((i, tab) => {
          const $tab = $(tab);
          const img = $tab.find('img').first();
          if (img.length) {
            const url = getImageUrl($, img[0]);
            if (url && volumeNumber) {
              volumes.push({
                number: volumeNumber,
                url,
                type: i === 0 ? 'English' : 'Japanese',
                source: 'tabbed'
              });
            }
          }
        });
      } else {
        // Regular extraction
        $table.find('img').each((_, img) => {
          const url = getImageUrl($, img);
          if (url) {
            const $img = $(img);
            const alt = $img.attr('alt') || '';
            const dataImageName = $img.attr('data-image-name') || '';
            
            let imgVolumeNumber = volumeNumber;
            const imgVolumeMatch = (alt + dataImageName).match(/volume\s*(\d+)/i);
            if (imgVolumeMatch) {
              imgVolumeNumber = parseInt(imgVolumeMatch[1], 10);
            }
            
            if (imgVolumeNumber) {
              volumes.push({
                number: imgVolumeNumber,
                url,
                source: 'table'
              });
            }
          }
        });
      }
    }
  });
  
  return volumes;
}

/**
 * Extract enhanced infobox data
 */
function extractInfobox($) {
  const data = {};
  
  // Portable infobox
  $('.portable-infobox .pi-data, aside.portable-infobox .pi-data').each((_, element) => {
    const $element = $(element);
    const label = $element.find('.pi-data-label').text().trim();
    const value = $element.find('.pi-data-value').text().trim();
    
    if (label && value) {
      const key = normalizeFieldName(label);
      data[key] = value;
    }
  });
  
  // Traditional infobox
  $('.infobox tr, table.infobox tr').each((_, row) => {
    const $row = $(row);
    const label = $row.find('th').text().trim();
    const value = $row.find('td').text().trim();
    
    if (label && value && !data[normalizeFieldName(label)]) {
      const key = normalizeFieldName(label);
      data[key] = value;
    }
  });
  
  return data;
}

/**
 * Normalize field names for consistent access
 */
function normalizeFieldName(field) {
  const normalized = field.toLowerCase();
  
  const mappings = {
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
    'status': 'status',
    'volumes': 'volumes',
    'no. of volumes': 'volumes',
    'chapters': 'chapters',
    'no. of chapters': 'chapters',
    'genre': 'genres',
    'genre(s)': 'genres'
  };
  
  return mappings[normalized] || normalized.replace(/[^\w]/g, '_');
}

/**
 * Test a single wiki
 */
async function testWiki(config) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`🔍 Testing: ${config.name}`);
  console.log(`${'='.repeat(60)}`);
  
  const results = { name: config.name };
  
  // Test main page
  console.log('\n📖 Main Page Test:');
  try {
    const response = await axios.get(config.mainPage, {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    const $ = cheerio.load(response.data);
    
    // Extract main cover
    const cover = extractMainCover($);
    if (cover) {
      console.log(`  ✅ Main cover found using: ${cover.selector}`);
      console.log(`     URL: ${cover.url.substring(0, 80)}...`);
      results.mainCover = true;
    } else {
      console.log(`  ❌ Main cover not found`);
      results.mainCover = false;
    }
    
    // Extract infobox
    const infobox = extractInfobox($);
    console.log(`\n  Infobox data:`);
    const importantFields = ['author', 'publisher', 'demographic', 'status', 'volumes', 'chapters'];
    importantFields.forEach(field => {
      if (infobox[field]) {
        console.log(`    ✅ ${field}: ${infobox[field]}`);
        results[field] = true;
      } else {
        console.log(`    ❌ ${field}: not found`);
        results[field] = false;
      }
    });
    
  } catch (error) {
    console.log(`  ❌ Error: ${error.message}`);
    results.mainPageError = error.message;
  }
  
  // Test volume page
  console.log('\n📚 Volume Page Test:');
  try {
    const response = await axios.get(config.volumePage, {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    const $ = cheerio.load(response.data);
    
    // Check for tabbed content
    const tabbers = $('.wds-tabber, .tabber');
    if (tabbers.length > 0) {
      console.log(`  ✅ Found ${tabbers.length} tabbed sections`);
      results.hasTabbed = true;
    }
    
    // Extract volume covers
    const volumes = extractVolumeCovers($);
    console.log(`  ✅ Found ${volumes.length} volume covers`);
    
    // Group by source
    const bySource = {};
    volumes.forEach(vol => {
      bySource[vol.source] = (bySource[vol.source] || 0) + 1;
    });
    
    Object.entries(bySource).forEach(([source, count]) => {
      console.log(`    - ${count} from ${source}`);
    });
    
    if (volumes.length > 0) {
      console.log(`\n  Sample volumes:`);
      volumes.slice(0, 3).forEach(vol => {
        console.log(`    Volume ${vol.number}: ${vol.url.substring(0, 60)}...`);
        if (vol.type) console.log(`      Type: ${vol.type}`);
      });
    }
    
    results.volumeCovers = volumes.length;
    
  } catch (error) {
    console.log(`  ❌ Error: ${error.message}`);
    results.volumePageError = error.message;
  }
  
  return results;
}

/**
 * Main execution
 */
async function main() {
  console.log('🚀 Refined Fandom Extraction Test');
  console.log('Testing improvements to cover and metadata extraction\n');
  
  const allResults = [];
  
  for (const config of TEST_CASES) {
    const result = await testWiki(config);
    allResults.push(result);
    
    // Delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 SUMMARY');
  console.log('='.repeat(60));
  
  allResults.forEach(result => {
    const score = [
      result.mainCover,
      result.author,
      result.publisher,
      result.volumeCovers > 0
    ].filter(Boolean).length;
    
    const emoji = score >= 3 ? '✅' : score >= 2 ? '⚠️' : '❌';
    
    console.log(`\n${emoji} ${result.name}:`);
    console.log(`  Main cover: ${result.mainCover ? '✅' : '❌'}`);
    console.log(`  Author: ${result.author ? '✅' : '❌'}`);
    console.log(`  Publisher: ${result.publisher ? '✅' : '❌'}`);
    console.log(`  Volume covers: ${result.volumeCovers || 0}`);
    console.log(`  Score: ${score}/4`);
  });
  
  console.log('\n✨ Test complete!');
}

// Run the test
main().catch(console.error);