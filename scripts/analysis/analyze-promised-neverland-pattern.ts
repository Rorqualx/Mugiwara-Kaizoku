import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

async function analyzePromisedNeverlandPattern() {
  console.log('🔍 Analyzing Promised Neverland Pattern\n');
  
  const url = 'https://yakusokunoneverland.fandom.com/wiki/Chapters_and_Volumes';
  const response = await fetch(url);
  const html = await response.text();
  const $ = cheerio.load(html);
  
  // Check all tables
  const tables = $('table');
  console.log(`Found ${tables.length} tables total\n`);
  
  // Examine tables
  tables.each((i, table) => {
    const $table = $(table);
    const rows = $table.find('tr').length;
    const classes = $table.attr('class') || 'no classes';
    const text = $table.text();
    
    console.log(`Table ${i + 1}:`);
    console.log(`  Classes: ${classes}`);
    console.log(`  Rows: ${rows}`);
    
    // Check for volume/chapter content
    if (text.includes('Volume') || text.includes('Chapter') || text.includes('volume')) {
      console.log(`  → Potential volume/chapter table!`);
      
      // Show first few rows
      console.log('  Sample rows:');
      $table.find('tr').slice(0, 5).each((j, row) => {
        const cells = $(row).find('td, th');
        const rowText = $(row).text().trim().replace(/\s+/g, ' ');
        console.log(`    Row ${j + 1} (${cells.length} cells): ${rowText.substring(0, 150)}${rowText.length > 150 ? '...' : ''}`);
      });
    }
    
    console.log('');
  });
  
  // Check for headers
  console.log('📋 Headers:');
  $('h2, h3').each((i, header) => {
    const text = $(header).text().trim();
    if (text.includes('Volume') || text.includes('Chapter') || text.includes('Arc')) {
      console.log(`  ${header.tagName}: ${text}`);
    }
  });
  
  // Check for navigation boxes
  console.log('\n📋 Navigation boxes:');
  const navboxes = $('.navbox');
  console.log(`  Found ${navboxes.length} navboxes`);
  
  // Check for galleries
  console.log('\n📋 Galleries:');
  const galleries = $('.wikia-gallery, .gallery');
  console.log(`  Found ${galleries.length} galleries`);
}

analyzePromisedNeverlandPattern().catch(console.error);