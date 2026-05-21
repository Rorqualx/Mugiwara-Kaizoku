import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

async function debugChapterCell() {
  try {
    console.log('Fetching Fire Force volumes page...');
    const response = await fetch('https://fire-force.fandom.com/wiki/List_of_Volumes');
    const html = await response.text();
    
    const $ = cheerio.load(html);
    
    // Find first volume table
    $('table').each((i, table) => {
      const tableText = $(table).text();
      if (tableText.includes('(Volume 1)')) {
        console.log(`\nAnalyzing Volume 1 table...`);
        
        // Find the chapters row
        $(table).find('tr').each((j, row) => {
          const rowText = $(row).text();
          if (rowText.includes('Chapters')) {
            console.log(`\nFound chapters row at index ${j}`);
            console.log(`Full row text: "${rowText}"`);
            
            // Analyze each cell
            const cells = $(row).find('td');
            console.log(`\nRow has ${cells.length} cells:`);
            
            cells.each((k, cell) => {
              const cellHtml = $(cell).html();
              const cellText = $(cell).text();
              console.log(`\n--- Cell ${k} ---`);
              console.log(`Text content: "${cellText.substring(0, 200)}..."`);
              console.log(`HTML: "${cellHtml?.substring(0, 200)}..."`);
              
              // Check for line breaks in HTML
              if (cellHtml) {
                const lineBreaks = (cellHtml.match(/<br\s*\/?>/gi) || []).length;
                console.log(`Contains ${lineBreaks} <br> tags`);
              }
            });
          }
        });
        
        return false; // Stop after first volume
      }
    });
    
  } catch (error) {
    console.error('Error:', error);
  }
}

debugChapterCell();