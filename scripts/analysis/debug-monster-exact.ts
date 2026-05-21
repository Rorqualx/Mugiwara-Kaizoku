import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

async function debugMonsterExact() {
  console.log('🔍 Debugging Monster Exact Issue\n');
  
  const url = 'https://obluda.fandom.com/wiki/List_of_chapters';
  const response = await fetch(url);
  const html = await response.text();
  const $ = cheerio.load(html);
  
  const table = $('table.wikitable').first();
  const rows = table.find('tr');
  
  console.log('Testing exact parsing logic:\n');
  
  let currentVolume: any = null;
  const volumesSaved: any[] = [];
  
  rows.each((i, row) => {
    const $row = $(row);
    const cells = $row.find('td, th');
    
    console.log(`\nRow ${i}: ${cells.length} cells`);
    
    // Volume header row (single cell with colspan)
    if (cells.length === 1 && cells.attr('colspan')) {
      const rowText = cells.text();
      const trimmedText = rowText.trim();
      console.log(`  Checking volume: "${trimmedText.substring(0, 40)}..."`);
      
      const volumeMatch = trimmedText.match(/Volume\s+(\d+)[:\s]*(.*?)(?:\s*\(|$)/i);
      
      if (volumeMatch) {
        console.log(`  ✅ Volume match: Volume ${volumeMatch[1]}`);
        
        // Save previous volume
        if (currentVolume && currentVolume.chapters.length > 0) {
          console.log(`  💾 Saving previous volume ${currentVolume.volumeNumber} with ${currentVolume.chapters.length} chapters`);
          volumesSaved.push(currentVolume);
        }
        
        // Start new volume
        currentVolume = {
          volumeNumber: parseInt(volumeMatch[1], 10),
          title: volumeMatch[2].trim() || `Volume ${volumeMatch[1]}`,
          chapters: []
        };
        console.log(`  📚 Created new volume: ${currentVolume.volumeNumber}`);
      } else {
        console.log(`  ❌ No volume match`);
      }
    }
    // Chapter row 
    else if (currentVolume && cells.length >= 1) {
      const firstCell = cells.eq(0);
      const cellText = firstCell.text();
      
      console.log(`  Chapter row check (volume ${currentVolume?.volumeNumber || 'none'}):`);
      console.log(`    Cell text preview: "${cellText.substring(0, 50)}..."`);
      
      // Check if chapters are in a list
      const listItems = firstCell.find('li');
      console.log(`    List items found: ${listItems.length}`);
      
      if (listItems.length > 0) {
        let chaptersAdded = 0;
        
        // Parse each list item as a chapter
        listItems.each((j, li) => {
          const liText = $(li).text().trim();
          
          // Skip Monster Chronicle
          if (liText.includes('Monster Chronicle')) {
            console.log(`    Skipping Monster Chronicle`);
            return;
          }
          
          // Try different chapter patterns
          let chapterMatch = liText.match(/^(\d{3})\.\s*(.+?)(?:\s*\(|$)/); // "001. Title"
          if (!chapterMatch) {
            chapterMatch = liText.match(/^Chapter\s+(\d+):\s*(.+)$/i); // "Chapter 1: Title"
          }
          
          if (chapterMatch) {
            const chapterNum = chapterMatch[1].padStart(3, '0');
            currentVolume.chapters.push({
              chapterNumber: chapterNum,
              title: chapterMatch[2].trim(),
              volumeNumber: currentVolume.volumeNumber
            });
            chaptersAdded++;
          } else if (j === 0) {
            console.log(`    ❌ Could not parse first item: "${liText.substring(0, 40)}..."`);
          }
        });
        
        console.log(`    ✅ Added ${chaptersAdded} chapters to volume ${currentVolume.volumeNumber}`);
      } else {
        // Check if there's text that looks like chapters
        if (cellText.includes('Chapter')) {
          console.log(`    ⚠️  Cell contains "Chapter" but no <li> tags!`);
          
          // Check the HTML structure
          const cellHtml = firstCell.html();
          if (cellHtml) {
            const hasBr = cellHtml.includes('<br');
            const hasNewlines = cellText.includes('\n');
            console.log(`    HTML info: ${hasBr ? 'has <br>' : 'no <br>'}, ${hasNewlines ? 'has newlines' : 'no newlines'}`);
          }
        }
      }
    }
    
    if (i >= 10) {
      console.log('\n... (showing first 10 rows only)');
      return false;
    }
  });
  
  // Don't forget the last volume
  if (currentVolume && currentVolume.chapters.length > 0) {
    console.log(`\n💾 Saving final volume ${currentVolume.volumeNumber} with ${currentVolume.chapters.length} chapters`);
    volumesSaved.push(currentVolume);
  }
  
  console.log(`\n\n📊 Final Result:`);
  console.log(`Volumes saved: ${volumesSaved.length}`);
  const totalChapters = volumesSaved.reduce((sum, vol) => sum + vol.chapters.length, 0);
  console.log(`Total chapters: ${totalChapters}`);
  
  if (volumesSaved.length > 0) {
    console.log('\nFirst 3 volumes:');
    volumesSaved.slice(0, 3).forEach(vol => {
      console.log(`  Volume ${vol.volumeNumber}: ${vol.chapters.length} chapters`);
    });
  }
}

debugMonsterExact().catch(console.error);