import axios from 'axios';
import * as cheerio from 'cheerio';

// Minimal Fire Force parser to test URL extraction
async function testFireForceParser() {
  try {
    console.log('Fetching Fire Force volumes page...');
    const response = await axios.get('https://fire-force.fandom.com/wiki/List_of_Volumes');
    
    console.log('Parsing HTML...');
    const $ = cheerio.load(response.data);
    
    // Look for chapter links
    const chapterLinks = $('a[href*="/wiki/Chapter_"]');
    console.log(`\nFound ${chapterLinks.length} chapter links in the HTML\n`);
    
    // Show first 10 chapter links
    chapterLinks.slice(0, 10).each((i, link) => {
      const href = $(link).attr('href');
      const text = $(link).text().trim();
      console.log(`  ${text}: ${href}`);
    });
    
    // Check for the specific structure Fire Force uses
    console.log('\nChecking Fire Force table structure...');
    
    // Find all small tables with Volume info
    const tables = $('table');
    console.log(`Found ${tables.length} tables total`);
    
    let volumeCount = 0;
    let chapterCount = 0;
    let urlCount = 0;
    
    tables.each((i, table) => {
      const $table = $(table);
      const text = $table.text();
      
      // Check if this is a volume table
      if (text.includes('(Volume')) {
        volumeCount++;
        
        // Look for chapter list in the row
        const rows = $table.find('tr');
        rows.each((j, row) => {
          const $row = $(row);
          const rowText = $row.text();
          
          if (rowText.includes('Chapters')) {
            // Next cell should have the chapter list
            const chapterCell = $row.find('td').eq(1);
            if (chapterCell.length > 0) {
              // Count links in this cell
              const links = chapterCell.find('a[href*="/wiki/Chapter_"]');
              chapterCount += links.length;
              
              links.each((k, link) => {
                const href = $(link).attr('href');
                if (href) urlCount++;
              });
            }
          }
        });
      }
    });
    
    console.log(`\nSummary:`);
    console.log(`  Volume tables found: ${volumeCount}`);
    console.log(`  Chapters found in tables: ${chapterCount}`);
    console.log(`  Chapter URLs extracted: ${urlCount}`);
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

testFireForceParser();