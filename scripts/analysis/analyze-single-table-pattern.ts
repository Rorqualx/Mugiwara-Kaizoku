import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

// Focus on modern manga with single large table pattern
const singleTableManga = [
  { name: 'Fist of the North Star', url: 'https://hokuto.fandom.com/wiki/Hokuto_no_Ken_chapters' },
  { name: 'Captain Tsubasa', url: 'https://manga.fandom.com/wiki/List_of_Captain_Tsubasa_chapters' },
  { name: 'Chainsaw Man', url: 'https://chainsaw-man.fandom.com/wiki/Chainsaw_Man_(Manga)' },
  { name: 'Monster', url: 'https://obluda.fandom.com/wiki/List_of_chapters' }
];

async function analyzeSingleTablePattern() {
  console.log('🔍 Analyzing Single Large Table Pattern\n');
  
  for (const manga of singleTableManga) {
    console.log(`\n📖 ${manga.name}`);
    console.log(`URL: ${manga.url}`);
    
    try {
      const response = await fetch(manga.url);
      const html = await response.text();
      const $ = cheerio.load(html);
      
      // Find all tables
      const tables = $('table');
      console.log(`\nTables found: ${tables.length}`);
      
      // Look for large tables
      const largeTables = tables.filter((_, table) => {
        const rows = $(table).find('tr').length;
        return rows > 20;
      }).toArray();
      
      console.log(`Large tables (20+ rows): ${largeTables.length}`);
      
      if (largeTables.length > 0) {
        // Analyze the largest table
        let maxRows = 0;
        let largestTable: any = null;
        
        largeTables.forEach(table => {
          const rowCount = $(table).find('tr').length;
          if (rowCount > maxRows) {
            maxRows = rowCount;
            largestTable = table;
          }
        });
        
        if (largestTable) {
          const $table = $(largestTable);
          console.log(`\n📊 Largest table analysis:`);
          console.log(`- Rows: ${maxRows}`);
          console.log(`- Classes: ${$table.attr('class') || 'none'}`);
          
          // Analyze structure
          const headers = $table.find('tr').first().find('th, td');
          console.log(`- Header cells: ${headers.length}`);
          
          const headerTexts = headers.map((_, cell) => $(cell).text().trim()).get();
          console.log(`- Headers: [${headerTexts.join('] [')}]`);
          
          // Check content patterns
          const sampleRows = $table.find('tr').slice(1, 6);
          console.log('\n📋 Sample rows:');
          
          sampleRows.each((i, row) => {
            const cells = $(row).find('td');
            const cellCount = cells.length;
            
            if (cellCount > 0) {
              const firstCell = cells.eq(0).text().trim();
              const secondCell = cells.eq(1).text().trim();
              
              console.log(`Row ${i + 1}: ${cellCount} cells`);
              console.log(`  Cell 1: "${firstCell.substring(0, 30)}${firstCell.length > 30 ? '...' : ''}"`);
              console.log(`  Cell 2: "${secondCell.substring(0, 30)}${secondCell.length > 30 ? '...' : ''}"`);
              
              // Check for volume/chapter patterns
              const hasVolume = /Volume \d+/i.test($(row).text());
              const hasChapter = /Chapter \d+/i.test($(row).text());
              
              if (hasVolume || hasChapter) {
                console.log(`  ✓ Contains: ${hasVolume ? 'Volume' : ''} ${hasChapter ? 'Chapter' : ''}`);
              }
            }
          });
          
          // Look for specific patterns
          const tableText = $table.text();
          console.log('\n🎯 Content indicators:');
          console.log(`- Has "Volume": ${/Volume \d+/i.test(tableText)}`);
          console.log(`- Has "Chapter": ${/Chapter \d+/i.test(tableText)}`);
          console.log(`- Has "#" column: ${headerTexts.includes('#')}`);
          console.log(`- Has "Title" column: ${headerTexts.some(h => h.includes('Title'))}`);
          
          // Check if rows are grouped by volume
          let volumeRows = 0;
          $table.find('tr').each((_, row) => {
            const text = $(row).text();
            if (/Volume \d+/i.test(text) && $(row).find('td').length <= 2) {
              volumeRows++;
            }
          });
          console.log(`- Volume header rows: ${volumeRows}`);
        }
      }
    } catch (error) {
      console.log(`\n❌ Error: ${error.message}`);
    }
  }
  
  console.log('\n\n📝 Pattern Summary:');
  console.log('Single large tables typically have:');
  console.log('1. 50+ rows containing all chapters');
  console.log('2. Headers like "#", "Title", "Volume", "Release Date"');
  console.log('3. Each row is a chapter with volume info in a column');
  console.log('4. OR volume rows act as section headers');
}

analyzeSingleTablePattern().catch(console.error);