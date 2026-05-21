import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

async function inspectTable() {
  const url = 'https://dragonball.fandom.com/wiki/Dragon_Ball_(manga)';
  const response = await fetch(url);
  const html = await response.text();
  const $ = cheerio.load(html);
  
  // Get table at index 1
  const table = $('table').eq(1);
  console.log('Inspecting table 1...\n');
  
  // Get the HTML to see structure
  const tableHtml = table.html();
  console.log('Table HTML (first 500 chars):');
  console.log(tableHtml?.substring(0, 500) + '...\n');
  
  // Check if it's inside a navbox
  const parentClass = table.parent().attr('class') || '';
  console.log(`Parent class: ${parentClass}`);
  
  // Get all text content
  const tableText = table.text();
  console.log('\nTable text (first 300 chars):');
  console.log(tableText.substring(0, 300) + '...');
  
  // Look for navigation structures
  const navbox = $('.navbox.mw-collapsible.mw-collapsed');
  console.log(`\nNavbox found: ${navbox.length > 0}`);
  
  if (navbox.length > 0) {
    console.log('\nNavbox structure:');
    const navRows = navbox.find('tr');
    console.log(`  Total rows: ${navRows.length}`);
    
    // Check first few rows
    navRows.slice(0, 5).each((i, row) => {
      const $row = $(row);
      const cells = $row.find('td, th');
      const text = $row.text().trim().substring(0, 80);
      console.log(`  Row ${i}: ${cells.length} cells - "${text}${text.length >= 80 ? '...' : ''}"`);
    });
  }
}

inspectTable().catch(console.error);