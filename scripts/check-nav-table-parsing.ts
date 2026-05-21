import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

async function checkNavTableParsing() {
  try {
    const response = await fetch('https://onepiece.fandom.com/wiki/Chapters_and_Volumes/Volumes');
    const html = await response.text();
    const $ = cheerio.load(html);
    
    console.log('Checking navigation table (table 1)...\\n');
    
    const navTable = $('table').eq(1);
    const tableText = navTable.text();
    
    // Check pattern matches
    console.log('Pattern checks:');
    console.log(`  Fire Force: ${/\\(Volume\\s+\\d+\\)/i.test(tableText)}`);
    console.log(`  Attack on Titan: ${tableText.includes('Chapters list:') && /Volume\\s+\\d+/i.test(tableText)}`);
    console.log(`  Demon Slayer: ${tableText.includes('Chapters List:')}`);
    console.log(`  Generic: ${(tableText.includes('Chapters:') || tableText.includes('Chapters list:') || 
                              tableText.includes('Chapter list:') || tableText.includes('Chapter List:')) &&
                             tableText.includes('ISBN')}`);
    
    // Check cells
    console.log('\\nChecking cells:');
    const rows = navTable.find('tr');
    
    rows.each((i, row) => {
      if (i > 2) return; // Only check first few rows
      
      const cells = $(row).find('td');
      console.log(`\\nRow ${i}: ${cells.length} cells`);
      
      cells.slice(0, 3).each((j, cell) => {
        const cellText = $(cell).text().trim();
        console.log(`  Cell ${j}: "${cellText}"`);
        
        // Check if this would be parsed as a volume
        const volumeMatch = cellText.match(/Volume(\\d+)/);
        if (volumeMatch) {
          console.log(`    -> Would extract volume ${volumeMatch[1]}`);
        }
      });
    });
    
    // Check if this matches arc-based pattern
    console.log('\\nArc-based pattern check:');
    console.log(`  Contains "Chapters": ${tableText.includes('Chapters')}`);
    console.log(`  Contains "Volume": ${tableText.includes('Volume')}`);
    console.log(`  Would match arc-based: ${tableText.includes('Chapters') && tableText.includes('Volume')}`);
    
  } catch (error) {
    console.error('Error:', error);
  }
}

checkNavTableParsing();