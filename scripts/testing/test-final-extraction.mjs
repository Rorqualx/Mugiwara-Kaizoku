#!/usr/bin/env node

/**
 * Final comprehensive test for Fandom extraction improvements
 * Tests against real wiki data with proper lazy-loading and structure handling
 */

import axios from 'axios';
import * as cheerio from 'cheerio';

/**
 * Enhanced URL cleaning with all edge cases
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
 * Extract metadata from Fire Force style pages (no infobox)
 */
function extractFireForceMetadata($) {
  const metadata = {};
  
  // Look for metadata in text content
  const contentText = $('.mw-parser-output').text();
  
  // Author
  const authorMatch = contentText.match(/Author\s*\n?\s*([^\n]+)/);
  if (authorMatch) {
    metadata.author = authorMatch[1].trim();
  }
  
  // Genre
  const genreMatch = contentText.match(/Genre\s*\n?\s*([^\n]+)/);
  if (genreMatch) {
    metadata.genre = genreMatch[1].trim();
  }
  
  // Look for main image in figure
  const mainFigure = $('figure').first();
  if (mainFigure.length) {
    const img = mainFigure.find('img').first();
    if (img.length) {
      // Check data-src first for lazy-loaded images
      const dataSrc = img.attr('data-src');
      if (dataSrc && !dataSrc.includes('data:image')) {
        metadata.cover = cleanImageUrl(dataSrc);
      } else {
        const src = img.attr('src');
        if (src && !src.includes('data:image')) {
          metadata.cover = cleanImageUrl(src);
        }
      }
    }
  }
  
  // Look for linked images
  if (!metadata.cover) {
    $('a.image img').each((_, img) => {
      const $img = $(img);
      const dataSrc = $img.attr('data-src');
      const dataImageName = $img.attr('data-image-name');
      
      if (dataImageName && (dataImageName.includes('Volume') || dataImageName.includes('Cover'))) {
        if (dataSrc && !dataSrc.includes('data:image')) {
          metadata.cover = cleanImageUrl(dataSrc);
          return false; // break
        }
      }
    });
  }
  
  return metadata;
}

/**
 * Extract metadata from One Piece style pages (with portable infobox)
 */
function extractOnePieceMetadata($) {
  const metadata = {};
  
  // Extract from portable infobox
  $('.portable-infobox .pi-data').each((_, element) => {
    const $element = $(element);
    const label = $element.find('.pi-data-label').text().trim();
    const value = $element.find('.pi-data-value').text().trim();
    
    if (label && value) {
      const key = label.toLowerCase().replace(/[^a-z0-9]/g, '_');
      metadata[key] = value;
    }
  });
  
  // Get cover image from infobox
  const infoboxImg = $('.portable-infobox .pi-image img').first();
  if (infoboxImg.length) {
    metadata.cover = getImageUrl($, infoboxImg[0]);
  }
  
  // Look for author in content if not in infobox
  if (!metadata.author) {
    const authorSection = $('*:contains("Author:")').filter((i, el) => {
      const text = $(el).text();
      return text.startsWith('Author:') && text.length < 100;
    }).first();
    
    if (authorSection.length) {
      const authorText = authorSection.text().replace('Author:', '').trim();
      metadata.author = authorText.split('\n')[0].trim();
    }
  }
  
  return metadata;
}

/**
 * Extract volume covers with enhanced detection
 */
function extractVolumeCovers($) {
  const volumes = [];
  const volumeMap = new Map();
  
  // Method 1: Tables with volume info
  $('table').each((_, table) => {
    const $table = $(table);
    const tableText = $table.text();
    
    if (tableText.toLowerCase().includes('volume')) {
      let volumeNumber = 0;
      
      // Check headers
      const header = $table.find('th:contains("Volume"), caption:contains("Volume")').first().text();
      const volumeMatch = header.match(/volume\s+(\d+)/i);
      if (volumeMatch) {
        volumeNumber = parseInt(volumeMatch[1], 10);
      }
      
      // Check for tabbed content (Fire Force)
      const tabber = $table.find('.wds-tabber, .tabber').first();
      if (tabber.length) {
        const tabs = tabber.find('.wds-tab__content, .tabbertab');
        tabs.each((i, tab) => {
          const $tab = $(tab);
          const img = $tab.find('img').first();
          if (img.length) {
            const dataSrc = img.attr('data-src');
            const src = img.attr('src');
            
            let url = '';
            if (dataSrc && !dataSrc.includes('data:image')) {
              url = cleanImageUrl(dataSrc);
            } else if (src && !src.includes('data:image')) {
              url = cleanImageUrl(src);
            }
            
            if (url && volumeNumber) {
              if (!volumeMap.has(volumeNumber)) {
                volumeMap.set(volumeNumber, {
                  number: volumeNumber,
                  covers: []
                });
              }
              volumeMap.get(volumeNumber).covers.push({
                url,
                type: i === 0 ? 'English' : 'Japanese'
              });
            }
          }
        });
      } else {
        // Regular table images
        $table.find('img').each((_, img) => {
          const $img = $(img);
          const dataSrc = $img.attr('data-src');
          const dataImageName = $img.attr('data-image-name') || '';
          const alt = $img.attr('alt') || '';
          
          if ((dataImageName.includes('Volume') || alt.includes('Volume')) && dataSrc) {
            const url = cleanImageUrl(dataSrc);
            if (url) {
              // Extract volume number
              const volMatch = (dataImageName + alt).match(/volume\s*(\d+)/i);
              if (volMatch) {
                const volNum = parseInt(volMatch[1], 10);
                if (!volumeMap.has(volNum)) {
                  volumeMap.set(volNum, {
                    number: volNum,
                    covers: [{ url, type: 'Standard' }]
                  });
                }
              }
            }
          }
        });
      }
    }
  });
  
  // Convert map to array
  return Array.from(volumeMap.values()).sort((a, b) => a.number - b.number);
}

/**
 * Test a manga wiki
 */
async function testManga(name, mainUrl, volumeUrl) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`📚 Testing: ${name}`);
  console.log(`${'='.repeat(60)}`);
  
  const results = { name };
  
  // Test main page
  console.log('\n📖 Main Page:');
  try {
    const response = await axios.get(mainUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    const $ = cheerio.load(response.data);
    
    // Determine wiki type
    const hasInfobox = $('.portable-infobox').length > 0;
    console.log(`  Wiki type: ${hasInfobox ? 'Standard (with infobox)' : 'Custom layout'}`);
    
    // Extract metadata based on type
    const metadata = hasInfobox ? 
      extractOnePieceMetadata($) : 
      extractFireForceMetadata($);
    
    // Display results
    if (metadata.cover) {
      console.log(`  ✅ Cover image found`);
      console.log(`     URL: ${metadata.cover.substring(0, 80)}...`);
      results.hasCover = true;
    } else {
      console.log(`  ❌ Cover image not found`);
      results.hasCover = false;
    }
    
    if (metadata.author) {
      console.log(`  ✅ Author: ${metadata.author}`);
      results.hasAuthor = true;
    } else {
      console.log(`  ❌ Author not found`);
      results.hasAuthor = false;
    }
    
    if (metadata.genre || metadata.genres) {
      console.log(`  ✅ Genre: ${metadata.genre || metadata.genres}`);
      results.hasGenre = true;
    }
    
    // Show other metadata
    const otherKeys = Object.keys(metadata).filter(k => 
      !['cover', 'author', 'genre', 'genres'].includes(k)
    );
    if (otherKeys.length > 0) {
      console.log(`  📊 Other metadata: ${otherKeys.slice(0, 5).join(', ')}`);
    }
    
  } catch (error) {
    console.log(`  ❌ Error: ${error.message}`);
    results.mainError = error.message;
  }
  
  // Test volume page
  console.log('\n📚 Volume Page:');
  try {
    const response = await axios.get(volumeUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    const $ = cheerio.load(response.data);
    
    const volumes = extractVolumeCovers($);
    console.log(`  ✅ Found ${volumes.length} volumes with covers`);
    results.volumeCount = volumes.length;
    
    // Count total covers
    let totalCovers = 0;
    volumes.forEach(vol => {
      totalCovers += vol.covers.length;
    });
    console.log(`  📊 Total cover images: ${totalCovers}`);
    
    // Show sample volumes
    if (volumes.length > 0) {
      console.log(`\n  Sample volumes:`);
      volumes.slice(0, 3).forEach(vol => {
        console.log(`    Volume ${vol.number}:`);
        vol.covers.forEach(cover => {
          console.log(`      ${cover.type}: ${cover.url.substring(0, 60)}...`);
        });
      });
    }
    
    // Check for tabbed content
    const hasTabbed = $('.wds-tabber, .tabber').length > 0;
    if (hasTabbed) {
      console.log(`  ✅ Tabbed content detected`);
    }
    
  } catch (error) {
    console.log(`  ❌ Error: ${error.message}`);
    results.volumeError = error.message;
  }
  
  return results;
}

/**
 * Main execution
 */
async function main() {
  console.log('🚀 Final Fandom Extraction Test');
  console.log('Testing real-world extraction with all improvements\n');
  
  const tests = [
    {
      name: 'One Piece',
      main: 'https://onepiece.fandom.com/wiki/One_Piece_(Manga)',
      volume: 'https://onepiece.fandom.com/wiki/Chapters_and_Volumes'
    },
    {
      name: 'Fire Force',
      main: 'https://fire-force.fandom.com/wiki/Fire_Force_(manga)',
      volume: 'https://fire-force.fandom.com/wiki/List_of_Volumes'
    },
    {
      name: 'My Hero Academia',
      main: 'https://myheroacademia.fandom.com/wiki/My_Hero_Academia_(Manga)',
      volume: 'https://myheroacademia.fandom.com/wiki/Volumes_%26_Chapters'
    }
  ];
  
  const allResults = [];
  
  for (const test of tests) {
    const result = await testManga(test.name, test.main, test.volume);
    allResults.push(result);
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 FINAL SUMMARY');
  console.log('='.repeat(60));
  
  allResults.forEach(result => {
    const score = [
      result.hasCover,
      result.hasAuthor,
      result.hasGenre,
      result.volumeCount > 0
    ].filter(Boolean).length;
    
    const emoji = score >= 3 ? '✅' : score >= 2 ? '⚠️' : '❌';
    
    console.log(`\n${emoji} ${result.name}:`);
    console.log(`  Main cover: ${result.hasCover ? '✅' : '❌'}`);
    console.log(`  Author: ${result.hasAuthor ? '✅' : '❌'}`);
    console.log(`  Genre: ${result.hasGenre ? '✅' : '❌'}`);
    console.log(`  Volume covers: ${result.volumeCount || 0}`);
    console.log(`  Success rate: ${(score / 4 * 100).toFixed(0)}%`);
  });
  
  const avgScore = allResults.reduce((sum, r) => {
    return sum + [r.hasCover, r.hasAuthor, r.hasGenre, r.volumeCount > 0].filter(Boolean).length;
  }, 0) / allResults.length;
  
  console.log(`\n📈 Overall success rate: ${(avgScore / 4 * 100).toFixed(0)}%`);
  console.log('\n✨ Test complete!');
}

// Run the test
main().catch(console.error);