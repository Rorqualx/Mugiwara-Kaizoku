import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

async function checkTable0() {
  try {
    const response = await fetch('https://onepiece.fandom.com/wiki/Chapters_and_Volumes/Volumes');
    const html = await response.text();
    const $ = cheerio.load(html);
    
    console.log('Checking table 0...\\n');
    
    const table0 = $('table').eq(0);
    const tableText = table0.text();
    
    // Check if this has both Chapters and Volume
    console.log('Content checks:');
    console.log(`  Contains "Chapters": ${tableText.includes('Chapters')}`);
    console.log(`  Contains "Volume": ${tableText.includes('Volume')}`);
    console.log(`  Contains "ISBN": ${tableText.includes('ISBN')}`);
    console.log(`  Contains specific volumes: Volume1=${tableText.includes('Volume1')}, Volume11=${tableText.includes('Volume11')}`);
    
    // Check pattern matches
    console.log('\\nPattern checks:');
    const genericCheck = (tableText.includes('Chapters:') || tableText.includes('Chapters list:') || 
                         tableText.includes('Chapter list:') || tableText.includes('Chapter List:')) &&
                        tableText.includes('ISBN');
    console.log(`  Would match generic pattern: ${genericCheck}`);
    
    // Check if it would match arc-based
    const arcBasedCheck = tableText.includes('Arc(Chapters') || (tableText.includes('Chapters') && tableText.includes('Volume'));
    console.log(`  Would match arc-based pattern: ${arcBasedCheck}`);
    
    // If it matches arc-based, what would parseArcBasedTable extract?
    if (arcBasedCheck) {
      console.log('\\nThis table would be processed by parseArcBasedTable');
      console.log('Checking what it might extract...');
      
      // Look for pattern like "Chapters X to Y, Volume Z"
      const arcMatches = tableText.match(/Chapters\s+(\d+)\s+to\s+(\d+),\s*(?:Volume(?:s)?\s+)(.+?)\)/g);
      console.log(`  Arc pattern matches: ${arcMatches ? arcMatches.length : 0}`);
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
}

checkTable0();