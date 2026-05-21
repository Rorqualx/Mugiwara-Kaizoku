// Script to generate the Bleach pattern code

const bleachPatternDetect = `
/**
 * Detects Bleach style tables
 * - Multi-volume tables (10 volumes per table)
 * - Volume number is just a number in first cell (e.g., "1", "11", "21")
 * - Chapters in separate row starting with "Chapters list:"
 */
function detectBleachStyleTable($: cheerio.CheerioAPI, table: cheerio.Cheerio<any>): boolean {
  const rows = table.find('tr');
  if (rows.length < 10) return false;
  
  const headers = rows.first().find('th').map((_, th) => $(th).text().trim()).get();
  const hasCorrectHeaders = headers.includes('#') && headers.includes('Japanese') && headers.includes('English');
  
  if (hasCorrectHeaders) {
    // Check for volume rows (just numbers in first cell)
    let volumeCount = 0;
    let hasChaptersList = false;
    
    rows.each((_, row) => {
      const firstCell = $(row).find('td').first();
      const text = firstCell.text().trim();
      
      // Check if it's a volume number row
      if (/^\\d+$/.test(text)) {
        volumeCount++;
      }
      
      // Check for chapters list
      if (text.includes('Chapters list:')) {
        hasChaptersList = true;
      }
    });
    
    // Bleach pattern: multiple volumes and chapters list
    return volumeCount >= 3 && hasChaptersList;
  }
  
  return false;
}`;

const bleachPatternParse = `
/**
 * Parses Bleach style multi-volume tables
 */
function parseBleachStyleTable($: cheerio.CheerioAPI, table: cheerio.Cheerio<any>): VolumeInfo[] {
  const volumes: VolumeInfo[] = [];
  const rows = table.find('tr');
  
  let currentVolume: VolumeInfo | null = null;
  let expectingChapters = false;
  
  rows.each((_, row) => {
    const $row = $(row);
    const cells = $row.find('td');
    
    if (cells.length === 0) return; // Skip header rows
    
    const firstCellText = cells.first().text().trim();
    
    // Check if this is a volume row (just a number)
    if (/^\\d+$/.test(firstCellText) && cells.length >= 5) {
      // Save previous volume if exists
      if (currentVolume && currentVolume.chapters.length > 0) {
        volumes.push(currentVolume);
      }
      
      // Create new volume
      const volumeNumber = parseInt(firstCellText, 10);
      currentVolume = {
        volumeNumber,
        title: \`Volume \${volumeNumber}\`,
        chapters: []
      };
      
      // Extract metadata
      currentVolume.japaneseReleaseDate = cells.eq(1).text().trim().split('[')[0];
      currentVolume.japaneseIsbn = cells.eq(2).text().trim().replace(/^ISBN\\s*/, '');
      currentVolume.englishReleaseDate = cells.eq(3).text().trim().split('[')[0];
      currentVolume.isbn = cells.eq(4).text().trim().replace(/^ISBN\\s*/, '');
      
      expectingChapters = true;
    }
    // Check if this is a chapters row
    else if (expectingChapters && firstCellText.includes('Chapters list:') && currentVolume) {
      const chapterText = firstCellText.replace('Chapters list:', '').trim();
      const chapterLines = chapterText.split('\\n').filter(line => line.trim());
      
      chapterLines.forEach(line => {
        // Pattern: "001. Death & Strawberry"
        const match = line.match(/^(\\d{3})\\.\\s+(.+)$/);
        if (match) {
          currentVolume.chapters.push({
            chapterNumber: match[1],
            title: match[2].trim(),
            volumeNumber: currentVolume.volumeNumber
          });
        }
      });
      
      expectingChapters = false;
    }
  });
  
  // Don't forget the last volume
  if (currentVolume && currentVolume.chapters.length > 0) {
    volumes.push(currentVolume);
  }
  
  return volumes;
}`;

console.log('Add this to the patterns array in the unified parser:\n');
console.log(`    {
      name: 'bleach-style',
      detect: detectBleachStyleTable,
      parse: parseBleachStyleTable
    },`);

console.log('\n\nAdd these functions to the parser file:\n');
console.log(bleachPatternDetect);
console.log('\n');
console.log(bleachPatternParse);