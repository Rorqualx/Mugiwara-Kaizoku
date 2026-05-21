import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

async function analyzeFullmetalAlchemistPattern() {
  console.log('🔍 Analyzing Fullmetal Alchemist Pattern\n');
  
  const url = 'https://fma.fandom.com/wiki/Chapters_and_Volumes';
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
  
  // Check for lists
  console.log('\n📋 Lists:');
  const lists = $('ul, ol');
  let volumeLists = 0;
  lists.each((i, list) => {
    const $list = $(list);
    const text = $list.text();
    if (text.includes('Chapter') && text.includes(':')) {
      volumeLists++;
      console.log(`\nList ${volumeLists}:`);
      $list.find('li').slice(0, 3).each((j, li) => {
        console.log(`  - ${$(li).text().trim()}`);
      });
    }
  });
  console.log(`Total lists with chapters: ${volumeLists}`);
}

analyzeFullmetalAlchemistPattern().catch(console.error);