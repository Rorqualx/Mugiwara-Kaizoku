import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

async function analyzeBlackLagoonPattern() {
  console.log('🔍 Analyzing Black Lagoon Pattern\n');
  
  const url = 'https://lagooncompany.fandom.com/wiki/Chapters_and_Volumes_List';
  const response = await fetch(url);
  const html = await response.text();
  const $ = cheerio.load(html);
  
  // Check all tables
  const tables = $('table');
  console.log(`Found ${tables.length} tables total\n`);
  
  // Examine tables
  tables.each((i, table) => {
    const $table = $(table);
    const rows = $table.find('tr').length;
    const classes = $table.attr('class') || 'no classes';
    const text = $table.text();
    
    console.log(`Table ${i + 1}:`);
    console.log(`  Classes: ${classes}`);
    console.log(`  Rows: ${rows}`);
    
    // Check for volume/chapter content
    if (text.includes('Volume') || text.includes('Chapter') || text.includes('volume')) {
      console.log(`  → Potential volume/chapter table!`);
      
      // Show first few rows
      console.log('  Sample rows:');
      $table.find('tr').slice(0, 5).each((j, row) => {
        const cells = $(row).find('td, th');
        const rowText = $(row).text().trim().replace(/\s+/g, ' ');
        console.log(`    Row ${j + 1} (${cells.length} cells): ${rowText.substring(0, 150)}${rowText.length > 150 ? '...' : ''}`);
      });
    }
    
    console.log('');
  });
  
  // Check for divs with volume info
  console.log('📋 Checking for volume divs:');
  const volumeDivs = $('div').filter((_, div) => {
    const text = $(div).text();
    return /Volume\s+\d+/i.test(text) && text.includes('Chapter');
  });
  console.log(`Found ${volumeDivs.length} divs with volume info\n`);
  
  // Check headers
  console.log('📋 Headers:');
  $('h2, h3, h4').each((i, header) => {
    const text = $(header).text().trim();
    if (text.includes('Volume') || text.includes('Chapter') || text.includes('Arc')) {
      console.log(`  ${header.tagName}: ${text}`);
    }
  });
  
  // Check for specific patterns
  console.log('\n📋 Looking for volume patterns:');
  const volumeMatches = html.match(/Volume\s+\d+/gi) || [];
  const chapterMatches = html.match(/Chapter\s+\d+/gi) || [];
  console.log(`  Volume references: ${volumeMatches.length}`);
  console.log(`  Chapter references: ${chapterMatches.length}`);
  
  // Check tabber sections
  console.log('\n📋 Checking for tabber sections:');
  const tabbers = $('.tabber');
  console.log(`  Found ${tabbers.length} tabber elements`);
  
  if (tabbers.length > 0) {
    tabbers.each((i, tabber) => {
      const tabs = $(tabber).find('.tabbertab');
      console.log(`  Tabber ${i + 1} has ${tabs.length} tabs`);
      tabs.slice(0, 3).each((j, tab) => {
        const title = $(tab).attr('title') || 'no title';
        console.log(`    Tab ${j + 1}: ${title}`);
      });
    });
  }
}

analyzeBlackLagoonPattern().catch(console.error);