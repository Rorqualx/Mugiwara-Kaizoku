import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

async function analyzeCaptainTsubasaPattern() {
  console.log('🔍 Analyzing Captain Tsubasa Pattern\n');
  
  const url = 'https://manga.fandom.com/wiki/List_of_Captain_Tsubasa_chapters';
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
    if (text.includes('Volume') || text.includes('Chapter') || text.includes('Match')) {
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
  
  // Check for sections
  console.log('📋 Headers:');
  $('h2, h3, h4').each((i, header) => {
    const text = $(header).text().trim();
    if (text.includes('Volume') || text.includes('Chapter') || text.includes('Part') || text.includes('Arc')) {
      console.log(`  ${header.tagName}: ${text}`);
    }
  });
  
  // Check for lists
  console.log('\n📋 Lists after headers:');
  $('h2, h3').each((i, header) => {
    const $header = $(header);
    const headerText = $header.text().trim();
    const $next = $header.next();
    
    if ($next.is('ul, ol')) {
      console.log(`\nAfter "${headerText}":`);
      $next.find('li').slice(0, 3).each((j, li) => {
        console.log(`  - ${$(li).text().trim()}`);
      });
    }
  });
}

analyzeCaptainTsubasaPattern().catch(console.error);