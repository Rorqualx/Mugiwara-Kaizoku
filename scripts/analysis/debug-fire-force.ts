import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

async function debugFireForce() {
  console.log('Fetching Fire Force page...');
  const response = await fetch('https://fire-force.fandom.com/wiki/List_of_Volumes');
  const html = await response.text();
  const $ = cheerio.load(html);
  
  console.log('\n=== Analyzing Fire Force Tables ===\n');
  
  const tables = $('table');
  console.log(`Total tables found: ${tables.length}\n`);
  
  // Look for volume tables
  tables.each((i, table) => {
    const $table = $(table);
    const rows = $table.find('tr');
    
    if (rows.length > 2) {
      console.log(`\nTable ${i} (${rows.length} rows):`);
      console.log(`Class: ${$table.attr('class') || 'none'}`);
      
      // Check first few rows
      console.log('\nFirst 5 rows:');
      rows.slice(0, 5).each((j, row) => {
        const $row = $(row);
        const cells = $row.find('td, th');
        const rowText = $row.text().trim().substring(0, 150);
        console.log(`\nRow ${j} (${cells.length} cells): "${rowText}${rowText.length >= 150 ? '...' : ''}"`);
        
        // Show individual cells for first few rows
        if (j < 3 && cells.length > 0) {
          cells.each((k, cell) => {
            const cellText = $(cell).text().trim().substring(0, 100);
            console.log(`  Cell ${k}: "${cellText}"`);
            
            // Check for volume/chapter patterns
            if (cellText.includes('Volume') || cellText.includes('Chapter')) {
              // Check for lists in this cell
              const lists = $(cell).find('ul, ol');
              if (lists.length > 0) {
                console.log(`    -> Has ${lists.length} lists`);
                const listItems = lists.find('li');
                console.log(`    -> ${listItems.length} list items`);
                if (listItems.length > 0) {
                  console.log(`    -> First item: "${listItems.first().text().trim()}"`);
                }
              }
            }
          });
        }
      });
      
      // Check for volume/chapter patterns
      const tableText = $table.text();
      const volumeMatches = tableText.match(/Volume\s+\d+/gi);
      const chapterMatches = tableText.match(/Chapter\s+\d+/gi);
      
      if (volumeMatches || chapterMatches) {
        console.log(`\nPatterns found:`);
        if (volumeMatches) console.log(`- Volumes: ${volumeMatches.length} (first few: ${volumeMatches.slice(0, 3).join(', ')})`);
        if (chapterMatches) console.log(`- Chapters: ${chapterMatches.length} (first few: ${chapterMatches.slice(0, 3).join(', ')})`);
      }
    }
  });
  
  // Check for non-table structures
  console.log('\n=== Non-table structures ===');
  
  // Check for volume headers
  const volumeHeaders = $('h2, h3').filter((_, el) => {
    const text = $(el).text();
    return /Volume\s+\d+/i.test(text);
  });
  
  console.log(`\nVolume headers found: ${volumeHeaders.length}`);
  volumeHeaders.slice(0, 3).each((i, header) => {
    console.log(`- ${$(header).prop('tagName')}: "${$(header).text().trim()}"`);
  });
  
  // Check for divs with volume info
  const volumeDivs = $('.infobox, .portable-infobox, .volume-box');
  console.log(`\nVolume info boxes: ${volumeDivs.length}`);
}

debugFireForce().catch(console.error);