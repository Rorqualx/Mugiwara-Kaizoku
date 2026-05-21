import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

async function analyzeCaptainTsubasaDetailed() {
  console.log('🔍 Analyzing Captain Tsubasa Pattern in Detail\n');
  
  const url = 'https://manga.fandom.com/wiki/List_of_Captain_Tsubasa_chapters';
  const response = await fetch(url);
  const html = await response.text();
  const $ = cheerio.load(html);
  
  // Focus on the large wikitable
  const mainTable = $('table.wikitable').first();
  console.log(`Main table rows: ${mainTable.find('tr').length}\n`);
  
  // Analyze row structure
  const rows = mainTable.find('tr');
  
  console.log('Row analysis:');
  rows.slice(0, 10).each((i, row) => {
    const $row = $(row);
    const cells = $row.find('td, th');
    const text = $row.text().trim().replace(/\s+/g, ' ');
    
    console.log(`Row ${i + 1}:`);
    console.log(`  Cells: ${cells.length}`);
    console.log(`  Text: ${text.substring(0, 150)}${text.length > 150 ? '...' : ''}`);
    
    // Check if it's a volume row
    if (cells.length === 3 && /^\d+$/.test(cells.eq(0).text().trim())) {
      console.log(`  → Volume row! Number: ${cells.eq(0).text().trim()}`);
    }
    
    // Check if it's a chapter row
    if (cells.length <= 2 && text.includes('"')) {
      console.log(`  → Chapter list row!`);
    }
    
    console.log('');
  });
  
  // Check pattern
  console.log('Pattern analysis:');
  let volumeCount = 0;
  let chapterRowCount = 0;
  
  for (let i = 1; i < rows.length; i++) {
    const $row = rows.eq(i);
    const cells = $row.find('td');
    
    if (cells.length === 3 && /^\d+$/.test(cells.eq(0).text().trim())) {
      volumeCount++;
    } else if (cells.length === 1 || cells.length === 2) {
      const text = $row.text();
      if (text.includes('"') && text.includes('.')) {
        chapterRowCount++;
      }
    }
  }
  
  console.log(`Volume rows: ${volumeCount}`);
  console.log(`Chapter list rows: ${chapterRowCount}`);
  console.log(`\nPattern: ${volumeCount > 20 && chapterRowCount > 20 ? 'Alternating volume/chapter rows' : 'Unknown'}`);
}

analyzeCaptainTsubasaDetailed().catch(console.error);