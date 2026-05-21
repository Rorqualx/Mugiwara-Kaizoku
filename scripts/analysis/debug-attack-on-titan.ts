import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

async function debugAOT() {
  const response = await fetch('https://attackontitan.fandom.com/wiki/List_of_Attack_on_Titan_chapters');
  const html = await response.text();
  const $ = cheerio.load(html);
  
  console.log('Attack on Titan page structure:\n');
  
  // Look for tables
  const tables = $('table');
  console.log(`Found ${tables.length} tables\n`);
  
  // Check first few tables
  tables.slice(0, 3).each((i, table) => {
    const $table = $(table);
    const text = $table.text();
    
    console.log(`Table ${i}:`);
    console.log(`  Has "Volume": ${text.includes('Volume')}`);
    console.log(`  Has "Chapter": ${text.includes('Chapter')}`);
    console.log(`  Text preview: "${text.substring(0, 150).replace(/\n/g, ' ')}..."`);
    
    // Check if it matches any patterns
    const firstCell = $table.find('tr').first().find('td, th').first().text().trim();
    console.log(`  First cell: "${firstCell}"`);
    
    // Check for volume pattern
    if (text.includes('Volume') && text.includes('Chapters list:')) {
      console.log('  -> This looks like an Attack on Titan volume table!');
      
      // Look at structure
      const rows = $table.find('tr');
      console.log(`  Rows: ${rows.length}`);
      
      rows.slice(0, 5).each((j, row) => {
        const $row = $(row);
        const cells = $row.find('td');
        console.log(`    Row ${j}: ${cells.length} cells, text: "${$row.text().substring(0, 50).trim()}..."`);
      });
    }
    
    console.log('');
  });
}

debugAOT().catch(console.error);