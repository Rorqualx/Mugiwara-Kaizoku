import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

async function debugChainsawManDetection() {
  console.log('🔍 Debugging Chainsaw Man Pattern Detection\n');
  
  const url = 'https://chainsaw-man.fandom.com/wiki/Chapters_and_Volumes';
  const response = await fetch(url);
  const html = await response.text();
  const $ = cheerio.load(html);
  
  // Test the detection logic
  const tables = $('table');
  console.log(`Total tables: ${tables.length}`);
  
  // Look for small 2-row tables
  const twoRowTables = tables.filter((_, table) => {
    const rows = $(table).find('tr').length;
    return rows === 2;
  });
  
  console.log(`2-row tables: ${twoRowTables.length}`);
  
  // Check if tables follow the pattern
  let volumeTableCount = 0;
  
  twoRowTables.each((_, table) => {
    const $table = $(table);
    const text = $table.text();
    
    // Check for volume and chapters list pattern
    if (text.includes('Volume') && text.includes('Chapters list:')) {
      volumeTableCount++;
    }
  });
  
  console.log(`Volume tables with pattern: ${volumeTableCount}`);
  console.log(`Would detect pattern: ${volumeTableCount >= 5}`);
  
  // Test parsing a single volume
  console.log('\n📋 Testing single volume parse:');
  
  const firstVolumeTable = twoRowTables.filter((_, table) => {
    const text = $(table).text();
    return text.includes('Volume 1') && text.includes('Chapters list:');
  }).first();
  
  if (firstVolumeTable.length > 0) {
    const rows = firstVolumeTable.find('tr');
    console.log(`Rows in first volume table: ${rows.length}`);
    
    // First row
    const volumeRow = rows.first();
    const volumeCells = volumeRow.find('td');
    console.log(`\nFirst row cells: ${volumeCells.length}`);
    volumeCells.each((i, cell) => {
      console.log(`  Cell ${i}: ${$(cell).text().trim().substring(0, 50)}...`);
    });
    
    // Second row
    const chaptersRow = rows.eq(1);
    const chaptersCells = chaptersRow.find('td');
    console.log(`\nSecond row cells: ${chaptersCells.length}`);
    
    const chaptersText = chaptersCells.first().text();
    console.log(`Chapters text preview: ${chaptersText.substring(0, 200)}...`);
    
    // Test chapter parsing
    if (chaptersText.includes('Chapters list:')) {
      const chapterLines = chaptersText.replace('Chapters list:', '').trim().split('\n');
      console.log(`\nChapter lines found: ${chapterLines.length}`);
      console.log('First 3 chapters:');
      chapterLines.slice(0, 3).forEach(line => {
        const trimmed = line.trim();
        if (trimmed) {
          console.log(`  "${trimmed}"`);
        }
      });
    }
  }
}

debugChainsawManDetection().catch(console.error);