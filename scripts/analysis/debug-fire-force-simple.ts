import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

async function debugSimple() {
  const response = await fetch('https://fire-force.fandom.com/wiki/List_of_Volumes');
  const html = await response.text();
  const $ = cheerio.load(html);
  
  // Look at first table structure
  const firstTable = $('table').first();
  const nestedTable = firstTable.find('table').first();
  
  console.log('Nested table rows:');
  const rows = nestedTable.find('tr');
  
  rows.each((i, row) => {
    const $row = $(row);
    const text = $row.text();
    
    console.log(`\nRow ${i}:`);
    console.log(`  Text includes "Chapter": ${text.includes('Chapter')}`);
    console.log(`  Text preview: "${text.substring(0, 100)}..."`);
    
    if (text.includes('Chapter')) {
      console.log('  This row contains chapters!');
      const cells = $row.children('td, th');
      console.log(`  Number of direct child cells: ${cells.length}`);
      
      cells.each((j, cell) => {
        const $cell = $(cell);
        console.log(`    Cell ${j}:`);
        console.log(`      Has <ul>: ${$cell.find('ul').length > 0}`);
        console.log(`      Has <li>: ${$cell.find('li').length}`);
        console.log(`      Text preview: "${$cell.text().substring(0, 50)}..."`);
      });
    }
  });
}

debugSimple().catch(console.error);