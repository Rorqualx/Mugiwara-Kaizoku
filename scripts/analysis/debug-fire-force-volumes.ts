#!/usr/bin/env ts-node
/**
 * Debug script to understand the Fire Force List of Volumes page structure
 * This will help us understand why our volume extraction is failing
 */

import axios from 'axios';
import * as cheerio from 'cheerio';

async function debugVolumesPage() {
  console.log('🔍 Debugging Fire Force List of Volumes page structure...\n');

  try {
    const response = await axios.get('https://fire-force.fandom.com/wiki/List_of_Volumes', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      timeout: 30000
    });

    const $ = cheerio.load(response.data);
    
    console.log('📋 Page title:', $('.page-header__title').text().trim());
    
    console.log('\n🏷️ All headings on the page:');
    $('h1, h2, h3, h4, h5, h6').each((index, element) => {
      const level = element.tagName;
      const text = $(element).text().trim();
      if (text) {
        console.log(`  ${level.toUpperCase()}: "${text}"`);
      }
    });

    console.log('\n📊 All tables on the page:');
    $('table').each((index, table) => {
      const $table = $(table);
      console.log(`\n  Table ${index + 1}:`);
      console.log(`    Classes: ${$table.attr('class') || 'none'}`);
      console.log(`    Rows: ${$table.find('tr').length}`);
      
      // Show header row if it exists
      const headerRow = $table.find('tr').first();
      if (headerRow.length) {
        const headers = headerRow.find('th, td').map((_, cell) => $(cell).text().trim()).get();
        if (headers.length > 0) {
          console.log(`    Headers: [${headers.join(', ')}]`);
        }
      }

      // Show a sample data row
      const dataRow = $table.find('tr').eq(1);
      if (dataRow.length) {
        const cells = dataRow.find('td').map((_, cell) => {
          const text = $(cell).text().trim();
          return text.length > 30 ? text.substring(0, 30) + '...' : text;
        }).get();
        if (cells.length > 0) {
          console.log(`    Sample row: [${cells.join(' | ')}]`);
        }
      }
    });

    console.log('\n🖼️ Images on the page:');
    const images = new Set<string>();
    $('img').each((_, img) => {
      const src = $(img).attr('src') || $(img).attr('data-src');
      const alt = $(img).attr('alt') || '';
      if (src && !src.includes('data:') && !src.includes('wikia-button')) {
        images.add(src);
      }
    });
    
    Array.from(images).slice(0, 10).forEach((src, index) => {
      console.log(`  ${index + 1}. ${src.substring(0, 80)}${src.length > 80 ? '...' : ''}`);
    });
    
    if (images.size > 10) {
      console.log(`  ... and ${images.size - 10} more images`);
    }

    console.log('\n📚 Looking for volume-related content:');
    
    // Search for volume mentions in the text
    const pageText = $('body').text();
    const volumeMatches = pageText.match(/Volume\s+\d+/gi);
    if (volumeMatches) {
      const uniqueVolumes = [...new Set(volumeMatches)].slice(0, 10);
      console.log(`  Volume mentions found: ${uniqueVolumes.join(', ')}`);
    } else {
      console.log('  ❌ No volume mentions found');
    }

    // Look for chapter mentions
    const chapterMatches = pageText.match(/Chapter\s+\d+/gi);
    if (chapterMatches) {
      const uniqueChapters = [...new Set(chapterMatches)].slice(0, 10);
      console.log(`  Chapter mentions found: ${uniqueChapters.join(', ')}`);
    } else {
      console.log('  ❌ No chapter mentions found');
    }

    console.log('\n🔍 Detailed analysis of first few sections:');
    
    // Get the main content area
    const mainContent = $('.mw-parser-output, .page-content, .article-content').first();
    if (mainContent.length) {
      console.log('  Main content area found');
      
      // Look at the first few elements in the main content
      mainContent.children().slice(0, 10).each((index, element) => {
        const tagName = element.tagName.toLowerCase();
        const text = $(element).text().trim().substring(0, 100);
        const elementClass = $(element).attr('class') || 'no-class';
        
        console.log(`  ${index + 1}. <${tagName}> (class: ${elementClass}): ${text}${text.length >= 100 ? '...' : ''}`);
      });
    } else {
      console.log('  ❌ Main content area not found');
    }

    console.log('\n🧭 Navigation and special elements:');
    
    // Look for navigation elements
    $('.navbox, .navigation, .infobox, .wikitable').each((index, element) => {
      const className = $(element).attr('class') || 'unknown';
      const tagName = element.tagName.toLowerCase();
      console.log(`  ${tagName}.${className}: ${$(element).text().trim().substring(0, 50)}...`);
    });

    console.log('\n✅ Debug complete');

  } catch (error) {
    console.error('❌ Debug failed:', error instanceof Error ? error.message : String(error));
  }
}

// Run the debug
debugVolumesPage().catch((error) => {
  console.error('💥 Unhandled error:', error);
  process.exit(1);
});