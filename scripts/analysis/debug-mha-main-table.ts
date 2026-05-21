import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

async function debugMHAMainTable() {
  const response = await fetch('https://myheroacademia.fandom.com/wiki/Chapters_and_Volumes');
  const html = await response.text();
  const $ = cheerio.load(html);
  
  // Get the main table (table 3)
  const mainTable = $('table').eq(3);
  const rows = mainTable.find('tr');
  
  console.log('My Hero Academia main table structure:\n');
  console.log(`Total rows: ${rows.length}\n`);
  
  // Analyze row patterns
  let volumeRows = 0;
  let chapterRows = 0;
  
  rows.each((i, row) => {
    const $row = $(row);
    const cells = $row.find('td');
    const firstCellText = cells.first().text().trim();
    
    if (firstCellText.startsWith('Volume')) {
      volumeRows++;
      if (volumeRows <= 3) {
        console.log(`Volume row ${volumeRows} (row ${i}): "${firstCellText}"`);
        console.log(`  Cells: ${cells.length}`);
        cells.each((j, cell) => {
          if (j < 3) {
            console.log(`    Cell ${j}: "${$(cell).text().trim().substring(0, 40)}..."`);
          }
        });
        console.log('');
      }
    } else if (firstCellText.match(/^\d+\./)) {
      chapterRows++;
      if (chapterRows <= 3) {
        console.log(`Chapter row ${chapterRows} (row ${i}): "${firstCellText}"`);
        const titleCell = cells.eq(1);
        console.log(`  Title: "${titleCell.text().trim()}"`);
      }
    }
  });
  
  console.log(`\nSummary:`);
  console.log(`  Volume rows: ${volumeRows}`);
  console.log(`  Chapter rows: ${chapterRows}`);
}

debugMHAMainTable().catch(console.error);