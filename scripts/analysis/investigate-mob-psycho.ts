import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

async function investigateMobPsycho() {
  const url = 'https://mob-psycho-100.fandom.com/wiki/Manga';
  console.log('Investigating Mob Psycho 100 page structure...\n');
  
  const response = await fetch(url);
  console.log(`Status: ${response.status}`);
  
  const html = await response.text();
  const $ = cheerio.load(html);
  
  // Check page content
  const title = $('title').text();
  console.log(`Page title: ${title}`);
  
  // Look for tables
  const tables = $('table');
  console.log(`\nTables found: ${tables.length}`);
  
  if (tables.length > 0) {
    tables.each((i, table) => {
      if (i < 5) {
        const $table = $(table);
        const className = $table.attr('class') || 'none';
        const rows = $table.find('tr').length;
        
        console.log(`\nTable ${i}:`);
        console.log(`  Class: ${className}`);
        console.log(`  Rows: ${rows}`);
        
        // Check for volume/chapter patterns
        const tableText = $table.text();
        const hasVolume = /Volume\s+\d+/i.test(tableText);
        const hasChapter = /Chapter\s+\d+/i.test(tableText);
        
        if (hasVolume || hasChapter) {
          console.log(`  Contains: ${hasVolume ? 'Volume' : ''} ${hasChapter ? 'Chapter' : ''}`);
          
          // Show first few rows
          const firstRows = $table.find('tr').slice(0, 3);
          firstRows.each((j, row) => {
            const cells = $(row).find('td, th');
            console.log(`    Row ${j}: ${cells.length} cells`);
            if (cells.length > 0 && cells.length <= 5) {
              const firstCellText = cells.eq(0).text().trim().substring(0, 40);
              console.log(`      First cell: "${firstCellText}${firstCellText.length >= 40 ? '...' : ''}"`);
            }
          });
        }
      }
    });
  }
  
  // Look for volume/chapter lists
  const volumeLists = $('ul, ol').filter((_, el) => {
    const text = $(el).text();
    return /Volume\s+\d+/i.test(text) || /Chapter\s+\d+/i.test(text);
  });
  console.log(`\nVolume/Chapter lists: ${volumeLists.length}`);
  
  // Check for expandable/collapsible sections
  const expandables = $('.mw-collapsible, .wikia-menu-button, .expand-collapse-icon');
  console.log(`Expandable sections: ${expandables.length}`);
  
  // Look for divs with volume info
  const volumeDivs = $('div').filter((_, el) => {
    const text = $(el).text();
    return /Volume\s+\d+/i.test(text) && text.length < 500;
  });
  console.log(`Divs with Volume info: ${volumeDivs.length}`);
  
  if (volumeDivs.length > 0) {
    console.log('\nFirst few volume divs:');
    volumeDivs.slice(0, 3).each((i, div) => {
      const text = $(div).text().trim().substring(0, 80);
      console.log(`  ${i}: "${text}${text.length >= 80 ? '...' : ''}"`);
    });
  }
}

investigateMobPsycho().catch(console.error);