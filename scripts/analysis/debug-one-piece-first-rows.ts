import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

async function debugFirstRows() {
  try {
    console.log('Fetching One Piece volumes page...');
    const response = await fetch('https://onepiece.fandom.com/wiki/Chapters_and_Volumes/Volumes');
    const html = await response.text();
    
    const $ = cheerio.load(html);
    
    console.log('\\nFirst row of each table that contains "Volume":\\n');
    
    $('table').each((i, table) => {
      const tableText = $(table).text();
      
      if (tableText.includes('Volume') && tableText.includes('ISBN')) {
        const rows = $(table).find('tr');
        const firstRow = rows.first();
        const firstRowText = firstRow.text().trim();
        const firstRowCells = firstRow.find('td, th');
        
        console.log(`Table ${i}:`);
        console.log(`  First row text: "${firstRowText.substring(0, 100)}..."`);
        console.log(`  First row cells: ${firstRowCells.length}`);
        console.log(`  Contains "Volume 1": ${firstRowText.includes('Volume 1')}`);
        console.log(`  Matches /^Volume\\\\s+\\\\d+/: ${/^Volume\\s+\\d+/i.test(firstRowText)}`);
        
        // Show first cell specifically
        if (firstRowCells.length > 0) {
          const firstCellText = firstRowCells.first().text().trim();
          console.log(`  First cell text: "${firstCellText}"`);
          console.log(`  First cell colspan: ${firstRowCells.first().attr('colspan') || '1'}`);
        }
        
        // Check if it's a single cell spanning the whole row
        if (firstRowCells.length === 1) {
          const colspan = firstRowCells.first().attr('colspan');
          console.log(`  Single cell with colspan: ${colspan}`);
        }
        
        console.log('');
      }
    });
    
  } catch (error) {
    console.error('Error:', error);
  }
}

debugFirstRows();