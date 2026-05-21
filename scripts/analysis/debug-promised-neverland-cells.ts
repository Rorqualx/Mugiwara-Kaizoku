import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

async function debugPromisedNeverlandCells() {
  console.log('🔍 Debugging Promised Neverland Cell Structure\n');
  
  const url = 'https://yakusokunoneverland.fandom.com/wiki/Chapters_and_Volumes';
  const response = await fetch(url);
  const html = await response.text();
  const $ = cheerio.load(html);
  
  // Get first article table
  const firstTable = $('table.article-table').first();
  const rows = firstTable.find('tr');
  
  console.log('First table structure:');
  rows.each((i, row) => {
    const $row = $(row);
    const cells = $row.find('td');
    
    console.log(`\nRow ${i + 1}: ${cells.length} cells`);
    
    cells.each((j, cell) => {
      const $cell = $(cell);
      const text = $cell.text().trim();
      const html = $cell.html();
      
      console.log(`  Cell ${j + 1}:`);
      console.log(`    Text length: ${text.length}`);
      console.log(`    Text preview: "${text.substring(0, 100)}..."`);
      
      // Check for line breaks
      const brCount = (html?.match(/<br\s*\/?>/gi) || []).length;
      console.log(`    <br> tags: ${brCount}`);
      
      // Check for links
      const links = $cell.find('a');
      console.log(`    Links: ${links.length}`);
    });
  });
  
  // Check specifically the fourth row of the first table
  console.log('\n\nFourth row detailed analysis:');
  const fourthRow = rows.eq(3);
  const cells = fourthRow.find('td');
  
  cells.each((i, cell) => {
    const $cell = $(cell);
    const text = $cell.text();
    const html = $cell.html();
    
    console.log(`\nCell ${i + 1}:`);
    console.log('HTML:', html?.substring(0, 500));
    console.log('\nText:', text.substring(0, 200));
    
    // Try getting text with different methods
    const directText = $cell.text();
    const innerText = $cell.prop('innerText');
    
    console.log('\ndirectText lines:', directText.split('\n').filter(l => l.trim()).slice(0, 3));
  });
}

debugPromisedNeverlandCells().catch(console.error);