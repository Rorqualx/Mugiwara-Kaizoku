import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

async function debugOPMTableStructure() {
  console.log('🔍 Debugging OPM Table Structure\n');
  
  const url = 'https://onepunchman.fandom.com/wiki/Volumes';
  const response = await fetch(url);
  const html = await response.text();
  const $ = cheerio.load(html);
  
  const tables = $('table');
  let volumeCount = 0;
  
  tables.each((i, table) => {
    const $table = $(table);
    const rows = $table.find('tr');
    
    // Skip large tables
    if (rows.length < 2 || rows.length > 10) return;
    
    const text = $table.text();
    if (text.includes('Punch') || text.includes('Chapter list:')) {
      volumeCount++;
      console.log(`\n📊 Volume Table ${volumeCount}:`);
      
      // Check for volume header
      let $prev = $table.prev();
      for (let j = 0; j < 3 && $prev.length; j++) {
        if (/Volume \d+/.test($prev.text())) {
          console.log(`Volume header: ${$prev.text().trim()}`);
          break;
        }
        $prev = $prev.prev();
      }
      
      console.log(`Total rows: ${rows.length}`);
      
      // Examine each row
      rows.each((rowIndex, row) => {
        const $row = $(row);
        const cells = $row.find('td, th');
        const rowText = $row.text().trim().substring(0, 100);
        console.log(`Row ${rowIndex}: ${cells.length} cells - "${rowText}..."`);
        
        // Check if this is the chapter row
        if (rowText.includes('Chapter list:') || rowText.includes('Punch')) {
          console.log('  ^ This is the chapter row!');
          
          // Extract chapters
          const chapterText = cells.first().text();
          const lines = chapterText.split('\n').filter(line => line.trim());
          console.log(`  Found ${lines.length} lines in chapter cell`);
          lines.slice(0, 3).forEach(line => {
            console.log(`    - "${line.trim()}"`);
          });
        }
      });
      
      if (volumeCount >= 3) return false; // Show only first 3
    }
  });
}

debugOPMTableStructure().catch(console.error);