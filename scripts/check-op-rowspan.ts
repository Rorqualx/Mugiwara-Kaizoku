import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

async function checkRowspan() {
  try {
    console.log('Fetching One Piece volumes page...');
    const response = await fetch('https://onepiece.fandom.com/wiki/Chapters_and_Volumes/Volumes');
    const html = await response.text();
    
    const $ = cheerio.load(html);
    
    // Find Volume 1 table
    $('table').each((i, table) => {
      const firstCell = $(table).find('tr').first().find('td, th').first();
      if (firstCell.text().trim() === 'Volume 1') {
        console.log(`\\nAnalyzing Volume 1 table HTML structure...\\n`);
        
        // Get the actual HTML structure
        const tableHtml = $(table).html();
        
        // Look for Japan row specifically
        const japanRowMatch = tableHtml.match(/<tr[^>]*>([\s\S]*?Japan[\s\S]*?)<\/tr>/i);
        if (japanRowMatch) {
          console.log('Japan row HTML:');
          console.log(japanRowMatch[0].substring(0, 500));
        }
        
        // Check for rowspan
        if (tableHtml.includes('rowspan')) {
          console.log('\\nTable uses rowspan!');
          
          // Find all rowspan instances
          const rowspanMatches = tableHtml.match(/rowspan=["']?(\\d+)["']?/gi);
          if (rowspanMatches) {
            console.log('Rowspan instances found:', rowspanMatches);
          }
        }
        
        return false;
      }
    });
    
  } catch (error) {
    console.error('Error:', error);
  }
}

checkRowspan();