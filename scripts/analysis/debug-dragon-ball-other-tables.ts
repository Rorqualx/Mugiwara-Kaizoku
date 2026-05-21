import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

async function debugOtherTables() {
  console.log('Fetching Dragon Ball page...');
  const response = await fetch('https://dragonball.fandom.com/wiki/List_of_Dragon_Ball_manga_chapters');
  const html = await response.text();
  const $ = cheerio.load(html);
  
  console.log('\n=== Analyzing Tables 1-3 in Detail ===\n');
  
  const tables = $('table');
  
  // Look at tables 1, 2, and 3
  [1, 2, 3].forEach(tableIndex => {
    if (tableIndex < tables.length) {
      const $table = $(tables[tableIndex]);
      const rows = $table.find('tr');
      
      console.log(`\n📊 Table ${tableIndex} (${rows.length} rows):`);
      console.log(`Class: ${$table.attr('class') || 'none'}`);
      
      // Show structure of first few rows
      rows.slice(0, 5).each((j, row) => {
        const $row = $(row);
        const cells = $row.find('td, th');
        
        console.log(`\nRow ${j} (${cells.length} cells):`);
        cells.each((k, cell) => {
          const text = $(cell).text().trim().substring(0, 80);
          console.log(`  Cell ${k}: "${text}${text.length >= 80 ? '...' : ''}"`);
        });
        
        // Check for volume/chapter content
        const rowText = $row.text();
        if (rowText.includes('Volume') || rowText.match(/\d+\.\s+"[^"]+"/)) {
          console.log('  -> Contains volume or chapter data!');
        }
      });
    }
  });
  
  // Let's also check what comes after the h3 headers
  console.log('\n=== Content After Volume Headers ===');
  $('h3').each((i, header) => {
    const $header = $(header);
    const headerText = $header.text();
    
    if (headerText.includes('Volume') && headerText.includes('to')) {
      console.log(`\n${headerText}`);
      
      // Look for the next table after this header
      let $next = $header.next();
      let distance = 0;
      
      while ($next.length && distance < 5) {
        if ($next.is('table')) {
          const rows = $next.find('tr').length;
          const firstRowCells = $next.find('tr').first().find('td, th').length;
          console.log(`  -> Found table with ${rows} rows, first row has ${firstRowCells} cells`);
          
          // Show first row to understand structure
          const firstRowText = $next.find('tr').first().text().trim().substring(0, 100);
          console.log(`     First row: "${firstRowText}..."`);
          break;
        }
        $next = $next.next();
        distance++;
      }
    }
  });
}

debugOtherTables().catch(console.error);