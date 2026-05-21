import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

async function analyzeBleachStructure() {
  console.log('🔍 Analyzing Bleach Wiki Structure\n');
  
  const response = await fetch('https://bleach.fandom.com/wiki/Chapters');
  const html = await response.text();
  const $ = cheerio.load(html);
  
  console.log('📊 Table Structure Analysis:');
  
  $('table').each((tableIdx, table) => {
    const $table = $(table);
    const rows = $table.find('tr');
    
    console.log(`\n━━━ Table ${tableIdx + 1} ━━━`);
    console.log(`Total rows: ${rows.length}`);
    
    // Analyze first few rows to understand structure
    rows.slice(0, 5).each((rowIdx, row) => {
      const $row = $(row);
      const cells = $row.find('td, th');
      
      console.log(`\nRow ${rowIdx + 1}: ${cells.length} cells`);
      
      if (rowIdx === 0) {
        // Header row
        cells.each((cellIdx, cell) => {
          console.log(`  Header ${cellIdx + 1}: "${$(cell).text().trim()}"`);
        });
      } else {
        // Data rows
        const firstCellText = cells.first().text().trim();
        console.log(`  First cell: "${firstCellText}"`);
        
        // Check if this is a volume row
        if (/^\d+$/.test(firstCellText)) {
          console.log(`  ✓ Volume ${firstCellText} detected`);
          
          // Check for chapters in this row
          cells.each((cellIdx, cell) => {
            const cellText = $(cell).text();
            if (cellText.includes('Chapters list:')) {
              console.log(`  📚 Chapters in cell ${cellIdx + 1}:`);
              const chapterText = cellText.replace('Chapters list:', '').trim();
              const chapterLines = chapterText.split('\n').filter(line => line.trim());
              console.log(`     ${chapterLines.length} chapter lines found`);
              
              // Show first 3 chapters
              chapterLines.slice(0, 3).forEach(line => {
                console.log(`     - "${line.trim()}"`);
              });
            }
          });
        }
      }
    });
    
    // Count volume rows in this table
    let volumeCount = 0;
    rows.each((_, row) => {
      const firstCell = $(row).find('td').first();
      const firstCellText = firstCell.text().trim();
      if (/^\d+$/.test(firstCellText)) {
        volumeCount++;
      }
    });
    
    console.log(`\n📈 Summary: ${volumeCount} volumes in this table`);
  });
  
  // Analyze specific pattern
  console.log('\n\n🎯 Pattern Analysis:');
  console.log('Bleach uses a multi-volume table structure where:');
  console.log('- Each table contains ~10 volumes');
  console.log('- Volume number is in the first cell (just a number like "1", "11", "21")');
  console.log('- Chapters are in a cell containing "Chapters list:" followed by chapter listings');
  console.log('- Chapter format: "001. Death & Strawberry", "002. Starter", etc.');
  
  // Sample a full volume row
  const firstTable = $('table').first();
  const volumeRow = firstTable.find('tr').filter((_, row) => {
    const firstCell = $(row).find('td').first();
    return firstCell.text().trim() === '1';
  }).first();
  
  if (volumeRow.length > 0) {
    console.log('\n📖 Sample Volume Row Structure:');
    volumeRow.find('td').each((idx, cell) => {
      const cellText = $(cell).text().trim();
      console.log(`\nCell ${idx + 1}:`);
      if (cellText.length > 200) {
        console.log(`"${cellText.substring(0, 200)}..."`);
      } else {
        console.log(`"${cellText}"`);
      }
    });
  }
}

analyzeBleachStructure().catch(console.error);