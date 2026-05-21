import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

async function analyzeFMATableStructure() {
  console.log('🔍 Analyzing FMA Table Structure\n');
  
  const url = 'https://fma.fandom.com/wiki/Chapters_and_Volumes';
  const response = await fetch(url);
  const html = await response.text();
  const $ = cheerio.load(html);
  
  // Get first collapsible table
  const firstTable = $('table.collapsible').first();
  const rows = firstTable.find('tr');
  
  console.log(`First table has ${rows.length} rows\n`);
  
  rows.each((i, row) => {
    const $row = $(row);
    const cells = $row.find('td, th');
    const text = $row.text().trim().replace(/\s+/g, ' ');
    
    console.log(`Row ${i + 1}:`);
    console.log(`  Cells: ${cells.length}`);
    console.log(`  Text: ${text.substring(0, 200)}${text.length > 200 ? '...' : ''}`);
    
    // If this is the chapters row, let's examine it more closely
    if (text.includes('Chapter') && !text.includes('Cover')) {
      console.log('\n  📋 This appears to be the chapters row!');
      const chapterCell = cells.first();
      const cellHtml = chapterCell.html() || '';
      console.log(`  Cell HTML preview: ${cellHtml.substring(0, 300)}...`);
      
      // Check for line breaks
      const hasLineBreaks = cellHtml.includes('<br>') || cellHtml.includes('<br/>') || cellHtml.includes('<br />');
      console.log(`  Has <br> tags: ${hasLineBreaks}`);
      
      // Get text and split by newlines
      const cellText = chapterCell.text();
      const lines = cellText.split('\n').filter(line => line.trim());
      console.log(`  Lines found: ${lines.length}`);
      
      lines.slice(0, 3).forEach((line, j) => {
        console.log(`    Line ${j + 1}: ${line.trim()}`);
      });
    }
    
    console.log('');
  });
}

analyzeFMATableStructure().catch(console.error);