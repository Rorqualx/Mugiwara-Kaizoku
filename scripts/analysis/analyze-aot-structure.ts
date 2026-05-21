import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

async function analyzeAoTStructure() {
  try {
    console.log('Fetching Attack on Titan chapters page...');
    const response = await fetch('https://attackontitan.fandom.com/wiki/List_of_Attack_on_Titan_chapters');
    const html = await response.text();
    
    const $ = cheerio.load(html);
    
    console.log('Analyzing page structure...\n');
    
    // Count tables
    console.log(`Total tables: ${$('table').length}`);
    
    // Look for volume headers
    const volumeHeaders = $('h2, h3').filter((_, el) => {
      const text = $(el).text();
      return /Volume\s+\d+/i.test(text);
    });
    console.log(`Volume headers (h2/h3): ${volumeHeaders.length}`);
    
    // Check table contents
    console.log('\nChecking tables for volume information:');
    $('table').each((i, table) => {
      const tableText = $(table).text();
      
      // Check various patterns
      if (tableText.includes('Volume 1') || 
          tableText.includes('To You, 2,000 Years From Now') ||
          tableText.includes('978-4-06-384276-0')) {
        console.log(`\nTable ${i} looks like Volume 1:`);
        console.log(`  Contains "Volume 1": ${tableText.includes('Volume 1')}`);
        console.log(`  Contains chapter titles: ${tableText.includes('To You, 2,000 Years From Now')}`);
        console.log(`  Contains ISBN: ${tableText.includes('978-4-06-384276-0')}`);
        
        // Check table structure
        const rows = $(table).find('tr');
        console.log(`  Rows: ${rows.length}`);
        
        // Look at first few rows
        rows.slice(0, 5).each((j, row) => {
          const cells = $(row).find('td, th');
          const rowText = $(row).text().trim().substring(0, 100);
          console.log(`    Row ${j}: ${cells.length} cells - "${rowText}..."`);
        });
        
        // Check for chapter list structure
        const hasChaptersList = tableText.includes('Chapters list:');
        console.log(`  Has "Chapters list:": ${hasChaptersList}`);
        
        // Look for list elements
        const lists = $(table).find('ul, ol');
        console.log(`  Contains ${lists.length} lists`);
        
        if (lists.length > 0) {
          lists.each((k, list) => {
            const items = $(list).find('li');
            console.log(`    List ${k}: ${items.length} items`);
            items.slice(0, 3).each((l, item) => {
              console.log(`      - "${$(item).text().trim()}"`);
            });
          });
        }
      }
    });
    
    // Check for specific Attack on Titan table class names
    console.log('\nChecking for specific table classes:');
    const tableClasses = new Set<string>();
    $('table').each((_, table) => {
      const classes = $(table).attr('class');
      if (classes) {
        classes.split(' ').forEach(c => tableClasses.add(c));
      }
    });
    console.log('Table classes found:', Array.from(tableClasses).join(', '));
    
  } catch (error) {
    console.error('Error:', error);
  }
}

analyzeAoTStructure();