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
}

async function parseWDSTabsContent() {
  console.log('🎯 Parsing WDS Tab Content\n');
  
  const url = 'https://dr-stone.fandom.com/wiki/Chapters_and_Volumes';
  const response = await fetch(url);
  const html = await response.text();
  const $ = cheerio.load(html);
  
  // Strategy: Find all tables regardless of tab state
  const volumes: VolumeInfo[] = [];
  
  // Look for all tables that might contain volume/chapter data
  const tables = $('table');
  console.log(`Found ${tables.length} tables total\n`);
  
  tables.each((i, table) => {
    const $table = $(table);
    const tableText = $table.text();
    
    // Skip if not a volume/chapter table
    if (!tableText.includes('Chapter') || tableText.includes('Navigation')) {
      return;
    }
    
    console.log(`\nAnalyzing table ${i + 1}:`);
    
    // Check if this is a volume header table
    const rows = $table.find('tr');
    console.log(`- Rows: ${rows.length}`);
    
    // Try to parse as a standard volume table
    if (rows.length > 2) {
      // Look for volume info in first row or caption
      let volumeNumber = 0;
      let volumeTitle = '';
      
      // Check table caption
      const caption = $table.find('caption').text().trim();
      if (caption) {
        const volumeMatch = caption.match(/Volume\s+(\d+)/i);
        if (volumeMatch) {
          volumeNumber = parseInt(volumeMatch[1], 10);
          volumeTitle = caption.replace(/Volume\s+\d+:?\s*/i, '').trim();
        }
      }
      
      // If no caption, check first row
      if (!volumeNumber) {
        const firstRowText = rows.first().text();
        const volumeMatch = firstRowText.match(/Volume\s+(\d+)/i);
        if (volumeMatch) {
          volumeNumber = parseInt(volumeMatch[1], 10);
          volumeTitle = firstRowText.replace(/Volume\s+\d+:?\s*/i, '').trim();
        }
      }
      
      console.log(`- Volume: ${volumeNumber} - ${volumeTitle}`);
      
      if (volumeNumber > 0) {
        const volumeInfo: VolumeInfo = {
          volumeNumber,
          title: volumeTitle,
          chapters: []
        };
        
        // Parse chapters from remaining rows
        rows.slice(1).each((_, row) => {
          const cells = $(row).find('td');
          
          if (cells.length >= 2) {
            // First cell might be chapter number
            const cell1 = cells.eq(0).text().trim();
            const cell2 = cells.eq(1).text().trim();
            
            // Try different patterns
            let chapterNumber = '';
            let chapterTitle = '';
            
            // Pattern 1: Chapter number in first cell
            const chapterMatch = cell1.match(/(\d+)/);
            if (chapterMatch) {
              chapterNumber = chapterMatch[1].padStart(3, '0');
              chapterTitle = cell2;
            }
            // Pattern 2: "Chapter X: Title" in one cell
            else if (cell1.includes('Chapter')) {
              const match = cell1.match(/Chapter\s+(\d+):?\s*(.*)$/i);
              if (match) {
                chapterNumber = match[1].padStart(3, '0');
                chapterTitle = match[2].trim() || cell2;
              }
            }
            
            if (chapterNumber && chapterTitle) {
              volumeInfo.chapters.push({ chapterNumber, title: chapterTitle });
            }
          }
        });
        
        if (volumeInfo.chapters.length > 0) {
          volumes.push(volumeInfo);
          console.log(`- Extracted ${volumeInfo.chapters.length} chapters`);
        }
      }
    }
  });
  
  // Check for alternative structure - single large table
  if (volumes.length === 0) {
    console.log('\n🔄 Trying alternative parsing approach...\n');
    
    // Look for the largest table
    let largestTable: cheerio.Cheerio<any> | null = null;
    let maxRows = 0;
    
    tables.each((_, table) => {
      const rowCount = $(table).find('tr').length;
      if (rowCount > maxRows) {
        maxRows = rowCount;
        largestTable = $(table);
      }
    });
    
    if (largestTable && maxRows > 10) {
      console.log(`Found large table with ${maxRows} rows`);
      
      // Parse as single table with all chapters
      const rows = largestTable.find('tr');
      let currentVolume: VolumeInfo | null = null;
      
      rows.each((_, row) => {
        const cells = $(row).find('td, th');
        const rowText = $(row).text();
        
        // Check if this is a volume header row
        if (rowText.includes('Volume') && cells.length <= 2) {
          if (currentVolume && currentVolume.chapters.length > 0) {
            volumes.push(currentVolume);
          }
          
          const volumeMatch = rowText.match(/Volume\s+(\d+):?\s*(.*)$/i);
          if (volumeMatch) {
            currentVolume = {
              volumeNumber: parseInt(volumeMatch[1], 10),
              title: volumeMatch[2].trim(),
              chapters: []
            };
          }
        }
        // Otherwise parse as chapter row
        else if (currentVolume && cells.length >= 2) {
          const chapterNum = cells.eq(0).text().trim();
          const chapterTitle = cells.eq(1).text().trim();
          
          if (/^\d+$/.test(chapterNum)) {
            currentVolume.chapters.push({
              chapterNumber: chapterNum.padStart(3, '0'),
              title: chapterTitle
            });
          }
        }
      });
      
      // Don't forget last volume
      if (currentVolume && currentVolume.chapters.length > 0) {
        volumes.push(currentVolume);
      }
    }
  }
  
  console.log('\n📊 Results:');
  console.log(`Total volumes parsed: ${volumes.length}`);
  
  const totalChapters = volumes.reduce((sum, vol) => sum + vol.chapters.length, 0);
  console.log(`Total chapters: ${totalChapters}`);
  
  if (volumes.length > 0) {
    console.log('\nFirst 3 volumes:');
    volumes.slice(0, 3).forEach(vol => {
      console.log(`\nVolume ${vol.volumeNumber}: ${vol.title}`);
      console.log(`  Chapters: ${vol.chapters.length}`);
      vol.chapters.slice(0, 2).forEach(ch => {
        console.log(`    - [${ch.chapterNumber}] ${ch.title}`);
      });
    });
  }
  
  console.log('\n📈 Dr. Stone expected: ~26 volumes, ~232 chapters');
  console.log(`Accuracy: ${((totalChapters / 232) * 100).toFixed(1)}%`);
}

parseWDSTabsContent().catch(console.error);