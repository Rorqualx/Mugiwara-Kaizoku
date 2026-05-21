import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

async function debugSpyFamilyDetail() {
  const url = 'https://spy-x-family.fandom.com/wiki/Chapters_and_Volumes';
  console.log('Analyzing Spy x Family table structure in detail...\n');
  
  const response = await fetch(url);
  const html = await response.text();
  const $ = cheerio.load(html);
  
  // Focus on the first table
  const firstTable = $('table').first();
  const rows = firstTable.find('tr');
  
  console.log('=== First Table Analysis ===');
  console.log(`Total rows: ${rows.length}`);
  
  // Analyze first 10 rows
  rows.slice(0, 10).each((i, row) => {
    const $row = $(row);
    const cells = $row.find('td, th');
    
    console.log(`\nRow ${i}: ${cells.length} cells`);
    
    if (cells.length > 0) {
      cells.each((j, cell) => {
        const $cell = $(cell);
        const text = $cell.text().trim();
        const isHeader = cell.tagName.toLowerCase() === 'th';
        
        if (j < 3 || text.includes('Volume') || text.includes('Mission')) {
          console.log(`  Cell ${j} (${isHeader ? 'th' : 'td'}): "${text.substring(0, 60)}${text.length > 60 ? '...' : ''}"`);
          
          // Check for lists in the cell
          const lists = $cell.find('ul, ol');
          if (lists.length > 0) {
            console.log(`    Contains ${lists.length} list(s)`);
            const firstItems = lists.first().find('li').slice(0, 2);
            firstItems.each((k, li) => {
              console.log(`      - ${$(li).text().trim().substring(0, 50)}...`);
            });
          }
        }
      });
    }
  });
  
  // Check the pattern of volume/mission content
  console.log('\n=== Content Pattern Analysis ===');
  const volumeRows = rows.filter((_, row) => {
    const text = $(row).text();
    return text.includes('Volume') && /Volume\s+\d+/i.test(text);
  });
  
  console.log(`Rows containing "Volume X": ${volumeRows.length}`);
  
  if (volumeRows.length > 0) {
    const firstVolumeRow = volumeRows.first();
    const nextRow = firstVolumeRow.next();
    
    console.log('\nFirst volume row and next row:');
    console.log(`Volume row cells: ${firstVolumeRow.find('td').length}`);
    console.log(`Next row cells: ${nextRow.find('td').length}`);
    
    const nextRowText = nextRow.text();
    if (nextRowText.includes('Mission')) {
      console.log('Next row contains missions!');
    }
  }
}

debugSpyFamilyDetail().catch(console.error);