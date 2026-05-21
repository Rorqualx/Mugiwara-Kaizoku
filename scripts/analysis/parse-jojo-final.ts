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

async function parseJoJoFinal() {
  console.log("🎯 Parsing JoJo with Alternating Table Pattern\n");
  
  const url = "https://jojo.fandom.com/wiki/List_of_JoJo's_Bizarre_Adventure_chapters";
  const response = await fetch(url);
  const html = await response.text();
  const $ = cheerio.load(html);
  
  const volumes: VolumeInfo[] = [];
  const tables = $('table');
  
  console.log(`Found ${tables.length} tables`);
  
  // JoJo pattern: Volume header table followed by chapter list table
  for (let i = 0; i < tables.length - 1; i++) {
    const currentTable = $(tables[i]);
    const currentText = currentTable.text().trim();
    
    // Check if this is a volume header (contains "Volume X:")
    const volumeMatch = currentText.match(/Volume (\d+):\s*([^''\n]+)/);
    
    if (volumeMatch) {
      const volumeNumber = parseInt(volumeMatch[1], 10);
      const volumeTitle = volumeMatch[2].trim();
      
      // The next table should contain chapters
      const nextTable = $(tables[i + 1]);
      const nextText = nextTable.text();
      
      // Check if next table contains chapter data
      if (nextText.includes('Chapter Titles') || /\d{3}\./.test(nextText)) {
        const volumeInfo: VolumeInfo = {
          volumeNumber,
          title: volumeTitle,
          chapters: []
        };
        
        // Extract chapters from the chapter table
        const rows = nextTable.find('tr');
        
        rows.each((_, row) => {
          const rowText = $(row).text();
          
          // Extract all chapters from the row
          // Pattern: 001. Title (Japanese, Romaji)
          const chapterPattern = /(\d{3})\.\s*([^(\n]+?)(?:\s*\([^)]+\))?(?:\s*\n|$)/g;
          let match;
          
          while ((match = chapterPattern.exec(rowText)) !== null) {
            const chapterNumber = match[1];
            const chapterTitle = match[2].trim();
            
            // Filter out non-chapter entries
            if (chapterTitle && !chapterTitle.includes('Release Date') && !chapterTitle.includes('ISBN')) {
              volumeInfo.chapters.push({
                chapterNumber,
                title: chapterTitle,
                volumeNumber
              });
            }
          }
        });
        
        if (volumeInfo.chapters.length > 0) {
          volumes.push(volumeInfo);
          // Skip the chapter table in next iteration
          i++;
        }
      }
    }
  }
  
  console.log(`\n📚 Results:`);
  console.log(`Volumes parsed: ${volumes.length}`);
  
  const totalChapters = volumes.reduce((sum, vol) => sum + vol.chapters.length, 0);
  console.log(`Total chapters: ${totalChapters}`);
  
  // Show sample volumes
  console.log('\n📖 Sample Volumes:');
  
  // Show first volume
  if (volumes.length > 0) {
    const vol = volumes[0];
    console.log(`\nVolume ${vol.volumeNumber}: ${vol.title}`);
    console.log(`  Chapters: ${vol.chapters.length}`);
    vol.chapters.forEach(ch => {
      console.log(`    - [${ch.chapterNumber}] ${ch.title}`);
    });
  }
  
  // Show a middle volume
  if (volumes.length > 50) {
    const vol = volumes[50];
    console.log(`\nVolume ${vol.volumeNumber}: ${vol.title}`);
    console.log(`  Chapters: ${vol.chapters.length}`);
    vol.chapters.slice(0, 3).forEach(ch => {
      console.log(`    - [${ch.chapterNumber}] ${ch.title}`);
    });
  }
  
  // Show last volume
  if (volumes.length > 1) {
    const vol = volumes[volumes.length - 1];
    console.log(`\nVolume ${vol.volumeNumber}: ${vol.title}`);
    console.log(`  Chapters: ${vol.chapters.length}`);
    vol.chapters.slice(0, 3).forEach(ch => {
      console.log(`    - [${ch.chapterNumber}] ${ch.title}`);
    });
  }
  
  console.log('\n📊 JoJo Parts Distribution:');
  // Rough part boundaries based on volume numbers
  const partRanges = [
    { part: 1, name: 'Phantom Blood', start: 1, end: 5 },
    { part: 2, name: 'Battle Tendency', start: 6, end: 12 },
    { part: 3, name: 'Stardust Crusaders', start: 13, end: 28 },
    { part: 4, name: 'Diamond is Unbreakable', start: 29, end: 47 },
    { part: 5, name: 'Golden Wind', start: 48, end: 63 },
    { part: 6, name: 'Stone Ocean', start: 64, end: 80 },
    { part: 7, name: 'Steel Ball Run', start: 81, end: 104 },
    { part: 8, name: 'JoJolion', start: 105, end: 131 }
  ];
  
  partRanges.forEach(({ part, name, start, end }) => {
    const partVolumes = volumes.filter(v => v.volumeNumber >= start && v.volumeNumber <= end);
    const partChapters = partVolumes.reduce((sum, vol) => sum + vol.chapters.length, 0);
    console.log(`Part ${part} (${name}): ${partVolumes.length} volumes, ${partChapters} chapters`);
  });
  
  const accuracy = (totalChapters / 950) * 100;
  console.log(`\n🎯 Overall accuracy: ${accuracy.toFixed(1)}%`);
}

parseJoJoFinal().catch(console.error);