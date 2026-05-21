import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

async function debugTokyoRevengersPattern() {
  try {
    console.log('Fetching Tokyo Revengers chapters page...');
    const response = await fetch('https://tokyorevengers.fandom.com/wiki/Volumes_%26_Chapters');
    const html = await response.text();
    
    const $ = cheerio.load(html);
    
    console.log('\nChecking pattern matching for tables...\n');
    
    $('table').each((i, table) => {
      const tableText = $(table).text();
      
      // Check our patterns
      const hasChapters = tableText.includes('Chapters:') || 
                         tableText.includes('Chapters list:') || 
                         tableText.includes('Chapter list:') || 
                         tableText.includes('Chapter List:');
      
      const hasISBN = tableText.includes('ISBN');
      
      const firstCell = $(table).find('td').first();
      const firstCellText = firstCell.text().trim();
      const isNumeric = /^\d+$/.test(firstCellText);
      
      if (hasChapters || hasISBN) {
        console.log(`Table ${i}:`);
        console.log(`  Has "Chapters:": ${hasChapters}`);
        console.log(`  Has "ISBN": ${hasISBN}`);
        console.log(`  First cell: "${firstCellText}"`);
        console.log(`  First cell is numeric: ${isNumeric}`);
        console.log(`  Should match pattern: ${hasChapters && hasISBN}`);
        
        // Check if this is the issue
        if (hasChapters && hasISBN) {
          console.log('  ✅ This table should be parsed!');
          
          // Try parsing it
          const volumeNumber = parseInt(firstCellText);
          if (!isNaN(volumeNumber) && volumeNumber >= 1 && volumeNumber <= 50) {
            console.log(`  Volume number would be: ${volumeNumber}`);
          } else {
            console.log('  ❌ Volume number extraction failed');
            
            // Look for volume number in other cells
            const cells = $(table).find('td');
            cells.each((j, cell) => {
              const text = $(cell).text().trim();
              const num = parseInt(text);
              if (!isNaN(num) && num >= 1 && num <= 50 && j < 5) {
                console.log(`    Found potential volume number in cell ${j}: ${num}`);
              }
            });
          }
        }
        
        console.log('');
      }
    });
    
  } catch (error) {
    console.error('Error:', error);
  }
}

debugTokyoRevengersPattern();