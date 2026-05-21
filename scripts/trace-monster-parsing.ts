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

function parseSingleLargeTableTrace($: cheerio.CheerioAPI): VolumeInfo[] {
  const volumes: VolumeInfo[] = [];
  
  console.log('🔍 Tracing parseSingleLargeTable execution\n');
  
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
  let volumeCount = 0;
  let chapterRowCount = 0;
  let totalChaptersAdded = 0;
  
  rows.each((i, row) => {
    const $row = $(row);
    const cells = $row.find('td, th');
    
    // Volume header row (single cell with colspan)
    if (cells.length === 1 && cells.attr('colspan')) {
      const rowText = cells.text();
      const volumeMatch = rowText.trim().match(/Volume\s+(\d+)[:\s]*(.*?)(?:\s*\(|$)/i);
      
      if (volumeMatch) {
        // Save previous volume
        if (currentVolume && currentVolume.chapters.length > 0) {
          console.log(`💾 Saving volume ${currentVolume.volumeNumber} with ${currentVolume.chapters.length} chapters`);
          volumes.push(currentVolume);
        }
        
        volumeCount++;
        const volumeNum = parseInt(volumeMatch[1], 10);
        const volumeTitle = volumeMatch[2].trim() || `Volume ${volumeMatch[1]}`;
        
        console.log(`📚 Volume ${volumeNum}: "${volumeTitle}"`);
        
        // Start new volume
        currentVolume = {
          volumeNumber: volumeNum,
          title: volumeTitle,
          chapters: []
        };
      }
    }
    // Chapter row 
    else if (currentVolume && cells.length >= 1) {
      const firstCell = cells.eq(0);
      const cellText = firstCell.text();
      
      // Skip non-chapter rows
      if (!cellText.includes('Chapter') && !cellText.includes('Monster Chronicle')) {
        return;
      }
      
      // Check if chapters are in a list
      const listItems = firstCell.find('li');
      if (listItems.length > 0) {
        chapterRowCount++;
        console.log(`  📄 Row ${i}: Found ${listItems.length} chapters`);
        
        // Parse each list item as a chapter
        listItems.each((j, li) => {
          const liText = $(li).text().trim();
          
          if (liText.includes('Monster Chronicle')) {
            console.log(`    ⏭️  Skipping: "${liText}"`);
            return;
          }
          
          // Try different chapter patterns
          let chapterMatch = liText.match(/^(\d{3})\.\s*(.+?)(?:\s*\(|$)/); // "001. Title"
          if (!chapterMatch) {
            chapterMatch = liText.match(/^Chapter\s+(\d+):\s*(.+)$/i); // "Chapter 1: Title"
          }
          
          if (chapterMatch) {
            const chapterNum = chapterMatch[1].padStart(3, '0');
            const chapterTitle = chapterMatch[2].trim();
            
            console.log(`    ✅ Chapter ${chapterNum}: "${chapterTitle.substring(0, 30)}..."`);
            
            currentVolume.chapters.push({
              chapterNumber: chapterNum,
              title: chapterTitle,
              volumeNumber: currentVolume.volumeNumber
            });
            totalChaptersAdded++;
          } else {
            console.log(`    ❌ Could not parse: "${liText.substring(0, 40)}..."`);
          }
        });
      } else {
        // Check for text-based chapters
        const chapterMatches = cellText.match(/\d{3}\.\s*[^\n]+/g);
        if (chapterMatches) {
          console.log(`  📄 Row ${i}: Found ${chapterMatches.length} text chapters`);
        }
      }
    }
  });
  
  // Don't forget the last volume
  if (currentVolume && currentVolume.chapters.length > 0) {
    console.log(`\n💾 Saving final volume ${currentVolume.volumeNumber} with ${currentVolume.chapters.length} chapters`);
    volumes.push(currentVolume);
  }
  
  console.log(`\n📊 Summary:`);
  console.log(`  Volumes processed: ${volumeCount}`);
  console.log(`  Chapter rows found: ${chapterRowCount}`);
  console.log(`  Total chapters added: ${totalChaptersAdded}`);
  console.log(`  Volumes saved: ${volumes.length}`);
  
  return volumes;
}

async function traceMonsterParsing() {
  const url = 'https://obluda.fandom.com/wiki/List_of_chapters';
  const response = await fetch(url);
  const html = await response.text();
  const $ = cheerio.load(html);
  
  const volumes = parseSingleLargeTableTrace($);
  
  console.log(`\n\n🎯 Final Result: ${volumes.length} volumes`);
  if (volumes.length > 0) {
    const totalChapters = volumes.reduce((sum, vol) => sum + vol.chapters.length, 0);
    console.log(`Total chapters: ${totalChapters}`);
  }
}

traceMonsterParsing().catch(console.error);