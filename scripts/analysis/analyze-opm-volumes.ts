import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

async function analyzeOPMVolumes() {
  console.log('🔍 Analyzing One Punch Man Volumes Page\n');
  
  const url = 'https://onepunchman.fandom.com/wiki/Volumes';
  const response = await fetch(url);
  const html = await response.text();
  const $ = cheerio.load(html);
  
  console.log('📊 Volumes Page Analysis:\n');
  
  // Analyze tables
  const tables = $('table');
  console.log(`Total tables: ${tables.length}`);
  
  // Look for volume tables
  const volumeTables = tables.filter((_, table) => {
    const $table = $(table);
    const text = $table.text();
    return text.includes('Volume') && (text.includes('Chapter') || text.includes('Punch'));
  });
  
  console.log(`Volume-related tables: ${volumeTables.length}`);
  
  // Analyze first few tables
  tables.slice(0, 5).each((i, table) => {
    const $table = $(table);
    const rows = $table.find('tr');
    const classes = $table.attr('class') || 'no-class';
    
    console.log(`\nTable ${i + 1}:`);
    console.log(`  Classes: ${classes}`);
    console.log(`  Rows: ${rows.length}`);
    
    // Check if it's a single volume table
    const tableText = $table.text();
    const volumeMatch = tableText.match(/Volume (\d+)/);
    if (volumeMatch) {
      console.log(`  ✓ Volume ${volumeMatch[1]} table`);
      
      // Look for chapter information
      const chapters = [];
      
      // Method 1: Look for "Punch X" pattern
      const punchMatches = tableText.matchAll(/Punch (\d+)[:\s]*([^•\n]+)/g);
      for (const match of punchMatches) {
        chapters.push({ number: match[1], title: match[2].trim() });
      }
      
      // Method 2: Look for chapter lists in cells
      $table.find('td').each((_, cell) => {
        const cellText = $(cell).text();
        const chapterMatch = cellText.match(/(?:Chapter|Punch)\s*(\d+)[:\s]*(.+?)(?=Chapter|Punch|\n|$)/);
        if (chapterMatch && chapters.length === 0) {
          chapters.push({ number: chapterMatch[1], title: chapterMatch[2].trim() });
        }
      });
      
      if (chapters.length > 0) {
        console.log(`  Chapters found: ${chapters.length}`);
        chapters.slice(0, 3).forEach((ch, j) => {
          console.log(`    ${j + 1}. Punch ${ch.number}: "${ch.title.substring(0, 40)}..."`);
        });
      }
      
      // Check table structure
      if (rows.length > 0) {
        const firstRow = rows.first();
        const cells = firstRow.find('td, th');
        console.log(`  First row cells: ${cells.length}`);
        
        // Look for specific patterns
        cells.each((j, cell) => {
          const text = $(cell).text().trim();
          if (text.includes('Chapter') || text.includes('Punch') || text.includes('ISBN')) {
            console.log(`    Cell ${j + 1} contains: ${text.substring(0, 50)}...`);
          }
        });
      }
    }
  });
  
  // Look for pattern: each volume in a separate table
  console.log('\n📚 Volume Table Pattern Analysis:\n');
  
  const smallTables = tables.filter((_, table) => {
    const rows = $(table).find('tr').length;
    return rows >= 2 && rows <= 10;
  });
  
  console.log(`Small tables (2-10 rows): ${smallTables.length}`);
  
  if (smallTables.length > 20) {
    console.log('✓ Likely pattern: Each volume in separate table');
    
    // Extract volume info from first table
    const firstTable = smallTables.first();
    console.log('\nFirst volume table structure:');
    
    const rows = firstTable.find('tr');
    rows.each((i, row) => {
      const $row = $(row);
      const cells = $row.find('td, th');
      console.log(`  Row ${i + 1}: ${cells.length} cells`);
      
      if (cells.length === 1) {
        const text = cells.text().trim();
        console.log(`    Single cell: "${text.substring(0, 80)}..."`);
      } else if (cells.length === 2) {
        const label = cells.eq(0).text().trim();
        const value = cells.eq(1).text().trim();
        console.log(`    ${label}: "${value.substring(0, 60)}..."`);
      }
    });
  }
  
  // Check for navigation elements between tables
  console.log('\n🔍 Elements between tables:\n');
  
  const betweenElements = tables.first().nextUntil('table');
  console.log(`Elements between first two tables: ${betweenElements.length}`);
  
  betweenElements.slice(0, 3).each((i, el) => {
    console.log(`  ${i + 1}. ${el.tagName}: "${$(el).text().trim().substring(0, 50)}..."`);
  });
}

analyzeOPMVolumes().catch(console.error);