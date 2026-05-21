import axios from 'axios';
import * as cheerio from 'cheerio';

async function analyzeStructure() {
  try {
    console.log('Fetching Fire Force volumes page...');
    const response = await axios.get('https://fire-force.fandom.com/wiki/List_of_Volumes');
    
    const $ = cheerio.load(response.data);
    
    // Let's find where the chapter links actually are
    console.log('\nAnalyzing chapter link locations...\n');
    
    // Get first few chapter links and trace their parent structure
    const firstChapterLink = $('a[href="/wiki/Chapter_0"]').first();
    
    if (firstChapterLink.length > 0) {
      console.log('Found Chapter 0 link. Tracing parent structure:');
      
      let current = firstChapterLink;
      let level = 0;
      
      while (current.length > 0 && level < 10) {
        const tagName = current.prop('tagName');
        const classes = current.attr('class') || 'no-class';
        const id = current.attr('id') || 'no-id';
        
        console.log(`${'  '.repeat(level)}${tagName} (class: ${classes}, id: ${id})`);
        
        // If this is a list item, show its content
        if (tagName === 'LI') {
          const text = current.text().trim().substring(0, 100);
          console.log(`${'  '.repeat(level)}  Content: ${text}`);
        }
        
        // If this is a TD, show which table it belongs to
        if (tagName === 'TD') {
          const table = current.closest('table');
          const tableText = table.find('tr').first().text().trim().substring(0, 100);
          console.log(`${'  '.repeat(level)}  Table first row: ${tableText}`);
        }
        
        current = current.parent();
        level++;
      }
    }
    
    // Look for the pattern of how chapters are organized
    console.log('\n\nLooking for chapter lists pattern...\n');
    
    // Find all UL/OL elements that contain chapter links
    const listsWithChapters = $('ul, ol').filter((i, list) => {
      return $(list).find('a[href*="/wiki/Chapter_"]').length > 0;
    });
    
    console.log(`Found ${listsWithChapters.length} lists containing chapter links`);
    
    // Analyze first list
    if (listsWithChapters.length > 0) {
      const firstList = listsWithChapters.first();
      const chapterLinks = firstList.find('a[href*="/wiki/Chapter_"]');
      
      console.log(`\nFirst list has ${chapterLinks.length} chapter links`);
      
      // Check what's before this list (probably volume info)
      const prevElement = firstList.prev();
      if (prevElement.length > 0) {
        console.log(`Previous element: ${prevElement.prop('tagName')}`);
        console.log(`Previous element text: ${prevElement.text().trim().substring(0, 100)}`);
      }
      
      // Check parent structure
      const parent = firstList.parent();
      console.log(`Parent element: ${parent.prop('tagName')}`);
      
      // Is it inside a table cell?
      const td = firstList.closest('td');
      if (td.length > 0) {
        console.log('List IS inside a table cell!');
        
        // Which row and table?
        const tr = td.closest('tr');
        const table = tr.closest('table');
        const rowIndex = table.find('tr').index(tr);
        console.log(`  Row index: ${rowIndex}`);
        console.log(`  Row text: ${tr.text().trim().substring(0, 100)}`);
      } else {
        console.log('List is NOT inside a table cell');
      }
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

analyzeStructure();