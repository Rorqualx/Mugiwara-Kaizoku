import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

async function analyzeAstroBoyPattern() {
  console.log('🔍 Analyzing Astro Boy Pattern\n');
  
  const url = 'https://astroboy.fandom.com/wiki/List_of_Astro_Boy_Volumes_and_Chapters';
  const response = await fetch(url);
  const html = await response.text();
  const $ = cheerio.load(html);
  
  // Check all tables
  const tables = $('table');
  console.log(`Found ${tables.length} tables total\n`);
  
  // Examine tables in detail
  tables.each((i, table) => {
    const $table = $(table);
    const rows = $table.find('tr').length;
    const classes = $table.attr('class') || 'no classes';
    
    if (rows <= 10) {  // Focus on smaller tables
      console.log(`Table ${i + 1}:`);
      console.log(`  Classes: ${classes}`);
      console.log(`  Rows: ${rows}`);
      
      // Check all rows
      $table.find('tr').each((j, row) => {
        const $row = $(row);
        const cells = $row.find('td, th').length;
        const text = $row.text().trim().replace(/\s+/g, ' ');
        console.log(`    Row ${j + 1} (${cells} cells): ${text.substring(0, 150)}${text.length > 150 ? '...' : ''}`);
      });
      
      console.log('');
    }
  });
  
  // Check for patterns in text
  console.log('📋 Checking for volume/chapter patterns in text:');
  const volumeMatches = html.match(/Volume\s+\d+/gi) || [];
  const chapterMatches = html.match(/Chapter\s+\d+/gi) || [];
  console.log(`  Volume references: ${volumeMatches.length}`);
  console.log(`  Chapter references: ${chapterMatches.length}`);
  
  // Check headers
  console.log('\n📋 Headers:');
  $('h1, h2, h3, h4').each((i, header) => {
    const text = $(header).text().trim();
    if (text.includes('Volume') || text.includes('Chapter') || text.includes('List')) {
      console.log(`  ${header.tagName}: ${text}`);
    }
  });
  
  // Look for specific patterns
  console.log('\n📋 Analyzing structure:');
  
  // Check if volumes are in separate tables
  const volumeTables = tables.filter((_, table) => {
    const text = $(table).text();
    return /Volume\s+\d+/.test(text) && text.includes('ISBN');
  });
  console.log(`  Tables with Volume + ISBN: ${volumeTables.length}`);
  
  // Check for chapter lists after tables
  tables.each((i, table) => {
    const $table = $(table);
    if (/Volume\s+\d+/.test($table.text())) {
      const nextElement = $table.next();
      if (nextElement.is('ul, ol')) {
        console.log(`  Table ${i + 1} is followed by a list!`);
      }
    }
  });
}

analyzeAstroBoyPattern().catch(console.error);