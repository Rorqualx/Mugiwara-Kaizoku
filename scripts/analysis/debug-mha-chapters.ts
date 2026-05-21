import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

async function debugMHAChapters() {
  const response = await fetch('https://myheroacademia.fandom.com/wiki/Chapters_and_Volumes');
  const html = await response.text();
  const $ = cheerio.load(html);
  
  // Get the main table (table 3)
  const mainTable = $('table').eq(3);
  const rows = mainTable.find('tr');
  
  console.log('Analyzing rows between volumes:\n');
  
  // Look at rows 2-4 (after Volume 1)
  for (let i = 2; i <= 4; i++) {
    const $row = rows.eq(i);
    const cells = $row.find('td');
    const rowText = $row.text();
    
    console.log(`Row ${i}:`);
    console.log(`  Cell count: ${cells.length}`);
    console.log(`  Has colspan: ${$row.find('td[colspan]').length > 0}`);
    console.log(`  Row text preview: "${rowText.substring(0, 100).replace(/\n/g, ' ')}..."`);
    
    if (cells.length === 1) {
      const cell = cells.first();
      const colspan = cell.attr('colspan');
      console.log(`  Single cell with colspan="${colspan}"`);
      
      // Check for list items
      const listItems = cell.find('li');
      console.log(`  Contains ${listItems.length} list items`);
      
      if (listItems.length > 0) {
        console.log('  First 3 list items:');
        listItems.slice(0, 3).each((j, li) => {
          console.log(`    ${j}: "${$(li).text().trim()}"`);
        });
      }
    }
    console.log('');
  }
}

debugMHAChapters().catch(console.error);