import fetch from 'node-fetch';
import * as cheerio from 'cheerio';
import { parseVolumeTables } from '../src/api/metadataProviders/utils/unifiedFandomParser';

async function debugUnifiedParser() {
  console.log('Debugging unified parser with Fire Force...\n');
  
  const response = await fetch('https://fire-force.fandom.com/wiki/List_of_Volumes');
  const html = await response.text();
  const $ = cheerio.load(html);
  
  // Look at just the first table
  const firstTable = $('table').first();
  const tableHtml = $.html(firstTable);
  
  console.log('First table HTML structure:');
  console.log(tableHtml.substring(0, 2000));
  console.log('\n... (truncated)\n');
  
  // Parse just the first table
  const tempHtml = `<html><body>${tableHtml}</body></html>`;
  const volumes = parseVolumeTables(tempHtml);
  
  console.log(`\nParsed ${volumes.length} volumes from first table`);
  if (volumes.length > 0) {
    console.log('\nFirst volume:', JSON.stringify(volumes[0], null, 2));
  }
}

debugUnifiedParser().catch(console.error);