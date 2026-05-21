import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

async function debugMonsterRows() {
  console.log('🔍 Debugging Monster Row Structure\n');
  
  const url = 'https://obluda.fandom.com/wiki/List_of_chapters';
  const response = await fetch(url);
  const html = await response.text();
  const $ = cheerio.load(html);
  
  const table = $('table.wikitable').first();
  const rows = table.find('tr');
  
  console.log(`Total rows: ${rows.length}\n`);
  
  // Track pattern
  const volumeRows: number[] = [];
  const chapterRows: number[] = [];
  
  rows.each((i, row) => {
    const $row = $(row);
    const cells = $row.find('td, th');
    const text = $row.text();
    
    // Check if it's a volume row
    if (cells.length === 1 && cells.attr('colspan') && /Volume\s+\d+:/i.test(text)) {
      volumeRows.push(i);
    }
    
    // Check if it's a chapter row
    if (cells.length === 1 && cells.find('li').length > 0) {
      chapterRows.push(i);
    }
  });
  
  console.log(`Volume rows: ${volumeRows.length} at positions:`, volumeRows.slice(0, 5));
  console.log(`Chapter rows: ${chapterRows.length} at positions:`, chapterRows.slice(0, 5));
  
  // Check the pattern
  console.log('\n🔍 Checking row pattern for first volume:');
  
  for (let i = 0; i <= 5; i++) {
    const $row = $(rows[i]);
    const cells = $row.find('td, th');
    const cellCount = cells.length;
    const firstCell = cells.first();
    const colspan = firstCell.attr('colspan');
    const tag = firstCell.prop('tagName').toLowerCase();
    const text = $row.text().trim().substring(0, 50);
    
    console.log(`\nRow ${i}: ${cellCount} cells`);
    console.log(`  Tag: ${tag}, Colspan: ${colspan || 'none'}`);
    console.log(`  Text: "${text}..."`);
    
    // Check row type
    if (cellCount === 1 && colspan && /Volume\s+\d+:/i.test(text)) {
      console.log(`  ✅ VOLUME HEADER`);
    } else if (cellCount === 1 && firstCell.find('li').length > 0) {
      console.log(`  ✅ CHAPTER LIST (${firstCell.find('li').length} chapters)`);
    } else if (cellCount > 1) {
      console.log(`  📊 DATA ROW`);
    } else {
      console.log(`  ❓ OTHER`);
    }
  }
  
  // Now test the actual parsing condition
  console.log('\n\n🧪 Testing parsing conditions:');
  
  let currentVolume: any = null;
  let savedVolumes = 0;
  
  rows.slice(0, 10).each((i, row) => {
    const $row = $(row);
    const cells = $row.find('td, th');
    
    // Volume header detection
    if (cells.length === 1 && cells.attr('colspan')) {
      const rowText = cells.text();
      const volumeMatch = rowText.trim().match(/Volume\s+(\d+)[:\s]*(.*?)(?:\s*\(|$)/i);
      
      if (volumeMatch) {
        if (currentVolume && currentVolume.chapters && currentVolume.chapters.length > 0) {
          console.log(`\n💾 Would save volume ${currentVolume.volumeNumber} with ${currentVolume.chapters.length} chapters`);
          savedVolumes++;
        }
        
        currentVolume = {
          volumeNumber: parseInt(volumeMatch[1], 10),
          title: volumeMatch[2].trim() || `Volume ${volumeMatch[1]}`,
          chapters: []
        };
        console.log(`\n📚 Created volume ${currentVolume.volumeNumber}: "${currentVolume.title}"`);
      }
    }
    // Chapter row detection
    else if (currentVolume && cells.length >= 1) {
      console.log(`  Row ${i}: Checking for chapters (currentVolume exists: ${!!currentVolume})`);
      
      const firstCell = cells.eq(0);
      const listItems = firstCell.find('li');
      
      if (listItems.length > 0) {
        console.log(`    Found ${listItems.length} list items`);
        
        // Test parsing one chapter
        const firstLi = listItems.first().text().trim();
        const chapterMatch = firstLi.match(/^Chapter\s+(\d+):\s*(.+)$/i);
        
        if (chapterMatch) {
          console.log(`    ✅ Can parse: Chapter ${chapterMatch[1]}: "${chapterMatch[2].substring(0, 30)}..."`);
          
          // Actually add chapters
          listItems.each((_, li) => {
            const liText = $(li).text().trim();
            const match = liText.match(/^Chapter\s+(\d+):\s*(.+)$/i);
            if (match && currentVolume.chapters) {
              currentVolume.chapters.push({
                chapterNumber: match[1].padStart(3, '0'),
                title: match[2].trim()
              });
            }
          });
          
          console.log(`    Added ${currentVolume.chapters.length} chapters to volume`);
        } else {
          console.log(`    ❌ Cannot parse: "${firstLi.substring(0, 50)}..."`);
        }
      }
    }
  });
  
  if (currentVolume && currentVolume.chapters && currentVolume.chapters.length > 0) {
    console.log(`\n💾 Would save final volume ${currentVolume.volumeNumber} with ${currentVolume.chapters.length} chapters`);
    savedVolumes++;
  }
  
  console.log(`\n\n📊 Summary: Would save ${savedVolumes} volumes`);
}

debugMonsterRows().catch(console.error);