import fetch from 'node-fetch';
import * as cheerio from 'cheerio';
import { parseVolumeTables } from '../src/api/metadataProviders/utils/fandomTableParser';

async function debugDemonSlayerPattern() {
  console.log('Fetching Demon Slayer page...');
  const response = await fetch('https://kimetsu-no-yaiba.fandom.com/wiki/Chapters_and_Volumes');
  const html = await response.text();
  const $ = cheerio.load(html);
  
  console.log('\n=== Looking for Demon Slayer Pattern ===\n');
  
  // Pattern analysis
  console.log('Pattern characteristics:');
  console.log('- Each volume is a separate table');
  console.log('- Tables have volume number in first cell of data row');
  console.log('- Header row has "#", "Japanese", "English"');
  console.log('- Sub-header has "Release date", "ISBN", "Release date", "ISBN"');
  console.log('- Chapter list in row after volume data\n');
  
  // Count tables with this pattern
  let patternCount = 0;
  const tables = $('table');
  
  tables.each((i, table) => {
    const $table = $(table);
    const rows = $table.find('tr');
    
    if (rows.length >= 3) {
      const firstRow = rows.eq(0);
      const headerCells = firstRow.find('th, td');
      
      if (headerCells.length >= 3) {
        const cell0 = headerCells.eq(0).text().trim();
        const cell1 = headerCells.eq(1).text().trim();
        const cell2 = headerCells.eq(2).text().trim();
        
        if (cell0 === '#' && cell1 === 'Japanese' && cell2 === 'English') {
          patternCount++;
          
          // Get volume number from data row
          const dataRow = rows.eq(2);
          const volumeNumber = dataRow.find('td').first().text().trim();
          
          console.log(`\nTable ${i} - Volume ${volumeNumber}:`);
          
          // Look for chapters
          rows.slice(3).each((j, row) => {
            const rowText = $(row).text();
            if (rowText.includes('Chapter')) {
              console.log(`  Has chapters row: "${rowText.substring(0, 100)}..."`);
            }
          });
        }
      }
    }
  });
  
  console.log(`\nTotal tables with Demon Slayer pattern: ${patternCount}`);
  
  // Test the parser
  console.log('\n=== Testing Parser ===');
  const volumes = parseVolumeTables(html);
  console.log(`Volumes parsed: ${volumes.length}`);
  
  if (volumes.length > 0) {
    console.log('\nFirst 3 volumes:');
    volumes.slice(0, 3).forEach(vol => {
      console.log(`  Volume ${vol.volumeNumber}: ${vol.chapters.length} chapters`);
      if (vol.chapters.length > 0) {
        console.log(`    First chapter: ${vol.chapters[0].chapterNumber} - ${vol.chapters[0].title}`);
      }
    });
  }
  
  // Let's manually parse one table to understand the structure
  console.log('\n=== Manual Parse of First Table ===');
  const firstTable = tables.first();
  const rows = firstTable.find('tr');
  
  console.log(`Total rows: ${rows.length}`);
  rows.each((i, row) => {
    const $row = $(row);
    const cells = $row.find('td, th');
    console.log(`Row ${i}: ${cells.length} cells - "${$row.text().substring(0, 80).replace(/\s+/g, ' ')}..."`);
  });
}

debugDemonSlayerPattern().catch(console.error);