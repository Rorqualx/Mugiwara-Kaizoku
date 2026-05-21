import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

async function debugChainsawManStructure() {
  console.log('🔍 Debugging Chainsaw Man Structure\n');
  
  const url = 'https://chainsaw-man.fandom.com/wiki/Chapters_and_Volumes';
  const response = await fetch(url);
  const html = await response.text();
  const $ = cheerio.load(html);
  
  const tables = $('table');
  console.log(`Total tables: ${tables.length}\n`);
  
  // Count tables by row count
  const rowCounts: Record<number, number> = {};
  tables.each((_, table) => {
    const rows = $(table).find('tr').length;
    rowCounts[rows] = (rowCounts[rows] || 0) + 1;
  });
  
  console.log('Tables by row count:');
  Object.entries(rowCounts).forEach(([rows, count]) => {
    console.log(`  ${rows} rows: ${count} tables`);
  });
  
  // Check 2-row tables specifically
  console.log('\n📋 Examining 2-row tables:');
  let volumeTableCount = 0;
  
  tables.each((i, table) => {
    const $table = $(table);
    const rows = $table.find('tr').length;
    
    if (rows === 2) {
      const text = $table.text();
      const hasVolume = text.includes('Volume');
      const hasChaptersList = text.includes('Chapters list:');
      
      if (hasVolume && hasChaptersList) {
        volumeTableCount++;
        if (volumeTableCount <= 3) {
          console.log(`\nVolume table ${volumeTableCount}:`);
          console.log(`  Text preview: ${text.substring(0, 200).replace(/\s+/g, ' ')}...`);
          
          // Check first row structure
          const firstRow = $table.find('tr').first();
          const firstRowCells = firstRow.find('td');
          console.log(`  First row cells: ${firstRowCells.length}`);
          
          if (firstRowCells.length > 0) {
            console.log(`  First cell: ${firstRowCells.eq(0).text().trim()}`);
          }
        }
      }
    }
  });
  
  console.log(`\nTotal volume tables found: ${volumeTableCount}`);
  
  // Also check if there's a header table
  tables.each((i, table) => {
    const $table = $(table);
    const text = $table.text();
    
    if (text.includes('Title') && text.includes('Release date') && text.includes('ISBN')) {
      console.log(`\nFound header table at index ${i}`);
      console.log(`  Rows: ${$table.find('tr').length}`);
    }
  });
}

debugChainsawManStructure().catch(console.error);