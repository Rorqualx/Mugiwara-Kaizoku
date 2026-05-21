import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

async function investigateSpyFamily() {
  const url = 'https://spy-x-family.fandom.com/wiki/Chapters_and_Volumes';
  console.log('Investigating Spy x Family page structure...\n');
  
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
        
        // Check first row for headers
        const firstRow = $table.find('tr').first();
        const headers = firstRow.find('th');
        if (headers.length > 0) {
          const headerTexts = headers.map((_, h) => $(h).text().trim()).get().slice(0, 5);
          console.log(`  Headers: ${headerTexts.join(' | ')}`);
        }
        
        // Check a data row
        if (rows > 1) {
          const dataRow = $table.find('tr').eq(1);
          const cells = dataRow.find('td');
          console.log(`  First data row cells: ${cells.length}`);
          
          if (cells.length > 0 && cells.length <= 6) {
            const firstCellText = cells.eq(0).text().trim().substring(0, 50);
            console.log(`    First cell: "${firstCellText}${firstCellText.length >= 50 ? '...' : ''}"`);
          }
        }
        
        // Check for volume/chapter patterns
        const tableText = $table.text();
        const hasVolume = /Volume\s+\d+/i.test(tableText);
        const hasChapter = /Chapter\s+\d+/i.test(tableText);
        const hasMission = /Mission\s+\d+/i.test(tableText);
        
        if (hasVolume || hasChapter || hasMission) {
          console.log(`  Contains: ${hasVolume ? 'Volume' : ''} ${hasChapter ? 'Chapter' : ''} ${hasMission ? 'Mission' : ''}`);
        }
      }
    });
  }
  
  // Check for divs or other structures
  const volumeDivs = $('div').filter((_, el) => {
    const text = $(el).text();
    return /Volume\s+\d+/i.test(text) || /Mission\s+\d+/i.test(text);
  });
  console.log(`\nDivs with Volume/Mission: ${volumeDivs.length}`);
  
  // Check for h2/h3 headers
  const volumeHeaders = $('h2, h3').filter((_, el) => {
    const text = $(el).text();
    return /Volume\s+\d+/i.test(text) || /Mission\s+\d+/i.test(text);
  });
  console.log(`Volume/Mission headers: ${volumeHeaders.length}`);
  
  if (volumeHeaders.length > 0) {
    console.log('\nFirst few headers:');
    volumeHeaders.slice(0, 3).each((i, header) => {
      console.log(`  - ${$(header).text().trim()}`);
    });
  }
}

investigateSpyFamily().catch(console.error);