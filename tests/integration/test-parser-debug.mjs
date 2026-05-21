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
          
          if (cells.length > 0) {
            const firstCell = cells.eq(0).text().trim().substring(0, 50);
            console.log(`Row ${rowIndex}: "${firstCell}" (${cells.length} cells)`);
            
            // Look for Chapters row
            if (firstCell === 'Chapters') {
              console.log('  -> This is the Chapters row!');
              
              const chapterCell = cells.eq(1);
              console.log(`  -> Chapter cell HTML length: ${chapterCell.html()?.length || 0}`);
              
              // Look for lists
              const lists = chapterCell.find('ul, ol');
              console.log(`  -> Found ${lists.length} list(s)`);
              
              if (lists.length > 0) {
                const list = lists.first();
                const items = list.find('li');
                console.log(`  -> List has ${items.length} items`);
                
                // Check first 3 items
                items.slice(0, 3).each((itemIndex, li) => {
                  const $li = $(li);
                  const text = $li.text().trim();
                  const link = $li.find('a').first();
                  const href = link.attr('href');
                  
                  console.log(`\n     Item ${itemIndex}:`);
                  console.log(`       Text: "${text.substring(0, 60)}"`);
                  console.log(`       Has link: ${link.length > 0}`);
                  console.log(`       Href: ${href || 'NO HREF'}`);
                  
                  // Test the regex pattern
                  const chapterMatch = text.match(/^(\d{2,3})\.\s+(.+?)(?:\s*\([^)]+\))?$/);
                  if (chapterMatch) {
                    console.log(`       Regex match: Chapter ${chapterMatch[1]}, Title: "${chapterMatch[2].substring(0, 30)}"`);
                  } else {
                    console.log(`       Regex: NO MATCH`);
                  }
                });
              }
            }
          }
        });
      }
    });
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

debugParser();