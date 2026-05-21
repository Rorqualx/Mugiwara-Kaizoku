import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

async function analyzeMonsterChapters() {
  console.log('🔍 Analyzing Monster Chapter Structure\n');
  
  const url = 'https://obluda.fandom.com/wiki/List_of_chapters';
  const response = await fetch(url);
  const html = await response.text();
  const $ = cheerio.load(html);
  
  // Find the main table
  const table = $('table.wikitable').first();
  const rows = table.find('tr');
  
  console.log(`Total rows: ${rows.length}\n`);
  
  // Look for chapter rows
  let chapterRowCount = 0;
  
  rows.each((i, row) => {
    const $row = $(row);
    const cells = $row.find('td');
    const rowText = $row.text();
    
    // Skip if it's a volume header
    if (/Volume\s+\d+:/i.test(rowText) && cells.length === 1 && cells.attr('colspan')) {
      return;
    }
    
    // Check if this row contains chapters
    cells.each((j, cell) => {
      const $cell = $(cell);
      const cellText = $cell.text();
      const listItems = $cell.find('li');
      
      if (listItems.length > 0) {
        console.log(`Row ${i}, Cell ${j}: Found ${listItems.length} list items`);
        console.log('Sample chapters:');
        
        listItems.slice(0, 3).each((k, li) => {
          const liText = $(li).text().trim();
          console.log(`  - "${liText.substring(0, 60)}${liText.length > 60 ? '...' : ''}"`);
          
          // Test different patterns
          const patterns = [
            { name: '001. pattern', regex: /^(\d{3})\.\s*(.+)$/ },
            { name: 'Chapter X: pattern', regex: /^Chapter\s+(\d+):\s*(.+)$/i },
            { name: 'Chapter X pattern', regex: /^Chapter\s+(\d+)\s+(.+)$/i },
            { name: 'Just number pattern', regex: /^(\d+)\.\s*(.+)$/ }
          ];
          
          patterns.forEach(pattern => {
            if (pattern.regex.test(liText)) {
              console.log(`    ✓ Matches ${pattern.name}`);
            }
          });
        });
        
        chapterRowCount++;
        console.log('');
      }
    });
  });
  
  console.log(`Total rows with chapters: ${chapterRowCount}`);
}

analyzeMonsterChapters().catch(console.error);