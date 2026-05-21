import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

async function analyzeOnePieceStructure() {
  try {
    console.log('Fetching One Piece chapters page...');
    const response = await fetch('https://onepiece.fandom.com/wiki/Chapters_and_Volumes');
    const html = await response.text();
    
    const $ = cheerio.load(html);
    
    console.log('\nAnalyzing One Piece page structure...');
    
    // Basic counts
    console.log(`Total tables: ${$('table').length}`);
    console.log(`Total divs: ${$('div').length}`);
    
    // Look for specific One Piece patterns
    console.log('\nChecking for volume containers:');
    
    // Pattern 1: Divs with volume information
    const volumeDivs = $('div').filter((_, div) => {
      const text = $(div).text();
      return /Volume\s+\d+/i.test(text) && text.includes('Chapter');
    });
    console.log(`Divs containing "Volume X" and "Chapter": ${volumeDivs.length}`);
    
    // Pattern 2: Collapsible headers
    const collapsibles = $('.mw-collapsible-toggle');
    console.log(`Collapsible toggles: ${collapsibles.length}`);
    
    // Pattern 3: Look for chapter lists in different formats
    console.log('\nLooking for chapter patterns:');
    
    // Check for lists inside tables
    const tablesWithLists = $('table').filter((_, table) => {
      return $(table).find('ul, ol').length > 0;
    });
    console.log(`Tables containing lists: ${tablesWithLists.length}`);
    
    // Look at a specific volume section
    console.log('\nExamining first volume section:');
    const firstVolume = $('h3').filter((_, h) => $(h).text().includes('Volume 1')).first();
    if (firstVolume.length > 0) {
      console.log(`Found Volume 1 header: "${firstVolume.text()}"`);
      
      // Look at the next element after the header
      let nextElement = firstVolume.next();
      let elementCount = 0;
      while (nextElement.length && elementCount < 5) {
        const tagName = nextElement.prop('tagName');
        const text = nextElement.text().trim().substring(0, 100);
        console.log(`  Next element (${tagName}): "${text}..."`);
        
        // Check if it's a table
        if (tagName === 'TABLE') {
          const rows = nextElement.find('tr');
          console.log(`    Table has ${rows.length} rows`);
          
          // Check for chapter list
          const hasChapterList = nextElement.text().includes('Chapter');
          console.log(`    Contains "Chapter": ${hasChapterList}`);
        }
        
        nextElement = nextElement.next();
        elementCount++;
      }
    }
    
    // Check for arc-based organization
    console.log('\nChecking for arc-based structure:');
    const arcHeaders = $('h2, h3').filter((_, h) => {
      const text = $(h).text();
      return text.includes('Arc') || text.includes('Saga');
    });
    console.log(`Headers with "Arc" or "Saga": ${arcHeaders.length}`);
    if (arcHeaders.length > 0) {
      arcHeaders.slice(0, 3).each((i, h) => {
        console.log(`  ${h.tagName}: "${$(h).text()}"`);
      });
    }
    
    // Check for tabber structure
    console.log('\nChecking for tabber structure:');
    const tabbers = $('.tabber');
    console.log(`Tabber elements: ${tabbers.length}`);
    
    // Look at actual chapter content structure
    console.log('\nLooking for chapter content:');
    $('table').slice(0, 3).each((i, table) => {
      const tableText = $(table).text();
      if (tableText.includes('Chapter') || tableText.includes('Volume')) {
        console.log(`\nTable ${i}:`);
        const rows = $(table).find('tr').slice(0, 3);
        rows.each((j, row) => {
          const text = $(row).text().trim().substring(0, 150);
          console.log(`  Row ${j}: "${text}..."`);
        });
      }
    });
    
  } catch (error) {
    console.error('Error:', error);
  }
}

analyzeOnePieceStructure();