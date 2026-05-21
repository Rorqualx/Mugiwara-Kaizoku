import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

async function debugOPMPatternSimple() {
  console.log('🔍 Debugging Why OPM Pattern Fails\n');
  
  const url = 'https://onepunchman.fandom.com/wiki/Volumes';
  const response = await fetch(url);
  const html = await response.text();
  const $ = cheerio.load(html);
  
  const tables = $('table');
  console.log(`Total tables: ${tables.length}`);
  
  // Check if there's a table with more than 20 rows
  let largeTableCount = 0;
  let largeTableInfo = '';
  
  tables.each((i, table) => {
    const rows = $(table).find('tr').length;
    if (rows > 20) {
      largeTableCount++;
      const text = $(table).text();
      largeTableInfo = `Table ${i + 1}: ${rows} rows, contains "Volume": ${text.includes('Volume')}, contains "Chapter": ${text.includes('Chapter')}`;
    }
  });
  
  console.log(`\nLarge tables (20+ rows): ${largeTableCount}`);
  if (largeTableInfo) {
    console.log(largeTableInfo);
  }
  
  // The issue is likely that the single large table pattern is catching it
  // Let's check what the single large table parser would return
  if (largeTableCount > 0) {
    console.log('\n⚠️  Single large table pattern would match BEFORE OPM pattern!');
    console.log('This is why OPM parsing fails - another pattern catches it first.');
  }
  
  // Let's check what the large table actually is
  const largeTable = tables.filter((_, table) => $(table).find('tr').length > 20).first();
  if (largeTable.length > 0) {
    console.log('\nAnalyzing large table:');
    const rows = largeTable.find('tr');
    console.log(`First 3 rows:`);
    rows.slice(0, 3).each((i, row) => {
      const cells = $(row).find('td, th');
      console.log(`  Row ${i + 1}: ${cells.length} cells, text: "${$(row).text().trim().substring(0, 80)}..."`);
    });
  }
}

debugOPMPatternSimple().catch(console.error);