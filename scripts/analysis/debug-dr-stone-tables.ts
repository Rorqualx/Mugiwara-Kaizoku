import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

async function debugDrStoneTables() {
  console.log('🔍 Debugging Dr. Stone Tables\n');
  
  const url = 'https://dr-stone.fandom.com/wiki/Chapters_and_Volumes';
  const response = await fetch(url);
  const html = await response.text();
  const $ = cheerio.load(html);
  
  const tables = $('table');
  console.log(`Found ${tables.length} tables\n`);
  
  tables.each((i, table) => {
    const $table = $(table);
    const rows = $table.find('tr');
    
    console.log(`\n=== Table ${i + 1} ===`);
    console.log(`Rows: ${rows.length}`);
    
    // Check table attributes
    const classes = $table.attr('class') || 'none';
    console.log(`Classes: ${classes}`);
    
    // Get first 5 rows to understand structure
    console.log('\nFirst 5 rows:');
    rows.slice(0, 5).each((j, row) => {
      const cells = $(row).find('td, th');
      console.log(`\nRow ${j + 1} (${cells.length} cells):`);
      
      cells.each((k, cell) => {
        const text = $(cell).text().trim();
        const truncated = text.length > 50 ? text.substring(0, 50) + '...' : text;
        console.log(`  Cell ${k + 1}: "${truncated}"`);
      });
    });
    
    // Check if this table contains volume/chapter info
    const tableText = $table.text();
    const hasVolume = /Volume\s+\d+/i.test(tableText);
    const hasChapter = /Chapter\s+\d+/i.test(tableText);
    const hasZ = tableText.includes('Z=');
    
    console.log(`\nContent indicators:`);
    console.log(`- Has Volume: ${hasVolume}`);
    console.log(`- Has Chapter: ${hasChapter}`);
    console.log(`- Has Z= pattern: ${hasZ}`);
    
    if (hasZ) {
      // This might be Dr. Stone's unique format
      console.log('\n🎯 Found Dr. Stone format! Analyzing...');
      
      // Look for Z=X patterns
      const zMatches = tableText.match(/Z=\d+/g);
      if (zMatches) {
        console.log(`Found ${zMatches.length} Z= entries`);
        console.log('First few:', zMatches.slice(0, 5));
      }
    }
  });
  
  // Look for the actual content structure
  console.log('\n\n🔍 Searching for content patterns...\n');
  
  // Check if content is in lists instead of tables
  const lists = $('ul, ol').filter((_, list) => {
    const text = $(list).text();
    return text.includes('Chapter') || text.includes('Z=');
  });
  
  console.log(`Found ${lists.length} lists with chapter info`);
  
  if (lists.length > 0) {
    lists.slice(0, 2).each((i, list) => {
      console.log(`\nList ${i + 1}:`);
      const items = $(list).find('li');
      console.log(`Items: ${items.length}`);
      
      items.slice(0, 3).each((j, item) => {
        console.log(`  - ${$(item).text().trim().substring(0, 80)}...`);
      });
    });
  }
}

debugDrStoneTables().catch(console.error);