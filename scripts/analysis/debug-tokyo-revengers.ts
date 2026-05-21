import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

async function debugTokyoRevengers() {
  console.log('Fetching Tokyo Revengers page...');
  const response = await fetch('https://tokyorevengers.fandom.com/wiki/Volumes_%26_Chapters');
  const html = await response.text();
  const $ = cheerio.load(html);
  
  console.log('\n=== Analyzing Tokyo Revengers Tables ===\n');
  
  const tables = $('table');
  console.log(`Total tables found: ${tables.length}\n`);
  
  // Look for volume tables
  tables.each((i, table) => {
    const $table = $(table);
    const tableText = $table.text();
    const rows = $table.find('tr');
    
    // Check if this looks like a volume table
    if (tableText.includes('Chapter') && (tableText.includes('Volume') || tableText.includes('ISBN'))) {
      console.log(`\nTable ${i} (potential volume table):`);
      console.log(`- Row count: ${rows.length}`);
      console.log(`- Contains "Volume": ${tableText.includes('Volume')}`);
      console.log(`- Contains "Chapter": ${tableText.includes('Chapter')}`);
      console.log(`- Contains "ISBN": ${tableText.includes('ISBN')}`);
      
      // Show first few rows
      console.log('\nFirst 5 rows:');
      rows.slice(0, 5).each((j, row) => {
        const $row = $(row);
        const cells = $row.find('td, th');
        const rowText = $row.text().trim().substring(0, 100);
        console.log(`  Row ${j} (${cells.length} cells): "${rowText}${rowText.length >= 100 ? '...' : ''}"`);
        
        // If this row has chapters, analyze it
        if (rowText.includes('Chapter') && j > 0) {
          console.log('    -> Analyzing chapter cell:');
          cells.each((k, cell) => {
            const cellText = $(cell).text();
            if (cellText.includes('Chapter')) {
              console.log(`       Cell ${k} HTML: ${$(cell).html()?.substring(0, 200)}`);
              
              // Check for lists
              const lists = $(cell).find('ul, ol');
              console.log(`       Lists found: ${lists.length}`);
              
              // Check for line breaks
              const brTags = $(cell).find('br');
              console.log(`       BR tags: ${brTags.length}`);
              
              // Parse text lines
              const lines = cellText.split('\n').filter(l => l.trim());
              console.log(`       Text lines: ${lines.length}`);
              lines.slice(0, 3).forEach((line, idx) => {
                console.log(`         Line ${idx}: "${line.trim()}"`);
              });
            }
          });
        }
      });
      
      if (i >= 2) return false; // Just show first 3 volume tables
    }
  });
  
  // Check headers
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

debugTokyoRevengers().catch(console.error);