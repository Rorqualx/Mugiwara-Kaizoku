import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

async function debugOPMDetectionDetailed() {
  console.log('🔍 Debugging OPM Detection in Detail\n');
  
  const url = 'https://onepunchman.fandom.com/wiki/Volumes';
  const response = await fetch(url);
  const html = await response.text();
  const $ = cheerio.load(html);
  
  const tables = $('table');
  const smallTables = tables.filter((_, table) => {
    const rows = $(table).find('tr').length;
    return rows >= 2 && rows <= 10;
  });
  
  console.log(`Total tables: ${tables.length}`);
  console.log(`Small tables (2-10 rows): ${smallTables.length}`);
  console.log(`Has enough small tables: ${smallTables.length >= 15}\n`);
  
  // Check each small table for patterns
  let volumeTableCount = 0;
  console.log('Checking small tables for volume pattern:');
  
  smallTables.each((i, table) => {
    const $table = $(table);
    const text = $table.text();
    
    if (text.includes('Punch') || text.includes('Chapter list:')) {
      console.log(`\nTable ${i + 1}: Contains pattern`);
      console.log(`  Text preview: ${text.substring(0, 100).replace(/\n/g, ' ')}...`);
      
      // Check if first cell is a number
      const rows = $table.find('tr');
      if (rows.length > 2) {
        const firstDataRow = rows.eq(2);
        const firstCell = firstDataRow.find('td').first().text().trim();
        console.log(`  First data cell: "${firstCell}"`);
        console.log(`  Is number: ${/^\d+$/.test(firstCell)}`);
      }
      
      // Check for preceding volume header
      let $prev = $table.prev();
      let foundVolume = false;
      for (let j = 0; j < 3 && $prev.length; j++) {
        if (/Volume \d+/.test($prev.text())) {
          console.log(`  Found volume header: ${$prev.text().trim()}`);
          foundVolume = true;
          break;
        }
        $prev = $prev.prev();
      }
      
      if (foundVolume || /^\d+$/.test(firstCell)) {
        volumeTableCount++;
        console.log(`  ✓ Counted as volume table (total: ${volumeTableCount})`);
      }
    }
    
    if (volumeTableCount >= 3) {
      return false; // break
    }
  });
  
  console.log(`\nTotal volume tables found: ${volumeTableCount}`);
  console.log(`Pattern should be detected: ${volumeTableCount >= 3}`);
}

debugOPMDetectionDetailed().catch(console.error);