import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

async function analyzeOnePieceVolumesStructure() {
  try {
    console.log('Fetching One Piece volumes page...');
    const response = await fetch('https://onepiece.fandom.com/wiki/Chapters_and_Volumes/Volumes');
    const html = await response.text();
    
    const $ = cheerio.load(html);
    
    console.log('\nAnalyzing page structure...');
    
    // Count basic elements
    console.log(`Total tables: ${$('table').length}`);
    console.log(`Total h2 headers: ${$('h2').length}`);
    console.log(`Total h3 headers: ${$('h3').length}`);
    
    // Look for volume headers
    console.log('\nChecking headers:');
    $('h2, h3').each((i, header) => {
      const text = $(header).text();
      if (/Volume\s+\d+/i.test(text)) {
        console.log(`${header.tagName}: "${text}"`);
        if (i < 3) {
          // Check what follows this header
          let next = $(header).next();
          let foundTable = false;
          for (let j = 0; j < 5 && next.length > 0; j++) {
            console.log(`  Next element: ${next.prop('tagName')}`);
            if (next.is('table')) {
              foundTable = true;
              console.log('    ^ Found table after header!');
              break;
            }
            next = next.next();
          }
        }
      }
    });
    
    // Check first few tables
    console.log('\nChecking first few tables:');
    $('table').slice(0, 3).each((i, table) => {
      console.log(`\nTable ${i}:`);
      const rows = $(table).find('tr');
      console.log(`  Rows: ${rows.length}`);
      
      // Show first few rows
      rows.slice(0, 5).each((j, row) => {
        const cells = $(row).find('td, th');
        const text = $(row).text().trim().substring(0, 100);
        console.log(`  Row ${j} (${cells.length} cells): "${text}..."`);
      });
      
      // Check if it contains volume data
      const tableText = $(table).text();
      console.log(`  Contains "Japan": ${tableText.includes('Japan')}`);
      console.log(`  Contains "Chapters": ${tableText.includes('Chapters')}`);
      console.log(`  Contains "Cover character": ${tableText.includes('Cover character')}`);
      console.log(`  Contains "ISBN": ${tableText.includes('ISBN')}`);
    });
    
    // Look for a specific volume 1 pattern
    console.log('\n\nLooking for Volume 1 specific content:');
    const pageText = $('body').text();
    const romanceDawnIndex = pageText.indexOf('ROMANCE DAWN');
    if (romanceDawnIndex !== -1) {
      console.log('Found "ROMANCE DAWN" in page');
      
      // Find the element containing it
      $('*').each((_, el) => {
        const elText = $(el).text();
        if (elText.includes('ROMANCE DAWN') && elText.includes('December 24, 1997')) {
          console.log(`\nFound Volume 1 data in ${el.tagName}:`);
          if ($(el).is('table')) {
            console.log('  It\'s a table!');
            const rows = $(el).find('tr');
            rows.slice(0, 10).each((i, row) => {
              console.log(`  Row ${i}: "${$(row).text().trim().substring(0, 100)}..."`);
            });
          } else if ($(el).parent().is('table')) {
            console.log('  Parent is a table!');
          }
          return false; // Stop once found
        }
      });
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
}

analyzeOnePieceVolumesStructure();