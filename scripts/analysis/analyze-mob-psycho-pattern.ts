import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

async function analyzeMobPsychoPattern() {
  console.log('🔍 Analyzing Mob Psycho 100 Pattern\n');
  
  const url = 'https://mob-psycho-100.fandom.com/wiki/Chapters';
  const response = await fetch(url);
  const html = await response.text();
  const $ = cheerio.load(html);
  
  // Check all tables
  const tables = $('table');
  console.log(`Found ${tables.length} tables total\n`);
  
  tables.each((i, table) => {
    const $table = $(table);
    const rows = $table.find('tr').length;
    const classes = $table.attr('class') || 'no classes';
    const firstRow = $table.find('tr').first().text().trim();
    const lastRow = $table.find('tr').last().text().trim();
    
    console.log(`Table ${i + 1}:`);
    console.log(`  Classes: ${classes}`);
    console.log(`  Rows: ${rows}`);
    console.log(`  First row: ${firstRow.substring(0, 100)}${firstRow.length > 100 ? '...' : ''}`);
    console.log(`  Last row: ${lastRow.substring(0, 100)}${lastRow.length > 100 ? '...' : ''}`);
    
    // Check if it looks like a volume table
    if (firstRow.includes('Volume') || firstRow.includes('Chapter') || 
        lastRow.includes('Chapter') || rows < 20) {
      console.log(`  → Potential volume/chapter table!`);
      
      // Show some sample rows
      console.log('  Sample rows:');
      $table.find('tr').slice(0, 5).each((j, row) => {
        const rowText = $(row).text().trim().replace(/\s+/g, ' ');
        console.log(`    Row ${j + 1}: ${rowText.substring(0, 150)}${rowText.length > 150 ? '...' : ''}`);
      });
    }
    
    console.log('');
  });
  
  // Check for article sections or headers
  console.log('\n📋 Article Sections:');
  const sections = $('h2, h3');
  sections.each((i, section) => {
    const text = $(section).text().trim();
    if (text.includes('Volume') || text.includes('Chapter') || text.includes('Arc')) {
      console.log(`- ${section.tagName}: ${text}`);
    }
  });
}

analyzeMobPsychoPattern().catch(console.error);