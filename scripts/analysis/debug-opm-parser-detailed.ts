import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

// Copy the parser function with debug logs
function parseOnePunchManPatternDebug($: cheerio.CheerioAPI): any[] {
  console.log('📊 Starting parseOnePunchManPattern');
  const volumes: any[] = [];
  const tables = $('table');
  
  console.log(`Total tables: ${tables.length}`);
  
  let tableCount = 0;
  tables.each((_, table) => {
    const $table = $(table);
    const rows = $table.find('tr');
    
    // Skip large tables
    if (rows.length < 2 || rows.length > 10) return;
    
    tableCount++;
    console.log(`\nProcessing table ${tableCount}: ${rows.length} rows`);
    
    // Get volume number from either:
    // 1. Previous H3 header
    // 2. First cell of the table
    let volumeNumber: number | null = null;
    
    // Check previous header
    let $prev = $table.prev();
    for (let i = 0; i < 3 && $prev.length; i++) {
      const text = $prev.text();
      const volumeMatch = text.match(/Volume (\d+)/);
      if (volumeMatch) {
        volumeNumber = parseInt(volumeMatch[1], 10);
        console.log(`  Found volume number from header: ${volumeNumber}`);
        break;
      }
      $prev = $prev.prev();
    }
    
    // Fallback: check first cell
    if (!volumeNumber) {
      const firstDataRow = rows.eq(2); // Skip header rows
      const firstCell = firstDataRow.find('td').first();
      const cellText = firstCell.text().trim();
      console.log(`  First data cell text: "${cellText}"`);
      if (/^\d+$/.test(cellText)) {
        volumeNumber = parseInt(cellText, 10);
        console.log(`  Found volume number from cell: ${volumeNumber}`);
      }
    }
    
    if (!volumeNumber) {
      console.log('  No volume number found, skipping');
      return;
    }
    
    const volumeInfo = {
      volumeNumber,
      title: `Volume ${volumeNumber}`,
      chapters: []
    };
    
    // Extract chapters from the last row
    const lastRow = rows.last();
    const chapterCells = lastRow.find('td');
    console.log(`  Last row has ${chapterCells.length} cells`);
    
    if (chapterCells.length > 0) {
      const chapterText = chapterCells.first().text();
      console.log(`  Chapter text length: ${chapterText.length}`);
      console.log(`  Contains "Chapter list:": ${chapterText.includes('Chapter list:')}`);
      console.log(`  Contains "Punch": ${chapterText.includes('Punch')}`);
      
      if (chapterText.includes('Chapter list:') || chapterText.includes('Punch')) {
        const lines = chapterText.split('\n').filter(line => line.trim());
        console.log(`  Found ${lines.length} lines`);
        
        lines.forEach((line, idx) => {
          const trimmedLine = line.trim();
          if (!trimmedLine || trimmedLine === 'Chapter list:') return;
          
          let lineToMatch = trimmedLine;
          if (lineToMatch.startsWith('Chapter list:')) {
            lineToMatch = lineToMatch.replace('Chapter list:', '').trim();
          }
          
          const patterns = [
            /^(\d+)(?:st|nd|rd|th)\s+Punch:\s*(.+?)(?:Note:|$)/,
            /^Punch\s+(\d+):\s*(.+?)(?:Note:|$)/,
            /^Chapter\s+(\d+):\s*(.+?)(?:Note:|$)/
          ];
          
          for (const pattern of patterns) {
            const match = lineToMatch.match(pattern);
            if (match) {
              const chapterNumber = match[1].padStart(3, '0');
              const title = match[2].trim();
              
              if (title) {
                volumeInfo.chapters.push({
                  chapterNumber,
                  title,
                  volumeNumber
                });
                console.log(`    Added chapter: ${chapterNumber} - ${title}`);
              }
              break;
            }
          }
        });
      }
    }
    
    console.log(`  Total chapters found: ${volumeInfo.chapters.length}`);
    if (volumeInfo.chapters.length > 0) {
      volumes.push(volumeInfo);
      console.log(`  ✅ Added volume ${volumeNumber} with ${volumeInfo.chapters.length} chapters`);
    } else {
      console.log(`  ❌ No chapters found, not adding volume`);
    }
  });
  
  console.log(`\nTotal volumes parsed: ${volumes.length}`);
  return volumes.sort((a, b) => a.volumeNumber - b.volumeNumber);
}

async function debugOPMParserDetailed() {
  const url = 'https://onepunchman.fandom.com/wiki/Volumes';
  const response = await fetch(url);
  const html = await response.text();
  const $ = cheerio.load(html);
  
  const volumes = parseOnePunchManPatternDebug($);
  
  console.log('\n📊 Final Result:');
  console.log(`Volumes: ${volumes.length}`);
  if (volumes.length > 0) {
    console.log('First volume:', JSON.stringify(volumes[0], null, 2));
  }
}

debugOPMParserDetailed().catch(console.error);