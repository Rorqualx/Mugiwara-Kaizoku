import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

async function debugOPMBetweenTables() {
  console.log('🔍 Debugging OPM Content Between Tables\n');
  
  const url = 'https://onepunchman.fandom.com/wiki/Volumes';
  const response = await fetch(url);
  const html = await response.text();
  const $ = cheerio.load(html);
  
  const tables = $('table');
  console.log(`Total tables: ${tables.length}\n`);
  
  // Check what's between the first few tables
  console.log('📄 Content between tables:');
  
  for (let i = 0; i < Math.min(3, tables.length - 1); i++) {
    const currentTable = tables.eq(i);
    const nextTable = tables.eq(i + 1);
    
    console.log(`\nBetween table ${i + 1} and ${i + 2}:`);
    
    // Get all elements between these tables
    const betweenElements = currentTable.nextUntil(nextTable);
    
    console.log(`  Elements found: ${betweenElements.length}`);
    
    betweenElements.each((j, el) => {
      const $el = $(el);
      const tagName = el.tagName;
      const text = $el.text().trim();
      
      console.log(`  ${j + 1}. <${tagName}>: "${text.substring(0, 100)}${text.length > 100 ? '...' : ''}"`);
      
      // Check if it's a volume header
      if (/Volume \d+/.test(text)) {
        console.log(`     ✓ Volume header found!`);
      }
    });
  }
  
  // Check table + preceding header pattern
  console.log('\n\n📚 Checking table with preceding headers:');
  
  tables.slice(0, 5).each((i, table) => {
    const $table = $(table);
    
    // Look for previous sibling that might be a header
    let $prev = $table.prev();
    let headerFound = false;
    
    // Check up to 3 elements before the table
    for (let j = 0; j < 3 && $prev.length; j++) {
      const text = $prev.text().trim();
      
      if (/Volume \d+/.test(text)) {
        console.log(`\nTable ${i + 1}:`);
        console.log(`  Preceded by: <${$prev.prop('tagName')}> "${text}"`);
        headerFound = true;
        
        // Now check table content
        const tableText = $table.text();
        const punchMatches = [...tableText.matchAll(/Punch (\d+):\s*([^•\n]+?)(?=Punch \d+:|$)/g)];
        console.log(`  Punch chapters in table: ${punchMatches.length}`);
        
        if (punchMatches.length > 0) {
          console.log(`  First chapter: Punch ${punchMatches[0][1]}: "${punchMatches[0][2].trim()}"`);
        }
        
        break;
      }
      
      $prev = $prev.prev();
    }
    
    if (!headerFound && i < 3) {
      // Show what IS before this table
      const $immediatelyBefore = $table.prev();
      if ($immediatelyBefore.length) {
        console.log(`\nTable ${i + 1} preceded by: <${$immediatelyBefore.prop('tagName')}> "${$immediatelyBefore.text().trim().substring(0, 50)}..."`);
      }
    }
  });
  
  // Alternative: Check if volume info is in the table itself
  console.log('\n\n🔍 Checking if volume numbers are in table cells:');
  
  const firstTable = tables.first();
  const volumeNumber = firstTable.find('td').first().text().trim();
  console.log(`First table, first cell: "${volumeNumber}"`);
  console.log(`Is it a number? ${/^\d+$/.test(volumeNumber)}`);
  
  if (/^\d+$/.test(volumeNumber)) {
    console.log('\n✓ Tables use first cell as volume number!');
    console.log('Pattern: Volume number is in the first data cell of the table');
  }
}

debugOPMBetweenTables().catch(console.error);