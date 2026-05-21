import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

async function investigateJoJoDetailed() {
  console.log("🔍 Detailed Investigation of JoJo's Bizarre Adventure Wiki\n");
  
  const url = "https://jojo.fandom.com/wiki/List_of_JoJo's_Bizarre_Adventure_chapters";
  const response = await fetch(url);
  const html = await response.text();
  const $ = cheerio.load(html);
  
  // Look for ALL headers
  console.log('📋 All Headers on Page:');
  const allHeaders = $('h1, h2, h3, h4');
  allHeaders.each((i, el) => {
    const tag = el.tagName;
    const text = $(el).text().trim();
    if (i < 20) { // Show first 20
      console.log(`${tag}: ${text}`);
    }
  });
  
  console.log(`\nTotal headers: ${allHeaders.length}`);
  
  // Look for tabber content
  console.log('\n📑 Tabber Analysis:');
  const tabberDivs = $('.tabber');
  console.log(`Found ${tabberDivs.length} tabber divs`);
  
  if (tabberDivs.length > 0) {
    tabberDivs.each((i, tabber) => {
      const $tabber = $(tabber);
      
      // Look for tab titles
      const tabTitles = $tabber.find('.tabbernav li a, .wds-tabs__tab');
      console.log(`\nTabber ${i + 1} has ${tabTitles.length} tabs:`);
      
      tabTitles.each((j, title) => {
        console.log(`  - ${$(title).text().trim()}`);
      });
      
      // Look for tab content
      const tabContents = $tabber.find('.tabbertab, .wds-tab__content');
      console.log(`  Tab contents: ${tabContents.length}`);
    });
  }
  
  // Check structure of tables
  console.log('\n📊 Table Structure Analysis:');
  const tables = $('table');
  
  // Group tables by similar structure
  const tableStructures = new Map<string, number>();
  
  tables.slice(0, 10).each((i, table) => {
    const $table = $(table);
    const firstRow = $table.find('tr').first();
    const cells = firstRow.find('th, td');
    
    // Create a signature based on cell count and content
    const cellTexts = cells.map((_, cell) => {
      const text = $(cell).text().trim();
      if (text.includes('Volume')) return 'VOL';
      if (text.includes('Chapter')) return 'CH';
      if (text.includes('Title')) return 'TITLE';
      if (text.includes('Date')) return 'DATE';
      return 'OTHER';
    }).get();
    
    const signature = `${cells.length}:${cellTexts.join('-')}`;
    tableStructures.set(signature, (tableStructures.get(signature) || 0) + 1);
    
    console.log(`\nTable ${i}:`);
    console.log(`- Signature: ${signature}`);
    console.log(`- First row text: ${firstRow.text().trim().substring(0, 100)}...`);
  });
  
  // Check if tables are inside specific containers
  console.log('\n📦 Table Container Analysis:');
  
  // Check parent elements of tables
  const tableParents = new Set<string>();
  tables.each((_, table) => {
    const parent = $(table).parent();
    const parentClass = parent.attr('class') || 'no-class';
    const parentTag = parent.prop('tagName');
    tableParents.add(`${parentTag}.${parentClass}`);
  });
  
  console.log('Unique table parent types:');
  Array.from(tableParents).forEach(parent => {
    console.log(`  - ${parent}`);
  });
  
  // Try to find volume/chapter pattern
  console.log('\n🔍 Looking for Volume/Chapter patterns:');
  
  let sampleTable: cheerio.Cheerio<any> | null = null;
  let sampleIndex = -1;
  
  // Find a table that looks like it contains chapter data
  tables.each((i, table) => {
    const $table = $(table);
    const text = $table.text();
    
    if (text.includes('Chapter') && text.includes('Title') && !sampleTable) {
      sampleTable = $table;
      sampleIndex = i;
    }
  });
  
  if (sampleTable) {
    console.log(`\nFound potential chapter table at index ${sampleIndex}`);
    const rows = sampleTable.find('tr');
    
    console.log(`Total rows: ${rows.length}`);
    console.log('\nFirst 5 rows:');
    
    rows.slice(0, 5).each((i, row) => {
      const cells = $(row).find('td, th');
      const cellTexts = cells.map((_, cell) => $(cell).text().trim().substring(0, 30)).get();
      console.log(`Row ${i}: [${cellTexts.join('] [')}]`);
    });
  }
  
  // Check for specific JoJo part mentions in the page
  console.log('\n🎯 Part mentions in page:');
  const pageText = $.text();
  const partMatches = pageText.match(/Part \d+/gi) || [];
  console.log(`Found ${partMatches.length} mentions of "Part X" in the page`);
  
  // Find unique parts mentioned
  const uniqueParts = new Set(partMatches.map(p => p.toLowerCase()));
  console.log('Unique parts mentioned:', Array.from(uniqueParts).sort());
}

investigateJoJoDetailed().catch(console.error);