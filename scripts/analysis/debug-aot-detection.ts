import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

async function debugDetection() {
  const response = await fetch('https://attackontitan.fandom.com/wiki/List_of_Attack_on_Titan_chapters');
  const html = await response.text();
  const $ = cheerio.load(html);
  
  const firstTable = $('table').first();
  const tableText = firstTable.text();
  const rows = firstTable.find('tr');
  
  console.log('Table detection checks:');
  console.log(`  Has "Chapters list:": ${tableText.includes('Chapters list:')}`);
  console.log(`  Row count: ${rows.length}`);
  
  if (rows.length >= 3) {
    const volumeRow = rows.eq(2).text();
    console.log(`  Row 2 text: "${volumeRow.trim().substring(0, 50)}..."`);
    console.log(`  Starts with number: ${/^\d+/.test(volumeRow.trim())}`);
  }
  
  // Check individual volume pattern
  const firstCell = firstTable.find('tr').first().find('td, th').first();
  const firstCellText = firstCell.text().trim();
  console.log(`\nFirst cell: "${firstCellText}"`);
  console.log(`  Matches Volume X: ${/^Volume\s+\d+$/.test(firstCellText)}`);
  
  // Check for ISBN and Chapters
  console.log(`\nTable contains ISBN: ${tableText.includes('ISBN')}`);
  console.log(`Table contains Chapter: ${tableText.includes('Chapter')}`);
  console.log(`Table contains Volume: ${tableText.includes('Volume')}`);
}

debugDetection().catch(console.error);