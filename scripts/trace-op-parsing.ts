import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

async function traceParsing() {
  try {
    const response = await fetch('https://onepiece.fandom.com/wiki/Chapters_and_Volumes/Volumes');
    const html = await response.text();
    const $ = cheerio.load(html);
    
    console.log('Looking for Pattern 5 matches...');
    
    let patternMatches = 0;
    
    $('table').each((i, table) => {
      const firstCell = $(table).find('tr').first().find('td, th').first();
      if (firstCell.length > 0) {
        const cellText = firstCell.text().trim();
        
        // Check if it would match our pattern
        if (/^Volume\s+\d+$/.test(cellText)) {
          patternMatches++;
          console.log(`\\nTable ${i} matches Pattern 5!`);
          console.log(`  First cell text: "${cellText}"`);
          
          // Show what would be parsed
          const rows = $(table).find('tr');
          console.log(`  Row count: ${rows.length}`);
          
          // Check row 1 (should be header)
          const row1 = rows.eq(1);
          console.log(`  Row 1 text: "${row1.text().substring(0, 50)}..."`);
          
          // Check if row 1 is being parsed as data
          const row1Cells = row1.find('td');
          if (row1Cells.length === 1) {
            console.log('  Row 1 has 1 cell - this is the header row');
          }
          
          // Check row 2
          const row2 = rows.eq(2);
          const row2Cells = row2.find('td');
          console.log(`  Row 2 has ${row2Cells.length} cells`);
          if (row2Cells.length === 4) {
            console.log(`    Cell 0: "${row2Cells.eq(0).text().trim()}"`);
          }
        }
      }
    });
    
    console.log(`\\nTotal tables matching Pattern 5: ${patternMatches}`);
    
  } catch (error) {
    console.error('Error:', error);
  }
}

traceParsing();