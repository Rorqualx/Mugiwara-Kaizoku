import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

async function checkOPMFirstRow() {
  console.log('🔍 Checking OPM First Row HTML\n');
  
  const url = 'https://onepunchman.fandom.com/wiki/Volumes';
  const response = await fetch(url);
  const html = await response.text();
  const $ = cheerio.load(html);
  
  const collapsibleTable = $('table.mw-collapsible').first();
  const firstRow = collapsibleTable.find('tr').first();
  const firstRowHtml = firstRow.html() || '';
  const firstRowText = firstRow.text();
  
  console.log('First row HTML:');
  console.log(firstRowHtml.substring(0, 200) + '...\n');
  
  console.log('First row text:');
  console.log(firstRowText);
  
  console.log('\nCharacter codes:');
  for (let i = 0; i < Math.min(20, firstRowText.length); i++) {
    const char = firstRowText[i];
    console.log(`  ${i}: "${char}" (code: ${char.charCodeAt(0)})`);
  }
  
  // Check for navigation patterns
  console.log('\nNavigation pattern checks:');
  console.log('Contains "v":', firstRowText.includes('v'));
  console.log('Contains "e":', firstRowText.includes('e'));
  console.log('Starts with whitespace:', /^\s/.test(firstRowText));
  console.log('Text trimmed:', firstRowText.trim());
}

checkOPMFirstRow().catch(console.error);