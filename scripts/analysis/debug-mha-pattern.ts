import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

async function debugPattern() {
  const response = await fetch('https://myheroacademia.fandom.com/wiki/Chapters_and_Volumes');
  const html = await response.text();
  const $ = cheerio.load(html);
  
  // Get the main table (table 3)
  const mainTable = $('table').eq(3);
  const tableText = mainTable.text();
  const rows = mainTable.find('tr');
  
  console.log('Pattern detection checks for MHA main table:');
  console.log(`  Row count: ${rows.length}`);
  console.log(`  Has "Chapters list:": ${tableText.includes('Chapters list:')}`);
  console.log(`  Has "Volume": ${tableText.includes('Volume')}`);
  console.log(`  Has "ISBN": ${tableText.includes('ISBN')}`);
  
  // Count volume rows
  let volumeCount = 0;
  rows.each((_, row) => {
    const firstCellText = $(row).find('td').first().text().trim();
    if (/^Volume\s+\d+$/.test(firstCellText)) {
      volumeCount++;
    }
  });
  console.log(`  Volume rows found: ${volumeCount}`);
  
  // Check individual volume pattern
  const firstCell = mainTable.find('tr').first().find('td, th').first();
  const firstCellText = firstCell.text().trim();
  console.log(`\nFirst cell text: "${firstCellText}"`);
  console.log(`  Matches "Volume X": ${/^Volume\s+\d+$/.test(firstCellText)}`);
  
  // Check multi-volume pattern
  console.log('\nMulti-volume pattern checks:');
  console.log(`  rows.length > 50: ${rows.length > 50}`);
  console.log(`  volumeCount > 5: ${volumeCount > 5}`);
  console.log(`  Should match multi-volume: ${tableText.includes('Chapters list:') && rows.length > 50 && volumeCount > 5}`);
}

debugPattern().catch(console.error);