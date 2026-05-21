import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

async function checkVolumeHeaders() {
  try {
    const response = await fetch('https://onepiece.fandom.com/wiki/Chapters_and_Volumes/Volumes');
    const html = await response.text();
    const $ = cheerio.load(html);
    
    console.log('Checking h2/h3 headers on the page...\\n');
    
    const volumeHeaders = $('h2, h3').filter((_, el) => {
      const text = $(el).text();
      return /Volume\s+\d+/i.test(text);
    });
    
    console.log(`Found ${volumeHeaders.length} headers with "Volume X" pattern:\\n`);
    
    volumeHeaders.each((i, header) => {
      const headerText = $(header).text();
      const tagName = header.tagName;
      
      console.log(`${i}. ${tagName}: "${headerText}"`);
      
      // Extract volume number
      const volumeMatch = headerText.match(/Volume\s+(\d+)/i);
      if (volumeMatch) {
        console.log(`   -> Would extract volume ${volumeMatch[1]}`);
      }
      
      // Check what follows this header
      let nextElement = $(header).next();
      let foundTable = false;
      
      while (nextElement.length && !nextElement.is('h2, h3') && !foundTable) {
        if (nextElement.is('table')) {
          foundTable = true;
          console.log(`   -> Has table after header`);
          
          // Check if this table has chapters
          const tableText = nextElement.text();
          if (tableText.includes('Chapters') || tableText.includes('Chapter')) {
            console.log(`      Table contains chapters`);
          }
        }
        nextElement = nextElement.next();
      }
    });
    
  } catch (error) {
    console.error('Error:', error);
  }
}

checkVolumeHeaders();