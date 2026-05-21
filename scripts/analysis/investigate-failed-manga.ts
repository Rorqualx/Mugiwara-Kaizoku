import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

// Select a few failed manga from different categories to investigate
const failedManga = [
  { name: 'Dragon Ball', url: 'https://dragonball.fandom.com/wiki/List_of_Dragon_Ball_manga_chapters' },
  { name: 'Naruto', url: 'https://naruto.fandom.com/wiki/List_of_Volumes' },
  { name: 'Jujutsu Kaisen', url: 'https://jujutsu-kaisen.fandom.com/wiki/Volumes_&_Chapters' },
  { name: 'Death Note', url: 'https://deathnote.fandom.com/wiki/List_of_Death_Note_chapters' },
  { name: 'Haikyuu!!', url: 'https://haikyuu.fandom.com/wiki/Haiky%C5%AB!!_Volumes' },
];

async function investigateManga(manga: { name: string; url: string }) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`🔍 Investigating ${manga.name}`);
  console.log(`URL: ${manga.url}`);
  console.log('='.repeat(60));
  
  try {
    const response = await fetch(manga.url);
    if (!response.ok) {
      console.log(`❌ HTTP Error: ${response.status}`);
      return;
    }
    
    const html = await response.text();
    const $ = cheerio.load(html);
    
    // Analyze tables
    const tables = $('table');
    console.log(`\n📊 Total tables found: ${tables.length}`);
    
    // Check for different table structures
    tables.each((i, table) => {
      const $table = $(table);
      const rows = $table.find('tr');
      const headers = $table.find('th');
      const tableText = $table.text();
      
      // Skip very small tables
      if (rows.length < 3) return;
      
      console.log(`\nTable ${i}:`);
      console.log(`- Rows: ${rows.length}`);
      console.log(`- Headers: ${headers.length}`);
      console.log(`- Contains "Volume": ${tableText.includes('Volume')}`);
      console.log(`- Contains "Chapter": ${tableText.includes('Chapter')}`);
      console.log(`- Contains "Title": ${tableText.includes('Title')}`);
      console.log(`- Contains "ISBN": ${tableText.includes('ISBN')}`);
      
      // Check table classes and attributes
      const tableClass = $table.attr('class') || 'none';
      console.log(`- Class: ${tableClass}`);
      
      // Show first few rows for volume-looking tables
      if (tableText.includes('Volume') || tableText.includes('Chapter')) {
        console.log('\nFirst 3 rows:');
        rows.slice(0, 3).each((j, row) => {
          const $row = $(row);
          const cells = $row.find('td, th');
          const cellCount = cells.length;
          const rowText = $row.text().trim().substring(0, 100);
          console.log(`  Row ${j} (${cellCount} cells): "${rowText}${rowText.length >= 100 ? '...' : ''}"`);
          
          // If first row, show individual cells
          if (j === 0 && cellCount > 0) {
            cells.each((k, cell) => {
              const cellText = $(cell).text().trim();
              console.log(`    Cell ${k}: "${cellText}"`);
            });
          }
        });
        
        // Check for nested structures
        const nestedTables = $table.find('table');
        const lists = $table.find('ul, ol, dl');
        console.log(`\nNested structures:`);
        console.log(`- Nested tables: ${nestedTables.length}`);
        console.log(`- Lists (ul/ol/dl): ${lists.length}`);
        
        // Look for volume patterns
        const volumeMatches = tableText.match(/Volume\s+\d+/gi);
        if (volumeMatches) {
          console.log(`- Volume patterns found: ${volumeMatches.length} (first few: ${volumeMatches.slice(0, 3).join(', ')})`);
        }
        
        // Look for chapter patterns
        const chapterMatches = tableText.match(/Chapter\s+\d+/gi);
        if (chapterMatches) {
          console.log(`- Chapter patterns found: ${chapterMatches.length} (first few: ${chapterMatches.slice(0, 3).join(', ')})`);
        }
      }
    });
    
    // Check for non-table structures
    console.log('\n🔍 Non-table structures:');
    
    // Check for divs with volume/chapter info
    const volumeDivs = $('div').filter((_, el) => {
      const text = $(el).text();
      return /Volume\s+\d+/i.test(text) && text.length < 1000;
    });
    console.log(`- Divs with volume info: ${volumeDivs.length}`);
    
    // Check for lists
    const chapterLists = $('ul, ol').filter((_, el) => {
      const text = $(el).text();
      return text.includes('Chapter') || text.includes('chapter');
    });
    console.log(`- Lists with chapter info: ${chapterLists.length}`);
    
    // Check for specific wiki structures
    const wikitables = $('.wikitable');
    const articleTables = $('.article-table');
    const infoboxes = $('.infobox');
    
    console.log(`\n📦 Wiki-specific structures:`);
    console.log(`- .wikitable: ${wikitables.length}`);
    console.log(`- .article-table: ${articleTables.length}`);
    console.log(`- .infobox: ${infoboxes.length}`);
    
  } catch (error) {
    console.log(`❌ Error: ${error.message}`);
  }
}

async function investigateAll() {
  console.log('🔍 Investigating Failed Manga Patterns\n');
  
  for (const manga of failedManga) {
    await investigateManga(manga);
    // Small delay between requests
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  console.log('\n✅ Investigation complete!');
}

investigateAll().catch(console.error);