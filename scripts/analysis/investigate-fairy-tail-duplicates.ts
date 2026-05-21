import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

async function investigateFairyTailDuplicates() {
  console.log('🔍 Investigating Fairy Tail Chapter Duplicates\n');
  
  const response = await fetch('https://fairytail.fandom.com/wiki/Volumes_and_Chapters');
  const html = await response.text();
  const $ = cheerio.load(html);
  
  // Find a volume table with the style pattern
  const volumeTables = $('table').filter((_, table) => {
    const style = $(table).attr('style') || '';
    const text = $(table).text();
    return style.includes('border:') && style.includes('background:#') && 
           /Volume\s+\d+/i.test(text);
  });
  
  console.log(`Found ${volumeTables.length} volume tables\n`);
  
  // Analyze the first volume in detail
  if (volumeTables.length > 0) {
    const firstTable = volumeTables.first();
    const rows = firstTable.find('tr');
    
    console.log('📊 First Volume Table Structure:');
    console.log(`Total rows: ${rows.length}\n`);
    
    rows.each((i, row) => {
      const cells = $(row).find('td');
      console.log(`\nRow ${i + 1}: ${cells.length} cells`);
      
      cells.each((j, cell) => {
        const cellText = $(cell).text().trim();
        const cellHtml = $(cell).html();
        
        // Check if this cell contains chapter listings
        if (cellText.includes('.') && (cellText.includes(':') || /\d{3}\./.test(cellText))) {
          console.log(`\n  Cell ${j + 1} - CHAPTER CELL:`);
          console.log('  Raw text:', cellText.substring(0, 200) + '...');
          
          // Check for line breaks
          const brTags = $(cell).find('br').length;
          console.log(`  <br> tags: ${brTags}`);
          
          // Check for nested elements
          const spans = $(cell).find('span').length;
          const divs = $(cell).find('div').length;
          console.log(`  Nested elements: ${spans} spans, ${divs} divs`);
          
          // Split by line breaks and analyze
          console.log('\n  Lines in cell:');
          const lines = cellText.split('\n').filter(line => line.trim());
          lines.forEach((line, idx) => {
            console.log(`    Line ${idx + 1}: "${line.trim()}"`);
          });
          
          // Check HTML structure for pattern
          if (cellHtml.includes('<br')) {
            console.log('\n  HTML structure uses <br> for line breaks');
            // Split by <br> tags
            const htmlLines = cellHtml.split(/<br\s*\/?>/i);
            console.log(`  ${htmlLines.length} segments separated by <br>`);
          }
        }
      });
    });
    
    // Check for specific duplicate patterns
    console.log('\n\n🔍 Checking for Duplicate Patterns:');
    
    // Look for cells with both Japanese and English text
    const chapterCells = $('td').filter((_, cell) => {
      const text = $(cell).text();
      return /\d{3}\./.test(text) || /Chapter\s+\d+:/i.test(text);
    });
    
    console.log(`Found ${chapterCells.length} cells with chapter info\n`);
    
    // Analyze first few chapter cells
    chapterCells.slice(0, 3).each((i, cell) => {
      const cellText = $(cell).text().trim();
      const cellHtml = $(cell).html();
      
      console.log(`\nChapter Cell ${i + 1}:`);
      
      // Check for Japanese characters
      const hasJapanese = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(cellText);
      console.log(`Contains Japanese: ${hasJapanese}`);
      
      // Check for parentheses pattern (might indicate translations)
      const hasParentheses = /\([^)]+\)/.test(cellText);
      console.log(`Contains parentheses: ${hasParentheses}`);
      
      // Look for repeated chapter numbers
      const chapterNumbers = cellText.match(/\d{3}(?=\.)/g) || [];
      const uniqueNumbers = [...new Set(chapterNumbers)];
      console.log(`Chapter numbers found: ${chapterNumbers.length} (${uniqueNumbers.length} unique)`);
      
      if (chapterNumbers.length > uniqueNumbers.length) {
        console.log('⚠️  DUPLICATE CHAPTER NUMBERS DETECTED!');
      }
      
      // Sample content
      console.log('\nFirst 300 chars:');
      console.log(cellText.substring(0, 300) + '...');
    });
  }
}

investigateFairyTailDuplicates().catch(console.error);