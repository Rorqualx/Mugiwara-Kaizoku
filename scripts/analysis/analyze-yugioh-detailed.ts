import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

async function analyzeYuGiOhDetailed() {
  console.log('🔍 Analyzing Yu-Gi-Oh! Detailed Structure\n');
  
  const url = 'https://yugioh.fandom.com/wiki/Yu-Gi-Oh!_(manga)';
  const response = await fetch(url);
  const html = await response.text();
  const $ = cheerio.load(html);
  
  // Check all tables
  const tables = $('table');
  console.log(`Found ${tables.length} tables total\n`);
  
  // Examine each table
  tables.each((i, table) => {
    const $table = $(table);
    const rows = $table.find('tr').length;
    const classes = $table.attr('class') || 'no classes';
    const text = $table.text();
    
    console.log(`Table ${i + 1}:`);
    console.log(`  Classes: ${classes}`);
    console.log(`  Rows: ${rows}`);
    
    // Show first and last row
    const firstRow = $table.find('tr').first().text().trim().replace(/\s+/g, ' ');
    const lastRow = $table.find('tr').last().text().trim().replace(/\s+/g, ' ');
    
    console.log(`  First row: ${firstRow.substring(0, 150)}${firstRow.length > 150 ? '...' : ''}`);
    console.log(`  Last row: ${lastRow.substring(0, 150)}${lastRow.length > 150 ? '...' : ''}`);
    
    // Check for volume/chapter content
    const hasVolume = text.includes('Volume') || text.includes('Vol.');
    const hasChapter = text.includes('Chapter') || text.includes('Duel');
    const hasISBN = text.includes('ISBN');
    
    if (hasVolume || hasChapter || hasISBN) {
      console.log(`  📚 Contains: ${hasVolume ? 'Volume ' : ''}${hasChapter ? 'Chapter/Duel ' : ''}${hasISBN ? 'ISBN' : ''}`);
      
      // Show more details
      if (rows <= 20) {
        console.log('  Sample rows:');
        $table.find('tr').slice(0, 4).each((j, row) => {
          const cells = $(row).find('td, th');
          console.log(`    Row ${j + 1} (${cells.length} cells): ${$(row).text().trim().replace(/\s+/g, ' ').substring(0, 200)}`);
        });
      }
    }
    
    console.log('');
  });
  
  // Check for chapter/volume information after specific headers
  console.log('\n📋 Content after headers:');
  
  const volumeHeader = $('h2:contains("Volume listings")');
  if (volumeHeader.length > 0) {
    console.log('\nAfter "Volume listings" header:');
    let next = volumeHeader.next();
    for (let i = 0; i < 5 && next.length > 0; i++) {
      const tagName = next.prop('tagName');
      const text = next.text().trim().substring(0, 200);
      console.log(`  ${tagName}: ${text}${next.text().length > 200 ? '...' : ''}`);
      next = next.next();
    }
  }
  
  const chapterHeader = $('h2:contains("Chapter listings")');
  if (chapterHeader.length > 0) {
    console.log('\nAfter "Chapter listings" header:');
    let next = chapterHeader.next();
    for (let i = 0; i < 5 && next.length > 0; i++) {
      const tagName = next.prop('tagName');
      const text = next.text().trim().substring(0, 200);
      console.log(`  ${tagName}: ${text}${next.text().length > 200 ? '...' : ''}`);
      next = next.next();
    }
  }
}

analyzeYuGiOhDetailed().catch(console.error);