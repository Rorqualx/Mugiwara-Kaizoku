import fetch from 'node-fetch';
import * as cheerio from 'cheerio';
import { parseVolumeTables } from '../src/api/metadataProviders/utils/fandomTableParser';

async function investigateMHA() {
  const url = 'https://myheroacademia.fandom.com/wiki/Chapters_and_Volumes';
  console.log('Investigating My Hero Academia failure...\n');
  
  const response = await fetch(url);
  const html = await response.text();
  const $ = cheerio.load(html);
  
  // Look for tables
  const tables = $('table');
  console.log(`Tables found: ${tables.length}`);
  
  // Check each table
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
      
      // Check pattern detection
      const tableText = $table.text();
      console.log(`  Contains Volume: ${/Volume\s+\d+/i.test(tableText)}`);
      console.log(`  Contains Chapter: ${/Chapter\s+\d+/i.test(tableText)}`);
      
      // Show a sample row
      if (rows > 2) {
        const sampleRow = $table.find('tr').eq(2);
        const cells = sampleRow.find('td');
        console.log(`  Sample row cells: ${cells.length}`);
        if (cells.length > 0) {
          const firstCell = cells.eq(0).text().trim().substring(0, 50);
          console.log(`    First cell: "${firstCell}"`);
        }
      }
    }
  });
  
  // Try parsing to see what happens
  console.log('\n=== Parser Results ===');
  const volumes = parseVolumeTables(html);
  console.log(`Volumes parsed: ${volumes.length}`);
  
  if (volumes.length === 0) {
    console.log('\nChecking why parsing failed...');
    
    // Check if there's a navigation table
    const navTables = $('.mw-collapsible, .toccolours').filter((_, el) => {
      return $(el).text().includes('Volume');
    });
    console.log(`Navigation tables with Volume: ${navTables.length}`);
    
    // Check for article tables
    const articleTables = $('.article-table');
    console.log(`Article tables: ${articleTables.length}`);
  }
}

investigateMHA().catch(console.error);