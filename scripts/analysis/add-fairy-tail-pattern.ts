// Script to generate the Fairy Tail pattern code to add to the unified parser

const fairyTailPattern = `
    {
      name: 'fairy-tail-style',
      detect: detectFairyTailStyleTable,
      parse: parseFairyTailStyleTable
    },`;

const fairyTailFunctions = `
/**
 * Detects Fairy Tail style tables
 * - Small tables with style containing border and background
 * - Volume number in text content, not specific cell
 * - Usually 4 rows with release dates and chapter listings
 */
function detectFairyTailStyleTable($: cheerio.CheerioAPI, table: cheerio.Cheerio<any>): boolean {
  const style = table.attr('style') || '';
  const tableText = table.text();
  
  // Check for Fairy Tail specific style pattern
  if (style.includes('border:') && style.includes('background:#') && 
      /Volume\\s+\\d+/i.test(tableText)) {
    
    // Additional verification - should have chapter listings
    return tableText.includes('.') && 
           (tableText.includes('Chapter') || /\\d{3}\\.\\s+\\w+/.test(tableText));
  }
  
  return false;
}

/**
 * Parses Fairy Tail style tables
 */
function parseFairyTailStyleTable($: cheerio.CheerioAPI, table: cheerio.Cheerio<any>): VolumeInfo | null {
  const tableText = table.text();
  const rows = table.find('tr');
  
  // Extract volume number
  const volumeMatch = tableText.match(/Volume\\s+(\\d+)/i);
  if (!volumeMatch) return null;
  
  const volumeNumber = parseInt(volumeMatch[1], 10);
  const volumeInfo: VolumeInfo = {
    volumeNumber,
    title: \`Volume \${volumeNumber}\`,
    chapters: []
  };
  
  // Extract dates from cells
  rows.each((_, row) => {
    const cells = $(row).find('td');
    cells.each((_, cell) => {
      const cellText = $(cell).text().trim();
      
      // Check for date patterns
      const dateMatch = cellText.match(/(\\w+\\s+\\d{1,2},?\\s+\\d{4})/);
      if (dateMatch) {
        if (!volumeInfo.japaneseReleaseDate) {
          volumeInfo.japaneseReleaseDate = dateMatch[1];
        } else if (!volumeInfo.englishReleaseDate) {
          volumeInfo.englishReleaseDate = dateMatch[1];
        }
      }
      
      // Check for chapter listings
      if (cellText.includes('.') && (cellText.includes(':') || /\\d{3}\\./.test(cellText))) {
        // Parse chapters from this cell
        const lines = cellText.split('\\n').filter(line => line.trim());
        
        lines.forEach(line => {
          // Pattern 1: "001. The Fairy's Tail"
          let match = line.match(/^(\\d{3})\\.\\s+(.+)$/);
          
          // Pattern 2: "Chapter 1: Title"
          if (!match) {
            match = line.match(/^Chapter\\s+(\\d+):\\s*(.+)$/i);
          }
          
          // Pattern 3: "Side Story: Title"
          if (!match && line.includes('Side Story:')) {
            const sideMatch = line.match(/Side Story:\\s*(.+)$/i);
            if (sideMatch) {
              volumeInfo.chapters.push({
                chapterNumber: 'SS',
                title: sideMatch[1].trim(),
                volumeNumber
              });
            }
          }
          
          if (match) {
            const chapterNumber = match[1].padStart(3, '0');
            const title = match[2].trim();
            
            volumeInfo.chapters.push({
              chapterNumber,
              title,
              volumeNumber
            });
          }
        });
      }
    });
  });
  
  // Extract ISBN if present
  const isbnMatch = tableText.match(/ISBN[:\\s]+(\\d[\\d-]+)/);
  if (isbnMatch) {
    volumeInfo.isbn = isbnMatch[1];
  }
  
  return volumeInfo.chapters.length > 0 ? volumeInfo : null;
}`;

console.log('Add this pattern to the patterns array (after fire-force-style):');
console.log(fairyTailPattern);

console.log('\n\nAdd these functions to the file (after parseFireForceStyleTable):');
console.log(fairyTailFunctions);

console.log('\n\nLocation guide:');
console.log('1. Add the pattern object to the patterns array around line 51');
console.log('2. Add the detector and parser functions after the Fire Force functions (around line 280)');