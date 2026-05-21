import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

// Copy the parsing function to test it directly
function parseOnePunchManPattern($: cheerio.CheerioAPI): any[] {
  const volumes: any[] = [];
  const tables = $('table');
  
  console.log(`Processing ${tables.length} tables`);
  
  // Process each small table
  tables.each((i, table) => {
    const $table = $(table);
    const rows = $table.find('tr');
    
    // Skip large tables
    if (rows.length < 2 || rows.length > 10) {
      console.log(`Table ${i + 1}: Skipped (${rows.length} rows)`);
      return;
    }
    
    console.log(`\nTable ${i + 1}: Processing (${rows.length} rows)`);
    
    // Get volume number from either:
    // 1. Previous H3 header
    // 2. First cell of the table
    let volumeNumber: number | null = null;
    
    // Check previous header
    let $prev = $table.prev();
    for (let j = 0; j < 3 && $prev.length; j++) {
      const text = $prev.text();
      const volumeMatch = text.match(/Volume (\d+)/);
      if (volumeMatch) {
        volumeNumber = parseInt(volumeMatch[1], 10);
        console.log(`  Volume number from header: ${volumeNumber}`);
        break;
      }
      $prev = $prev.prev();
    }
    
    // Fallback: check first cell
    if (!volumeNumber) {
      const firstDataRow = rows.eq(2); // Skip header rows
      const firstCell = firstDataRow.find('td').first();
      const cellText = firstCell.text().trim();
      if (/^\d+$/.test(cellText)) {
        volumeNumber = parseInt(cellText, 10);
        console.log(`  Volume number from cell: ${volumeNumber}`);
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
    const chapterCell = lastRow.find('td').first();
    const chapterText = chapterCell.text();
    
    console.log(`  Chapter cell text: "${chapterText.substring(0, 100)}..."`);
    
    if (chapterText.includes('Chapter list:') || chapterText.includes('Punch')) {
      // Split by line breaks
      const lines = chapterText.split('\n').filter(line => line.trim());
      
      console.log(`  Found ${lines.length} lines`);
      
      lines.forEach(line => {
        // Skip the "Chapter list:" header
        if (line.trim() === 'Chapter list:') return;
        
        // Parse patterns like "1st Punch: One Punch" or "2nd Punch: Title"
        const patterns = [
          /(\d+)(?:st|nd|rd|th)\s+Punch:\s*(.+)/,
          /Punch\s+(\d+):\s*(.+)/,
          /Chapter\s+(\d+):\s*(.+)/
        ];
        
        for (const pattern of patterns) {
          const match = line.match(pattern);
          if (match) {
            const chapterNumber = match[1].padStart(3, '0');
            const title = match[2].trim();
            
            volumeInfo.chapters.push({
              chapterNumber,
              title,
              volumeNumber
            });
            console.log(`    Added chapter: ${chapterNumber} - ${title}`);
            break;
          }
        }
      });
    }
    
    if (volumeInfo.chapters.length > 0) {
      volumes.push(volumeInfo);
      console.log(`  ✓ Added volume with ${volumeInfo.chapters.length} chapters`);
    } else {
      console.log('  No chapters found');
    }
  });
  
  return volumes.sort((a, b) => a.volumeNumber - b.volumeNumber);
}

async function forceOPMParse() {
  console.log('🔍 Force-parsing OPM Pattern\n');
  
  const url = 'https://onepunchman.fandom.com/wiki/Volumes';
  const response = await fetch(url);
  const html = await response.text();
  const $ = cheerio.load(html);
  
  const volumes = parseOnePunchManPattern($);
  
  console.log(`\n\n📊 Final Results:`);
  console.log(`Total volumes parsed: ${volumes.length}`);
  
  if (volumes.length > 0) {
    console.log('\nFirst 3 volumes:');
    volumes.slice(0, 3).forEach(vol => {
      console.log(`\nVolume ${vol.volumeNumber}:`);
      console.log(`  Chapters: ${vol.chapters.length}`);
      if (vol.chapters.length > 0) {
        console.log(`  First: ${vol.chapters[0].chapterNumber} - ${vol.chapters[0].title}`);
      }
    });
  }
}

forceOPMParse().catch(console.error);