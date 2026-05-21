import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

// Copy the exact parseAttackOnTitanStyleTable function
function parseAttackOnTitanStyleTable($: cheerio.CheerioAPI, table: cheerio.Cheerio<any>): any[] {
  const rows = table.find('tr');
  if (rows.length < 4) return [];
  
  // Volume info is in row 2 (0-indexed)
  const volumeRow = rows.eq(2);
  const volumeCells = volumeRow.find('td');
  if (volumeCells.length < 3) return [];
  
  const volumeNumberText = volumeCells.eq(0).text().trim();
  const volumeNumber = parseInt(volumeNumberText, 10);
  if (isNaN(volumeNumber)) return [];
  
  console.log(`\nParsing volume ${volumeNumber}`);
  
  // Chapter list is in row 3
  const chapterRow = rows.eq(3);
  const chapterCells = chapterRow.find('td');
  if (chapterCells.length === 0) return [];
  
  const volumeInfo: any = {
    volumeNumber,
    title: `Volume ${volumeNumber}`,
    chapters: []
  };
  
  // Parse chapters from the chapter cell
  const chapterCell = chapterCells.first();
  console.log(`Chapter cell length: ${chapterCell.length}`);
  console.log(`Chapter cell HTML preview: ${chapterCell.html()?.substring(0, 100)}...`);
  
  // Look for ordered list with start attribute
  const orderedList = chapterCell.find('ol');
  console.log(`Ordered list found: ${orderedList.length > 0}`);
  
  if (orderedList.length > 0) {
    console.log('Using ordered list parsing');
    // Get the start number from the list
    const startNum = parseInt(orderedList.attr('start') || '1', 10);
    console.log(`Start number: ${startNum}`);
    
    // Get list items
    const listItems = orderedList.find('li');
    console.log(`List items: ${listItems.length}`);
    
    listItems.each((index, li) => {
      const $li = $(li);
      const link = $li.find('a').first();
      const title = link.length > 0 ? link.text().trim() : $li.text().trim();
      
      if (title) {
        const chapterNumber = (startNum + index).toString().padStart(3, '0');
        console.log(`  Adding chapter ${chapterNumber}: ${title}`);
        volumeInfo.chapters.push({
          chapterNumber,
          title,
          volumeNumber
        });
      }
    });
  } else {
    console.log('Using text parsing fallback');
    // ... rest of the fallback code
  }
  
  console.log(`Total chapters parsed: ${volumeInfo.chapters.length}`);
  return volumeInfo.chapters.length > 0 ? [volumeInfo] : [];
}

async function traceAOTParsing() {
  const response = await fetch('https://attackontitan.fandom.com/wiki/List_of_Attack_on_Titan_chapters');
  const html = await response.text();
  const $ = cheerio.load(html);
  
  console.log('=== Tracing Attack on Titan Parsing ===');
  
  // Find first AOT style table
  const tables = $('table');
  let found = false;
  
  tables.each((i, table) => {
    const $table = $(table);
    const tableText = $table.text();
    const rows = $table.find('tr');
    
    if (!found && tableText.includes('Chapters list:') && rows.length >= 3 && rows.length < 10) {
      const volumeRow = rows.eq(2).text();
      if (/^\d+/.test(volumeRow.trim())) {
        found = true;
        console.log(`\nFound AOT table at index ${i}`);
        
        // Parse it
        const result = parseAttackOnTitanStyleTable($, $table);
        console.log(`\nResult:`, result);
      }
    }
  });
}

traceAOTParsing().catch(console.error);