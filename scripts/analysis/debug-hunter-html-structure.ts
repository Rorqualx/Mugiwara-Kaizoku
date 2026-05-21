import * as cheerio from 'cheerio';
import fetch from 'node-fetch';

async function debugStructure() {
  const response = await fetch('https://hunterxhunter.fandom.com/wiki/List_of_Volumes_and_Chapters');
  const html = await response.text();
  const $ = cheerio.load(html);
  
  const table = $('table').first();
  const rows = table.find('tr');
  
  console.log('=== HTML Structure Debug ===\n');
  
  // Check rows 3-6 (Volume 1 area)
  for (let i = 3; i <= 6 && i < rows.length; i++) {
    const $row = rows.eq(i);
    console.log(`\nRow ${i}:`);
    console.log(`  HTML: ${$row.html()?.substring(0, 200)}...`);
    
    const cells = $row.find('td');
    console.log(`  Cell count: ${cells.length}`);
    
    if (cells.length > 0) {
      const firstCellHtml = cells.eq(0).html() || '';
      const firstCellText = cells.eq(0).text().trim();
      
      console.log(`  First cell HTML: ${firstCellHtml.substring(0, 100)}...`);
      console.log(`  First cell text: "${firstCellText.substring(0, 50)}..."`);
      
      // Check if it's a volume row
      if (cells.length === 4) {
        const num = parseInt(firstCellText, 10);
        console.log(`  Parsed as number: ${num} (isNaN: ${isNaN(num)})`);
      }
    }
  }
}

debugStructure().catch(console.error);