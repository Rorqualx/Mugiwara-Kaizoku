import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

async function investigateTokyoGhoul() {
  const url = 'https://tokyoghoul.fandom.com/wiki/Tokyo_Ghoul_(manga)';
  console.log('Investigating Tokyo Ghoul page structure...\n');
  
  const response = await fetch(url);
  console.log(`Status: ${response.status}`);
  
  const html = await response.text();
  const $ = cheerio.load(html);
  
  // Check page content
  const title = $('title').text();
  console.log(`Page title: ${title}`);
  
  // Look for tables
  const tables = $('table');
  console.log(`\nTables found: ${tables.length}`);
  
  if (tables.length > 0) {
    tables.each((i, table) => {
      const $table = $(table);
      const className = $table.attr('class') || 'none';
      const tableText = $table.text();
      
      // Check for volume/chapter content
      if (tableText.includes('Volume') || tableText.includes('Chapter')) {
        console.log(`\nTable ${i}:`);
        console.log(`  Class: ${className}`);
        console.log(`  Contains Volume: ${/Volume\s+\d+/i.test(tableText)}`);
        console.log(`  Contains Chapter: ${/Chapter\s+\d+/i.test(tableText)}`);
        
        const rows = $table.find('tr').length;
        console.log(`  Rows: ${rows}`);
        
        // Check structure
        if (rows < 50) {
          $table.find('tr').slice(0, 5).each((j, row) => {
            const cells = $(row).find('td, th');
            console.log(`    Row ${j}: ${cells.length} cells`);
            if (cells.length > 0 && cells.length <= 5) {
              const firstCell = cells.eq(0).text().trim().substring(0, 50);
              console.log(`      First cell: "${firstCell}"`);
            }
          });
        }
      }
    });
  }
  
  // Look for volume lists in other structures
  const volumeSections = $('h2, h3').filter((_, el) => {
    return /Volume\s+\d+/i.test($(el).text());
  });
  
  console.log(`\nVolume section headers: ${volumeSections.length}`);
  if (volumeSections.length > 0) {
    volumeSections.slice(0, 3).each((i, section) => {
      console.log(`  - ${$(section).text().trim()}`);
    });
  }
  
  // Check for gallery structures
  const galleries = $('.wikia-gallery, .gallery');
  console.log(`\nGalleries: ${galleries.length}`);
  
  // Check for navigation boxes
  const navboxes = $('.navbox, .mw-collapsible');
  console.log(`Navigation boxes: ${navboxes.length}`);
  
  navboxes.each((i, nav) => {
    const navText = $(nav).text();
    if (navText.includes('Volume') || navText.includes('Chapter')) {
      console.log(`  Navbox ${i} contains volume/chapter info`);
    }
  });
}

investigateTokyoGhoul().catch(console.error);