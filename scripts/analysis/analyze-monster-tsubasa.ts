import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

async function analyzeMangaStructure(name: string, url: string) {
  console.log(`\n🔍 Analyzing ${name}...`);
  console.log(`URL: ${url}\n`);
  
  const response = await fetch(url);
  const html = await response.text();
  const $ = cheerio.load(html);
  
  // Find all tables
  const tables = $('table');
  console.log(`Total tables found: ${tables.length}`);
  
  // Look for the largest table
  let largestTable: cheerio.Cheerio<any> | null = null;
  let maxRows = 0;
  let largestIndex = -1;
  
  tables.each((i, table) => {
    const rowCount = $(table).find('tr').length;
    if (rowCount > maxRows) {
      maxRows = rowCount;
      largestTable = $(table);
      largestIndex = i;
    }
  });
  
  if (largestTable) {
    console.log(`\nLargest table: Table #${largestIndex} with ${maxRows} rows`);
    const classes = largestTable.attr('class') || 'none';
    console.log(`Classes: ${classes}`);
    
    // Analyze first 10 rows
    console.log('\nFirst 10 rows:');
    const rows = largestTable.find('tr');
    rows.slice(0, 10).each((i, row) => {
      const $row = $(row);
      const cells = $row.find('td, th');
      const cellCount = cells.length;
      const colspan = cells.first().attr('colspan');
      const text = $row.text().trim().substring(0, 80);
      
      console.log(`Row ${i}: ${cellCount} cells${colspan ? ` (colspan=${colspan})` : ''}`);
      console.log(`  Text: "${text}${text.length > 80 ? '...' : ''}"`);
      
      // Check for patterns
      if (/Volume\s+\d+/i.test(text)) {
        console.log(`  ✓ Volume header detected`);
      }
      if (/\d{3}\./.test(text) || /Chapter\s+\d+/i.test(text)) {
        console.log(`  ✓ Chapter pattern detected`);
      }
      
      // Check for list items in cells
      cells.each((j, cell) => {
        const $cell = $(cell);
        const listItems = $cell.find('li');
        if (listItems.length > 0) {
          console.log(`  Cell ${j} has ${listItems.length} list items`);
        }
      });
    });
    
    // Check for volume patterns
    console.log('\n🔍 Checking for volume patterns...');
    let volumeCount = 0;
    rows.each((_, row) => {
      const text = $(row).text();
      if (/Volume\s+\d+/i.test(text)) {
        volumeCount++;
      }
    });
    console.log(`Total volume headers found: ${volumeCount}`);
  }
  
  // Check page structure
  console.log('\n📄 Page structure:');
  const headers = $('h2, h3').slice(0, 5);
  headers.each((i, header) => {
    console.log(`${header.name}: ${$(header).text().trim()}`);
  });
}

async function main() {
  await analyzeMangaStructure('Monster', 'https://obluda.fandom.com/wiki/List_of_chapters');
  await analyzeMangaStructure('Captain Tsubasa', 'https://manga.fandom.com/wiki/List_of_Captain_Tsubasa_chapters');
}

main().catch(console.error);