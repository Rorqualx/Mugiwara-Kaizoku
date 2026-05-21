import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

async function debugDragonBallWikitable() {
  const url = 'https://dragonball.fandom.com/wiki/Dragon_Ball_(manga)';
  console.log('Fetching Dragon Ball manga page...');
  
  const response = await fetch(url);
  const html = await response.text();
  const $ = cheerio.load(html);
  
  // Find the wikitable
  const wikitable = $('.wikitable').first();
  console.log('\n=== Wikitable Analysis ===');
  console.log(`Rows: ${wikitable.find('tr').length}`);
  
  // Check headers
  const headers = wikitable.find('th');
  console.log(`\nHeaders (${headers.length}):`);
  headers.each((i, header) => {
    console.log(`  ${i}: "${$(header).text().trim()}"`);
  });
  
  // Check first few data rows
  const rows = wikitable.find('tr');
  console.log('\nFirst few data rows:');
  
  rows.slice(1, 4).each((i, row) => {
    const $row = $(row);
    const cells = $row.find('td');
    console.log(`\nRow ${i + 1}: ${cells.length} cells`);
    
    cells.each((j, cell) => {
      const text = $(cell).text().trim().substring(0, 50);
      console.log(`  Cell ${j}: "${text}${text.length >= 50 ? '...' : ''}"`);
    });
  });
  
  // Check for navigation box (collapsible table)
  const navbox = $('.navbox.mw-collapsible').first();
  if (navbox.length > 0) {
    console.log('\n=== Navigation Box Found ===');
    const navText = navbox.text();
    const hasVolumes = /Volume\s+\d+/i.test(navText);
    console.log(`Contains volume patterns: ${hasVolumes}`);
    
    if (hasVolumes) {
      const volumeMatches = navText.match(/Volume\s+\d+/gi);
      console.log(`Volume count: ${volumeMatches?.length || 0}`);
    }
  }
}

debugDragonBallWikitable().catch(console.error);