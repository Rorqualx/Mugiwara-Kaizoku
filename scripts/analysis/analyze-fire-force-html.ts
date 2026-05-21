import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

async function analyzeFireForceHTML() {
  try {
    console.log('Fetching Fire Force volumes page...');
    const response = await fetch('https://fire-force.fandom.com/wiki/List_of_Volumes');
    const html = await response.text();
    
    const $ = cheerio.load(html);
    
    console.log('Analyzing HTML structure...\n');
    
    // Look for all tables
    console.log(`Found ${$('table').length} tables total`);
    
    // Check for Fire Force style tables
    $('table').each((i, table) => {
      const tableText = $(table).text();
      if (tableText.includes('(Volume')) {
        console.log(`\nTable ${i + 1} contains volume information`);
        
        // Look for rows
        const rows = $(table).find('tr');
        console.log(`  Has ${rows.length} rows`);
        
        // Analyze row structure
        rows.each((j, row) => {
          if (j < 10) { // First 10 rows only
            const cells = $(row).find('td');
            const rowText = $(row).text().trim().substring(0, 100);
            console.log(`  Row ${j}: ${cells.length} cells - "${rowText}..."`);
            
            // Check if this row contains chapters
            if (rowText.includes('Chapters') || /\d{2,}\.\s+\w+/.test(rowText)) {
              console.log('    ^ This row contains chapter information!');
              
              // Log each cell separately
              cells.each((k, cell) => {
                const cellText = $(cell).text().trim().substring(0, 200);
                console.log(`      Cell ${k}: "${cellText}"`);
              });
            }
          }
        });
        
        return false; // Only analyze first volume table
      }
    });
    
  } catch (error) {
    console.error('Error analyzing HTML:', error);
  }
}

analyzeFireForceHTML();