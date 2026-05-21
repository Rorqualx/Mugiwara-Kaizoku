import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

async function analyzeTokyoGhoul() {
  console.log('🔍 Analyzing Tokyo Ghoul Wiki Structure\n');
  
  const url = 'https://tokyoghoul.fandom.com/wiki/Chapters';
  const response = await fetch(url);
  const html = await response.text();
  const $ = cheerio.load(html);
  
  console.log('📊 Page Analysis:\n');
  
  // Check for tables
  const allTables = $('table');
  console.log(`Total tables found: ${allTables.length}`);
  
  // Analyze table structures
  allTables.each((i, table) => {
    const $table = $(table);
    const rows = $table.find('tr');
    const classes = $table.attr('class') || 'no-class';
    
    console.log(`\nTable ${i + 1}:`);
    console.log(`  Classes: ${classes}`);
    console.log(`  Rows: ${rows.length}`);
    
    if (rows.length > 0) {
      const firstRow = rows.first();
      const cells = firstRow.find('th, td');
      console.log(`  First row cells: ${cells.length}`);
      console.log(`  First row text: "${firstRow.text().trim().substring(0, 100)}..."`);
      
      // Check if it's a volume table
      const tableText = $table.text();
      if (tableText.includes('Volume') || tableText.includes('Chapter')) {
        console.log(`  ✓ Contains volume/chapter information`);
        
        // Show structure of first few data rows
        rows.slice(1, 4).each((j, row) => {
          const $row = $(row);
          const cells = $row.find('td');
          console.log(`  Row ${j + 2}: ${cells.length} cells`);
          if (cells.length > 0) {
            console.log(`    Cell 1: "${cells.eq(0).text().trim().substring(0, 50)}..."`);
          }
        });
      }
    }
  });
  
  // Check for tabber/tabs
  console.log('\n📑 Tab System Analysis:\n');
  
  const tabbers = $('.tabber, .tabbertab, .tabs-container, article-tabs');
  console.log(`Tabber elements: ${tabbers.length}`);
  
  // Check for WikiaArticleTabs
  const articleTabs = $('.WikiaArticleTabs, .article-tabs');
  console.log(`Article tabs: ${articleTabs.length}`);
  
  if (articleTabs.length > 0) {
    const tabs = articleTabs.find('li');
    console.log(`\nTabs found: ${tabs.length}`);
    tabs.each((i, tab) => {
      const $tab = $(tab);
      const text = $tab.text().trim();
      const link = $tab.find('a').attr('href');
      console.log(`  Tab ${i + 1}: "${text}" -> ${link}`);
    });
  }
  
  // Look for volume sections
  console.log('\n📚 Volume Sections:\n');
  
  const volumeHeaders = $('h2, h3, .mw-headline').filter((_, el) => {
    const text = $(el).text();
    return /Volume \d+/.test(text);
  });
  
  console.log(`Volume headers found: ${volumeHeaders.length}`);
  volumeHeaders.slice(0, 5).each((i, header) => {
    console.log(`  ${i + 1}. "${$(header).text().trim()}"`);
  });
  
  // Check for collapsible sections
  const collapsibles = $('.mw-collapsible, .collapsible');
  console.log(`\nCollapsible sections: ${collapsibles.length}`);
  
  // Look for chapter lists in different formats
  console.log('\n📝 Chapter List Formats:\n');
  
  // Format 1: Lists within volume sections
  const chapterLists = $('ul, ol').filter((_, list) => {
    const text = $(list).text();
    return /Chapter \d+/.test(text);
  });
  
  console.log(`Chapter lists found: ${chapterLists.length}`);
  
  if (chapterLists.length > 0) {
    const firstList = chapterLists.first();
    const items = firstList.find('li');
    console.log(`\nFirst chapter list (${items.length} items):`);
    items.slice(0, 3).each((i, item) => {
      console.log(`  ${i + 1}. "${$(item).text().trim().substring(0, 80)}..."`);
    });
  }
  
  // Check for specific Tokyo Ghoul patterns
  console.log('\n🔍 Tokyo Ghoul Specific Patterns:\n');
  
  // Check if volumes are in separate sections
  const volumeSections = $('.mw-parser-output > h2').filter((_, h2) => {
    return /Volume \d+/.test($(h2).text());
  });
  
  console.log(`Volume sections as H2: ${volumeSections.length}`);
  
  if (volumeSections.length > 0) {
    console.log('\nAnalyzing first volume section:');
    const firstVolume = volumeSections.first();
    let $current = firstVolume.next();
    let elementCount = 0;
    
    while ($current.length && !$current.is('h2') && elementCount < 5) {
      console.log(`  Element ${elementCount + 1}: ${$current.prop('tagName')}`);
      if ($current.is('ul, ol')) {
        console.log(`    List with ${$current.find('li').length} items`);
      }
      $current = $current.next();
      elementCount++;
    }
  }
}

analyzeTokyoGhoul().catch(console.error);