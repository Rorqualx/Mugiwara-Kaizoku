import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

async function debugParserLogic() {
  try {
    console.log('Fetching One Piece volumes page...');
    const response = await fetch('https://onepiece.fandom.com/wiki/Chapters_and_Volumes/Volumes');
    const html = await response.text();
    
    const $ = cheerio.load(html);
    
    // Find Volume 1 table
    let volume1Table: cheerio.Cheerio<any> | null = null;
    
    $('table').each((i, table) => {
      const firstCell = $(table).find('tr').first().find('td, th').first();
      if (firstCell.text().trim() === 'Volume 1') {
        volume1Table = $(table);
        console.log(`Found Volume 1 at table index ${i}`);
        return false;
      }
    });
    
    if (!volume1Table) {
      console.log('Volume 1 table not found!');
      return;
    }
    
    console.log('\\nParsing Volume 1 table...\\n');
    
    // Simulate parseOnePieceVolumesStyleTable logic
    const rows = volume1Table.find('tr');
    const firstRowText = rows.first().text().trim();
    
    console.log(`First row text: "${firstRowText}"`);
    
    // Extract volume number from first row
    const volumeMatch = firstRowText.match(/Volume\\s+(\\d+)/i);
    console.log(`Volume match result:`, volumeMatch);
    
    if (!volumeMatch) {
      console.log('No volume match!');
      return;
    }
    
    const volumeNumber = parseInt(volumeMatch[1], 10);
    console.log(`Volume number: ${volumeNumber}`);
    
    // Parse each row
    rows.each((i, row) => {
      const cells = $(row).find('td');
      const rowText = $(row).text();
      
      console.log(`\\nRow ${i} (${cells.length} cells):`);
      console.log(`Row text preview: "${rowText.substring(0, 100)}..."`);
      
      // Check what the parser is looking for
      if (rowText.includes('Volume') || (rowText.includes('Title') && rowText.includes('Release Date'))) {
        console.log('  -> Skipping header/volume row');
        return;
      }
      
      // Japan/US info rows
      if (cells.length >= 5) {
        const region = cells.eq(0).text().trim();
        const title = cells.eq(1).text().trim();
        const releaseDate = cells.eq(2).text().trim();
        const pages = cells.eq(3).text().trim();
        const isbn = cells.eq(4).text().trim();
        
        console.log(`  Region: "${region}"`);
        console.log(`  Title: "${title}"`);
        console.log(`  Release Date: "${releaseDate}"`);
        console.log(`  Pages: "${pages}"`);
        console.log(`  ISBN: "${isbn}"`);
        
        if (region === 'Japan') {
          console.log('  -> Japan row detected!');
        } else if (region === 'US') {
          console.log('  -> US row detected!');
        }
      }
      
      // Chapters row
      if (rowText.includes('Chapters')) {
        console.log('  -> Chapters row detected!');
        
        // Debug chapter extraction
        const chapterCell = cells.filter((_, cell) => $(cell).text().includes('Chapters')).first();
        if (chapterCell.length > 0) {
          console.log('    Found chapter cell');
          
          // Look for list items
          const listItems = chapterCell.find('li');
          console.log(`    List items: ${listItems.length}`);
          
          if (listItems.length === 0) {
            // Try text splitting
            const chapterText = chapterCell.text();
            const lines = chapterText.split('\\n');
            console.log(`    Lines after split: ${lines.length}`);
            console.log(`    First few lines:`);
            lines.slice(0, 5).forEach((line, j) => {
              console.log(`      ${j}: "${line.trim()}"`);
            });
          }
        }
      }
    });
    
  } catch (error) {
    console.error('Error:', error);
  }
}

debugParserLogic();