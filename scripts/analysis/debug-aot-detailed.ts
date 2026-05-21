import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

async function debugAOTDetailed() {
  console.log('Fetching Attack on Titan page...');
  const response = await fetch('https://attackontitan.fandom.com/wiki/List_of_Attack_on_Titan_chapters');
  const html = await response.text();
  const $ = cheerio.load(html);
  
  // Find first volume table
  const tables = $('table');
  let foundTable = false;
  
  tables.each((i, table) => {
    const $table = $(table);
    const tableText = $table.text();
    
    if (tableText.includes('Chapters list:') && tableText.includes('ISBN') && !foundTable) {
      foundTable = true;
      console.log('\n=== Analyzing First Volume Table ===\n');
      
      const rows = $table.find('tr');
      const chapterRow = rows.eq(3); // Chapter row is index 3
      const chapterCell = chapterRow.find('td').first();
      
      console.log('Chapter cell HTML:');
      console.log(chapterCell.html());
      console.log('\n');
      
      // Test ordered list detection
      const orderedList = chapterCell.find('ol');
      console.log(`Ordered list found: ${orderedList.length > 0}`);
      
      if (orderedList.length > 0) {
        console.log(`Start attribute: "${orderedList.attr('start')}"`);
        console.log(`Parsed start number: ${parseInt(orderedList.attr('start') || '1', 10)}`);
        
        const listItems = orderedList.find('li');
        console.log(`List items found: ${listItems.length}`);
        
        listItems.each((index, li) => {
          const $li = $(li);
          const link = $li.find('a').first();
          const title = link.length > 0 ? link.text().trim() : $li.text().trim();
          console.log(`  Item ${index}: "${title}"`);
        });
      }
      
      return false;
    }
  });
  
  // Now test the actual parser function
  console.log('\n=== Testing parseAttackOnTitanStyleTable ===\n');
  
  // Copy the detection logic
  tables.each((i, table) => {
    const $table = $(table);
    const tableText = $table.text();
    const rows = $table.find('tr');
    
    if (tableText.includes('Chapters list:') && rows.length >= 3 && rows.length < 10) {
      const volumeRow = rows.eq(2).text();
      if (/^\d+/.test(volumeRow.trim())) {
        console.log(`Table ${i} detected as Attack on Titan style`);
        
        // Test if it would trigger multi-volume-list detection
        console.log(`Row count: ${rows.length}`);
        console.log(`Would trigger multi-volume? ${rows.length > 50}`);
        
        return false;
      }
    }
  });
}

debugAOTDetailed().catch(console.error);