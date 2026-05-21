import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

async function debugOPMTables() {
  console.log('🔍 Debugging One Punch Man Tables\n');
  
  const url = 'https://onepunchman.fandom.com/wiki/Volumes';
  const response = await fetch(url);
  const html = await response.text();
  const $ = cheerio.load(html);
  
  const tables = $('table');
  console.log(`Total tables: ${tables.length}`);
  
  // Analyze table sizes
  const tableSizes: { [key: string]: number } = {};
  tables.each((_, table) => {
    const rows = $(table).find('tr').length;
    const key = `${rows} rows`;
    tableSizes[key] = (tableSizes[key] || 0) + 1;
  });
  
  console.log('\nTable size distribution:');
  Object.entries(tableSizes).forEach(([size, count]) => {
    console.log(`  ${size}: ${count} tables`);
  });
  
  // Look at first few tables in detail
  console.log('\n📊 First 3 tables analysis:');
  
  tables.slice(0, 3).each((i, table) => {
    const $table = $(table);
    const rows = $table.find('tr');
    const text = $table.text();
    
    console.log(`\nTable ${i + 1}:`);
    console.log(`  Rows: ${rows.length}`);
    console.log(`  Contains "Volume": ${text.includes('Volume')}`);
    console.log(`  Contains "Punch": ${text.includes('Punch')}`);
    console.log(`  First 100 chars: "${text.trim().substring(0, 100)}..."`);
    
    // Check row structure
    rows.slice(0, 3).each((j, row) => {
      const cells = $(row).find('td, th');
      console.log(`  Row ${j + 1}: ${cells.length} cells`);
      
      // Show cell contents
      cells.each((k, cell) => {
        const cellText = $(cell).text().trim();
        if (cellText.length > 0 && cellText.length < 50) {
          console.log(`    Cell ${k + 1}: "${cellText}"`);
        }
      });
    });
    
    // Look for volume pattern specifically
    const volumeMatch = text.match(/Volume (\d+)/);
    if (volumeMatch) {
      console.log(`  ✓ Volume ${volumeMatch[1]} detected`);
      
      // Look for chapter patterns
      const punchMatches = [...text.matchAll(/Punch (\d+)/g)];
      console.log(`  Punch chapters found: ${punchMatches.length}`);
      if (punchMatches.length > 0) {
        console.log(`  First few: ${punchMatches.slice(0, 3).map(m => `Punch ${m[1]}`).join(', ')}`);
      }
    }
  });
  
  // Check specific volume table pattern
  console.log('\n🔍 Checking for volume pattern in small tables:');
  
  const smallTables = tables.filter((_, table) => {
    const rows = $(table).find('tr').length;
    return rows >= 2 && rows <= 10;
  });
  
  console.log(`Small tables (2-10 rows): ${smallTables.length}`);
  
  let volumeCount = 0;
  smallTables.each((_, table) => {
    const text = $(table).text();
    if (/Volume \d+/.test(text)) {
      volumeCount++;
    }
  });
  
  console.log(`Small tables with "Volume X": ${volumeCount}`);
}

debugOPMTables().catch(console.error);