import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

// Copy the detect function to test it
function detectMultiVolumeListTable($: cheerio.CheerioAPI, table: cheerio.Cheerio<any>): boolean {
  const tableText = table.text();
  const rows = table.find('tr');
  
  console.log('Running multi-volume detection...');
  console.log(`  Table text length: ${tableText.length}`);
  console.log(`  Row count: ${rows.length}`);
  console.log(`  Has "Chapters list:": ${tableText.includes('Chapters list:')}`);
  
  // Pattern 1: My Hero Academia style - large table with "Volume X" rows and "Chapters list:" rows
  if (tableText.includes('Chapters list:') && rows.length > 50) {
    console.log('  -> Checking MHA pattern...');
    let volumeCount = 0;
    rows.each((_, row) => {
      const firstCellText = $(row).find('td').first().text().trim();
      if (/^Volume\s+\d+$/.test(firstCellText)) {
        volumeCount++;
      }
    });
    console.log(`     Volume count: ${volumeCount}`);
    if (volumeCount > 5) {
      console.log('     -> MHA PATTERN MATCHED!');
      return true;
    }
  }
  
  return false;
}

async function debugMHAFull() {
  const response = await fetch('https://myheroacademia.fandom.com/wiki/Chapters_and_Volumes');
  const html = await response.text();
  const $ = cheerio.load(html);
  
  console.log('Testing all tables:\n');
  
  $('table').each((i, table) => {
    const $table = $(table);
    console.log(`\nTable ${i}:`);
    const matches = detectMultiVolumeListTable($, $table);
    console.log(`Result: ${matches ? 'MATCHED' : 'no match'}`);
  });
}

debugMHAFull().catch(console.error);