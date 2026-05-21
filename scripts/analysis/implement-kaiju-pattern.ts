import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

interface VolumeInfo {
  volumeNumber: number;
  title: string;
  englishReleaseDate?: string;
  chapters: ChapterInfo[];
}

interface ChapterInfo {
  chapterNumber: string;
  title: string;
  volumeNumber?: number;
}

/**
 * Detects Kaiju No. 8 pattern
 * - Main manga page with fandom-table
 * - Alternating rows: volume info, then chapter list
 * - Volume rows have 3 cells: number, date, volume link
 * - Chapter rows have "List of Chapters:" text
 */
function detectKaijuPattern($: cheerio.CheerioAPI): boolean {
  const fandomTable = $('table.fandom-table').first();
  if (fandomTable.length === 0) return false;
  
  const rows = fandomTable.find('tr');
  if (rows.length < 10) return false;
  
  // Check for alternating pattern
  let hasVolumeRows = false;
  let hasChapterListRows = false;
  
  rows.slice(1, 10).each((i, row) => {
    const $row = $(row);
    const cells = $row.find('td');
    const text = $row.text();
    
    // Even rows (0, 2, 4...) should be volume rows with 3 cells
    if (i % 2 === 0 && cells.length === 3) {
      const firstCell = cells.first().text().trim();
      if (/^\d+$/.test(firstCell)) {
        hasVolumeRows = true;
      }
    }
    
    // Odd rows should contain "List of Chapters:"
    if (i % 2 === 1 && text.includes('List of Chapters:')) {
      hasChapterListRows = true;
    }
  });
  
  return hasVolumeRows && hasChapterListRows;
}

/**
 * Parses Kaiju No. 8 pattern
 */
function parseKaijuPattern($: cheerio.CheerioAPI): VolumeInfo[] {
  const volumes: VolumeInfo[] = [];
  const fandomTable = $('table.fandom-table').first();
  
  if (fandomTable.length === 0) return volumes;
  
  const rows = fandomTable.find('tr');
  let currentVolume: VolumeInfo | null = null;
  
  rows.slice(1).each((i, row) => {
    const $row = $(row);
    const cells = $row.find('td');
    
    // Volume row (even index in data rows)
    if (i % 2 === 0 && cells.length === 3) {
      // Save previous volume if exists
      if (currentVolume && currentVolume.chapters.length > 0) {
        volumes.push(currentVolume);
      }
      
      const volumeNum = cells.eq(0).text().trim();
      const releaseDate = cells.eq(1).text().trim();
      const volumeLink = cells.eq(2).find('a');
      
      currentVolume = {
        volumeNumber: parseInt(volumeNum, 10),
        title: volumeLink.text().trim() || `Volume ${volumeNum}`,
        englishReleaseDate: releaseDate,
        chapters: []
      };
    }
    // Chapter list row (odd index)
    else if (i % 2 === 1 && currentVolume) {
      const chapterLinks = $row.find('a').filter((_, link) => {
        const href = $(link).attr('href') || '';
        const text = $(link).text();
        return href.includes('/Chapter_') && text.includes('Chapter');
      });
      
      chapterLinks.each((_, link) => {
        const text = $(link).text().trim();
        const match = text.match(/Chapter\s+(\d+)/);
        
        if (match) {
          const chapterNum = match[1].padStart(3, '0');
          currentVolume.chapters.push({
            chapterNumber: chapterNum,
            title: `Chapter ${match[1]}`, // Kaiju doesn't seem to have chapter titles
            volumeNumber: currentVolume.volumeNumber
          });
        }
      });
    }
  });
  
  // Don't forget the last volume
  if (currentVolume && currentVolume.chapters.length > 0) {
    volumes.push(currentVolume);
  }
  
  return volumes;
}

async function testKaijuPattern() {
  console.log('🎯 Testing Kaiju No. 8 Pattern Implementation\n');
  
  const url = 'https://kaiju-no-8.fandom.com/wiki/Kaiju_No._8_(manga)';
  const response = await fetch(url);
  const html = await response.text();
  const $ = cheerio.load(html);
  
  // Test detection
  console.log('Testing detection...');
  const detected = detectKaijuPattern($);
  console.log(`Pattern detected: ${detected}\n`);
  
  if (detected) {
    // Test parsing
    console.log('Testing parsing...');
    const volumes = parseKaijuPattern($);
    
    console.log(`Volumes found: ${volumes.length}`);
    const totalChapters = volumes.reduce((sum, vol) => sum + vol.chapters.length, 0);
    console.log(`Total chapters: ${totalChapters}`);
    
    console.log('\nFirst 3 volumes:');
    volumes.slice(0, 3).forEach(vol => {
      console.log(`  Volume ${vol.volumeNumber}: ${vol.title}`);
      console.log(`    Release: ${vol.englishReleaseDate}`);
      console.log(`    Chapters: ${vol.chapters.length}`);
      if (vol.chapters.length > 0) {
        const first = vol.chapters[0];
        const last = vol.chapters[vol.chapters.length - 1];
        console.log(`    Range: ${first.title} - ${last.title}`);
      }
    });
    
    console.log('\nExpected: ~129 chapters (from infobox)');
    console.log(`Accuracy: ${((totalChapters / 129) * 100).toFixed(1)}%`);
  }
}

testKaijuPattern().catch(console.error);