import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

async function checkTokyoGhoulVolumes() {
  console.log('🔍 Checking Tokyo Ghoul Volume Pages\n');
  
  // Try different URL patterns
  const urls = [
    'https://tokyoghoul.fandom.com/wiki/Tokyo_Ghoul/Volumes',
    'https://tokyoghoul.fandom.com/wiki/Tokyo_Ghoul_Volumes',
    'https://tokyoghoul.fandom.com/wiki/Volumes',
    'https://tokyoghoul.fandom.com/wiki/List_of_Tokyo_Ghoul_chapters'
  ];
  
  for (const url of urls) {
    console.log(`\n📄 Checking: ${url}`);
    
    try {
      const response = await fetch(url);
      
      if (response.status === 200) {
        const html = await response.text();
        const $ = cheerio.load(html);
        
        console.log(`✓ Page exists (status ${response.status})`);
        
        // Quick content check
        const tables = $('table');
        const lists = $('ul, ol').filter((_, list) => {
          const text = $(list).text();
          return text.includes('Chapter') || text.includes('Volume');
        });
        const headers = $('h2, h3').filter((_, h) => {
          const text = $(h).text();
          return text.includes('Volume') || text.includes('Chapter');
        });
        
        console.log(`  Tables: ${tables.length}`);
        console.log(`  Volume/Chapter lists: ${lists.length}`);
        console.log(`  Volume/Chapter headers: ${headers.length}`);
        
        // If we found content, analyze it more
        if (tables.length > 0 || lists.length > 0 || headers.length > 0) {
          console.log('\n  📊 Detailed Analysis:');
          
          if (tables.length > 0) {
            const firstTable = tables.first();
            const rows = firstTable.find('tr');
            console.log(`    First table: ${rows.length} rows`);
            console.log(`    Table classes: ${firstTable.attr('class') || 'none'}`);
            
            const firstRow = rows.first();
            console.log(`    Header: "${firstRow.text().trim().substring(0, 100)}..."`);
          }
          
          if (headers.length > 0) {
            console.log(`\n    Headers found:`);
            headers.slice(0, 5).each((i, h) => {
              console.log(`      ${i + 1}. "${$(h).text().trim()}"`);
            });
          }
        }
      } else {
        console.log(`✗ Page not found (status ${response.status})`);
      }
    } catch (error) {
      console.log(`✗ Error: ${error.message}`);
    }
  }
  
  // Also check the main Tokyo Ghoul page for volume info
  console.log('\n\n📚 Checking main Tokyo Ghoul manga page:\n');
  
  const mainUrl = 'https://tokyoghoul.fandom.com/wiki/Tokyo_Ghoul_(manga)';
  const response = await fetch(mainUrl);
  const html = await response.text();
  const $ = cheerio.load(html);
  
  // Look for navigation boxes or infoboxes
  const navboxes = $('.navbox, .navigation-box');
  const infobox = $('.portable-infobox, .infobox');
  
  console.log(`Navigation boxes: ${navboxes.length}`);
  console.log(`Infoboxes: ${infobox.length}`);
  
  // Check for volume information in the page
  const volumeInfo = $('*').filter((_, el) => {
    const text = $(el).text();
    return /\d+\s+volumes?/i.test(text) && text.length < 100;
  });
  
  console.log(`\nElements mentioning volume count: ${volumeInfo.length}`);
  volumeInfo.slice(0, 3).each((i, el) => {
    console.log(`  ${i + 1}. ${el.tagName}: "${$(el).text().trim()}"`);
  });
}

checkTokyoGhoulVolumes().catch(console.error);