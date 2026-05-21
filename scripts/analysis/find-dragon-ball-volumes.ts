import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

async function findDragonBallVolumes() {
  const url = 'https://dragonball.fandom.com/wiki/Dragon_Ball_(manga)';
  console.log('Searching for Dragon Ball volume information...\n');
  
  const response = await fetch(url);
  const html = await response.text();
  const $ = cheerio.load(html);
  
  // Look for all tables
  const tables = $('table');
  console.log(`Total tables: ${tables.length}\n`);
  
  tables.each((i, table) => {
    const $table = $(table);
    const className = $table.attr('class') || 'none';
    const tableText = $table.text();
    
    // Check if this table contains volume/chapter info
    const hasVolume = /Volume\s+\d+/i.test(tableText);
    const hasChapter = /Chapter\s+\d+/i.test(tableText) || /\d+\.\s+"[^"]+"/i.test(tableText);
    const hasDB = tableText.includes('DB Vol');
    
    if (hasVolume || hasChapter || hasDB) {
      console.log(`Table ${i} (class: ${className}):`);
      console.log(`  Has volume info: ${hasVolume}`);
      console.log(`  Has chapter info: ${hasChapter}`);
      console.log(`  Has DB Vol: ${hasDB}`);
      
      // Sample the structure
      const rows = $table.find('tr');
      console.log(`  Rows: ${rows.length}`);
      
      if (rows.length > 0) {
        const firstRow = rows.first();
        const headers = firstRow.find('th');
        if (headers.length > 0) {
          console.log(`  Headers: ${headers.map((_, h) => $(h).text().trim()).get().slice(0, 5).join(' | ')}`);
        }
        
        // Check a data row
        if (rows.length > 1) {
          const dataRow = rows.eq(1);
          const cells = dataRow.find('td');
          console.log(`  First data row cells: ${cells.length}`);
        }
      }
      console.log('');
    }
  });
  
  // Also check for specific sections
  const sections = $('h2, h3').filter((_, el) => {
    const text = $(el).text();
    return text.includes('Volume') || text.includes('Chapter');
  });
  
  console.log(`\nSections with Volume/Chapter: ${sections.length}`);
  sections.each((i, section) => {
    if (i < 5) {
      console.log(`  - ${$(section).text().trim()}`);
    }
  });
}

findDragonBallVolumes().catch(console.error);