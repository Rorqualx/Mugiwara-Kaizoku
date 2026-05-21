import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

async function investigateChainsawMan() {
  const url = 'https://chainsaw-man.fandom.com/wiki/Chapters_and_Volumes';
  console.log('Investigating Chainsaw Man page structure...\n');
  
  const response = await fetch(url);
  const html = await response.text();
  const $ = cheerio.load(html);
  
  // Look for tables
  const tables = $('table');
  console.log(`Tables found: ${tables.length}`);
  
  tables.each((i, table) => {
    if (i < 5) {
      const $table = $(table);
      const className = $table.attr('class') || 'none';
      const rows = $table.find('tr').length;
      
      console.log(`\nTable ${i}:`);
      console.log(`  Class: ${className}`);
      console.log(`  Rows: ${rows}`);
      
      // Check headers
      const headers = $table.find('tr').first().find('th');
      if (headers.length > 0) {
        const headerTexts = headers.map((_, h) => $(h).text().trim()).get();
        console.log(`  Headers: ${headerTexts.slice(0, 6).join(' | ')}`);
      }
      
      // Check pattern
      const tableText = $table.text();
      console.log(`  Contains Volume: ${/Volume\s+\d+/i.test(tableText)}`);
      console.log(`  Contains Chapter: ${/Chapter\s+\d+/i.test(tableText)}`);
      console.log(`  Contains #: ${tableText.includes('#')}`);
      
      // Show sample rows
      if (rows > 1 && rows < 20) {
        $table.find('tr').slice(1, 4).each((j, row) => {
          const cells = $(row).find('td');
          console.log(`    Row ${j+1}: ${cells.length} cells`);
          if (cells.length > 0) {
            const firstCell = cells.eq(0).text().trim().substring(0, 40);
            console.log(`      First cell: "${firstCell}"`);
          }
        });
      }
    }
  });
  
  // Look for other structures
  const mainContent = $('.mw-parser-output');
  const divs = mainContent.find('div').filter((_, el) => {
    const text = $(el).text();
    return /Volume\s+\d+/i.test(text) && text.length < 1000;
  });
  
  console.log(`\nDivs with Volume: ${divs.length}`);
  
  // Check for tabber
  const tabber = $('.tabber, .wds-tabs__wrapper');
  console.log(`Tabber elements: ${tabber.length}`);
}

investigateChainsawMan().catch(console.error);