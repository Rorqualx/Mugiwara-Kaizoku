import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

async function debugFetch() {
  const url = 'https://dragonball.fandom.com/wiki/List_of_Dragon_Ball_manga_volumes';
  console.log(`Fetching: ${url}`);
  
  const response = await fetch(url);
  console.log(`Status: ${response.status}`);
  console.log(`Content-Type: ${response.headers.get('content-type')}`);
  
  const html = await response.text();
  console.log(`HTML length: ${html.length}`);
  
  // Check if we're getting the actual content
  const $ = cheerio.load(html);
  const title = $('title').text();
  console.log(`Page title: ${title}`);
  
  // Look for content indicators
  const hasContent = html.includes('Dragon Ball');
  const hasTable = html.includes('<table');
  const hasVolume = html.includes('Volume');
  
  console.log(`\nContent checks:`);
  console.log(`  Contains "Dragon Ball": ${hasContent}`);
  console.log(`  Contains "<table": ${hasTable}`);
  console.log(`  Contains "Volume": ${hasVolume}`);
  
  // Check body content
  const bodyContent = $('.mw-parser-output').html();
  if (bodyContent) {
    console.log(`\nBody content length: ${bodyContent.length}`);
    
    // Try different table selectors
    const tables1 = $('.mw-parser-output table');
    const tables2 = $('table.wikitable');
    const tables3 = $('table.article-table');
    
    console.log(`\nTable searches:`);
    console.log(`  .mw-parser-output table: ${tables1.length}`);
    console.log(`  table.wikitable: ${tables2.length}`);
    console.log(`  table.article-table: ${tables3.length}`);
  }
  
  // Save a sample for inspection
  const fs = require('fs');
  fs.writeFileSync('debug-dragon-ball.html', html);
  console.log('\nSaved HTML to debug-dragon-ball.html for inspection');
}

debugFetch().catch(console.error);