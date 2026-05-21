import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

async function debugSpecificParsing() {
  try {
    console.log('Fetching Tokyo Revengers page...');
    const response = await fetch('https://tokyorevengers.fandom.com/wiki/Volumes_%26_Chapters');
    const html = await response.text();
    
    const $ = cheerio.load(html);
    
    console.log('\nChecking if our specific patterns are matching...\n');
    
    let patternsMatched = 0;
    
    $('table').each((i, table) => {
      const tableText = $(table).text();
      
      // Check for Tokyo Revengers specific pattern
      if (tableText.includes('Chapters:') && tableText.includes('ISBN')) {
        console.log(`Table ${i} matches Tokyo Revengers pattern!`);
        patternsMatched++;
        
        // Debug why it's not being parsed
        const firstCell = $(table).find('td').first();
        console.log(`  First cell: "${firstCell.text().trim()}"`);
        
        // Check if parseGenericVolumeTableWithChapters would work
        const rows = $(table).find('tr');
        let volumeNumber: number | null = null;
        
        rows.each((_, row) => {
          const firstRowCell = $(row).find('td').first();
          const cellText = firstRowCell.text().trim();
          const num = parseInt(cellText);
          
          if (!isNaN(num) && num >= 1 && num <= 50) {
            volumeNumber = num;
            console.log(`  Found volume number: ${num}`);
            return false;
          }
        });
        
        if (volumeNumber) {
          console.log('  ✅ This table should be parsed by generic parser!');
        } else {
          console.log('  ❌ Volume number extraction failed');
        }
      }
    });
    
    console.log(`\nTotal tables matching pattern: ${patternsMatched}`);
    
    // Check what's preventing the parsing
    console.log('\nChecking parsing flow:');
    
    // Check if it's being caught by another pattern
    const volumes: any[] = [];
    const processedVolumes = new Set<number>();
    
    $('table').each((i, table) => {
      const tableText = $(table).text();
      
      // Check each pattern in order
      if (/\(Volume\s+\d+\)/i.test(tableText)) {
        console.log(`Table ${i}: Matches Fire Force pattern`);
      } else if (tableText.includes('Chapters list:') && /Volume\s+\d+/i.test(tableText)) {
        console.log(`Table ${i}: Matches Attack on Titan pattern`);
      } else if (tableText.includes('Chapters List:') || (tableText.includes('Chapter') && tableText.includes('ISBN'))) {
        console.log(`Table ${i}: Matches Demon Slayer pattern`);
      } else if ((tableText.includes('Chapters:') || tableText.includes('Chapters list:') || 
                  tableText.includes('Chapter list:') || tableText.includes('Chapter List:')) &&
                 tableText.includes('ISBN')) {
        console.log(`Table ${i}: Matches generic pattern!`);
      }
    });
    
  } catch (error) {
    console.error('Error:', error);
  }
}

debugSpecificParsing();