import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

async function debugParserRows() {
  try {
    console.log('Fetching Fire Force volumes page...');
    const response = await fetch('https://fire-force.fandom.com/wiki/List_of_Volumes');
    const html = await response.text();
    
    const $ = cheerio.load(html);
    
    // Find first volume table
    $('table').each((i, table) => {
      const tableText = $(table).text();
      if (tableText.includes('(Volume 1)')) {
        console.log(`\nAnalyzing Volume 1 table structure...`);
        
        // Analyze row structure
        const rows = $(table).find('tr');
        console.log(`Table has ${rows.length} rows\n`);
        
        rows.each((j, row) => {
          const rowText = $(row).text().trim().substring(0, 100);
          const cells = $(row).find('td');
          console.log(`Row ${j}: ${cells.length} cells`);
          console.log(`  Text preview: "${rowText}..."`);
          
          // Check if it has nested tables
          const nestedTables = $(row).find('table');
          if (nestedTables.length > 0) {
            console.log(`  Contains ${nestedTables.length} nested table(s)`);
          }
        });
        
        // Now look for chapters in nested tables
        console.log('\n--- Looking for chapters in nested tables ---');
        $(table).find('table').each((k, nestedTable) => {
          const nestedText = $(nestedTable).text();
          if (nestedText.includes('Chapters')) {
            console.log(`\nNested table ${k} contains chapters!`);
            const nestedRows = $(nestedTable).find('tr');
            console.log(`Has ${nestedRows.length} rows`);
            
            nestedRows.each((l, nestedRow) => {
              const nestedRowText = $(nestedRow).text().trim();
              if (nestedRowText.includes('Chapters') || /\d{2,}\.\s+/.test(nestedRowText)) {
                console.log(`\nChapter row found!`);
                console.log(`Full text: "${nestedRowText}"`);
                
                // Look for list items
                const listItems = $(nestedRow).find('li');
                console.log(`Contains ${listItems.length} list items`);
                
                if (listItems.length > 0) {
                  listItems.slice(0, 3).each((m, li) => {
                    console.log(`  Li ${m}: "${$(li).text().trim()}"`);
                  });
                }
              }
            });
          }
        });
        
        return false; // Stop after first volume
      }
    });
    
  } catch (error) {
    console.error('Error:', error);
  }
}

debugParserRows();