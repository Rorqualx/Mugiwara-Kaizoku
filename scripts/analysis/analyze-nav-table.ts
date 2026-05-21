import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

async function analyzeNavTable() {
  console.log('🔍 Analyzing Navigation Table on OPM Page\n');
  
  const url = 'https://onepunchman.fandom.com/wiki/Volumes';
  const response = await fetch(url);
  const html = await response.text();
  const $ = cheerio.load(html);
  
  // Find the large table
  const tables = $('table');
  const largeTable = tables.filter((_, table) => $(table).find('tr').length > 20).first();
  
  if (largeTable.length > 0) {
    console.log('Found large table with', largeTable.find('tr').length, 'rows\n');
    
    // Check classes and attributes
    console.log('Table classes:', largeTable.attr('class') || 'none');
    console.log('Table style:', largeTable.attr('style') || 'none');
    
    // Check for navigation indicators
    const tableHtml = largeTable.html() || '';
    const tableText = largeTable.text();
    
    console.log('\nNavigation indicators:');
    console.log('- Contains "v • e":', tableText.includes('v • e'));
    console.log('- Contains "v•e":', tableText.includes('v•e'));
    console.log('- Has class "navbox":', largeTable.hasClass('navbox'));
    console.log('- Has class "toccolours":', largeTable.hasClass('toccolours'));
    console.log('- Has class "collapsible":', largeTable.hasClass('collapsible'));
    console.log('- Has class "navigation":', largeTable.hasClass('navigation'));
    
    // Check first row
    const firstRow = largeTable.find('tr').first();
    console.log('\nFirst row text:', firstRow.text().trim().substring(0, 100));
    
    // Check if it's a navigation template
    const isNavTemplate = tableHtml.includes('template') || 
                         tableHtml.includes('navbox') ||
                         tableText.includes('v • e') ||
                         tableText.includes('v•e');
    
    console.log('\nIs navigation template:', isNavTemplate);
    
    // Check structure
    console.log('\nTable structure:');
    const firstFiveRows = largeTable.find('tr').slice(0, 5);
    firstFiveRows.each((i, row) => {
      const cells = $(row).find('td, th');
      console.log(`Row ${i + 1}: ${cells.length} cells, colspan:`, 
                  cells.first().attr('colspan') || 'none',
                  'Text preview:', $(row).text().trim().substring(0, 50) + '...');
    });
  } else {
    console.log('No large table found!');
  }
}

analyzeNavTable().catch(console.error);