import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

async function analyzeMonsterDetailed() {
  console.log('🔍 Analyzing Monster HTML Structure in Detail\n');
  
  const url = 'https://obluda.fandom.com/wiki/List_of_chapters';
  const response = await fetch(url);
  const html = await response.text();
  const $ = cheerio.load(html);
  
  const table = $('table.wikitable').first();
  const rows = table.find('tr');
  
  console.log('First 10 rows HTML analysis:\n');
  
  rows.slice(0, 10).each((i, row) => {
    const $row = $(row);
    const cells = $row.find('td, th');
    
    console.log(`Row ${i}:`);
    console.log(`  Cell count: ${cells.length}`);
    
    cells.each((j, cell) => {
      const $cell = $(cell);
      const isHeader = cell.tagName.toLowerCase() === 'th';
      const colspan = $cell.attr('colspan');
      const text = $cell.text().trim().substring(0, 50);
      
      console.log(`  Cell ${j} (${isHeader ? 'th' : 'td'}${colspan ? `, colspan=${colspan}` : ''}): "${text}..."`);
      
      // Check for volume pattern
      if (colspan && /Volume\s+\d+/i.test($cell.text())) {
        console.log(`    ✓ Volume header detected!`);
      }
      
      // Check for list items
      const listItems = $cell.find('li');
      if (listItems.length > 0) {
        console.log(`    Has ${listItems.length} list items`);
      }
    });
    
    console.log('');
  });
}

analyzeMonsterDetailed().catch(console.error);