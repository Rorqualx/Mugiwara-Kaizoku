import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

async function debugBlackLagoonParser() {
  console.log('🔍 Debugging Black Lagoon Parser\n');
  
  const url = 'https://lagooncompany.fandom.com/wiki/Chapters_and_Volumes_List';
  const response = await fetch(url);
  const html = await response.text();
  const $ = cheerio.load(html);
  
  // Count all collapsible tables
  const collapsibleTables = $('table.collapsible');
  console.log(`Total collapsible tables: ${collapsibleTables.length}`);
  
  // Count 4-row collapsible tables
  const fourRowTables = collapsibleTables.filter((_, table) => {
    const rows = $(table).find('tr').length;
    return rows === 4;
  });
  console.log(`4-row collapsible tables: ${fourRowTables.length}`);
  
  // Check each 4-row table
  console.log('\nAnalyzing each 4-row table:');
  fourRowTables.each((i, table) => {
    const $table = $(table);
    const firstRow = $table.find('tr').first();
    const firstRowText = firstRow.text().trim();
    
    console.log(`\nTable ${i + 1}:`);
    console.log(`  First row: ${firstRowText}`);
    
    // Check if it has "Volume"
    if (firstRowText.includes('Volume')) {
      const volumeMatch = firstRowText.match(/Volume\s+(\d+)/i);
      console.log(`  → Volume table! Number: ${volumeMatch ? volumeMatch[1] : 'could not parse'}`);
      
      // Check chapters row
      const chaptersRow = $table.find('tr').eq(2);
      const chaptersText = chaptersRow.text();
      const hasChapters = chaptersText.includes('Chapter');
      console.log(`  Has chapters: ${hasChapters}`);
      
      // Try parsing chapters
      const cleanedText = chaptersText.replace(/^Chapters?\s*/i, '').trim();
      const chapterRegex = /(\d{2})\s+([^0-9]+?)(?=\s*\d{2}\s+|$)/g;
      const chapters = [];
      let match;
      
      while ((match = chapterRegex.exec(cleanedText)) !== null) {
        chapters.push(`${match[1]}: ${match[2].trim()}`);
      }
      
      console.log(`  Parsed ${chapters.length} chapters`);
      if (chapters.length > 0) {
        console.log(`  First chapter: ${chapters[0]}`);
        console.log(`  Last chapter: ${chapters[chapters.length - 1]}`);
      }
    }
  });
  
  // Look for other volume indicators
  console.log('\n\nLooking for other volume indicators:');
  const allTables = $('table');
  let volumeCount = 0;
  
  allTables.each((_, table) => {
    const text = $(table).text();
    const volumeMatches = text.match(/Volume\s+\d+/gi) || [];
    if (volumeMatches.length > 0) {
      volumeCount += volumeMatches.length;
    }
  });
  
  console.log(`Total volume references in all tables: ${volumeCount}`);
}

debugBlackLagoonParser().catch(console.error);