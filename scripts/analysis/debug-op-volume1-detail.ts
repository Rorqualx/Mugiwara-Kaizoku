import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

async function debugVolume1Detail() {
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
    
    console.log('\\nAnalyzing Volume 1 table structure...\\n');
    
    const rows = volume1Table.find('tr');
    console.log(`Total rows: ${rows.length}`);
    
    rows.each((i, row) => {
      const cells = $(row).find('td');
      const rowText = $(row).text();
      
      console.log(`\\nRow ${i}:`);
      console.log(`  Cell count: ${cells.length}`);
      console.log(`  Row text (first 150 chars): "${rowText.substring(0, 150).replace(/\\n/g, '\\\\n')}..."`);
      
      if (cells.length > 0) {
        cells.each((j, cell) => {
          const cellText = $(cell).text().trim();
          console.log(`  Cell ${j}: "${cellText.substring(0, 80)}${cellText.length > 80 ? '...' : ''}"`);
        });
      }
      
      // Check specific conditions
      if (i === 1 && rowText.includes('Title') && rowText.includes('Release Date')) {
        console.log('  -> This is the header row');
      }
      
      if (cells.length === 5) {
        const firstCellText = cells.eq(0).text().trim();
        if (firstCellText === 'Japan' || firstCellText === 'US') {
          console.log(`  -> This is a ${firstCellText} info row`);
        }
      }
      
      if (rowText.includes('Chapters')) {
        console.log('  -> This is the chapters row');
        
        // Check chapter cell structure
        const chapterCell = cells.filter((_, cell) => $(cell).text().includes('Chapters')).first();
        if (chapterCell.length > 0) {
          const listItems = chapterCell.find('li');
          console.log(`    List items found: ${listItems.length}`);
          
          if (listItems.length > 0) {
            console.log('    First 3 chapter list items:');
            listItems.slice(0, 3).each((k, li) => {
              console.log(`      - "${$(li).text().trim()}"`);
            });
          }
        }
      }
    });
    
  } catch (error) {
    console.error('Error:', error);
  }
}

debugVolume1Detail();