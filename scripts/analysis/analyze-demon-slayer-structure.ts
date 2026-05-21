import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

async function analyzeDemonSlayerStructure() {
  try {
    console.log('Fetching Demon Slayer chapters page...');
    const response = await fetch('https://kimetsu-no-yaiba.fandom.com/wiki/Chapters_and_Volumes');
    const html = await response.text();
    
    const $ = cheerio.load(html);
    
    console.log('\nAnalyzing page structure...');
    
    // Count basic elements
    console.log(`Total tables: ${$('table').length}`);
    console.log(`Total lists (ul/ol): ${$('ul, ol').length}`);
    
    // Look for volume/chapter patterns in text
    const pageText = $('body').text();
    const volumeMatches = pageText.match(/Volume\s+\d+/gi);
    const chapterMatches = pageText.match(/Chapter\s+\d+/gi);
    
    console.log(`\n"Volume X" occurrences: ${volumeMatches ? volumeMatches.length : 0}`);
    console.log(`"Chapter X" occurrences: ${chapterMatches ? chapterMatches.length : 0}`);
    
    // Check for specific patterns
    console.log('\nChecking for common patterns:');
    
    // Pattern 1: Tables with class "wikitable"
    const wikiTables = $('.wikitable');
    console.log(`\nWikitables found: ${wikiTables.length}`);
    if (wikiTables.length > 0) {
      wikiTables.each((i, table) => {
        if (i >= 3) return; // Only show first 3
        const firstRow = $(table).find('tr').first().text().trim();
        console.log(`  Table ${i}: "${firstRow.substring(0, 100)}..."`);
      });
    }
    
    // Pattern 2: Article tables
    const articleTables = $('.article-table');
    console.log(`\nArticle tables found: ${articleTables.length}`);
    if (articleTables.length > 0) {
      articleTables.each((i, table) => {
        if (i >= 3) return;
        const firstRow = $(table).find('tr').first().text().trim();
        console.log(`  Table ${i}: "${firstRow.substring(0, 100)}..."`);
      });
    }
    
    // Pattern 3: Volume tabs or collapsibles
    const tabbers = $('.tabber, .tabber-content, .mw-collapsible');
    console.log(`\nTab/Collapsible elements: ${tabbers.length}`);
    
    // Look at headers
    console.log('\nHeaders containing "Volume":');
    $('h1, h2, h3, h4').each((i, header) => {
      const text = $(header).text();
      if (/Volume\s+\d+/i.test(text)) {
        console.log(`  ${header.tagName}: "${text}"`);
      }
    });
    
    // Check first table in detail
    const firstTable = $('table').first();
    if (firstTable.length > 0) {
      console.log('\nFirst table structure:');
      const rows = firstTable.find('tr');
      console.log(`  Rows: ${rows.length}`);
      rows.slice(0, 5).each((i, row) => {
        const cells = $(row).find('td, th');
        const text = $(row).text().trim().substring(0, 150);
        console.log(`  Row ${i} (${cells.length} cells): "${text}..."`);
      });
    }
    
    // Look for expandable content
    console.log('\nChecking for expandable/hidden content:');
    const expandables = $('.mw-collapsible-content, .tabbertab, .wikia-tab-content');
    console.log(`  Expandable sections: ${expandables.length}`);
    
  } catch (error) {
    console.error('Error:', error);
  }
}

analyzeDemonSlayerStructure();