import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

async function debugMHADetailed() {
  const response = await fetch('https://myheroacademia.fandom.com/wiki/Chapters_and_Volumes');
  const html = await response.text();
  const $ = cheerio.load(html);
  
  console.log('Analyzing all tables:\n');
  
  $('table').each((i, table) => {
    const $table = $(table);
    const text = $table.text();
    
    console.log(`\nTable ${i}:`);
    console.log(`  Text length: ${text.length}`);
    console.log(`  Has "Chapter": ${text.includes('Chapter')}`);
    console.log(`  Has "Volume": ${text.includes('Volume')}`);
    console.log(`  Has numbers like "1.": ${!!text.match(/\d+\./)}`);
    
    // Check first row
    const firstRow = $table.find('tr').first();
    const firstRowText = firstRow.text().trim();
    console.log(`  First row: "${firstRowText.substring(0, 80)}..."`);
    
    // If it looks like a chapter table
    if (text.includes('Chapter') && text.match(/\d+\./)) {
      console.log('  -> This looks like a chapter table!');
      
      const rows = $table.find('tr');
      console.log(`  Total rows: ${rows.length}`);
      
      // Sample a chapter row
      const sampleRow = rows.eq(5);
      if (sampleRow.length > 0) {
        const cells = sampleRow.find('td');
        console.log(`  Sample row (5): ${cells.length} cells`);
        cells.each((j, cell) => {
          console.log(`    Cell ${j}: "${$(cell).text().trim().substring(0, 40)}..."`);
        });
      }
    }
  });
}

debugMHADetailed().catch(console.error);