import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

async function debugOPMChapters() {
  console.log('🔍 Finding OPM Chapter Information\n');
  
  const url = 'https://onepunchman.fandom.com/wiki/Volumes';
  const response = await fetch(url);
  const html = await response.text();
  const $ = cheerio.load(html);
  
  // Look at a specific volume section
  const volume1Header = $('h3').filter((_, h3) => $(h3).text().includes('Volume 1'));
  
  if (volume1Header.length > 0) {
    console.log('📚 Volume 1 Section Analysis:\n');
    
    let $current = volume1Header.first();
    let elementCount = 0;
    
    console.log('Elements after Volume 1 header:');
    
    // Look at next 10 elements or until we hit another h3
    while (elementCount < 10) {
      $current = $current.next();
      if (!$current.length || $current.is('h3')) break;
      
      const tagName = $current.prop('tagName');
      const text = $current.text().trim();
      
      console.log(`${elementCount + 1}. <${tagName}>:`);
      
      if (tagName === 'TABLE') {
        // Analyze table in detail
        const rows = $current.find('tr');
        console.log(`   Table with ${rows.length} rows`);
        
        // Check last row which might have chapters
        const lastRow = rows.last();
        const lastRowCells = lastRow.find('td');
        
        console.log(`   Last row has ${lastRowCells.length} cells`);
        
        lastRowCells.each((i, cell) => {
          const cellText = $(cell).text().trim();
          console.log(`   Cell ${i + 1}: "${cellText.substring(0, 100)}${cellText.length > 100 ? '...' : ''}"`);
          
          // Check if cell contains chapter info
          if (cellText.includes('Punch') || cellText.includes('Chapter')) {
            console.log(`     ✓ Contains chapter information!`);
            
            // Try different parsing approaches
            // Approach 1: Bullet points
            const bullets = $(cell).find('li');
            if (bullets.length > 0) {
              console.log(`     Found ${bullets.length} bullet points`);
              bullets.slice(0, 2).each((j, li) => {
                console.log(`       - "${$(li).text().trim()}"`);
              });
            }
            
            // Approach 2: Line breaks
            const htmlContent = $(cell).html();
            if (htmlContent && htmlContent.includes('<br')) {
              console.log(`     Contains <br> tags for line breaks`);
              const lines = cellText.split(/\n/).filter(line => line.trim());
              console.log(`     ${lines.length} lines found`);
              lines.slice(0, 2).forEach((line, j) => {
                console.log(`       Line ${j + 1}: "${line.trim()}"`);
              });
            }
          }
        });
      } else {
        console.log(`   Text: "${text.substring(0, 100)}${text.length > 100 ? '...' : ''}"`);
      }
      
      elementCount++;
    }
  }
  
  // Try a different approach - look for all text containing "Punch X:"
  console.log('\n\n🔍 Global search for Punch chapters:\n');
  
  const allText = $('body').text();
  const punchMatches = [...allText.matchAll(/Punch (\d+):\s*([^\n]+)/g)];
  
  console.log(`Total "Punch X:" patterns found: ${punchMatches.length}`);
  
  if (punchMatches.length > 0) {
    console.log('\nFirst 5 matches:');
    punchMatches.slice(0, 5).forEach((match, i) => {
      console.log(`${i + 1}. Punch ${match[1]}: "${match[2].trim().substring(0, 50)}..."`);
    });
  }
}

debugOPMChapters().catch(console.error);