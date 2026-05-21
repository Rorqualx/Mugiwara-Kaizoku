import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

async function debugParserFull() {
  try {
    console.log('Fetching Fire Force volumes page...');
    const response = await fetch('https://fire-force.fandom.com/wiki/List_of_Volumes');
    const html = await response.text();
    
    const $ = cheerio.load(html);
    
    // Find tables with volume pattern
    $('table').each((i, table) => {
      const tableText = $(table).text();
      if (tableText.includes('(Volume 1)')) {
        console.log(`\n=== Processing Volume 1 Table (index ${i}) ===`);
        
        // Check for nested tables
        const nestedTables = $(table).find('table');
        console.log(`Found ${nestedTables.length} nested tables`);
        
        // Process the table directly
        console.log('\n--- Direct rows ---');
        $(table).find('> tbody > tr, > tr').each((j, row) => {
          const rowText = $(row).text().trim().substring(0, 50);
          console.log(`Direct row ${j}: "${rowText}..."`);
        });
        
        // Process nested tables
        if (nestedTables.length > 0) {
          console.log('\n--- Processing nested tables ---');
          nestedTables.each((k, nestedTable) => {
            console.log(`\nNested table ${k}:`);
            $(nestedTable).find('tr').each((l, row) => {
              const rowText = $(row).text().trim();
              if (rowText.includes('Chapters')) {
                console.log(`  Row ${l} contains Chapters!`);
                console.log(`  Full text: "${rowText.substring(0, 200)}..."`);
                
                // Check cells
                const cells = $(row).find('td');
                console.log(`  Has ${cells.length} cells`);
                
                cells.each((m, cell) => {
                  const cellText = $(cell).text().trim();
                  if (cellText.includes('Chapters')) {
                    console.log(`    Cell ${m} contains chapters!`);
                    
                    // Check for list items
                    const listItems = $(cell).find('li');
                    console.log(`    Found ${listItems.length} list items`);
                    
                    if (listItems.length > 0) {
                      console.log('    First 3 chapters:');
                      listItems.slice(0, 3).each((n, li) => {
                        console.log(`      - "${$(li).text().trim()}"`);
                      });
                    }
                  }
                });
              }
            });
          });
        }
        
        return false; // Stop after first volume
      }
    });
    
  } catch (error) {
    console.error('Error:', error);
  }
}

debugParserFull();