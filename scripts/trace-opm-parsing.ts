import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

// Simulate exact pattern detection order
async function traceOPMParsing() {
  console.log('🔍 Tracing OPM Parsing Flow\n');
  
  const url = 'https://onepunchman.fandom.com/wiki/Volumes';
  const response = await fetch(url);
  const html = await response.text();
  const $ = cheerio.load(html);
  
  // Check patterns in order
  console.log('1. Gallery-based layout:');
  const galleries = $('.wikia-gallery, .gallery');
  console.log(`   Found: ${galleries.length} galleries`);
  console.log(`   Pattern matches: false\n`);
  
  console.log('2. JoJo alternating pattern:');
  console.log(`   Pattern matches: false\n`);
  
  console.log('3. Collapsible navigation:');
  const collapsibles = $('.mw-collapsible, .collapsible, .toccolours');
  console.log(`   Found: ${collapsibles.length} collapsibles`);
  console.log(`   Pattern matches: false\n`);
  
  console.log('4. Kaiju pattern:');
  const fandomTables = $('table.fandom-table');
  console.log(`   Found: ${fandomTables.length} fandom tables`);
  console.log(`   Pattern matches: false\n`);
  
  console.log('5. One Punch Man pattern:');
  const tables = $('table');
  const smallTables = tables.filter((_, table) => {
    const rows = $(table).find('tr').length;
    return rows >= 2 && rows <= 10;
  });
  
  console.log(`   Small tables: ${smallTables.length}`);
  console.log(`   Has 15+ small tables: ${smallTables.length >= 15}`);
  
  let volumeTableCount = 0;
  smallTables.each((_, table) => {
    const $table = $(table);
    const text = $table.text();
    
    if (text.includes('Punch') || text.includes('Chapter list:')) {
      const firstDataRow = $table.find('tr').eq(2);
      const firstCell = firstDataRow.find('td').first().text().trim();
      
      if (/^\d+$/.test(firstCell)) {
        volumeTableCount++;
      } else {
        let $prev = $table.prev();
        for (let i = 0; i < 3 && $prev.length; i++) {
          if (/Volume \d+/.test($prev.text())) {
            volumeTableCount++;
            break;
          }
          $prev = $prev.prev();
        }
      }
    }
    
    if (volumeTableCount >= 3) {
      return false;
    }
  });
  
  console.log(`   Volume tables found: ${volumeTableCount}`);
  console.log(`   Pattern matches: ${volumeTableCount >= 3}`);
  
  if (volumeTableCount >= 3) {
    console.log('   ✓ OPM pattern detected! Should parse and return volumes.\n');
    
    // Actually parse it
    console.log('Parsing OPM volumes...');
    const volumes: any[] = [];
    
    tables.each((_, table) => {
      const $table = $(table);
      const rows = $table.find('tr');
      
      if (rows.length < 2 || rows.length > 10) return;
      
      let volumeNumber: number | null = null;
      
      let $prev = $table.prev();
      for (let i = 0; i < 3 && $prev.length; i++) {
        const text = $prev.text();
        const volumeMatch = text.match(/Volume (\d+)/);
        if (volumeMatch) {
          volumeNumber = parseInt(volumeMatch[1], 10);
          break;
        }
        $prev = $prev.prev();
      }
      
      if (!volumeNumber) {
        const firstDataRow = rows.eq(2);
        const firstCell = firstDataRow.find('td').first();
        const cellText = firstCell.text().trim();
        if (/^\d+$/.test(cellText)) {
          volumeNumber = parseInt(cellText, 10);
        }
      }
      
      if (!volumeNumber) return;
      
      const volumeInfo = {
        volumeNumber,
        title: `Volume ${volumeNumber}`,
        chapters: []
      };
      
      const lastRow = rows.last();
      const chapterCells = lastRow.find('td');
      
      if (chapterCells.length > 0) {
        const chapterText = chapterCells.first().text();
        
        if (chapterText.includes('Chapter list:') || chapterText.includes('Punch')) {
          const lines = chapterText.split('\n').filter(line => line.trim());
          
          lines.forEach(line => {
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
                }
                break;
              }
            }
          });
        }
      }
      
      if (volumeInfo.chapters.length > 0) {
        volumes.push(volumeInfo);
      }
    });
    
    console.log(`Parsed ${volumes.length} volumes`);
    console.log(`First volume: ${JSON.stringify(volumes[0], null, 2)}`);
    console.log('\nThis should be returned from parseVolumeTables()');
  }
}

traceOPMParsing().catch(console.error);