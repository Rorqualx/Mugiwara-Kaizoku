import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

async function analyzeMobPsychoContent() {
  console.log('🔍 Analyzing Mob Psycho 100 Content Structure\n');
  
  const url = 'https://mob-psycho-100.fandom.com/wiki/Chapters';
  const response = await fetch(url);
  const html = await response.text();
  const $ = cheerio.load(html);
  
  // Look for volume headers and their following content
  const volumeHeaders = $('h3');
  
  volumeHeaders.each((i, header) => {
    const $header = $(header);
    const headerText = $header.text().trim();
    
    if (headerText.includes('Volume')) {
      console.log(`\n📖 ${headerText}`);
      
      // Look at the next elements after this header
      let $next = $header.next();
      let elementCount = 0;
      
      while ($next.length && elementCount < 10 && !$next.is('h3')) {
        const tagName = $next.prop('tagName');
        const text = $next.text().trim();
        
        if (tagName === 'UL' || tagName === 'OL') {
          console.log(`  Found list (${tagName}):`);
          $next.find('li').each((j, li) => {
            if (j < 5) { // Show first 5 items
              const liText = $(li).text().trim();
              console.log(`    - ${liText}`);
            }
          });
        } else if (tagName === 'P' && text.length > 0) {
          console.log(`  Paragraph: ${text.substring(0, 100)}...`);
        } else if (tagName === 'DIV') {
          const classes = $next.attr('class') || '';
          console.log(`  DIV (${classes}): ${text.substring(0, 100)}...`);
        }
        
        $next = $next.next();
        elementCount++;
      }
    }
  });
  
  // Also check for any galleries
  console.log('\n🖼️ Galleries:');
  const galleries = $('.wikia-gallery, .gallery');
  console.log(`Found ${galleries.length} galleries`);
}

analyzeMobPsychoContent().catch(console.error);