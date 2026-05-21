import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

async function investigateTabbedPattern() {
  console.log('🔍 Investigating Tabbed Interface Pattern\n');
  
  // Test with Dr. Stone as example
  const testCases = [
    { name: 'Dr. Stone', url: 'https://dr-stone.fandom.com/wiki/Chapters_and_Volumes' },
    { name: 'Fullmetal Alchemist', url: 'https://fma.fandom.com/wiki/Chapters_and_Volumes' }
  ];
  
  for (const test of testCases) {
    console.log(`\n📖 Analyzing ${test.name}...`);
    console.log(`URL: ${test.url}\n`);
    
    const response = await fetch(test.url);
    const html = await response.text();
    const $ = cheerio.load(html);
    
    // Look for tabber elements
    const tabbers = $('.tabber');
    console.log(`Found ${tabbers.length} tabber elements`);
    
    if (tabbers.length > 0) {
      tabbers.each((i, tabber) => {
        console.log(`\nTabber ${i + 1}:`);
        
        // Check for tab navigation
        const tabNav = $(tabber).find('.tabbernav');
        const tabs = tabNav.find('li a');
        
        console.log(`  Tabs found: ${tabs.length}`);
        tabs.each((j, tab) => {
          console.log(`    - ${$(tab).text().trim()}`);
        });
        
        // Check tab content structure
        const tabContents = $(tabber).find('.tabbertab');
        console.log(`  Tab contents: ${tabContents.length}`);
        
        // Analyze first tab content
        if (tabContents.length > 0) {
          const firstTab = tabContents.first();
          const tables = firstTab.find('table');
          
          console.log(`\n  First tab analysis:`);
          console.log(`    - Tables: ${tables.length}`);
          
          if (tables.length > 0) {
            const firstTable = tables.first();
            const rows = firstTable.find('tr').length;
            console.log(`    - First table rows: ${rows}`);
            
            // Sample content
            const sampleRows = firstTable.find('tr').slice(0, 3);
            console.log(`    - Sample content:`);
            sampleRows.each((k, row) => {
              const cells = $(row).find('td, th');
              const cellTexts = cells.map((_, cell) => $(cell).text().trim().substring(0, 30)).get();
              console.log(`      Row ${k}: [${cellTexts.join('] [')}]`);
            });
          }
        }
      });
    }
    
    // Alternative tab implementations
    console.log('\n🔍 Checking alternative tab implementations:');
    
    // MediaWiki tabs
    const mwTabs = $('.mw-tabs, .tabs');
    console.log(`- MediaWiki tabs: ${mwTabs.length}`);
    
    // WDS (Wikia Design System) tabs
    const wdsTabs = $('.wds-tabs__wrapper');
    console.log(`- WDS tabs: ${wdsTabs.length}`);
    
    // Article tabs
    const articleTabs = $('.article-tabs, .page-tabs');
    console.log(`- Article tabs: ${articleTabs.length}`);
    
    // Check if content is in divs with specific IDs/classes
    console.log('\n📦 Checking for content divisions:');
    
    // Look for volume-specific divs
    const volumeDivs = $('div[id*="Volume"], div[class*="volume"]').filter((_, div) => {
      return $(div).find('table').length > 0;
    });
    console.log(`- Volume divs with tables: ${volumeDivs.length}`);
    
    // Look for hidden content
    const hiddenContent = $('.tabbertab:not(:first-child), .tab-content:not(.active)');
    console.log(`- Hidden tab content: ${hiddenContent.length}`);
    
    // Try to extract volumes from all tabs
    console.log('\n🎯 Attempting to extract data from all tabs:');
    
    if (tabbers.length > 0) {
      const allTabs = tabbers.find('.tabbertab');
      let totalVolumes = 0;
      let totalChapters = 0;
      
      allTabs.each((i, tab) => {
        const $tab = $(tab);
        const tables = $tab.find('table');
        
        tables.each((_, table) => {
          const text = $(table).text();
          if (text.includes('Volume') && text.includes('Chapter')) {
            const rows = $(table).find('tr').length;
            totalVolumes++;
            totalChapters += rows - 1; // Minus header row
          }
        });
      });
      
      console.log(`  Total volumes found across all tabs: ${totalVolumes}`);
      console.log(`  Estimated total chapters: ${totalChapters}`);
    }
  }
}

investigateTabbedPattern().catch(console.error);