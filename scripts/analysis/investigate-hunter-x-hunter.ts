import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

async function investigateHunterXHunter() {
  console.log('Fetching Hunter x Hunter page...');
  const response = await fetch('https://hunterxhunter.fandom.com/wiki/List_of_Volumes_and_Chapters');
  const html = await response.text();
  const $ = cheerio.load(html);
  
  console.log('\n=== Analyzing Hunter x Hunter Tables ===\n');
  
  const tables = $('table');
  console.log(`Total tables found: ${tables.length}\n`);
  
  // Look for volume tables
  tables.each((i, table) => {
    const $table = $(table);
    const rows = $table.find('tr');
    
    if (rows.length > 3) {
      console.log(`\nTable ${i} (${rows.length} rows):`);
      console.log(`Class: ${$table.attr('class') || 'none'}`);
      
      // Check first few rows
      console.log('\nFirst 5 rows:');
      rows.slice(0, 5).each((j, row) => {
        const $row = $(row);
        const cells = $row.find('td, th');
        const rowText = $row.text().trim().substring(0, 150);
        console.log(`\nRow ${j} (${cells.length} cells): "${rowText}${rowText.length >= 150 ? '...' : ''}"`);
        
        // Show individual cells for first few rows
        if (j < 3 && cells.length > 0) {
          cells.each((k, cell) => {
            const cellText = $(cell).text().trim().substring(0, 100);
            console.log(`  Cell ${k}: "${cellText}"`);
          });
        }
      });
      
      // Check for volume/chapter patterns
      const tableText = $table.text();
      const volumeMatches = tableText.match(/Volume\s+\d+/gi);
      const chapterMatches = tableText.match(/Chapter\s+\d+/gi);
      
      if (volumeMatches || chapterMatches) {
        console.log(`\nPatterns found:`);
        if (volumeMatches) console.log(`- Volumes: ${volumeMatches.length} (first few: ${volumeMatches.slice(0, 3).join(', ')})`);
        if (chapterMatches) console.log(`- Chapters: ${chapterMatches.length} (first few: ${chapterMatches.slice(0, 3).join(', ')})`);
      }
    }
  });
  
  // Check for divs with volume info
  console.log('\n=== Checking for volume divs ===');
  const volumeDivs = $('div').filter((_, el) => {
    const text = $(el).text();
    return /Volume\s+\d+/i.test(text) && text.length < 1000;
  });
  console.log(`Volume divs found: ${volumeDivs.length}`);
  
  // Check for tabs or collapsible content
  console.log('\n=== Checking for tabs/collapsibles ===');
  const tabs = $('.tabber, .tabs, .mw-collapsible');
  console.log(`Tab/collapsible elements: ${tabs.length}`);
}

investigateHunterXHunter().catch(console.error);