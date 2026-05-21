import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

async function debugHunterFormat() {
  console.log('Fetching Hunter x Hunter page...');
  const response = await fetch('https://hunterxhunter.fandom.com/wiki/List_of_Volumes_and_Chapters');
  const html = await response.text();
  const $ = cheerio.load(html);
  
  // Look at the first table in detail
  const firstTable = $('table').first();
  const rows = firstTable.find('tr');
  
  console.log('\n=== Analyzing Hunter x Hunter Format ===\n');
  
  // Look at rows 3-6 (should be volume 1 data)
  for (let i = 3; i <= 6 && i < rows.length; i++) {
    const $row = rows.eq(i);
    const cells = $row.find('td');
    
    console.log(`\nRow ${i} (${cells.length} cells):`);
    cells.each((j, cell) => {
      const $cell = $(cell);
      const text = $cell.text().trim();
      console.log(`  Cell ${j}: "${text.substring(0, 150)}${text.length > 150 ? '...' : ''}"`);
      
      // Check for chapter patterns
      if (text.includes('001.') || text.includes('Chapter')) {
        console.log('    -> This looks like a chapter cell!');
        
        // Try to parse chapters
        const lines = text.split('\n').map(l => l.trim()).filter(l => l);
        console.log(`    -> ${lines.length} lines found`);
        
        // Show first few lines
        lines.slice(0, 5).forEach((line, idx) => {
          console.log(`       Line ${idx}: "${line}"`);
          
          // Try different patterns
          const patterns = [
            /^(\d{3})\.\s+(.+)$/,  // 001. Title
            /^Chapter\s+(\d+):\s*(.+)$/i,  // Chapter 1: Title
            /^(\d+)\.\s+(.+)$/,  // 1. Title
          ];
          
          patterns.forEach((pattern, patIdx) => {
            const match = line.match(pattern);
            if (match) {
              console.log(`         -> Pattern ${patIdx} matched! Chapter: ${match[1]}, Title: ${match[2]}`);
            }
          });
        });
      }
    });
  }
}

debugHunterFormat().catch(console.error);