import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

async function debugTokyoRevengersStructure() {
  try {
    console.log('Fetching Tokyo Revengers chapters page...');
    const response = await fetch('https://tokyorevengers.fandom.com/wiki/Volumes_%26_Chapters');
    const html = await response.text();
    
    const $ = cheerio.load(html);
    
    console.log('\nAnalyzing page structure...');
    
    // Count basic elements
    console.log(`Total tables: ${$('table').length}`);
    console.log(`Total divs: ${$('div').length}`);
    
    // Look for volume patterns
    console.log('\nChecking for volume patterns:');
    const pageText = $('body').text();
    const volumeMatches = pageText.match(/Volume\s+\d+/gi);
    console.log(`"Volume X" occurrences: ${volumeMatches ? volumeMatches.length : 0}`);
    
    // Check tables
    console.log('\nChecking tables:');
    $('table').each((i, table) => {
      const tableText = $(table).text();
      
      // Check if this table might have volume data
      if (tableText.includes('ISBN') || tableText.includes('Chapter') || tableText.includes('Release date')) {
        console.log(`\n=== Table ${i} ===`);
        const rows = $(table).find('tr');
        console.log(`Rows: ${rows.length}`);
        
        // Show first few rows
        rows.slice(0, 5).each((j, row) => {
          const cells = $(row).find('td, th');
          const rowText = $(row).text().trim().substring(0, 150);
          console.log(`Row ${j} (${cells.length} cells): "${rowText}${rowText.length > 150 ? '...' : ''}"`);
        });
        
        // Check for volume number in first cell
        const firstCell = $(table).find('td').first();
        const firstCellText = firstCell.text().trim();
        console.log(`First cell: "${firstCellText}"`);
        
        // Check if contains chapters
        if (tableText.includes('Chapters:')) {
          console.log('Contains "Chapters:" - extracting chapter list');
          const chapterRow = rows.filter((_, row) => $(row).text().includes('Chapters:')).first();
          if (chapterRow.length > 0) {
            const chapterText = chapterRow.text();
            console.log('Chapter row preview:', chapterText.substring(0, 200) + '...');
          }
        }
      }
    });
    
    // Look for collapsible or hidden content
    console.log('\n\nChecking for expandable content:');
    const expandables = $('.mw-collapsible, .wikia-tab-content, .tabber');
    console.log(`Expandable elements: ${expandables.length}`);
    
  } catch (error) {
    console.error('Error:', error);
  }
}

debugTokyoRevengersStructure();