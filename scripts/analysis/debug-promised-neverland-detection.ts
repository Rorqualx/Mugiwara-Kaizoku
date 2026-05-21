import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

async function debugPromisedNeverlandDetection() {
  console.log('🔍 Debugging Promised Neverland Detection\n');
  
  const url = 'https://yakusokunoneverland.fandom.com/wiki/Chapters_and_Volumes';
  const response = await fetch(url);
  const html = await response.text();
  const $ = cheerio.load(html);
  
  // Test detection function logic
  const articleTables = $('table.article-table');
  console.log(`Total article-table: ${articleTables.length}`);
  
  // Look for 5-row article tables
  const fiveRowTables = articleTables.filter((_, table) => {
    const rows = $(table).find('tr').length;
    return rows === 5;
  });
  console.log(`5-row article tables: ${fiveRowTables.length}`);
  console.log(`Needs at least 10 for detection: ${fiveRowTables.length >= 10}`);
  
  // Check if tables follow the pattern
  let volumeTableCount = 0;
  
  fiveRowTables.each((i, table) => {
    const $table = $(table);
    const firstRow = $table.find('tr').first();
    const thirdRow = $table.find('tr').eq(2);
    
    const firstRowText = firstRow.text();
    const thirdRowText = thirdRow.text();
    
    // Check if first row has "Volume" and third row has "Chapters:"
    const hasVolume = firstRowText.includes('Volume');
    const hasChapters = thirdRowText.includes('Chapters:');
    
    if (i < 5) {
      console.log(`\nTable ${i + 1}:`);
      console.log(`  First row text: "${firstRowText.substring(0, 50)}..."`);
      console.log(`  Has "Volume": ${hasVolume}`);
      console.log(`  Third row text: "${thirdRowText.substring(0, 50)}..."`);
      console.log(`  Has "Chapters:": ${hasChapters}`);
    }
    
    if (hasVolume && hasChapters) {
      volumeTableCount++;
    }
  });
  
  console.log(`\nVolume tables found: ${volumeTableCount}`);
  console.log(`Needs at least 10 for detection: ${volumeTableCount >= 10}`);
  
  // Check why parsing might fail
  console.log('\n\nTesting parsing on first table:');
  const firstTable = fiveRowTables.first();
  if (firstTable.length > 0) {
    const rows = firstTable.find('tr');
    const firstRowText = rows.eq(0).text();
    console.log('First row text:', firstRowText);
    
    const volumeMatch = firstRowText.match(/Volume\s+(\d+)/i);
    console.log('Volume match:', volumeMatch ? volumeMatch[0] : 'none');
  }
}

debugPromisedNeverlandDetection().catch(console.error);