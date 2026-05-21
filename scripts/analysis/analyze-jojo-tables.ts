import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

async function analyzeJoJoTables() {
  console.log("🔍 Analyzing JoJo Table Structure\n");
  
  const url = "https://jojo.fandom.com/wiki/List_of_JoJo's_Bizarre_Adventure_chapters";
  const response = await fetch(url);
  const html = await response.text();
  const $ = cheerio.load(html);
  
  const tables = $('table');
  
  // Analyze first 10 tables in detail
  console.log('📋 Detailed Table Analysis:\n');
  
  for (let i = 0; i < Math.min(10, tables.length); i++) {
    const table = $(tables[i]);
    const rows = table.find('tr');
    
    console.log(`\n=== Table ${i} ===`);
    console.log(`Rows: ${rows.length}`);
    
    // Check table structure
    const firstRow = rows.first();
    const cells = firstRow.find('td, th');
    console.log(`Columns: ${cells.length}`);
    
    // Show actual content of first few rows
    rows.slice(0, 3).each((j, row) => {
      const rowCells = $(row).find('td, th');
      const cellContents = rowCells.map((_, cell) => {
        const text = $(cell).text().trim();
        // Truncate long text
        return text.length > 50 ? text.substring(0, 50) + '...' : text;
      }).get();
      
      console.log(`Row ${j}: ${JSON.stringify(cellContents)}`);
    });
    
    // Check if this looks like a volume header or chapter list
    const tableText = table.text();
    const isVolumeHeader = tableText.includes('Volume') && rows.length <= 2;
    const hasChapterData = tableText.includes('Chapter') || /\d{3}\./.test(tableText);
    
    console.log(`Type: ${isVolumeHeader ? 'Volume Header' : hasChapterData ? 'Chapter List' : 'Unknown'}`);
  }
  
  // Try a different approach - look for the pattern in the HTML structure
  console.log('\n\n🎯 Pattern Detection:');
  
  // Find all volume headers (single row tables with "Volume X:")
  const volumeHeaders: {number: number, title: string, nextTable: cheerio.Cheerio<any> | null}[] = [];
  
  tables.each((i, table) => {
    const $table = $(table);
    const rows = $table.find('tr');
    
    if (rows.length === 1) {
      const text = $table.text().trim();
      const volumeMatch = text.match(/Volume (\d+):\s*([^[\n]+)/);
      
      if (volumeMatch) {
        const volumeNumber = parseInt(volumeMatch[1], 10);
        const volumeTitle = volumeMatch[2].trim();
        
        // Find the next table (should be chapters)
        const nextTable = i < tables.length - 1 ? $(tables[i + 1]) : null;
        
        volumeHeaders.push({
          number: volumeNumber,
          title: volumeTitle,
          nextTable
        });
      }
    }
  });
  
  console.log(`Found ${volumeHeaders.length} volume headers`);
  
  // Test extraction on first volume
  if (volumeHeaders.length > 0) {
    const firstVolume = volumeHeaders[0];
    console.log(`\nTesting extraction for Volume ${firstVolume.number}: ${firstVolume.title}`);
    
    if (firstVolume.nextTable) {
      const chapterRows = firstVolume.nextTable.find('tr');
      console.log(`Chapter table has ${chapterRows.length} rows`);
      
      // Try to extract chapters
      const chapters: {number: string, title: string}[] = [];
      
      chapterRows.each((_, row) => {
        const cells = $(row).find('td');
        
        cells.each((_, cell) => {
          const cellText = $(cell).text().trim();
          
          // Multiple patterns to try
          const patterns = [
            /(\d{3})\.\s*([^(\n]+)/,  // 001. Title
            /Chapter (\d+):\s*([^(\n]+)/, // Chapter 1: Title
            /(\d+)\.\s*([^(\n]+)/ // 1. Title
          ];
          
          for (const pattern of patterns) {
            const match = cellText.match(pattern);
            if (match) {
              chapters.push({
                number: match[1].padStart(3, '0'),
                title: match[2].trim()
              });
              break;
            }
          }
        });
      });
      
      console.log(`Extracted ${chapters.length} chapters`);
      if (chapters.length > 0) {
        console.log('Sample chapters:');
        chapters.slice(0, 3).forEach(ch => {
          console.log(`  - [${ch.number}] ${ch.title}`);
        });
      }
    }
  }
}

analyzeJoJoTables().catch(console.error);