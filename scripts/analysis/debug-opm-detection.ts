import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

async function debugOPMDetection() {
  console.log('🔍 Debugging OPM Pattern Detection\n');
  
  const url = 'https://onepunchman.fandom.com/wiki/Volumes';
  const response = await fetch(url);
  const html = await response.text();
  const $ = cheerio.load(html);
  
  const tables = $('table');
  console.log(`Total tables: ${tables.length}`);
  
  // Check small tables
  const smallTables = tables.filter((_, table) => {
    const rows = $(table).find('tr').length;
    return rows >= 2 && rows <= 10;
  });
  
  console.log(`Small tables (2-10 rows): ${smallTables.length}`);
  console.log(`Passes size check (>=15): ${smallTables.length >= 15}\n`);
  
  // Check pattern matching
  let volumeTableCount = 0;
  
  console.log('Checking first 5 small tables:');
  smallTables.slice(0, 5).each((i, table) => {
    const $table = $(table);
    const text = $table.text();
    
    console.log(`\nTable ${i + 1}:`);
    console.log(`  Contains "Punch": ${text.includes('Punch')}`);
    
    if (text.includes('Punch')) {
      // Check first cell
      const firstDataRow = $table.find('tr').eq(2);
      const firstCell = firstDataRow.find('td').first().text().trim();
      console.log(`  First data cell: "${firstCell}"`);
      console.log(`  Is number: ${/^\d+$/.test(firstCell)}`);
      
      if (/^\d+$/.test(firstCell)) {
        volumeTableCount++;
        console.log(`  ✓ Counted as volume table (method 1)`);
      } else {
        // Check preceding element
        let $prev = $table.prev();
        console.log(`  Checking preceding elements:`);
        
        for (let j = 0; j < 3 && $prev.length; j++) {
          const prevText = $prev.text();
          console.log(`    Prev ${j + 1}: <${$prev.prop('tagName')}> "${prevText.substring(0, 50)}..."`);
          
          if (/Volume \d+/.test(prevText)) {
            volumeTableCount++;
            console.log(`    ✓ Counted as volume table (method 2)`);
            break;
          }
          $prev = $prev.prev();
        }
      }
    }
  });
  
  console.log(`\nVolume table count: ${volumeTableCount}`);
  console.log(`Passes volume check (>=3): ${volumeTableCount >= 3}`);
  console.log(`\nShould detect OPM pattern: ${smallTables.length >= 15 && volumeTableCount >= 3}`);
}

debugOPMDetection().catch(console.error);