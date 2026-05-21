import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

async function debugBlackLagoonChapters() {
  console.log('🔍 Debugging Black Lagoon Chapter Parsing\n');
  
  const url = 'https://lagooncompany.fandom.com/wiki/Chapters_and_Volumes_List';
  const response = await fetch(url);
  const html = await response.text();
  const $ = cheerio.load(html);
  
  // Get a few 4-row tables to analyze chapter format
  const collapsibleTables = $('table.collapsible');
  const fourRowTables = collapsibleTables.filter((_, table) => {
    const rows = $(table).find('tr').length;
    return rows === 4;
  });
  
  // Analyze first few volume tables
  fourRowTables.slice(0, 5).each((i, table) => {
    const $table = $(table);
    const firstRow = $table.find('tr').first();
    const volumeMatch = firstRow.text().match(/Volume\s+(\d+)/i);
    
    if (!volumeMatch) return;
    
    console.log(`\nVolume ${volumeMatch[1]}:`);
    
    // Get the chapters row (3rd row)
    const chaptersRow = $table.find('tr').eq(2);
    const chaptersCell = chaptersRow.find('td').first();
    const chaptersHtml = chaptersCell.html();
    const chaptersText = chaptersCell.text();
    
    console.log('Raw text:', chaptersText.substring(0, 200) + '...');
    console.log('');
    
    // Check if chapters are separated by <br> tags
    if (chaptersHtml && chaptersHtml.includes('<br>')) {
      console.log('Chapters are separated by <br> tags!');
      
      // Split by <br> and parse
      const parts = chaptersHtml.split(/<br\s*\/?>/i);
      console.log(`Found ${parts.length} parts after splitting by <br>`);
      
      parts.slice(0, 3).forEach((part, j) => {
        const cleanPart = part.replace(/<[^>]*>/g, '').trim();
        console.log(`  Part ${j + 1}: "${cleanPart}"`);
      });
    }
    
    // Also check for line breaks in text
    const lines = chaptersText.split('\n').filter(line => line.trim());
    if (lines.length > 1) {
      console.log(`\nText has ${lines.length} lines:`);
      lines.slice(0, 3).forEach((line, j) => {
        console.log(`  Line ${j + 1}: "${line.trim()}"`);
      });
    }
  });
}

debugBlackLagoonChapters().catch(console.error);