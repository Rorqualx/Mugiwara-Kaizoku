import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

async function debugSingleTable() {
  console.log('🔍 Debugging Single Table Structure\n');
  
  const url = 'https://hokuto.fandom.com/wiki/Hokuto_no_Ken_chapters';
  const response = await fetch(url);
  const html = await response.text();
  const $ = cheerio.load(html);
  
  // Find the largest table
  let largestTable: cheerio.Cheerio<any> | null = null;
  let maxRows = 0;
  
  $('table').each((_, table) => {
    const rowCount = $(table).find('tr').length;
    if (rowCount > maxRows) {
      maxRows = rowCount;
      largestTable = $(table);
    }
  });
  
  if (!largestTable) {
    console.log('No table found!');
    return;
  }
  
  console.log(`Found table with ${maxRows} rows\n`);
  
  // Analyze first 20 rows in detail
  const rows = largestTable.find('tr');
  
  rows.slice(0, 20).each((i, row) => {
    const $row = $(row);
    const cells = $row.find('td, th');
    const cellCount = cells.length;
    
    console.log(`\nRow ${i} (${cellCount} cells):`);
    
    cells.each((j, cell) => {
      const text = $(cell).text().trim();
      const colspan = $(cell).attr('colspan');
      
      if (text) {
        console.log(`  Cell ${j}: "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}"${colspan ? ` (colspan=${colspan})` : ''}`);
      }
    });
    
    // Check for patterns
    const rowText = $row.text();
    if (/Volume \d+/i.test(rowText)) {
      console.log(`  ✓ Volume header detected`);
    }
    if (/^\d{3}\.|Chapter \d+/i.test(rowText)) {
      console.log(`  ✓ Chapter entry detected`);
    }
  });
  
  // Try a different parsing approach
  console.log('\n\n🎯 Alternative Parsing Approach:');
  
  let volumeCount = 0;
  let chapterCount = 0;
  let currentVolumeChapters = 0;
  
  rows.each((_, row) => {
    const $row = $(row);
    const cells = $row.find('td');
    const rowText = $row.text();
    
    // Volume headers often span multiple columns
    if (cells.length === 1 && cells.attr('colspan')) {
      const volumeMatch = rowText.match(/Volume\s+(\d+)/i);
      if (volumeMatch) {
        if (currentVolumeChapters > 0) {
          console.log(`Volume ${volumeCount}: ${currentVolumeChapters} chapters`);
        }
        volumeCount++;
        currentVolumeChapters = 0;
      }
    }
    // Chapter rows
    else if (cells.length >= 2) {
      const firstCell = cells.eq(0).text().trim();
      
      // Check for chapter patterns
      if (/^\d{3}\./.test(firstCell) || /Chapter \d+/i.test(firstCell)) {
        chapterCount++;
        currentVolumeChapters++;
      }
    }
  });
  
  if (currentVolumeChapters > 0) {
    console.log(`Volume ${volumeCount}: ${currentVolumeChapters} chapters`);
  }
  
  console.log(`\nTotal volumes found: ${volumeCount}`);
  console.log(`Total chapters found: ${chapterCount}`);
}

debugSingleTable().catch(console.error);