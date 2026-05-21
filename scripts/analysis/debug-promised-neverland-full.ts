import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

// Copy the detection function to test it
function detectPromisedNeverlandPattern($: cheerio.CheerioAPI): boolean {
  const articleTables = $('table.article-table');
  
  // Look for 5-row article tables
  const fiveRowTables = articleTables.filter((_, table) => {
    const rows = $(table).find('tr').length;
    return rows === 5;
  });
  
  console.log(`  - Article tables: ${articleTables.length}`);
  console.log(`  - 5-row tables: ${fiveRowTables.length}`);
  
  // Need multiple 5-row tables
  if (fiveRowTables.length < 10) {
    console.log(`  - Not enough 5-row tables (need 10, have ${fiveRowTables.length})`);
    return false;
  }
  
  // Check if tables follow the pattern
  let volumeTableCount = 0;
  
  fiveRowTables.each((_, table) => {
    const $table = $(table);
    const firstRow = $table.find('tr').first();
    const thirdRow = $table.find('tr').eq(2);
    
    // Check if first row has "Volume" and third row has "Chapters:"
    if (firstRow.text().includes('Volume') && thirdRow.text().includes('Chapters:')) {
      volumeTableCount++;
    }
  });
  
  console.log(`  - Volume tables: ${volumeTableCount}`);
  
  // If we have many tables with this pattern, it's Promised Neverland style
  return volumeTableCount >= 10;
}

// Copy the parse function to test it
function parsePromisedNeverlandPattern($: cheerio.CheerioAPI): any[] {
  const volumes: any[] = [];
  const articleTables = $('table.article-table');
  
  console.log(`  - Processing ${articleTables.length} article tables`);
  
  // Process each 5-row table
  articleTables.each((i, table) => {
    const $table = $(table);
    const rows = $table.find('tr');
    
    // Skip if not a 5-row table
    if (rows.length !== 5) {
      console.log(`  - Table ${i + 1}: Skipped (${rows.length} rows)`);
      return;
    }
    
    // Check if this is a volume table
    const firstRow = rows.eq(0);
    const firstRowText = firstRow.text();
    
    if (!firstRowText.includes('Volume')) {
      console.log(`  - Table ${i + 1}: Skipped (no Volume in first row)`);
      return;
    }
    
    // Parse volume number from first row
    const volumeMatch = firstRowText.match(/Volume\s+(\d+)/i);
    if (!volumeMatch) {
      console.log(`  - Table ${i + 1}: Skipped (no volume number match)`);
      return;
    }
    
    const volumeNumber = parseInt(volumeMatch[1], 10);
    console.log(`  - Table ${i + 1}: Processing Volume ${volumeNumber}`);
    
    // Parse chapters from fourth row
    const chaptersRow = rows.eq(3);
    const chaptersCell = chaptersRow.find('td').first();
    const chaptersText = chaptersCell.text();
    
    // Split by lines since chapters are on separate lines
    const lines = chaptersText.split('\n').filter(line => line.trim());
    console.log(`    Found ${lines.length} lines in chapters cell`);
    
    let chapterCount = 0;
    lines.forEach(line => {
      line = line.trim();
      
      // Match chapter patterns: "001. Title" or "021.5. Chapter 21.5"
      const chapterMatch = line.match(/^(\d{3}(?:\.\d)?)\.\s+(.+)$/);
      
      if (chapterMatch) {
        chapterCount++;
      }
    });
    
    console.log(`    Parsed ${chapterCount} chapters`);
    
    if (chapterCount > 0) {
      volumes.push({ volumeNumber, chapters: chapterCount });
    }
  });
  
  return volumes;
}

async function debugPromisedNeverlandFull() {
  console.log('🔍 Full Debug of Promised Neverland Parser\n');
  
  const url = 'https://yakusokunoneverland.fandom.com/wiki/Chapters_and_Volumes';
  const response = await fetch(url);
  const html = await response.text();
  const $ = cheerio.load(html);
  
  console.log('1. Testing detection:');
  const detected = detectPromisedNeverlandPattern($);
  console.log(`   Detection result: ${detected}\n`);
  
  if (detected) {
    console.log('2. Testing parsing:');
    const volumes = parsePromisedNeverlandPattern($);
    console.log(`   Parsed ${volumes.length} volumes\n`);
    
    if (volumes.length > 0) {
      console.log('3. Volume summary:');
      volumes.forEach(v => {
        console.log(`   Volume ${v.volumeNumber}: ${v.chapters} chapters`);
      });
    }
  }
  
  // Test parsing directly regardless of detection
  console.log('\n4. Force parsing (ignoring detection):');
  const volumes = parsePromisedNeverlandPattern($);
  console.log(`   Parsed ${volumes.length} volumes`);
}

debugPromisedNeverlandFull().catch(console.error);