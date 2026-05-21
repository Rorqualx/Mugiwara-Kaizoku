import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

async function debugMonsterComplete() {
  console.log('🔍 Complete Monster Debug\n');
  
  const url = 'https://obluda.fandom.com/wiki/List_of_chapters';
  const response = await fetch(url);
  const html = await response.text();
  const $ = cheerio.load(html);
  
  // Check pattern detection order
  console.log('Pattern Detection Order:\n');
  
  // 1. Gallery-based
  const galleries = $('.wikia-gallery, .gallery');
  console.log(`1. Gallery-based: ${galleries.length > 0} (galleries: ${galleries.length})`);
  
  // 2. JoJo alternating
  const alternatingTables = $('table').filter((_, table) => {
    const $table = $(table);
    const rows = $table.find('tr');
    return rows.filter((_, row) => {
      const text = $(row).text();
      return /Part \d+:/i.test(text) || /^(Volume|Vol\.?)\s+\d+/i.test(text);
    }).length >= 3;
  });
  console.log(`2. JoJo alternating: ${alternatingTables.length > 0}`);
  
  // 3. Collapsible navigation
  const collapsibles = $('table.mw-collapsible, table.toccolours');
  console.log(`3. Collapsible navigation: ${collapsibles.length > 0}`);
  
  // 4. Kaiju pattern
  const fandomTable = $('table.fandom-table');
  console.log(`4. Kaiju pattern: ${fandomTable.length > 0}`);
  
  // 5. Single large table
  let hasLargeTable = false;
  let largestTableInfo = { rows: 0, volumeHeaders: 0, chapterRows: 0 };
  
  $('table').each((_, table) => {
    const $table = $(table);
    const rows = $table.find('tr');
    
    if (rows.length > 20) {
      let volumeHeaders = 0;
      let chapterRows = 0;
      
      rows.each((_, row) => {
        const cells = $(row).find('td, th');
        const rowText = $(row).text();
        
        if (cells.length === 1 && cells.attr('colspan')) {
          const text = cells.text();
          if (/Volume\s+\d+(?:\s*:|$)/i.test(text.trim())) {
            volumeHeaders++;
          }
        }
        
        cells.each((_, cell) => {
          const cellText = $(cell).text();
          const cellHtml = $(cell).html() || '';
          
          if (cellHtml.includes('<li>') && (/\d{3}\./.test(cellText) || /Chapter\s+\d+:/i.test(cellText))) {
            chapterRows++;
            return false;
          }
        });
      });
      
      if (volumeHeaders >= 3) {
        hasLargeTable = true;
        largestTableInfo = { rows: rows.length, volumeHeaders, chapterRows };
      }
    }
  });
  
  console.log(`5. Single large table: ${hasLargeTable}`);
  if (hasLargeTable) {
    console.log(`   - Rows: ${largestTableInfo.rows}`);
    console.log(`   - Volume headers: ${largestTableInfo.volumeHeaders}`);
    console.log(`   - Chapter rows: ${largestTableInfo.chapterRows}`);
  }
  
  console.log('\n\n🎯 Simulating parseVolumeTables flow:\n');
  
  if (galleries.length > 0) {
    console.log('❌ Would use gallery-based layout (but Monster doesn\'t have this)');
  } else if (alternatingTables.length > 0) {
    console.log('❌ Would use JoJo alternating pattern (but Monster doesn\'t have this)');
  } else if (collapsibles.length > 0) {
    console.log('❌ Would use collapsible navigation (but Monster doesn\'t have this)');
  } else if (fandomTable.length > 0) {
    console.log('❌ Would use Kaiju pattern (but Monster doesn\'t have fandom-table)');
  } else if (hasLargeTable) {
    console.log('✅ Should use single large table pattern!');
    console.log('   But it\'s returning empty volumes...');
    
    // Debug the parsing
    console.log('\n🔍 Debugging parseSingleLargeTable:');
    
    const table = $('table.wikitable').first();
    const rows = table.find('tr');
    let volumeCount = 0;
    let chapterCount = 0;
    
    rows.each((i, row) => {
      const $row = $(row);
      const cells = $row.find('td, th');
      
      if (cells.length === 1 && cells.attr('colspan')) {
        const text = cells.text().trim();
        if (/Volume\s+\d+:/i.test(text)) {
          volumeCount++;
          if (volumeCount <= 3) {
            console.log(`   Volume ${volumeCount} at row ${i}: "${text.substring(0, 40)}..."`);
          }
        }
      } else if (cells.length === 1) {
        const listItems = cells.find('li');
        if (listItems.length > 0) {
          chapterCount += listItems.length;
        }
      }
    });
    
    console.log(`\n   Total volumes detected: ${volumeCount}`);
    console.log(`   Total chapters in lists: ${chapterCount}`);
  } else {
    console.log('❌ No pattern matched!');
  }
}

debugMonsterComplete().catch(console.error);