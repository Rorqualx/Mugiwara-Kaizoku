import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

async function analyzeKaijuMainTable() {
  console.log('🔍 Analyzing Kaiju No. 8 Main Page Table\n');
  
  const url = 'https://kaiju-no-8.fandom.com/wiki/Kaiju_No._8_(manga)';
  const response = await fetch(url);
  const html = await response.text();
  const $ = cheerio.load(html);
  
  // Find the main table (class="fandom-table")
  const mainTable = $('table.fandom-table').first();
  
  if (mainTable.length === 0) {
    console.log('❌ No fandom-table found!');
    return;
  }
  
  const rows = mainTable.find('tr');
  console.log(`Found table with ${rows.length} rows\n`);
  
  // Analyze headers
  const headerRow = rows.first();
  const headers = headerRow.find('th').map((_, th) => $(th).text().trim()).get();
  console.log('Headers:', headers);
  console.log('');
  
  // Analyze first 10 data rows
  console.log('First 10 data rows:');
  rows.slice(1, 11).each((i, row) => {
    const $row = $(row);
    const cells = $row.find('td');
    
    console.log(`\nRow ${i + 1}:`);
    cells.each((j, cell) => {
      const text = $(cell).text().trim();
      const links = $(cell).find('a');
      
      console.log(`  Cell ${j}: "${text}"`);
      if (links.length > 0) {
        links.each((_, link) => {
          const linkText = $(link).text().trim();
          const href = $(link).attr('href');
          console.log(`    Link: "${linkText}" -> ${href}`);
        });
      }
    });
  });
  
  // Check volume grouping
  console.log('\n\n🔍 Checking for volume grouping...');
  let currentVolume = 0;
  const volumeRows = new Map<number, number>();
  
  rows.slice(1).each((_, row) => {
    const firstCell = $(row).find('td').first().text().trim();
    const volumeMatch = firstCell.match(/^(\d+)$/);
    
    if (volumeMatch) {
      currentVolume = parseInt(volumeMatch[1], 10);
      volumeRows.set(currentVolume, (volumeRows.get(currentVolume) || 0) + 1);
    }
  });
  
  console.log('\nVolumes found:');
  Array.from(volumeRows.entries()).slice(0, 5).forEach(([vol, count]) => {
    console.log(`  Volume ${vol}: ${count} chapters`);
  });
  
  // Check pattern
  console.log('\n📊 Pattern Analysis:');
  console.log('- Table contains all chapters');
  console.log('- First column appears to be volume numbers');
  console.log('- Chapters are listed with titles and release dates');
  console.log('- Links to individual chapter pages');
}

analyzeKaijuMainTable().catch(console.error);