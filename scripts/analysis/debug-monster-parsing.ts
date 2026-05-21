import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

interface VolumeInfo {
  volumeNumber: number;
  title: string;
  chapters: ChapterInfo[];
}

interface ChapterInfo {
  chapterNumber: string;
  title: string;
  volumeNumber?: number;
}

function parseSingleLargeTableDebug($: cheerio.CheerioAPI): VolumeInfo[] {
  const volumes: VolumeInfo[] = [];
  
  console.log('🔍 Debug: Starting parseSingleLargeTable\n');
  
  // Find the largest table
  let largestTable: cheerio.Cheerio<any> | null = null;
  let maxRows = 0;
  
  $('table').each((_, table) => {
    const rowCount = $(table).find('tr').length;
    if (rowCount > maxRows && rowCount > 20) {
      maxRows = rowCount;
      largestTable = $(table);
    }
  });
  
  if (!largestTable) {
    console.log('❌ No large table found');
    return volumes;
  }
  
  console.log(`✅ Found table with ${maxRows} rows\n`);
  
  let currentVolume: VolumeInfo | null = null;
  const rows = largestTable.find('tr');
  let rowCount = 0;
  let volumeCount = 0;
  let chapterRowCount = 0;
  
  rows.each((i, row) => {
    const $row = $(row);
    const cells = $row.find('td, th');
    
    // Volume header row (single cell with colspan)
    if (cells.length === 1 && cells.attr('colspan')) {
      const rowText = cells.text();
      console.log(`Row ${i}: Single cell with colspan="${cells.attr('colspan')}", text="${rowText.substring(0, 50)}..."`);
      
      const volumeMatch = rowText.match(/Volume\s+(\d+)[:\s]*(.*?)(?:\s*\(|$)/i);
      
      if (volumeMatch) {
        // Save previous volume
        if (currentVolume && currentVolume.chapters.length > 0) {
          console.log(`  Saving volume ${currentVolume.volumeNumber} with ${currentVolume.chapters.length} chapters`);
          volumes.push(currentVolume);
        }
        
        volumeCount++;
        console.log(`\nVolume ${volumeMatch[1]} detected: "${volumeMatch[2] || 'No title'}"`);
        
        // Start new volume
        currentVolume = {
          volumeNumber: parseInt(volumeMatch[1], 10),
          title: volumeMatch[2].trim() || `Volume ${volumeMatch[1]}`,
          chapters: []
        };
      }
    }
    // Chapter row 
    else if (currentVolume && cells.length >= 1) {
      const firstCell = cells.eq(0);
      const cellText = firstCell.text();
      
      // Skip rows that don't contain chapter info
      if (!cellText.includes('Chapter') && !cellText.includes('Monster Chronicle')) {
        return;
      }
      
      // Check if chapters are in a list
      const listItems = firstCell.find('li');
      if (listItems.length > 0) {
        chapterRowCount++;
        console.log(`  Row ${i}: Found ${listItems.length} list items`);
        
        // Parse each list item as a chapter
        listItems.each((j, li) => {
          const liText = $(li).text().trim();
          
          if (liText.includes('Monster Chronicle')) {
            console.log(`    Skipping: "${liText}"`);
            return;
          }
          
          // Try different chapter patterns
          let chapterMatch = liText.match(/^(\d{3})\.\s*(.+?)(?:\s*\(|$)/); // "001. Title"
          if (!chapterMatch) {
            chapterMatch = liText.match(/^Chapter\s+(\d+):\s*(.+)$/i); // "Chapter 1: Title"
          }
          
          if (chapterMatch) {
            const chapterNum = chapterMatch[1].padStart(3, '0');
            console.log(`    ✅ Chapter ${chapterNum}: "${chapterMatch[2].substring(0, 30)}..."`);
            currentVolume.chapters.push({
              chapterNumber: chapterNum,
              title: chapterMatch[2].trim(),
              volumeNumber: currentVolume.volumeNumber
            });
          } else {
            console.log(`    ❌ Could not parse: "${liText.substring(0, 50)}..."`);
          }
        });
      }
    }
    
    rowCount++;
  });
  
  // Don't forget the last volume
  if (currentVolume && currentVolume.chapters.length > 0) {
    console.log(`\n  Saving volume ${currentVolume.volumeNumber} with ${currentVolume.chapters.length} chapters`);
    volumes.push(currentVolume);
  }
  
  console.log(`\n📊 Summary:`);
  console.log(`  Total rows processed: ${rowCount}`);
  console.log(`  Volume headers found: ${volumeCount}`);
  console.log(`  Chapter rows found: ${chapterRowCount}`);
  console.log(`  Volumes saved: ${volumes.length}`);
  
  return volumes;
}

async function debugMonsterParsing() {
  console.log('🎯 Debug Monster Parsing\n');
  
  const url = 'https://obluda.fandom.com/wiki/List_of_chapters';
  const response = await fetch(url);
  const html = await response.text();
  const $ = cheerio.load(html);
  
  const volumes = parseSingleLargeTableDebug($);
  
  console.log(`\n\n📚 Final Result:`);
  console.log(`Volumes: ${volumes.length}`);
  const totalChapters = volumes.reduce((sum, vol) => sum + vol.chapters.length, 0);
  console.log(`Total chapters: ${totalChapters}`);
  
  if (volumes.length > 0) {
    console.log('\nFirst 3 volumes:');
    volumes.slice(0, 3).forEach(vol => {
      console.log(`  Volume ${vol.volumeNumber}: ${vol.title} - ${vol.chapters.length} chapters`);
    });
  }
}

debugMonsterParsing().catch(console.error);