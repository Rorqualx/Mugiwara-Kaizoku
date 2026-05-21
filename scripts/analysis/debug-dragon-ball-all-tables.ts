import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

async function debugDragonBallAllTables() {
  console.log('Fetching Dragon Ball page...');
  const response = await fetch('https://dragonball.fandom.com/wiki/List_of_Dragon_Ball_manga_chapters');
  const html = await response.text();
  const $ = cheerio.load(html);
  
  console.log('\n=== Analyzing ALL Dragon Ball Tables ===\n');
  
  const tables = $('table');
  console.log(`Total tables found: ${tables.length}\n`);
  
  // Look for all tables that match the Dragon Ball pattern
  let dragonBallTables = 0;
  let totalVolumes = 0;
  let totalChapters = 0;
  
  tables.each((i, table) => {
    const $table = $(table);
    const firstRow = $table.find('tr').eq(0);
    const headerText = firstRow.text().toLowerCase();
    
    // Check if this is a Dragon Ball volume table
    if (headerText.includes('volume title') && 
        headerText.includes('japanese release') && 
        headerText.includes('english release')) {
      
      dragonBallTables++;
      console.log(`\n📚 Dragon Ball Table ${dragonBallTables} (Table ${i}):`);
      
      // Count volumes in this table
      const rows = $table.find('tr');
      let volumesInTable = 0;
      let chaptersInTable = 0;
      
      rows.each((j, row) => {
        const $row = $(row);
        const cells = $row.find('td, th');
        
        // Volume info row (has 4 cells)
        if (cells.length === 4 && j > 0) {
          const volumeNum = parseInt(cells.eq(0).text().trim(), 10);
          if (!isNaN(volumeNum)) {
            volumesInTable++;
            console.log(`  Volume ${volumeNum}: ${cells.eq(1).text().trim()}`);
          }
        }
        // Chapter row (single cell with chapters)
        else if (cells.length === 1 && j > 0) {
          const chapterMatches = cells.eq(0).text().match(/\d+\.\s+"[^"]+"/g);
          if (chapterMatches) {
            chaptersInTable += chapterMatches.length;
          }
        }
      });
      
      totalVolumes += volumesInTable;
      totalChapters += chaptersInTable;
      console.log(`  -> Contains ${volumesInTable} volumes with ${chaptersInTable} chapters`);
    }
  });
  
  console.log('\n=== SUMMARY ===');
  console.log(`Dragon Ball volume tables found: ${dragonBallTables}`);
  console.log(`Total volumes across all tables: ${totalVolumes}`);
  console.log(`Total chapters across all tables: ${totalChapters}`);
  
  // Check for section headers
  console.log('\n=== Volume Section Headers ===');
  $('h3').each((i, header) => {
    const text = $(header).text();
    if (text.includes('Volume')) {
      console.log(`- ${text}`);
    }
  });
}

debugDragonBallAllTables().catch(console.error);