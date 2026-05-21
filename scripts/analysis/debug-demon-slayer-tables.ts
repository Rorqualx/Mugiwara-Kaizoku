import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

async function debugDemonSlayerTables() {
  try {
    console.log('Fetching Demon Slayer chapters page...');
    const response = await fetch('https://kimetsu-no-yaiba.fandom.com/wiki/Chapters_and_Volumes');
    const html = await response.text();
    
    const $ = cheerio.load(html);
    
    console.log('\nLooking for tables with volume data...\n');
    
    $('table').each((i, table) => {
      const tableText = $(table).text();
      
      // Check if this table has volume data
      if (tableText.includes('ISBN') || tableText.includes('Chapters List:')) {
        console.log(`=== Table ${i} ===`);
        
        // Get first few rows to understand structure
        const rows = $(table).find('tr');
        console.log(`Total rows: ${rows.length}`);
        
        rows.slice(0, 6).each((j, row) => {
          const cells = $(row).find('td, th');
          console.log(`\nRow ${j} (${cells.length} cells):`);
          
          cells.each((k, cell) => {
            const cellText = $(cell).text().trim();
            if (cellText) {
              console.log(`  Cell ${k}: "${cellText.substring(0, 100)}${cellText.length > 100 ? '...' : ''}"`);
              
              // Check if this cell contains chapter list
              if (cellText.includes('Chapters List:')) {
                console.log('    ^ This cell contains chapter list!');
                
                // Try to extract chapters
                const chapterText = cellText.replace('Chapters List:', '').trim();
                const chapterMatches = chapterText.matchAll(/(\d+)\.\s*([^0-9]+?)(?=\d+\.|$)/g);
                const chapters = Array.from(chapterMatches);
                console.log(`    Found ${chapters.length} chapters`);
                if (chapters.length > 0 && chapters.length < 5) {
                  chapters.forEach(ch => {
                    console.log(`      ${ch[1]}. ${ch[2].trim()}`);
                  });
                }
              }
            }
          });
        });
        
        console.log('\n---\n');
      }
    });
    
    // Also check what happens with first volume specifically
    console.log('Looking for Volume 1 specifically...');
    const tables = $('table');
    tables.each((i, table) => {
      const firstCell = $(table).find('td').first();
      if (firstCell.text().trim() === '1') {
        console.log(`\nFound potential Volume 1 table at index ${i}`);
        console.log('First cell content:', firstCell.text());
        console.log('Table preview:', $(table).text().substring(0, 300) + '...');
      }
    });
    
  } catch (error) {
    console.error('Error:', error);
  }
}

debugDemonSlayerTables();