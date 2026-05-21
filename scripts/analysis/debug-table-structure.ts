import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

async function debugTableStructure() {
  console.log('Debugging Fire Force table structure...\n');
  
  const response = await fetch('https://fire-force.fandom.com/wiki/List_of_Volumes');
  const html = await response.text();
  const $ = cheerio.load(html);
  
  // Look at the first table with nested structure
  const firstTable = $('table').first();
  const nestedTable = firstTable.find('table').first();
  
  console.log('Analyzing nested table structure:');
  const rows = nestedTable.find('tr');
  
  rows.each((i, row) => {
    const $row = $(row);
    const cells = $row.find('td, th');
    console.log(`\nRow ${i}: ${cells.length} cells`);
    
    cells.each((j, cell) => {
      const $cell = $(cell);
      const text = $cell.text().trim().substring(0, 50);
      const hasUL = $cell.find('ul').length > 0;
      const liCount = $cell.find('li').length;
      
      console.log(`  Cell ${j}: "${text}..."`);
      if (hasUL) {
        console.log(`    -> Contains <ul> with ${liCount} <li> items`);
        
        // Show first few list items
        $cell.find('li').slice(0, 3).each((k, li) => {
          const liText = $(li).text().trim();
          console.log(`       Li ${k}: "${liText}"`);
        });
      }
    });
  });
}

debugTableStructure().catch(console.error);