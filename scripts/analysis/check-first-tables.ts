import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

async function checkFirstTables() {
  try {
    const response = await fetch('https://onepiece.fandom.com/wiki/Chapters_and_Volumes/Volumes');
    const html = await response.text();
    const $ = cheerio.load(html);
    
    console.log('Checking first few tables...\\n');
    
    $('table').slice(0, 5).each((i, table) => {
      console.log(`\\nTable ${i}:`);
      
      const rows = $(table).find('tr');
      console.log(`  Row count: ${rows.length}`);
      
      // Show first row
      const firstRow = rows.first();
      const firstRowText = firstRow.text().trim().substring(0, 100);
      console.log(`  First row: "${firstRowText}..."`);
      
      // Check if this table contains volume navigation
      const tableText = $(table).text();
      if (tableText.includes('Volume1') && tableText.includes('Volume2')) {
        console.log('  -> This looks like a navigation table!');
      }
      
      // Check for pattern matches
      const firstCell = $(table).find('tr').first().find('td').first();
      if (firstCell.length > 0) {
        console.log(`  First cell: "${firstCell.text().trim()}"`);
      }
    });
    
  } catch (error) {
    console.error('Error:', error);
  }
}

checkFirstTables();