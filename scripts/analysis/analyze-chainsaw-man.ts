import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

async function analyzeChainsawMan() {
  console.log('🔍 Analyzing Chainsaw Man Wiki Structure\n');
  
  const url = 'https://chainsaw-man.fandom.com/wiki/Chapters';
  const response = await fetch(url);
  const html = await response.text();
  const $ = cheerio.load(html);
  
  console.log('📊 Page Analysis:\n');
  
  // Check page title
  const pageTitle = $('h1.page-header__title').text().trim();
  console.log(`Page Title: "${pageTitle}"`);
  
  // Check for tables
  const allTables = $('table');
  console.log(`\nTotal tables found: ${allTables.length}`);
  
  // Analyze each table
  allTables.each((i, table) => {
    const $table = $(table);
    const rows = $table.find('tr');
    const classes = $table.attr('class') || 'no-class';
    
    console.log(`\nTable ${i + 1}:`);
    console.log(`  Classes: ${classes}`);
    console.log(`  Rows: ${rows.length}`);
    
    // Check table structure
    if (rows.length > 0) {
      const headerRow = rows.first();
      const headerCells = headerRow.find('th, td');
      console.log(`  Header cells: ${headerCells.length}`);
      
      if (headerCells.length > 0 && headerCells.length <= 10) {
        console.log(`  Headers:`);
        headerCells.each((j, cell) => {
          console.log(`    ${j + 1}. "${$(cell).text().trim()}"`);
        });
      }
      
      // Check if it's a volume table
      const tableText = $table.text();
      if (tableText.includes('Volume') || tableText.includes('Arc')) {
        console.log(`  ✓ Contains volume/arc information`);
        
        // Sample first data row
        if (rows.length > 1) {
          const dataRow = rows.eq(1);
          const dataCells = dataRow.find('td');
          console.log(`  First data row (${dataCells.length} cells):`);
          dataCells.each((j, cell) => {
            const text = $(cell).text().trim();
            console.log(`    Cell ${j + 1}: "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}"`);
          });
        }
      }
    }
  });
  
  // Check for specific patterns
  console.log('\n🔍 Pattern Analysis:\n');
  
  // Look for arc sections
  const arcHeaders = $('h2, h3').filter((_, el) => {
    const text = $(el).text();
    return text.includes('Arc') || text.includes('Part');
  });
  
  console.log(`Arc/Part headers: ${arcHeaders.length}`);
  if (arcHeaders.length > 0) {
    console.log('Arc headers found:');
    arcHeaders.slice(0, 5).each((i, header) => {
      console.log(`  ${i + 1}. "${$(header).text().trim()}"`);
    });
  }
  
  // Check for volume sections within tables
  const volumeCells = $('td, th').filter((_, cell) => {
    const text = $(cell).text();
    return /Volume \d+/.test(text) && text.length < 50;
  });
  
  console.log(`\nCells with "Volume X": ${volumeCells.length}`);
  
  // Look for chapter ranges
  const chapterRanges = $('td').filter((_, cell) => {
    const text = $(cell).text();
    return /\d+\s*-\s*\d+/.test(text) && text.length < 20;
  });
  
  console.log(`Cells with chapter ranges (X-Y): ${chapterRanges.length}`);
  
  // Check for a specific table pattern
  if (allTables.length > 0) {
    console.log('\n📋 Detailed Table Pattern Check:\n');
    
    const firstTable = allTables.first();
    const rows = firstTable.find('tr');
    
    // Check if rows alternate between volume info and chapter lists
    let hasVolumePattern = false;
    rows.slice(1, Math.min(10, rows.length)).each((i, row) => {
      const $row = $(row);
      const text = $row.text();
      
      if (text.includes('Volume') && text.includes('Arc')) {
        hasVolumePattern = true;
      }
    });
    
    if (hasVolumePattern) {
      console.log('✓ Table contains volume and arc information');
      
      // Analyze row pattern
      console.log('\nRow pattern analysis:');
      rows.slice(1, 6).each((i, row) => {
        const $row = $(row);
        const cells = $row.find('td');
        const colspan = cells.attr('colspan');
        
        console.log(`  Row ${i + 2}:`);
        console.log(`    Cells: ${cells.length}`);
        if (colspan) console.log(`    Colspan: ${colspan}`);
        console.log(`    Contains "Volume": ${$row.text().includes('Volume')}`);
        console.log(`    Contains "Chapter": ${$row.text().includes('Chapter')}`);
      });
    }
  }
}

analyzeChainsawMan().catch(console.error);