import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

async function investigateDrStone() {
  console.log('🔬 Investigating Dr. Stone Wiki Structure\n');
  
  const response = await fetch('https://dr-stone.fandom.com/wiki/Chapters_and_Volumes');
  const html = await response.text();
  const $ = cheerio.load(html);
  
  console.log('📊 Tabbed Interface Analysis:');
  
  // Look for tabber structure
  const tabbers = $('.tabber');
  console.log(`Found ${tabbers.length} tabber containers`);
  
  // Analyze tabbertabs
  const tabs = $('.tabbertab');
  console.log(`Found ${tabs.length} individual tabs\n`);
  
  if (tabs.length > 0) {
    console.log('🔍 Tab Structure:');
    tabs.slice(0, 5).each((i, tab) => {
      const $tab = $(tab);
      const title = $tab.attr('title') || 'No title';
      const tables = $tab.find('table').length;
      const text = $tab.text().trim();
      
      console.log(`\nTab ${i + 1}: "${title}"`);
      console.log(`  Tables in tab: ${tables}`);
      
      // Check if it's a volume tab
      if (title.includes('Volume')) {
        console.log('  ✓ This is a volume tab');
        
        // Look for chapter information
        const hasChapters = text.includes('Chapter');
        console.log(`  Has chapters: ${hasChapters}`);
        
        // Sample content
        const preview = text.substring(0, 200).replace(/\s+/g, ' ');
        console.log(`  Content preview: "${preview}..."`);
        
        // Look for table structure
        const table = $tab.find('table').first();
        if (table.length > 0) {
          const rows = table.find('tr').length;
          const headers = table.find('tr').first().find('th').map((_, th) => $(th).text().trim()).get();
          
          console.log(`  Table structure:`);
          console.log(`    - Rows: ${rows}`);
          console.log(`    - Headers: ${headers.join(' | ')}`);
          
          // Sample first data row
          const firstDataRow = table.find('tr').eq(1);
          const cells = firstDataRow.find('td');
          console.log(`    - First data row (${cells.length} cells):`);
          cells.each((j, cell) => {
            const cellText = $(cell).text().trim();
            if (cellText.includes('Chapter')) {
              console.log(`      Cell ${j + 1}: Contains chapter list`);
              // Extract chapter numbers
              const chapterMatches = cellText.match(/Chapter\s+\d+/g);
              if (chapterMatches) {
                console.log(`      Found chapters: ${chapterMatches.slice(0, 3).join(', ')}${chapterMatches.length > 3 ? '...' : ''}`);
              }
            } else {
              console.log(`      Cell ${j + 1}: "${cellText.substring(0, 50)}${cellText.length > 50 ? '...' : ''}"`);
            }
          });
        }
      }
    });
  }
  
  // Check the main tables (outside tabs)
  console.log('\n\n📋 Main Tables (outside tabs):');
  const mainTables = $('table').filter((_, table) => {
    // Check if table is not inside a tab
    return $(table).closest('.tabbertab').length === 0;
  });
  
  console.log(`Found ${mainTables.length} tables outside tabs\n`);
  
  mainTables.slice(0, 3).each((i, table) => {
    const $table = $(table);
    const rows = $table.find('tr').length;
    const headers = $table.find('tr').first().find('th').map((_, th) => $(th).text().trim()).get();
    
    console.log(`Table ${i + 1}:`);
    console.log(`  Rows: ${rows}`);
    console.log(`  Headers: ${headers.join(' | ') || 'No headers'}`);
    
    // Check if it's a volume list
    const text = $table.text();
    if (text.includes('Volume') || text.includes('Chapter')) {
      console.log('  ✓ Contains volume/chapter info');
      
      // Check structure
      const firstRow = $table.find('tr').eq(1);
      const cells = firstRow.find('td');
      if (cells.length > 0) {
        console.log(`  First data row:`);
        cells.slice(0, 3).each((j, cell) => {
          const cellText = $(cell).text().trim();
          console.log(`    Cell ${j + 1}: "${cellText.substring(0, 50)}${cellText.length > 50 ? '...' : ''}"`);
        });
      }
    }
  });
  
  // Look for pattern
  console.log('\n\n🎯 Pattern Detection:');
  console.log('Dr. Stone uses a tabbed interface where:');
  console.log('1. Each volume is in a separate tab');
  console.log('2. Tab title contains "Volume X"');
  console.log('3. Inside each tab is a table with volume info');
  console.log('4. Chapters are listed in a cell, often with "Chapters list:" prefix');
  console.log('5. Chapter format: "Chapter X: Title" or just numbers');
  
  // Extract sample data
  console.log('\n📖 Sample Volume Extraction:');
  const volumeTab = tabs.filter((_, tab) => {
    const title = $(tab).attr('title') || '';
    return title.includes('Volume 1') && !title.includes('Volume 10');
  }).first();
  
  if (volumeTab.length > 0) {
    const title = volumeTab.attr('title') || '';
    console.log(`\nExtracting from: "${title}"`);
    
    const table = volumeTab.find('table').first();
    if (table.length > 0) {
      // Look for chapter cell
      table.find('td').each((_, cell) => {
        const cellText = $(cell).text();
        if (cellText.includes('Chapter') || cellText.includes('Chapters list:')) {
          console.log('\nChapter cell found:');
          const chapterText = cellText.replace('Chapters list:', '').trim();
          const lines = chapterText.split('\n').filter(line => line.trim());
          
          console.log(`${lines.length} chapter lines found:`);
          lines.slice(0, 5).forEach(line => {
            console.log(`  - ${line.trim()}`);
          });
        }
      });
    }
  }
}

investigateDrStone().catch(console.error);