import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

async function debugDragonBall() {
  console.log('Fetching Dragon Ball page...');
  const response = await fetch('https://dragonball.fandom.com/wiki/List_of_Dragon_Ball_manga_chapters');
  const html = await response.text();
  const $ = cheerio.load(html);
  
  console.log('\n=== Analyzing Dragon Ball Tables ===\n');
  
  const tables = $('table');
  console.log(`Total tables found: ${tables.length}\n`);
  
  // Look for the main volume table
  tables.each((i, table) => {
    const $table = $(table);
    const rows = $table.find('tr');
    
    if (rows.length > 10) {
      console.log(`\nTable ${i} (${rows.length} rows):`);
      
      // Check first row headers
      const firstRow = rows.eq(0);
      const headers = firstRow.find('th, td');
      console.log(`Headers: ${headers.length}`);
      headers.each((j, header) => {
        console.log(`  Header ${j}: "${$(header).text().trim()}"`);
      });
      
      // Show a few data rows
      console.log('\nFirst few data rows:');
      rows.slice(1, 4).each((j, row) => {
        const $row = $(row);
        const cells = $row.find('td');
        console.log(`\nRow ${j + 1} (${cells.length} cells):`);
        cells.each((k, cell) => {
          const text = $(cell).text().trim().substring(0, 100);
          console.log(`  Cell ${k}: "${text}${text.length >= 100 ? '...' : ''}"`);
          
          // Check for chapter patterns in this cell
          const chapterMatches = $(cell).text().match(/\d+\.\s+"[^"]+"/g);
          if (chapterMatches) {
            console.log(`    -> Found ${chapterMatches.length} chapters`);
            console.log(`    -> First: ${chapterMatches[0]}`);
          }
        });
      });
      
      if (i >= 1) return false; // Just check first 2 large tables
    }
  });
}

debugDragonBall().catch(console.error);