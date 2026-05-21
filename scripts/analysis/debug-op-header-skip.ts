import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

async function debugHeaderSkip() {
  try {
    const response = await fetch('https://onepiece.fandom.com/wiki/Chapters_and_Volumes/Volumes');
    const html = await response.text();
    const $ = cheerio.load(html);
    
    // Find Volume 1
    $('table').each((i, table) => {
      const firstCell = $(table).find('tr').first().find('td').first();
      if (firstCell.text().trim() === 'Volume 1') {
        console.log('Processing Volume 1 table...');
        
        const rows = $(table).find('tr');
        console.log(`Total rows: ${rows.length}\\n`);
        
        // Process each row
        rows.each((rowIndex, row) => {
          const cells = $(row).find('td');
          const rowText = $(row).text();
          
          console.log(`\\nRow ${rowIndex}:`);
          console.log(`  Text preview: "${rowText.substring(0, 60).replace(/\\n/g, ' ')}..."`);
          console.log(`  Cell count: ${cells.length}`);
          
          // Check skip conditions
          const skipCondition1 = rowText.includes('Volume');
          const skipCondition2 = rowText.includes('Title') && rowText.includes('Release Date');
          const shouldSkip = skipCondition1 || skipCondition2;
          
          console.log(`  Skip check:`);
          console.log(`    Contains 'Volume': ${skipCondition1}`);
          console.log(`    Contains 'Title' AND 'Release Date': ${skipCondition2}`);
          console.log(`    Should skip: ${shouldSkip}`);
          
          if (!shouldSkip && cells.length >= 4) {
            console.log('  -> This row would be processed as data');
            
            if (rowIndex === 2) {
              console.log('     Would be treated as Japan row');
              console.log(`     Title would be: "${cells.eq(0).text().trim()}"`);
            } else if (rowIndex === 3) {
              console.log('     Would be treated as US row');
              console.log(`     Title would be: "${cells.eq(0).text().trim()}"`);
            }
          }
        });
        
        return false;
      }
    });
    
  } catch (error) {
    console.error('Error:', error);
  }
}

debugHeaderSkip();