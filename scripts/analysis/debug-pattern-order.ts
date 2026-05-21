import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

async function debugPatternOrder() {
  try {
    const response = await fetch('https://onepiece.fandom.com/wiki/Chapters_and_Volumes/Volumes');
    const html = await response.text();
    const $ = cheerio.load(html);
    
    console.log('Checking pattern matching order...\\n');
    
    // Find Volume 1 table
    $('table').each((i, table) => {
      const firstCell = $(table).find('tr').first().find('td').first();
      if (firstCell.text().trim() === 'Volume 1') {
        const tableText = $(table).text();
        
        console.log('Volume 1 table analysis:');
        console.log(`Table index: ${i}`);
        
        // Check each pattern in order
        console.log('\\nPattern checks:');
        console.log(`1. Fire Force (Volume X): ${/\\(Volume\\s+\\d+\\)/i.test(tableText)}`);
        console.log(`2. Attack on Titan: ${tableText.includes('Chapters list:') && /Volume\\s+\\d+/i.test(tableText)}`);
        console.log(`3. Demon Slayer: ${tableText.includes('Chapters List:')}`);
        
        const genericCheck = (tableText.includes('Chapters:') || tableText.includes('Chapters list:') || 
                             tableText.includes('Chapter list:') || tableText.includes('Chapter List:')) &&
                            tableText.includes('ISBN');
        console.log(`4. Generic: ${genericCheck}`);
        console.log(`   - Has 'Chapters:': ${tableText.includes('Chapters:')}`);
        console.log(`   - Has 'Chapters list:': ${tableText.includes('Chapters list:')}`);
        console.log(`   - Has 'Chapter list:': ${tableText.includes('Chapter list:')}`);
        console.log(`   - Has 'Chapter List:': ${tableText.includes('Chapter List:')}`);
        console.log(`   - Has 'ISBN': ${tableText.includes('ISBN')}`);
        
        console.log(`5. One Piece style: ${/^Volume\s+\d+$/.test(firstCell.text().trim())}`);
        console.log(`   First cell text: "${firstCell.text().trim()}"`);
        
        console.log('\\nWhich pattern would match FIRST:');
        if (/\(Volume\s+\d+\)/i.test(tableText)) {
          console.log('  -> Fire Force style');
        } else if (tableText.includes('Chapters list:') && /Volume\s+\d+/i.test(tableText)) {
          console.log('  -> Attack on Titan style');
        } else if (tableText.includes('Chapters List:')) {
          console.log('  -> Demon Slayer style');
        } else if (genericCheck) {
          console.log('  -> Generic style (PROBLEM! This comes before One Piece check)');
        } else {
          console.log('  -> Would reach One Piece style check');
        }
        
        return false;
      }
    });
    
  } catch (error) {
    console.error('Error:', error);
  }
}

debugPatternOrder();