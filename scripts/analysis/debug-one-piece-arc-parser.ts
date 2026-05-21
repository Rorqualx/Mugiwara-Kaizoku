import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

async function debugOnePieceArcParser() {
  try {
    console.log('Fetching One Piece chapters page...');
    const response = await fetch('https://onepiece.fandom.com/wiki/Chapters_and_Volumes');
    const html = await response.text();
    
    const $ = cheerio.load(html);
    
    console.log('\nLooking for arc patterns...\n');
    
    // Look for cells containing arc patterns
    let foundArcs = 0;
    $('td').each((i, cell) => {
      const cellText = $(cell).text();
      
      // Check for arc pattern
      if (cellText.includes('Arc(Chapters') && cellText.includes('Volume')) {
        foundArcs++;
        if (foundArcs <= 5) { // Show first 5
          console.log(`Arc ${foundArcs}:`);
          console.log(`Text: "${cellText.trim()}"`);
          
          // Test the regex
          const arcMatch = cellText.match(/([^(]+)\(Chapters\s+(\d+)\s+to\s+(\d+),\s*(?:Volume(?:s)?\s+)(.+?)\)/);
          if (arcMatch) {
            console.log('  Parsed:');
            console.log(`    Arc Name: ${arcMatch[1].trim()}`);
            console.log(`    Start Chapter: ${arcMatch[2]}`);
            console.log(`    End Chapter: ${arcMatch[3]}`);
            console.log(`    Volume(s): ${arcMatch[4]}`);
          } else {
            console.log('  ❌ Regex did not match');
          }
          console.log('');
        }
      }
    });
    
    console.log(`\nTotal arc entries found: ${foundArcs}`);
    
    // Also check the table structure
    console.log('\nChecking table structures:');
    $('table').each((i, table) => {
      const tableText = $(table).text();
      if (tableText.includes('Arc(Chapters')) {
        console.log(`\nTable ${i} contains arc data`);
        const rows = $(table).find('tr');
        console.log(`  Rows: ${rows.length}`);
        
        // Show first few rows
        rows.slice(0, 3).each((j, row) => {
          const cells = $(row).find('td');
          console.log(`  Row ${j} (${cells.length} cells):`);
          cells.each((k, cell) => {
            const text = $(cell).text().trim();
            if (text && text.length < 100) {
              console.log(`    Cell ${k}: "${text}"`);
            }
          });
        });
      }
    });
    
  } catch (error) {
    console.error('Error:', error);
  }
}

debugOnePieceArcParser();