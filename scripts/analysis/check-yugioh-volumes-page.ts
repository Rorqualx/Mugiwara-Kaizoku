import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

async function checkYuGiOhVolumesPage() {
  console.log('🔍 Checking Yu-Gi-Oh! Volumes Page\n');
  
  // Try the volumes link
  const url = 'https://yugioh.fandom.com/wiki/Yu-Gi-Oh!_volumes';
  const response = await fetch(url);
  
  console.log(`URL: ${url}`);
  console.log(`Status: ${response.status}`);
  
  if (response.status === 404) {
    console.log('\n404 - Page not found. Trying alternate URLs...\n');
    
    // Try alternate URLs
    const alternateUrls = [
      'https://yugioh.fandom.com/wiki/Yu-Gi-Oh!_Volume_listing',
      'https://yugioh.fandom.com/wiki/List_of_Yu-Gi-Oh!_volumes',
      'https://yugioh.fandom.com/wiki/Yu-Gi-Oh!_Duelist_volumes',
      'https://yugioh.fandom.com/wiki/Category:Yu-Gi-Oh!_volumes'
    ];
    
    for (const altUrl of alternateUrls) {
      const altResponse = await fetch(altUrl);
      console.log(`${altUrl}: ${altResponse.status}`);
      
      if (altResponse.status === 200) {
        const html = await altResponse.text();
        const $ = cheerio.load(html);
        
        console.log(`\n✅ Found working URL: ${altUrl}`);
        console.log(`Title: ${$('title').text()}`);
        console.log(`Tables: ${$('table').length}`);
        console.log(`Links with "Volume": ${$('a:contains("Volume")').length}`);
        
        // Check for volume patterns
        const volumePattern = /Volume\s+\d+/g;
        const matches = html.match(volumePattern) || [];
        console.log(`Volume references: ${matches.length}`);
        
        break;
      }
    }
  } else {
    const html = await response.text();
    const $ = cheerio.load(html);
    
    console.log(`\nPage loaded successfully`);
    console.log(`Title: ${$('title').text()}`);
    console.log(`Tables: ${$('table').length}`);
    
    // Check tables
    const tables = $('table');
    tables.each((i, table) => {
      const $table = $(table);
      const text = $table.text();
      
      if (text.includes('Volume') || text.includes('Chapter') || text.includes('ISBN')) {
        console.log(`\nTable ${i + 1} looks relevant:`);
        console.log(`  Rows: ${$table.find('tr').length}`);
        console.log(`  Sample: ${text.substring(0, 200)}...`);
      }
    });
  }
}

checkYuGiOhVolumesPage().catch(console.error);