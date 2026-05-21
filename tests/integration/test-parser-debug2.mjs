import axios from 'axios';
import * as cheerio from 'cheerio';

async function debugParser() {
  try {
    console.log('Fetching Fire Force volumes page...');
    const response = await axios.get('https://fire-force.fandom.com/wiki/List_of_Volumes');
    
    const $ = cheerio.load(response.data);
    
    // Find first volume table to debug
    const tables = $('table');
    let foundVolume = false;
    
    tables.each((i, table) => {
      if (foundVolume) return;
      
      const $table = $(table);
      const text = $table.text();
      
      // Check if this is Volume 1
      if (text.includes('(Volume 1)')) {
        foundVolume = true;
        console.log('\nFound Volume 1 table. Analyzing structure...\n');
        
        const rows = $table.find('tr');
        console.log(`Table has ${rows.length} rows`);
        
        rows.each((rowIndex, row) => {
          const $row = $(row);
          const cells = $row.find('td');
          
          // Check each cell for "Chapters" text
          cells.each((cellIndex, cell) => {
            const $cell = $(cell);
            const cellText = $cell.text().trim();
            
            if (cellText.includes('Chapters')) {
              console.log(`\nRow ${rowIndex}, Cell ${cellIndex} contains "Chapters"`);
              console.log(`Cell text preview: "${cellText.substring(0, 100)}..."`);
              
              // Look for lists in this cell
              const lists = $cell.find('ul, ol');
              console.log(`Found ${lists.length} list(s) in this cell`);
              
              if (lists.length > 0) {
                const list = lists.first();
                const items = list.find('li');
                console.log(`List has ${items.length} items`);
                
                // Check first 3 items
                items.slice(0, 3).each((itemIndex, li) => {
                  const $li = $(li);
                  const text = $li.text().trim();
                  const link = $li.find('a').first();
                  const href = link.attr('href');
                  
                  console.log(`\n  Item ${itemIndex}:`);
                  console.log(`    Text: "${text.substring(0, 60)}"`);
                  console.log(`    Has link: ${link.length > 0}`);
                  console.log(`    Href: ${href || 'NO HREF'}`);
                });
              }
              
              // Check if there's a next cell with chapter info
              if (cellIndex < cells.length - 1) {
                const nextCell = cells.eq(cellIndex + 1);
                const nextLists = nextCell.find('ul, ol');
                if (nextLists.length > 0) {
                  console.log(`\nNext cell (${cellIndex + 1}) also has ${nextLists.length} list(s)`);
                  const items = nextLists.first().find('li');
                  console.log(`With ${items.length} items`);
                }
              }
            }
          });
        });
      }
    });
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

debugParser();