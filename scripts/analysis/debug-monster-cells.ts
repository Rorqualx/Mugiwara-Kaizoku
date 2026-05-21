import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

async function debugMonsterCells() {
  console.log('🔍 Debugging Monster Cell Structure\n');
  
  const url = 'https://obluda.fandom.com/wiki/List_of_chapters';
  const response = await fetch(url);
  const html = await response.text();
  const $ = cheerio.load(html);
  
  const table = $('table.wikitable').first();
  const rows = table.find('tr');
  
  // Look at rows 0-10 in detail
  rows.slice(0, 10).each((i, row) => {
    const $row = $(row);
    const cells = $row.find('td, th');
    
    console.log(`\nRow ${i}: ${cells.length} cells`);
    
    cells.each((j, cell) => {
      const $cell = $(cell);
      const isHeader = cell.tagName.toLowerCase() === 'th';
      const colspan = $cell.attr('colspan');
      const text = $cell.text().trim().substring(0, 50);
      
      console.log(`  Cell ${j} (${isHeader ? 'th' : 'td'}${colspan ? `, colspan=${colspan}` : ''}):`);
      console.log(`    Text: "${text}..."`);
      
      // Check for list items
      const listItems = $cell.find('li');
      if (listItems.length > 0) {
        console.log(`    ✅ Has ${listItems.length} <li> items`);
        
        // Show first 2 items
        listItems.slice(0, 2).each((k, li) => {
          const liText = $(li).text().trim();
          console.log(`      - "${liText.substring(0, 40)}..."`);
        });
      }
      
      // Check if it's a chapter cell but no li tags
      if (text.includes('Chapter') && listItems.length === 0) {
        console.log(`    ⚠️  Has chapters but no <li> tags`);
        
        // Check the HTML
        const html = $cell.html();
        if (html) {
          const hasUl = html.includes('<ul');
          const hasBr = html.includes('<br');
          console.log(`    HTML contains: ${hasUl ? '<ul>' : ''} ${hasBr ? '<br>' : ''}`);
        }
      }
    });
  });
}

debugMonsterCells().catch(console.error);