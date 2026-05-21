import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

async function investigateJoJo() {
  console.log("🔍 Investigating JoJo's Bizarre Adventure Wiki Structure\n");
  
  const url = "https://jojo.fandom.com/wiki/List_of_JoJo's_Bizarre_Adventure_chapters";
  const response = await fetch(url);
  const html = await response.text();
  const $ = cheerio.load(html);
  
  console.log('📊 Page Analysis:');
  
  // Count tables
  const tables = $('table');
  console.log(`- Total tables: ${tables.length}`);
  
  // Check for part-based organization
  const partHeaders = $('h2, h3').filter((_, el) => {
    const text = $(el).text();
    return text.includes('Part') && /Part \d+/i.test(text);
  });
  console.log(`- Part headers found: ${partHeaders.length}`);
  
  // List parts
  console.log('\n📚 Parts found:');
  partHeaders.each((i, el) => {
    console.log(`  ${i + 1}. ${$(el).text().trim()}`);
  });
  
  // Check for tabber or tabs
  const tabbers = $('.tabber, .tabbertab, .wds-tabs, .tabs');
  console.log(`\n- Tabber/Tab elements: ${tabbers.length}`);
  
  // Check for collapsible sections
  const collapsible = $('.mw-collapsible, .collapsible, .NavFrame');
  console.log(`- Collapsible sections: ${collapsible.length}`);
  
  // Analyze table structures
  console.log('\n📋 Table Analysis:');
  let volumeTables = 0;
  let chapterTables = 0;
  
  tables.each((i, table) => {
    const $table = $(table);
    const tableText = $table.text();
    
    if (tableText.includes('Volume') && tableText.includes('Chapter')) {
      volumeTables++;
    } else if (tableText.includes('Chapter')) {
      chapterTables++;
    }
    
    // Show first few tables for debugging
    if (i < 3) {
      const rows = $table.find('tr').length;
      const classes = $table.attr('class') || 'none';
      const firstRowText = $table.find('tr').first().text().replace(/\s+/g, ' ').substring(0, 100);
      
      console.log(`\nTable ${i}:`);
      console.log(`- Rows: ${rows}`);
      console.log(`- Classes: ${classes}`);
      console.log(`- First row: ${firstRowText}...`);
    }
  });
  
  console.log(`\nVolume/Chapter tables: ${volumeTables}`);
  console.log(`Chapter-only tables: ${chapterTables}`);
  
  // Look for specific JoJo patterns
  console.log('\n🎯 JoJo-specific patterns:');
  
  // Check if tables are grouped by part
  const partSections = $('.mw-parser-output > h2, .mw-parser-output > h3').filter((_, el) => {
    return $(el).text().includes('Part');
  });
  
  console.log(`\nAnalyzing part-based structure:`);
  partSections.each((i, header) => {
    const $header = $(header);
    const partName = $header.text().trim();
    
    // Find tables after this header and before next header
    const tablesInPart = $header.nextUntil('h2, h3').filter('table');
    
    if (tablesInPart.length > 0) {
      console.log(`\n${partName}:`);
      console.log(`  - Tables: ${tablesInPart.length}`);
      
      // Check first table structure
      const firstTable = tablesInPart.first();
      const hasVolume = firstTable.text().includes('Volume');
      const hasChapter = firstTable.text().includes('Chapter');
      
      console.log(`  - Has Volume info: ${hasVolume}`);
      console.log(`  - Has Chapter info: ${hasChapter}`);
    }
  });
  
  // Look for navigation boxes
  const navBoxes = $('.navbox, .nav-box, .navigation-box');
  console.log(`\n- Navigation boxes: ${navBoxes.length}`);
  
  // Sample extraction test for Part 1
  console.log('\n🧪 Sample extraction for Part 1:');
  const part1Header = partSections.filter((_, el) => $(el).text().includes('Part 1')).first();
  
  if (part1Header.length > 0) {
    const part1Tables = part1Header.nextUntil('h2, h3').filter('table');
    
    if (part1Tables.length > 0) {
      const firstTable = part1Tables.first();
      const rows = firstTable.find('tr');
      
      console.log(`Found ${rows.length} rows in first Part 1 table`);
      
      // Try to extract volume/chapter info
      rows.slice(1, 4).each((i, row) => {
        const cells = $(row).find('td, th');
        const cellTexts = cells.map((_, cell) => $(cell).text().trim()).get();
        console.log(`Row ${i + 1}: ${JSON.stringify(cellTexts)}`);
      });
    }
  }
}

investigateJoJo().catch(console.error);