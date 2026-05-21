import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

async function debugWhichVolumes() {
  try {
    const response = await fetch('https://onepiece.fandom.com/wiki/Chapters_and_Volumes/Volumes');
    const html = await response.text();
    const $ = cheerio.load(html);
    
    console.log('Checking all tables for volume pattern...\\n');
    
    const volumeTables: number[] = [];
    
    $('table').each((i, table) => {
      const tableText = $(table).text();
      
      // Check all patterns that would be processed
      let pattern = null;
      
      if (/\(Volume\s+\d+\)/i.test(tableText)) {
        pattern = 'Fire Force style';
      } else if (tableText.includes('Chapters list:') && /Volume\s+\d+/i.test(tableText)) {
        pattern = 'Attack on Titan style';
      } else if (tableText.includes('Chapters List:')) {
        pattern = 'Demon Slayer style';
      } else if ((tableText.includes('Chapters:') || tableText.includes('Chapters list:') || 
                  tableText.includes('Chapter list:') || tableText.includes('Chapter List:')) &&
                 tableText.includes('ISBN')) {
        pattern = 'Generic style';
      } else {
        const firstCell = $(table).find('tr').first().find('td, th').first();
        if (firstCell.length > 0) {
          const cellText = firstCell.text().trim();
          if (/^Volume\s+\d+$/.test(cellText)) {
            pattern = 'One Piece Volumes style';
            volumeTables.push(i);
          }
        }
      }
      
      if (pattern && i < 20) {
        console.log(`Table ${i}: ${pattern}`);
        if (pattern === 'One Piece Volumes style') {
          const firstCell = $(table).find('tr').first().find('td').first();
          console.log(`  Volume: ${firstCell.text().trim()}`);
        }
      }
    });
    
    console.log(`\\nTotal One Piece style volume tables: ${volumeTables.length}`);
    console.log(`Table indices: ${volumeTables.slice(0, 10).join(', ')}...`);
    
  } catch (error) {
    console.error('Error:', error);
  }
}

debugWhichVolumes();