import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

async function countVolumeTables() {
  try {
    const response = await fetch('https://onepiece.fandom.com/wiki/Chapters_and_Volumes/Volumes');
    const html = await response.text();
    const $ = cheerio.load(html);
    
    let actualVolumeTables = 0;
    let navigationTables = 0;
    
    $('table').each((i, table) => {
      const firstCell = $(table).find('tr').first().find('td').first();
      const cellText = firstCell.text().trim();
      
      if (/^Volume\\s+\\d+$/.test(cellText)) {
        actualVolumeTables++;
        
        // Check if it's parsing correctly
        if (actualVolumeTables <= 3) {
          console.log(`\\nVolume table ${actualVolumeTables}: ${cellText}`);
          const rows = $(table).find('tr');
          
          // Check row 2 (should be Japan)
          const row2 = rows.eq(2);
          const row2Cells = row2.find('td');
          if (row2Cells.length === 4) {
            console.log(`  Japan title: "${row2Cells.eq(0).text().trim()}"`);
            console.log(`  Japan ISBN: "${row2Cells.eq(3).text().trim()}"`);
          }
        }
      } else if (cellText.includes('Volume')) {
        navigationTables++;
      }
    });
    
    console.log(`\\nTotal actual volume tables: ${actualVolumeTables}`);
    console.log(`Navigation/other tables with "Volume": ${navigationTables}`);
    
  } catch (error) {
    console.error('Error:', error);
  }
}

countVolumeTables();