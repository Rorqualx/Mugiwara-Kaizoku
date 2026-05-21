import * as cheerio from 'cheerio';
import fetch from 'node-fetch';

// Copy the detection function
function detectWikitableVolumes($: cheerio.CheerioAPI, table: cheerio.Cheerio<any>): boolean {
  const tableClass = table.attr('class') || '';
  const headers = table.find('th');
  let hasVolumeHeader = false;
  let hasReleaseHeader = false;
  
  headers.each((_, header) => {
    const headerText = $(header).text().toLowerCase();
    if (headerText.includes('volume')) hasVolumeHeader = true;
    if (headerText.includes('release')) hasReleaseHeader = true;
  });
  
  const isWikitable = tableClass.includes('wikitable') || tableClass.includes('volumes');
  const hasChapterLists = table.find('ul, ol').length > 0;
  
  // Also check for Hunter x Hunter style (chapters in text, not lists)
  const hasTextChapters = table.text().match(/\d{3}\.\s+\w+/);
  
  return (isWikitable || (hasVolumeHeader && hasReleaseHeader)) && (hasChapterLists || hasTextChapters);
}

async function debugFlow() {
  const response = await fetch('https://hunterxhunter.fandom.com/wiki/List_of_Volumes_and_Chapters');
  const html = await response.text();
  const $ = cheerio.load(html);
  
  console.log('=== Debug Parser Flow ===\n');
  
  const tables = $('table');
  console.log(`Total tables found: ${tables.length}`);
  
  tables.each((i, table) => {
    const $table = $(table);
    console.log(`\nTable ${i}:`);
    
    const detected = detectWikitableVolumes($, $table);
    console.log(`  Detection result: ${detected}`);
    
    if (detected) {
      console.log('  ✅ This table would be processed by parseWikitableVolumes');
      
      // Show first few rows
      const rows = $table.find('tr');
      console.log(`  Total rows: ${rows.length}`);
      
      rows.slice(0, 10).each((j, row) => {
        const $row = $(row);
        const cells = $row.find('td');
        if (cells.length > 0) {
          console.log(`    Row ${j}: ${cells.length} cells`);
          const firstCell = cells.eq(0).text().trim().substring(0, 50);
          console.log(`      First cell: "${firstCell}${firstCell.length >= 50 ? '...' : ''}"`);
        }
      });
    }
  });
}

debugFlow().catch(console.error);