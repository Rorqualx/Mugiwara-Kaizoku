import { parseVolumeTables } from '../src/api/metadataProviders/utils/fandomTableParser';
import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

// Import detection functions
function detectDragonBallStyleTable($: cheerio.CheerioAPI, table: cheerio.Cheerio<any>): boolean {
  const headers = table.find('th');
  const firstRow = table.find('tr').first();
  const headerTexts = firstRow.find('th').map((_, h) => $(h).text().trim().toLowerCase()).get();
  
  // Check for Dragon Ball style headers
  const hasNumberHeader = headerTexts.some(h => h === '#' || h === 'no.' || h === 'volume');
  const hasJapaneseHeader = headerTexts.some(h => h.includes('japanese'));
  const hasEnglishHeader = headerTexts.some(h => h.includes('english'));
  
  // Must have volume rows with chapters beneath
  if (hasNumberHeader && hasJapaneseHeader && hasEnglishHeader) {
    // Check if there are chapter listings
    const rows = table.find('tr');
    for (let i = 1; i < Math.min(rows.length, 5); i++) {
      const row = rows.eq(i);
      const cellText = row.text();
      if (cellText.match(/\d+\.\s+"[^"]+"/)) {
        return true;
      }
    }
  }
  
  return false;
}

async function debugDrStone() {
  const url = 'https://dr-stone.fandom.com/wiki/Chapters_and_Volumes';
  console.log('Debugging Dr. Stone parser...\n');
  
  const response = await fetch(url);
  const html = await response.text();
  const $ = cheerio.load(html);
  
  // Check each table
  const tables = $('table');
  
  tables.each((i, table) => {
    const $table = $(table);
    console.log(`\nTable ${i}:`);
    
    // Test Dragon Ball style detection
    const isDragonBallStyle = detectDragonBallStyleTable($, $table);
    console.log(`  Dragon Ball style detected: ${isDragonBallStyle}`);
    
    // Check table structure
    const headers = $table.find('tr').first().find('th');
    const headerTexts = headers.map((_, h) => $(h).text().trim()).get();
    console.log(`  Headers: ${headerTexts.join(' | ')}`);
    
    // Check first data rows
    const rows = $table.find('tr');
    for (let j = 1; j <= Math.min(3, rows.length - 1); j++) {
      const row = rows.eq(j);
      const cells = row.find('td');
      
      console.log(`  Row ${j}: ${cells.length} cells`);
      
      if (cells.length > 0) {
        const firstCellText = cells.eq(0).text().trim();
        console.log(`    First cell: "${firstCellText.substring(0, 50)}${firstCellText.length > 50 ? '...' : ''}"`);
        
        // Check for chapter pattern
        const hasChapters = firstCellText.match(/\d+\.\s+"[^"]+"/);
        if (hasChapters) {
          console.log(`    ✓ Contains chapters!`);
        }
      }
    }
  });
  
  // Try parsing
  console.log('\n=== Parsing Result ===');
  const volumes = parseVolumeTables(html);
  console.log(`Volumes parsed: ${volumes.length}`);
  
  if (volumes.length === 0) {
    console.log('\nNo volumes parsed. The pattern might not be implemented yet.');
  }
}

debugDrStone().catch(console.error);