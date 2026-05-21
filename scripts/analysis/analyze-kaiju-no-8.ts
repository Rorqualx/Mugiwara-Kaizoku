import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

async function analyzeKaijuNo8() {
  console.log('🔍 Analyzing Kaiju No. 8 Unique Pattern\n');
  
  const urls = [
    { name: 'Main Page', url: 'https://kaiju-no-8.fandom.com/wiki/Kaiju_No._8_(manga)' },
    { name: 'Volumes Category', url: 'https://kaiju-no-8.fandom.com/wiki/Category:Volumes' },
    { name: 'Chapters Category', url: 'https://kaiju-no-8.fandom.com/wiki/Category:Chapters' }
  ];
  
  for (const { name, url } of urls) {
    console.log(`\n📄 Analyzing ${name}...`);
    console.log(`URL: ${url}`);
    
    const response = await fetch(url);
    const html = await response.text();
    const $ = cheerio.load(html);
    
    // Check for tables
    const tables = $('table');
    console.log(`Tables found: ${tables.length}`);
    
    if (tables.length > 0) {
      tables.slice(0, 3).each((i, table) => {
        const $table = $(table);
        const rows = $table.find('tr').length;
        const classes = $table.attr('class') || 'none';
        console.log(`  Table ${i}: ${rows} rows, classes: ${classes}`);
      });
    }
    
    // Check for category listings
    if (url.includes('Category:')) {
      const categoryPages = $('.category-page__member-link');
      console.log(`\nCategory pages found: ${categoryPages.length}`);
      
      if (categoryPages.length > 0) {
        console.log('Sample entries:');
        categoryPages.slice(0, 5).each((i, link) => {
          const text = $(link).text().trim();
          const href = $(link).attr('href');
          console.log(`  - "${text}" -> ${href}`);
        });
      }
    }
    
    // Check for infobox
    const infobox = $('.infobox, .portable-infobox');
    if (infobox.length > 0) {
      console.log('\n✅ Found infobox!');
      
      // Look for volume/chapter count
      const rows = infobox.find('tr, .pi-item');
      rows.each((_, row) => {
        const $row = $(row);
        const label = $row.find('th, .pi-data-label').text().trim();
        const value = $row.find('td, .pi-data-value').text().trim();
        
        if (label && (label.toLowerCase().includes('volume') || label.toLowerCase().includes('chapter'))) {
          console.log(`  ${label}: ${value}`);
        }
      });
    }
    
    // Check for navigation boxes
    const navbox = $('.navbox, .navbox-list');
    if (navbox.length > 0) {
      console.log('\n✅ Found navigation box!');
      const links = navbox.find('a');
      const volumeLinks = links.filter((_, link) => $(link).text().includes('Volume'));
      const chapterLinks = links.filter((_, link) => $(link).text().includes('Chapter'));
      
      console.log(`  Volume links: ${volumeLinks.length}`);
      console.log(`  Chapter links: ${chapterLinks.length}`);
      
      if (volumeLinks.length > 0) {
        console.log('\nSample volume links:');
        volumeLinks.slice(0, 3).each((_, link) => {
          console.log(`  - ${$(link).text()}`);
        });
      }
    }
  }
}

analyzeKaijuNo8().catch(console.error);