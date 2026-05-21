import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

async function debugPromisedNeverlandParser() {
  console.log('🔍 Debugging Promised Neverland Parser\n');
  
  const url = 'https://yakusokunoneverland.fandom.com/wiki/Chapters_and_Volumes';
  const response = await fetch(url);
  const html = await response.text();
  const $ = cheerio.load(html);
  
  // Count article tables
  const articleTables = $('table.article-table');
  console.log(`Total article-table: ${articleTables.length}`);
  
  // Count 5-row article tables
  const fiveRowTables = articleTables.filter((_, table) => {
    const rows = $(table).find('tr').length;
    return rows === 5;
  });
  console.log(`5-row article-table: ${fiveRowTables.length}`);
  
  // Check each 5-row table
  console.log('\nAnalyzing first few 5-row tables:');
  fiveRowTables.slice(0, 3).each((i, table) => {
    const $table = $(table);
    const rows = $table.find('tr');
    
    console.log(`\nTable ${i + 1}:`);
    
    rows.each((j, row) => {
      const $row = $(row);
      const cells = $row.find('td, th');
      const text = $row.text().trim().replace(/\s+/g, ' ').substring(0, 100);
      console.log(`  Row ${j + 1} (${cells.length} cells): ${text}...`);
    });
    
    // Check pattern detection
    const firstRow = rows.eq(0);
    const thirdRow = rows.eq(2);
    
    console.log('\nPattern checks:');
    console.log(`  First row includes "Volume": ${firstRow.text().includes('Volume')}`);
    console.log(`  Third row includes "Chapters:": ${thirdRow.text().includes('Chapters:')}`);
    
    // Try parsing chapters from fourth row
    const chaptersRow = rows.eq(3);
    const chaptersText = chaptersRow.text();
    console.log('\nChapters text sample:', chaptersText.substring(0, 200));
    
    // Test chapter regex
    const chapterMatches = [...chaptersText.matchAll(/(\d{3})\.\s+([^0-9]+?)(?=\s*\d{3}\.\s+|$)/g)];
    console.log(`Chapters found with regex: ${chapterMatches.length}`);
    if (chapterMatches.length > 0) {
      console.log('First chapter:', chapterMatches[0][1], '-', chapterMatches[0][2]);
    }
  });
  
  // Check for volume pattern in all tables
  console.log('\n\nChecking volume pattern in all tables:');
  let volumeCount = 0;
  articleTables.each((_, table) => {
    const text = $(table).text();
    if (text.includes('Volume') && text.includes('Chapters')) {
      volumeCount++;
    }
  });
  console.log(`Tables with Volume and Chapters: ${volumeCount}`);
}

debugPromisedNeverlandParser().catch(console.error);