import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

async function debugMonsterPattern() {
  console.log('🔍 Debugging Monster Pattern Detection\n');
  
  const url = 'https://obluda.fandom.com/wiki/List_of_chapters';
  const response = await fetch(url);
  const html = await response.text();
  const $ = cheerio.load(html);
  
  // Check if single table pattern is detected
  let hasLargeTable = false;
  
  $('table').each((i, table) => {
    const $table = $(table);
    const rows = $table.find('tr');
    
    console.log(`Table ${i}: ${rows.length} rows`);
    
    if (rows.length > 20) {
      console.log('  ✓ Has more than 20 rows');
      
      let volumeHeaders = 0;
      let chapterRows = 0;
      
      rows.each((j, row) => {
        const cells = $(row).find('td, th');
        const rowText = $(row).text();
        
        // Volume header check
        if (cells.length === 1 && cells.attr('colspan')) {
          const text = cells.text();
          if (/Volume\s+\d+(?:\s*:|$)/i.test(text)) {
            volumeHeaders++;
            if (volumeHeaders <= 3) {
              console.log(`  Volume ${volumeHeaders}: "${text.trim()}"`);
            }
          }
        }
        
        // Chapter check
        cells.each((_, cell) => {
          const cellText = $(cell).text();
          const cellHtml = $(cell).html() || '';
          
          if (cellHtml.includes('<li>') && /\d{3}\./.test(cellText)) {
            chapterRows++;
          }
        });
      });
      
      console.log(`  Total volume headers: ${volumeHeaders}`);
      console.log(`  Total chapter rows: ${chapterRows}`);
      console.log(`  Pattern detected: ${volumeHeaders >= 3}`);
      
      if (volumeHeaders >= 3) {
        hasLargeTable = true;
      }
    }
    console.log('');
  });
  
  console.log(`\nSingle large table pattern detected: ${hasLargeTable}`);
  
  // Now check if pattern would actually be used
  const detectGalleryBasedLayout = () => {
    const galleries = $('.wikia-gallery, .gallery');
    return galleries.length > 0 && galleries.find('.wikia-gallery-item, .gallerybox').length >= 3;
  };
  
  const detectCollapsibleNavigation = () => {
    const collapsibles = $('.mw-collapsible');
    return collapsibles.find('tr').filter((_, row) => /Volume\s+\d+/i.test($(row).text())).length >= 3;
  };
  
  console.log('\nPattern priority check:');
  console.log(`Gallery-based layout: ${detectGalleryBasedLayout()}`);
  console.log(`Collapsible navigation: ${detectCollapsibleNavigation()}`);
  console.log(`Single large table: ${hasLargeTable}`);
}

debugMonsterPattern().catch(console.error);