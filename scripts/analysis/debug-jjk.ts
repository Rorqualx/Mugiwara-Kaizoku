import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

async function debugJJK() {
  console.log('Debugging Jujutsu Kaisen parser...');
  
  const response = await fetch('https://jujutsukaisen.fandom.com/wiki/Chapters_%26_Volumes');
  const html = await response.text();
  const $ = cheerio.load(html);
  
  const tables = $('table');
  console.log(`\nTotal tables: ${tables.length}`);
  
  // Focus on navigation tables
  tables.each((i, table) => {
    const $table = $(table);
    const className = $table.attr('class') || 'none';
    
    if (className.includes('toccolours') || className.includes('collapsible')) {
      console.log(`\nTable ${i} (Navigation table):`);
      console.log(`  Class: ${className}`);
      
      // Check for volume patterns
      const tableText = $table.text();
      const hasVolumes = /Volume\s+\d+/i.test(tableText);
      const hasChapterNumbers = /\b\d+\s*[•·]\s*\d+\b/.test(tableText) || /\b\d+\s+\d+\s+\d+\b/.test(tableText);
      
      console.log(`  Has volumes: ${hasVolumes}`);
      console.log(`  Has chapter numbers: ${hasChapterNumbers}`);
      
      if (hasVolumes) {
        const volumeMatches = tableText.match(/Volume\s+\d+/gi);
        console.log(`  Volume count: ${volumeMatches?.length || 0}`);
        if (volumeMatches && volumeMatches.length > 0) {
          console.log(`  First volumes: ${volumeMatches.slice(0, 3).join(', ')}`);
        }
      }
    }
  });
}

debugJJK().catch(console.error);