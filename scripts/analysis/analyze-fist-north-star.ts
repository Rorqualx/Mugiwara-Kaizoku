import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

async function analyzeFistNorthStar() {
  console.log('🔍 Analyzing Fist of the North Star in Detail\n');
  
  const url = 'https://hokuto.fandom.com/wiki/Hokuto_no_Ken_chapters';
  const response = await fetch(url);
  const html = await response.text();
  const $ = cheerio.load(html);
  
  // Find the main table
  const tables = $('table.wikitable');
  console.log(`Found ${tables.length} wikitables\n`);
  
  if (tables.length > 0) {
    const mainTable = tables.first();
    const rows = mainTable.find('tr');
    
    // Look at volume 1 in detail
    let inVolume1 = false;
    const volume1Rows: any[] = [];
    
    rows.each((i, row) => {
      const $row = $(row);
      const cells = $row.find('td, th');
      const rowText = $row.text();
      
      if (rowText.includes('Volume 1:') && cells.attr('colspan')) {
        inVolume1 = true;
        console.log(`Volume 1 starts at row ${i}`);
      } else if (rowText.includes('Volume 2:') && cells.attr('colspan')) {
        inVolume1 = false;
        console.log(`Volume 1 ends at row ${i}\n`);
      } else if (inVolume1) {
        volume1Rows.push({ index: i, row: $row });
      }
    });
    
    console.log(`Volume 1 chapter rows: ${volume1Rows.length}\n`);
    
    // Analyze each chapter row
    volume1Rows.forEach(({ index, row }) => {
      const cells = row.find('td');
      console.log(`Row ${index} (${cells.length} cells):`);
      
      cells.each((j, cell) => {
        const text = $(cell).text().trim();
        if (j === 0) { // First cell usually has chapter info
          console.log(`  Chapter cell: "${text.substring(0, 60)}..."`);
          
          // Look for all chapters in this cell
          const chapterMatches = text.match(/\d{3}\.\s*[^)]+(?:\)|$)/g);
          if (chapterMatches) {
            console.log(`  Found ${chapterMatches.length} chapters in cell:`);
            chapterMatches.forEach(ch => {
              console.log(`    - ${ch.substring(0, 50)}${ch.length > 50 ? '...' : ''}`);
            });
          }
        }
      });
    });
    
    // Check how chapters are separated
    console.log('\n🔍 Checking chapter separation:');
    const sampleCell = volume1Rows[0]?.row.find('td').first();
    if (sampleCell) {
      const cellHtml = sampleCell.html();
      console.log('Cell HTML structure:');
      console.log(cellHtml?.substring(0, 200) + '...');
      
      // Check for line breaks
      const hasBreaks = cellHtml?.includes('<br');
      const hasLists = cellHtml?.includes('<li');
      console.log(`\nHas <br> tags: ${hasBreaks}`);
      console.log(`Has list items: ${hasLists}`);
    }
  }
}

analyzeFistNorthStar().catch(console.error);