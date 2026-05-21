import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

async function debugOPMPatternOrder() {
  console.log('🔍 Debugging OPM Pattern Detection Order\n');
  
  const url = 'https://onepunchman.fandom.com/wiki/Volumes';
  const response = await fetch(url);
  const html = await response.text();
  const $ = cheerio.load(html);
  
  // Check gallery-based layout
  console.log('1. Gallery-based layout:');
  const galleries = $('.wikia-gallery, .gallery');
  console.log(`   Galleries found: ${galleries.length}`);
  console.log(`   ✗ Not detected\n`);
  
  // Check JoJo alternating
  console.log('2. JoJo alternating pattern:');
  const tables = $('table');
  const smallTables = tables.filter((_, table) => {
    const rows = $(table).find('tr').length;
    return rows >= 3 && rows <= 10;
  });
  console.log(`   Small tables: ${smallTables.length}`);
  
  let hasAlternatingPattern = false;
  smallTables.slice(0, 10).each((i, table, list) => {
    if (i % 2 === 0 && i + 1 < list.length) {
      const volumeTable = $(table);
      const chapterTable = $(list[i + 1]);
      
      const volumeText = volumeTable.text();
      const chapterText = chapterTable.text();
      
      if (/Volume \d+/.test(volumeText) && (chapterText.includes('Chapter') || chapterText.includes('#'))) {
        hasAlternatingPattern = true;
      }
    }
  });
  console.log(`   Has alternating: ${hasAlternatingPattern}`);
  console.log(`   ✗ Not detected\n`);
  
  // Check collapsible navigation
  console.log('3. Collapsible navigation:');
  const collapsibles = $('.mw-collapsible, .collapsible, .toccolours');
  console.log(`   Collapsibles found: ${collapsibles.length}`);
  console.log(`   ✗ Not detected\n`);
  
  // Check Kaiju pattern
  console.log('4. Kaiju No. 8 pattern:');
  const fandomTable = $('table.fandom-table');
  console.log(`   Fandom tables: ${fandomTable.length}`);
  console.log(`   ✗ Not detected\n`);
  
  // Check OPM pattern
  console.log('5. One Punch Man pattern:');
  console.log(`   Small tables (2-10 rows): ${smallTables.length}`);
  console.log(`   Has 15+ small tables: ${smallTables.length >= 15}`);
  
  let volumeTableCount = 0;
  smallTables.slice(0, 5).each((_, table) => {
    const $table = $(table);
    const text = $table.text();
    
    if (text.includes('Punch')) {
      const firstDataRow = $table.find('tr').eq(2);
      const firstCell = firstDataRow.find('td').first().text().trim();
      
      if (/^\d+$/.test(firstCell)) {
        volumeTableCount++;
      } else {
        let $prev = $table.prev();
        for (let i = 0; i < 3 && $prev.length; i++) {
          if (/Volume \d+/.test($prev.text())) {
            volumeTableCount++;
            break;
          }
          $prev = $prev.prev();
        }
      }
    }
  });
  
  console.log(`   Volume table count: ${volumeTableCount}`);
  console.log(`   Has 3+ volume tables: ${volumeTableCount >= 3}`);
  console.log(`   ${volumeTableCount >= 3 && smallTables.length >= 15 ? '✓ Should be detected!' : '✗ Not detected'}\n`);
  
  // Check single large table
  console.log('6. Single large table:');
  let hasLargeTable = false;
  tables.each((_, table) => {
    const rows = $(table).find('tr').length;
    if (rows > 20) {
      hasLargeTable = true;
    }
  });
  console.log(`   Has large table (20+ rows): ${hasLargeTable}`);
  
  // The issue might be here!
  if (hasLargeTable) {
    const largeTable = tables.filter((_, table) => $(table).find('tr').length > 20).first();
    const largeTableText = largeTable.text();
    console.log(`   Large table contains "Volume": ${largeTableText.includes('Volume')}`);
    console.log(`   Large table contains "Punch": ${largeTableText.includes('Punch')}`);
    console.log(`   Large table rows: ${largeTable.find('tr').length}`);
  }
}

debugOPMPatternOrder().catch(console.error);