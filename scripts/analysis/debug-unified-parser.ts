import fetch from 'node-fetch';
import * as cheerio from 'cheerio';
import { parseVolumeTables } from '../src/api/metadataProviders/utils/unifiedFandomParser';

async function debugUnifiedParser() {
  console.log('Debugging unified parser with Fire Force...\n');
  
  const response = await fetch('https://fire-force.fandom.com/wiki/List_of_Volumes');
  const html = await response.text();
  const $ = cheerio.load(html);
  
  console.log('Page structure:');
  console.log(`  Total tables: ${$('table').length}`);
  
  // Check first few tables
  $('table').slice(0, 5).each((i, table) => {
    const $table = $(table);
    const tableText = $table.text();
    
    console.log(`\nTable ${i}:`);
    console.log(`  Text preview: "${tableText.substring(0, 100).replace(/\n/g, ' ')}..."`);
    
    // Check pattern detection
    const firstCell = $table.find('tr').first().find('td, th').first();
    console.log(`  First cell: "${firstCell.text().trim()}"`);
    
    // Individual volume checks
    console.log(`  Pattern checks:`);
    console.log(`    - First cell Volume X: ${/^Volume\s+\d+$/.test(firstCell.text().trim())}`);
    console.log(`    - Contains (Volume X): ${/\(Volume\s+\d+\)/i.test(tableText)}`);
    console.log(`    - Has ISBN & Chapters: ${tableText.includes('ISBN') && tableText.includes('Chapter')}`);
    console.log(`    - Has Volume in text: ${/Volume\s+\d+/i.test(tableText)}`);
  });
  
  // Test the parser
  console.log('\n\nTesting parser...');
  const volumes = parseVolumeTables(html);
  console.log(`Found ${volumes.length} volumes`);
  
  if (volumes.length > 0) {
    console.log('\nFirst volume:');
    console.log(JSON.stringify(volumes[0], null, 2));
  }
}

debugUnifiedParser().catch(console.error);