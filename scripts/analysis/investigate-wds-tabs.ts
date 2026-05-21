import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

async function investigateWDSTabs() {
  console.log('🔍 Investigating WDS (Wikia Design System) Tabs\n');
  
  const url = 'https://dr-stone.fandom.com/wiki/Chapters_and_Volumes';
  const response = await fetch(url);
  const html = await response.text();
  const $ = cheerio.load(html);
  
  // Look for WDS tab structure
  console.log('📋 WDS Tab Structure Analysis:\n');
  
  // Find WDS tab wrappers
  const wdsTabWrappers = $('.wds-tabs__wrapper');
  console.log(`Found ${wdsTabWrappers.length} WDS tab wrappers`);
  
  if (wdsTabWrappers.length > 0) {
    wdsTabWrappers.each((i, wrapper) => {
      if (i >= 3) return; // Only analyze first 3
      
      console.log(`\nWrapper ${i + 1}:`);
      const $wrapper = $(wrapper);
      
      // Find tab navigation
      const tabList = $wrapper.find('.wds-tabs__tab');
      console.log(`  Tabs: ${tabList.length}`);
      
      tabList.each((j, tab) => {
        const tabText = $(tab).find('.wds-tabs__tab-label').text().trim();
        console.log(`    - ${tabText}`);
      });
      
      // Find tab content
      const tabContent = $wrapper.find('.wds-tab__content');
      console.log(`  Tab contents: ${tabContent.length}`);
      
      // Analyze content of each tab
      tabContent.each((j, content) => {
        const $content = $(content);
        const tables = $content.find('table');
        const isActive = $content.hasClass('wds-is-current');
        
        console.log(`\n  Tab ${j + 1} (${isActive ? 'active' : 'hidden'}):`);
        console.log(`    - Tables: ${tables.length}`);
        
        if (tables.length > 0) {
          const firstTable = tables.first();
          const rows = firstTable.find('tr');
          console.log(`    - First table rows: ${rows.length}`);
          
          // Check table content
          const text = firstTable.text();
          const hasVolume = text.includes('Volume');
          const hasChapter = text.includes('Chapter');
          console.log(`    - Has Volume info: ${hasVolume}`);
          console.log(`    - Has Chapter info: ${hasChapter}`);
          
          // Sample first row
          if (rows.length > 0) {
            const firstRow = rows.first();
            const cells = firstRow.find('td, th');
            console.log(`    - First row cells: ${cells.length}`);
            const cellTexts = cells.map((_, cell) => $(cell).text().trim().substring(0, 20)).get();
            console.log(`    - Cell content: [${cellTexts.join('] [')}]`);
          }
        }
      });
    });
  }
  
  // Try alternative structure - nested divs
  console.log('\n\n🔍 Checking nested structure:');
  
  // Look for the actual content area
  const contentArea = $('.mw-parser-output');
  const allTables = contentArea.find('table');
  console.log(`Total tables in content: ${allTables.length}`);
  
  // Check if tables are inside specific divs
  const tabDivs = contentArea.find('div[class*="wds-tab"]');
  console.log(`Divs with tab classes: ${tabDivs.length}`);
  
  // Look for data attributes that might indicate tabs
  const elementsWithTabData = $('[data-tab], [data-wds-tab]');
  console.log(`Elements with tab data attributes: ${elementsWithTabData.length}`);
  
  // Extract all visible content
  console.log('\n📊 Extracting all visible content:');
  
  let volumeCount = 0;
  let chapterCount = 0;
  
  allTables.each((i, table) => {
    const $table = $(table);
    const text = $table.text();
    
    if (text.includes('Volume') && text.includes('Chapter')) {
      volumeCount++;
      const rows = $table.find('tr').length - 1; // Minus header
      chapterCount += rows;
    }
  });
  
  console.log(`\nVisible content summary:`);
  console.log(`- Volume tables found: ${volumeCount}`);
  console.log(`- Estimated chapters: ${chapterCount}`);
  
  // Check if content is dynamically loaded
  console.log('\n🔄 Checking for dynamic content indicators:');
  
  const scripts = $('script').filter((_, script) => {
    const text = $(script).html() || '';
    return text.includes('tab') || text.includes('Tab');
  });
  
  console.log(`Scripts with tab references: ${scripts.length}`);
  
  // Look for JSON data that might contain tab content
  const dataElements = $('[data-portable-infobox], [data-source]');
  console.log(`Data elements: ${dataElements.length}`);
}

investigateWDSTabs().catch(console.error);