import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

async function debugDetection() {
  console.log('🔍 Debugging Single Table Detection\n');
  
  const url = 'https://hokuto.fandom.com/wiki/Hokuto_no_Ken_chapters';
  const response = await fetch(url);
  const html = await response.text();
  const $ = cheerio.load(html);
  
  console.log('Analyzing all tables...\n');
  
  $('table').each((i, table) => {
    const $table = $(table);
    const rows = $table.find('tr');
    console.log(`Table ${i + 1}: ${rows.length} rows`);
    
    if (rows.length > 20) {
      console.log('  ✓ Has more than 20 rows');
      
      // Check for volume headers
      let volumeHeaders = 0;
      let chapterRows = 0;
      
      rows.each((_, row) => {
        const $row = $(row);
        const cells = $row.find('td, th');
        const rowText = $row.text();
        
        // Check for volume header pattern
        if (cells.length === 1 && cells.attr('colspan') && /Volume\s+\d+/i.test(rowText)) {
          volumeHeaders++;
        }
        
        // Check for chapter pattern
        if (/^\d{3}\./.test(rowText) || /Chapter\s+\d+/i.test(rowText)) {
          chapterRows++;
        }
      });
      
      console.log(`  Volume headers found: ${volumeHeaders}`);
      console.log(`  Chapter rows found: ${chapterRows}`);
      console.log(`  Would detect: ${volumeHeaders >= 5 && chapterRows >= 20}`);
      
      // Check first few rows in detail
      console.log('\n  First 5 rows:');
      rows.slice(0, 5).each((j, row) => {
        const $row = $(row);
        const cells = $row.find('td, th');
        const cellCount = cells.length;
        const colspan = cells.first().attr('colspan');
        const text = $row.text().trim().substring(0, 50);
        console.log(`    Row ${j}: ${cellCount} cells${colspan ? ` (colspan=${colspan})` : ''} - "${text}..."`);
      });
    }
    
    console.log('');
  });
}

debugDetection().catch(console.error);