import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

async function debugOPMTablesAfterFix() {
  console.log('🔍 Debugging OPM Tables After Navigation Fix\n');
  
  const url = 'https://onepunchman.fandom.com/wiki/Volumes';
  const response = await fetch(url);
  const html = await response.text();
  const $ = cheerio.load(html);
  
  // Count all tables
  const tables = $('table');
  console.log(`Total tables: ${tables.length}`);
  
  // Count small tables (OPM pattern)
  const smallTables = tables.filter((_, table) => {
    const rows = $(table).find('tr').length;
    return rows >= 2 && rows <= 10;
  });
  console.log(`Small tables (2-10 rows): ${smallTables.length}`);
  
  // Count large tables (20+ rows)
  const largeTables = tables.filter((_, table) => {
    const rows = $(table).find('tr').length;
    return rows > 20;
  });
  console.log(`Large tables (20+ rows): ${largeTables.length}`);
  
  // Check large tables for navigation indicators
  console.log('\nLarge table analysis:');
  largeTables.each((i, table) => {
    const $table = $(table);
    const classes = $table.attr('class') || '';
    const firstRowText = $table.find('tr').first().text();
    const rows = $table.find('tr').length;
    
    console.log(`\nLarge table ${i + 1}:`);
    console.log(`  Rows: ${rows}`);
    console.log(`  Classes: ${classes || 'none'}`);
    console.log(`  First row: ${firstRowText.substring(0, 50)}...`);
    console.log(`  Is navigation: ${classes.includes('mw-collapsible') || firstRowText.includes('v • e')}`);
  });
  
  // Check if single large table pattern would match now
  let hasNonNavLargeTable = false;
  largeTables.each((_, table) => {
    const $table = $(table);
    const classes = $table.attr('class') || '';
    const firstRowText = $table.find('tr').first().text();
    
    if (!classes.includes('mw-collapsible') && 
        !classes.includes('navbox') &&
        !classes.includes('toccolours') &&
        !firstRowText.includes('v • e') &&
        !firstRowText.includes('v•e')) {
      hasNonNavLargeTable = true;
    }
  });
  
  console.log(`\nHas non-navigation large table: ${hasNonNavLargeTable}`);
  console.log('Should OPM pattern be checked: ' + (!hasNonNavLargeTable ? 'YES' : 'NO (single large table would match first)'));
}

debugOPMTablesAfterFix().catch(console.error);