import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

async function debugOnePieceParsing() {
  try {
    console.log('Fetching One Piece volumes page...');
    const response = await fetch('https://onepiece.fandom.com/wiki/Chapters_and_Volumes/Volumes');
    const html = await response.text();
    
    const $ = cheerio.load(html);
    
    console.log('\\nChecking table pattern matching...\\n');
    
    let matchedTables = 0;
    
    $('table').each((i, table) => {
      const firstRowText = $(table).find('tr').first().text().trim();
      const tableText = $(table).text();
      
      // Check Pattern 5 condition
      if (/^Volume\\s+\\d+/i.test(firstRowText)) {
        console.log(`Table ${i} matches Pattern 5!`);
        console.log(`  First row: "${firstRowText.substring(0, 50)}..."`);
        matchedTables++;
        
        // If this is Volume 1, analyze in detail
        if (firstRowText.includes('Volume 1')) {
          console.log('\\n=== Detailed Volume 1 Analysis ===');
          
          const rows = $(table).find('tr');
          console.log(`Total rows: ${rows.length}`);
          
          rows.each((j, row) => {
            const cells = $(row).find('td');
            const rowText = $(row).text();
            
            console.log(`\\nRow ${j} (${cells.length} cells):`);
            
            // Check specific conditions
            if (rowText.includes('Title') && rowText.includes('Release Date')) {
              console.log('  -> Header row detected');
            }
            
            if (cells.length >= 5) {
              const region = cells.eq(0).text().trim();
              const title = cells.eq(1).text().trim();
              const releaseDate = cells.eq(2).text().trim();
              const pages = cells.eq(3).text().trim();
              const isbn = cells.eq(4).text().trim();
              
              console.log(`  Region: "${region}"`);
              console.log(`  Title: "${title}"`);
              console.log(`  Release Date: "${releaseDate}"`);
              console.log(`  Pages: "${pages}"`);
              console.log(`  ISBN: "${isbn}"`);
            }
            
            if (rowText.includes('Chapters')) {
              console.log('  -> Chapters row detected!');
              const chapterCell = cells.filter((_, cell) => $(cell).text().includes('Chapters')).first();
              
              if (chapterCell.length > 0) {
                console.log('    Found chapter cell');
                
                // Look for list items
                const listItems = chapterCell.find('li');
                console.log(`    List items found: ${listItems.length}`);
                
                if (listItems.length > 0) {
                  console.log('    First 3 list items:');
                  listItems.slice(0, 3).each((k, li) => {
                    console.log(`      ${k}: "${$(li).text().trim()}"`);
                  });
                }
              }
            }
          });
          
          return false; // Stop after Volume 1
        }
      }
    });
    
    console.log(`\\nTotal tables matching Pattern 5: ${matchedTables}`);
    
  } catch (error) {
    console.error('Error:', error);
  }
}

debugOnePieceParsing();