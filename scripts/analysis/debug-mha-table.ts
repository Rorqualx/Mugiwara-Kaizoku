import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

async function debugMHATable() {
  const url = 'https://myheroacademia.fandom.com/wiki/Chapters_and_Volumes';
  console.log('Debugging MHA table structure...\n');
  
  const response = await fetch(url);
  const html = await response.text();
  const $ = cheerio.load(html);
  
  // Focus on table 3 which has volumes
  const volumeTable = $('table').eq(3);
  console.log('=== Volume Table (Table 3) Analysis ===');
  
  const rows = volumeTable.find('tr');
  console.log(`Total rows: ${rows.length}`);
  
  // Analyze first 10 rows
  rows.slice(0, 10).each((i, row) => {
    const $row = $(row);
    const cells = $row.find('td, th');
    
    console.log(`\nRow ${i}: ${cells.length} cells`);
    
    if (cells.length > 0 && i < 5) {
      cells.each((j, cell) => {
        const $cell = $(cell);
        const text = $cell.text().trim();
        const tagName = cell.tagName.toLowerCase();
        
        if (j < 3 || text.includes('Volume') || text.includes('Chapter')) {
          console.log(`  Cell ${j} (${tagName}): "${text.substring(0, 60)}${text.length > 60 ? '...' : ''}"`);
          
          // Check for nested structures
          const lists = $cell.find('ul, ol');
          const links = $cell.find('a');
          
          if (lists.length > 0) {
            console.log(`    Contains ${lists.length} list(s)`);
          }
          if (links.length > 1) {
            console.log(`    Contains ${links.length} links`);
            // Show first few links
            links.slice(0, 3).each((k, link) => {
              const linkText = $(link).text().trim();
              if (linkText.includes('Chapter')) {
                console.log(`      Link: "${linkText}"`);
              }
            });
          }
        }
      });
    }
  });
  
  // Check the pattern more thoroughly
  console.log('\n=== Pattern Analysis ===');
  
  // Look for rows with Volume X pattern
  const volumeRows = rows.filter((_, row) => {
    const firstCell = $(row).find('td').first().text();
    return /Volume\s+\d+/i.test(firstCell);
  });
  
  console.log(`Rows with "Volume X" in first cell: ${volumeRows.length}`);
  
  if (volumeRows.length > 0) {
    console.log('\nAnalyzing first volume row structure:');
    const firstVolumeRow = volumeRows.eq(0);
    const cells = firstVolumeRow.find('td');
    
    cells.each((i, cell) => {
      const $cell = $(cell);
      const text = $cell.text().trim();
      console.log(`  Cell ${i}: ${text.substring(0, 50)}${text.length > 50 ? '...' : ''}`);
      
      // Check for chapter information
      const links = $cell.find('a');
      const linkTexts = links.map((_, l) => $(l).text().trim()).get();
      const chapterLinks = linkTexts.filter(t => t.includes('Chapter'));
      
      if (chapterLinks.length > 0) {
        console.log(`    Chapter links: ${chapterLinks.length}`);
        console.log(`    First chapters: ${chapterLinks.slice(0, 3).join(', ')}`);
      }
    });
  }
}

debugMHATable().catch(console.error);