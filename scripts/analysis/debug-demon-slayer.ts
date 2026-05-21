import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

async function debugDemonSlayer() {
  console.log('Fetching Demon Slayer page...');
  const response = await fetch('https://kimetsu-no-yaiba.fandom.com/wiki/Chapters_and_Volumes');
  const html = await response.text();
  const $ = cheerio.load(html);
  
  console.log('\n=== Analyzing Demon Slayer Tables ===\n');
  
  // Analyze all tables
  const tables = $('table');
  console.log(`Total tables found: ${tables.length}\n`);
  
  tables.each((i, table) => {
    const $table = $(table);
    const tableText = $table.text();
    const rows = $table.find('tr');
    
    console.log(`\nTable ${i}:`);
    console.log(`- Row count: ${rows.length}`);
    console.log(`- Text length: ${tableText.length}`);
    console.log(`- Contains "Volume": ${tableText.includes('Volume')}`);
    console.log(`- Contains "Chapter": ${tableText.includes('Chapter')}`);
    console.log(`- Contains "ISBN": ${tableText.includes('ISBN')}`);
    
    // Check first few rows
    console.log('\nFirst 3 rows:');
    rows.slice(0, 3).each((j, row) => {
      const $row = $(row);
      const cells = $row.find('td, th');
      console.log(`  Row ${j}: ${cells.length} cells`);
      cells.each((k, cell) => {
        const text = $(cell).text().trim().substring(0, 50);
        console.log(`    Cell ${k}: "${text}${text.length >= 50 ? '...' : ''}"`);
      });
    });
    
    // Look for specific patterns
    const hasVolumeInFirstCell = rows.toArray().some(row => {
      const firstCell = $(row).find('td, th').first().text().trim();
      return /Volume\s+\d+/i.test(firstCell);
    });
    
    console.log(`\n- Has "Volume X" in first cell: ${hasVolumeInFirstCell}`);
    
    // Check for nested tables
    const nestedTables = $table.find('table');
    console.log(`- Nested tables: ${nestedTables.length}`);
    
    if (tableText.includes('Volume') && tableText.includes('Chapter')) {
      console.log('\n*** POTENTIAL VOLUME TABLE ***');
      
      // Sample some text
      const sample = tableText.substring(0, 500).replace(/\s+/g, ' ');
      console.log('Sample text:', sample);
    }
  });
  
  // Check for headers
  console.log('\n=== Volume Headers ===');
  const headers = $('h2, h3').filter((_, el) => {
    const text = $(el).text();
    return /Volume\s+\d+/i.test(text);
  });
  
  console.log(`Found ${headers.length} volume headers`);
  headers.slice(0, 5).each((i, header) => {
    console.log(`- ${$(header).prop('tagName')}: "${$(header).text().trim()}"`);
  });
}

debugDemonSlayer().catch(console.error);