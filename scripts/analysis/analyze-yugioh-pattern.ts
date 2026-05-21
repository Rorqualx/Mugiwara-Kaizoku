import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

async function analyzeYuGiOhPattern() {
  console.log('🔍 Analyzing Yu-Gi-Oh! Pattern\n');
  
  const url = 'https://yugioh.fandom.com/wiki/Yu-Gi-Oh!_(manga)';
  const response = await fetch(url);
  const html = await response.text();
  const $ = cheerio.load(html);
  
  // Check all tables
  const tables = $('table');
  console.log(`Found ${tables.length} tables total\n`);
  
  // Check for volume-like tables
  let volumeTables = 0;
  
  tables.each((i, table) => {
    const $table = $(table);
    const rows = $table.find('tr').length;
    const classes = $table.attr('class') || 'no classes';
    const text = $table.text();
    
    // Check if this looks like a volume table
    if ((text.includes('Volume') || text.includes('Chapter')) && rows < 20) {
      volumeTables++;
      
      console.log(`Table ${i + 1}:`);
      console.log(`  Classes: ${classes}`);
      console.log(`  Rows: ${rows}`);
      
      // Show structure
      const firstRow = $table.find('tr').first().text().trim();
      console.log(`  First row: ${firstRow.substring(0, 100)}${firstRow.length > 100 ? '...' : ''}`);
      
      // Show some sample rows
      console.log('  Sample rows:');
      $table.find('tr').slice(0, 5).each((j, row) => {
        const rowText = $(row).text().trim().replace(/\s+/g, ' ');
        console.log(`    Row ${j + 1}: ${rowText.substring(0, 150)}${rowText.length > 150 ? '...' : ''}`);
      });
      
      console.log('');
    }
  });
  
  console.log(`\nTotal volume-like tables: ${volumeTables}`);
  
  // Check for headers
  console.log('\n📋 Headers with Volume/Chapter:');
  const headers = $('h2, h3, h4');
  headers.each((i, header) => {
    const text = $(header).text().trim();
    if (text.includes('Volume') || text.includes('Chapter') || text.includes('Duel')) {
      console.log(`- ${header.tagName}: ${text}`);
    }
  });
  
  // Check for specific Yu-Gi-Oh patterns
  console.log('\n📋 Checking for Duel patterns:');
  const duelCount = (html.match(/Duel \d+/g) || []).length;
  console.log(`- Found ${duelCount} references to "Duel X"`);
  
  // Check for lists
  console.log('\n📋 Lists:');
  const lists = $('ul, ol');
  let chapterLists = 0;
  lists.each((i, list) => {
    const $list = $(list);
    const text = $list.text();
    if ((text.includes('Duel') || text.includes('Chapter')) && text.includes(':')) {
      chapterLists++;
      if (chapterLists <= 3) {
        console.log(`\nList ${chapterLists}:`);
        $list.find('li').slice(0, 3).each((j, li) => {
          console.log(`  - ${$(li).text().trim()}`);
        });
      }
    }
  });
  console.log(`\nTotal lists with chapters/duels: ${chapterLists}`);
}

analyzeYuGiOhPattern().catch(console.error);