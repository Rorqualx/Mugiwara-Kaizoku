import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

async function debugMHA() {
  const response = await fetch('https://myheroacademia.fandom.com/wiki/Chapters_and_Volumes');
  const html = await response.text();
  const $ = cheerio.load(html);
  
  console.log('My Hero Academia page structure:\n');
  
  // Look for tables
  const tables = $('table');
  console.log(`Found ${tables.length} tables\n`);
  
  // Look for the main chapter table
  const chapterTable = tables.filter((_, table) => {
    const text = $(table).text();
    return text.includes('Chapter') && text.includes('Title') && !text.includes('Volume');
  }).first();
  
  if (chapterTable.length > 0) {
    console.log('Found main chapter table:');
    const rows = chapterTable.find('tr');
    console.log(`  Rows: ${rows.length}`);
    
    // Check first few rows
    rows.slice(0, 5).each((i, row) => {
      const $row = $(row);
      const cells = $row.find('td, th');
      console.log(`\n  Row ${i}: ${cells.length} cells`);
      cells.each((j, cell) => {
        const text = $(cell).text().trim();
        console.log(`    Cell ${j}: "${text.substring(0, 40)}..."`);
      });
    });
  }
  
  // Look for volume sections
  console.log('\n\nLooking for volume information:');
  const volumeHeaders = $('h3, h2').filter((_, el) => {
    return $(el).text().includes('Volume');
  });
  
  console.log(`Found ${volumeHeaders.length} volume headers`);
  volumeHeaders.slice(0, 3).each((i, header) => {
    console.log(`  ${i}: "${$(header).text().trim()}"`);
  });
}

debugMHA().catch(console.error);