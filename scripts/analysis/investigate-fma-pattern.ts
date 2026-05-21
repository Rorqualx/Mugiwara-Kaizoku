import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

async function investigateFMA() {
  const url = 'https://fma.fandom.com/wiki/Fullmetal_Alchemist_(manga)';
  console.log('Investigating Fullmetal Alchemist page structure...\n');
  
  const response = await fetch(url);
  console.log(`Status: ${response.status}`);
  
  const html = await response.text();
  const $ = cheerio.load(html);
  
  // Check page title
  const title = $('title').text();
  console.log(`Page title: ${title}`);
  
  // Look for tables
  const tables = $('table');
  console.log(`\nTables found: ${tables.length}`);
  
  // Look for volume/chapter headings
  const volumeHeadings = $('h2, h3, h4').filter((_, el) => {
    const text = $(el).text();
    return /Volume\s+\d+/i.test(text);
  });
  console.log(`Volume headings: ${volumeHeadings.length}`);
  
  if (volumeHeadings.length > 0) {
    console.log('\nFirst few volume headings:');
    volumeHeadings.slice(0, 5).each((i, heading) => {
      const $heading = $(heading);
      const text = $heading.text().trim();
      console.log(`  ${$heading.prop('tagName')}: "${text}"`);
      
      // Check what follows the heading
      const nextElement = $heading.next();
      if (nextElement.length > 0) {
        const nextTag = nextElement.prop('tagName').toLowerCase();
        console.log(`    Next element: <${nextTag}>`);
        
        if (nextTag === 'ul' || nextTag === 'ol') {
          const items = nextElement.find('li');
          console.log(`    List with ${items.length} items`);
          if (items.length > 0) {
            const firstItem = items.first().text().trim().substring(0, 60);
            console.log(`    First item: "${firstItem}..."`);
          }
        }
      }
    });
  }
  
  // Look for chapter lists
  const chapterLists = $('ul, ol').filter((_, el) => {
    const text = $(el).text();
    return /Chapter\s+\d+/i.test(text) || /\d+\.\s+\w+/.test(text);
  });
  console.log(`\nChapter lists: ${chapterLists.length}`);
  
  // Look for div structures with volume info
  const volumeDivs = $('div').filter((_, el) => {
    const $el = $(el);
    const text = $el.text();
    const hasVolume = /Volume\s+\d+/i.test(text);
    const hasChapter = /Chapter\s+\d+/i.test(text);
    const isReasonableSize = text.length < 2000;
    return hasVolume && hasChapter && isReasonableSize;
  });
  
  console.log(`\nDivs with volume & chapter info: ${volumeDivs.length}`);
  
  // Check specific patterns
  const pageText = $('body').text();
  const hasVolumePattern = /Volume\s+\d+:/i.test(pageText);
  const hasChapterPattern = /Chapter\s+\d+:/i.test(pageText);
  
  console.log(`\nPage contains:`);
  console.log(`  "Volume X:" pattern: ${hasVolumePattern}`);
  console.log(`  "Chapter X:" pattern: ${hasChapterPattern}`);
}

investigateFMA().catch(console.error);