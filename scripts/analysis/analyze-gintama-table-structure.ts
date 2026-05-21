import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

async function analyzeGintamaTableStructure() {
  console.log('🔍 Analyzing Gintama Table Structure\n');
  
  const url = 'https://gintama.fandom.com/wiki/Lessons_and_Volumes';
  const response = await fetch(url);
  const html = await response.text();
  const $ = cheerio.load(html);
  
  // Look at collapsible tables specifically
  const collapsibleTables = $('table.collapsible');
  console.log(`Found ${collapsibleTables.length} collapsible tables\n`);
  
  // Analyze first volume table
  const firstTable = collapsibleTables.first();
  const rows = firstTable.find('tr');
  
  console.log('First volume table structure:');
  rows.each((i, row) => {
    const $row = $(row);
    const cells = $row.find('td, th');
    
    console.log(`\nRow ${i + 1} (${cells.length} cells):`);
    cells.each((j, cell) => {
      const text = $(cell).text().trim();
      console.log(`  Cell ${j + 1}: ${text.substring(0, 100)}${text.length > 100 ? '...' : ''}`);
    });
  });
  
  // Look for pattern in all collapsible tables
  console.log('\n📊 Pattern Analysis:');
  let volumeCount = 0;
  
  collapsibleTables.each((i, table) => {
    const $table = $(table);
    const firstRow = $table.find('tr').first();
    const volumeText = firstRow.text();
    
    if (volumeText.includes('Volume')) {
      volumeCount++;
      const volumeMatch = volumeText.match(/Volume (\d+)/);
      if (volumeMatch) {
        const volumeNum = volumeMatch[1];
        
        // Look for chapters row
        const chaptersRow = $table.find('tr').eq(2);
        const chaptersText = chaptersRow.text();
        
        if (chaptersText.includes('Lesson')) {
          const lessonMatches = chaptersText.match(/Lesson \d+/g);
          const lessonCount = lessonMatches ? lessonMatches.length : 0;
          console.log(`Volume ${volumeNum}: ${lessonCount} lessons found`);
        }
      }
    }
  });
  
  console.log(`\nTotal volumes found: ${volumeCount}`);
}

analyzeGintamaTableStructure().catch(console.error);