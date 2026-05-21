import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

async function analyzeChainsawManChaptersVolumes() {
  console.log('🔍 Analyzing Chainsaw Man Chapters and Volumes Page\n');
  
  const url = 'https://chainsaw-man.fandom.com/wiki/Chapters_and_Volumes';
  const response = await fetch(url);
  const html = await response.text();
  const $ = cheerio.load(html);
  
  // Check all tables
  const tables = $('table');
  console.log(`Found ${tables.length} tables total\n`);
  
  tables.each((i, table) => {
    const $table = $(table);
    const rows = $table.find('tr').length;
    const classes = $table.attr('class') || 'no classes';
    const firstRow = $table.find('tr').first().text().trim();
    
    console.log(`Table ${i + 1}:`);
    console.log(`  Classes: ${classes}`);
    console.log(`  Rows: ${rows}`);
    console.log(`  First row: ${firstRow.substring(0, 100)}${firstRow.length > 100 ? '...' : ''}`);
    
    // Check if it looks like a volume table
    if (firstRow.includes('Volume') || firstRow.includes('Chapter') || 
        $table.text().includes('Volume') || rows < 15) {
      console.log(`  → Potential volume/chapter table!`);
      
      // Show some sample rows
      console.log('  Sample content:');
      $table.find('tr').slice(0, 5).each((j, row) => {
        const rowText = $(row).text().trim().replace(/\s+/g, ' ');
        console.log(`    Row ${j + 1}: ${rowText.substring(0, 150)}${rowText.length > 150 ? '...' : ''}`);
      });
      
      // Check for chapter patterns
      const tableText = $table.text();
      if (tableText.includes('Chapter')) {
        const chapterMatches = tableText.match(/Chapter \d+/g);
        if (chapterMatches) {
          console.log(`  → Found ${chapterMatches.length} chapter references`);
        }
      }
    }
    
    console.log('');
  });
}

analyzeChainsawManChaptersVolumes().catch(console.error);