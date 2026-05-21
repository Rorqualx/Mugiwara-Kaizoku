import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

async function checkAoTChapterNumbers() {
  try {
    console.log('Fetching Attack on Titan chapters page...');
    const response = await fetch('https://attackontitan.fandom.com/wiki/List_of_Attack_on_Titan_chapters');
    const html = await response.text();
    
    const $ = cheerio.load(html);
    
    // Look for chapter links or text that might contain chapter numbers
    console.log('Looking for chapter links with numbers...\n');
    
    $('a').each((i, link) => {
      const href = $(link).attr('href') || '';
      const text = $(link).text();
      
      // Look for links that might be chapter links
      if (href.includes('/Chapter_') || text.match(/^Chapter\s+\d+/i)) {
        console.log(`Found: "${text}" -> ${href}`);
        
        // Extract chapter number
        const chapterMatch = href.match(/Chapter_(\d+)/i) || text.match(/Chapter\s+(\d+)/i);
        if (chapterMatch) {
          console.log(`  Chapter number: ${chapterMatch[1]}`);
        }
        
        if (i > 10) return false; // Just show first few
      }
    });
    
    // Check if chapters in tables have links
    console.log('\n\nChecking chapter titles in first volume table...');
    const firstVolumeTable = $('table').filter((_, table) => {
      return $(table).text().includes('To You, 2,000 Years From Now');
    }).first();
    
    if (firstVolumeTable.length > 0) {
      const chapterList = firstVolumeTable.find('li');
      chapterList.each((i, li) => {
        const link = $(li).find('a').first();
        if (link.length > 0) {
          const href = link.attr('href') || '';
          const text = link.text();
          console.log(`Chapter ${i + 1}: "${text}"`);
          console.log(`  Link: ${href}`);
          
          // Try to extract chapter number from URL
          const chapterMatch = href.match(/Chapter[_\s]+(\d+)/i);
          if (chapterMatch) {
            console.log(`  Extracted number: ${chapterMatch[1]}`);
          }
        } else {
          console.log(`Chapter ${i + 1}: "${$(li).text().trim()}" (no link)`);
        }
      });
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
}

checkAoTChapterNumbers();