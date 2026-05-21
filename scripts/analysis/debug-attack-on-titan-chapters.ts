import fetch from 'node-fetch';
import * as cheerio from 'cheerio';
import { parseVolumeTables } from '../src/api/metadataProviders/utils/fandomTableParser';

async function debugAOTChapters() {
  console.log('Fetching Attack on Titan page...');
  const response = await fetch('https://attackontitan.fandom.com/wiki/List_of_Attack_on_Titan_chapters');
  const html = await response.text();
  const $ = cheerio.load(html);
  
  console.log('\n=== Debugging Attack on Titan Chapter Extraction ===\n');
  
  // Look at a specific table
  const tables = $('table');
  let foundVolumeTable = false;
  
  tables.each((i, table) => {
    const $table = $(table);
    const tableText = $table.text();
    
    if (tableText.includes('Chapters list:') && tableText.includes('ISBN') && !foundVolumeTable) {
      foundVolumeTable = true;
      console.log(`\nAnalyzing Table ${i} (Volume table):`);
      
      const rows = $table.find('tr');
      console.log(`Total rows: ${rows.length}`);
      
      rows.each((j, row) => {
        const $row = $(row);
        const rowText = $row.text().trim().substring(0, 100);
        console.log(`\nRow ${j}: "${rowText}${rowText.length >= 100 ? '...' : ''}"`);
        
        if (rowText.includes('Chapters list:')) {
          console.log('  -> This is the chapters row!');
          
          const chapterCell = $row.find('td').first();
          console.log('  Cell HTML:', chapterCell.html()?.substring(0, 200));
          
          // Check for links
          const links = chapterCell.find('a');
          console.log(`  Links found: ${links.length}`);
          
          if (links.length > 0) {
            links.each((k, link) => {
              const $link = $(link);
              console.log(`    Link ${k}: "${$link.text()}" -> ${$link.attr('href')}`);
            });
          }
          
          // Check text content
          const cellText = chapterCell.text();
          const lines = cellText.split('\n').filter(l => l.trim());
          console.log(`  Text lines: ${lines.length}`);
          lines.forEach((line, idx) => {
            console.log(`    Line ${idx}: "${line.trim()}"`);
          });
        }
      });
      
      return false; // Stop after first volume table
    }
  });
  
  // Test the parser
  console.log('\n\n=== Testing Parser Output ===');
  const volumes = parseVolumeTables(html);
  
  if (volumes.length > 0) {
    const vol1 = volumes[0];
    console.log(`\nVolume 1: ${vol1.chapters.length} chapters`);
    vol1.chapters.forEach((ch, idx) => {
      console.log(`  ${idx}: [${ch.chapterNumber}] ${ch.title}`);
    });
  }
}

debugAOTChapters().catch(console.error);