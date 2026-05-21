import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

async function checkSingleChapter() {
  console.log('🔍 Checking Kaiju No. 8 Chapter 1 Page Structure\n');
  
  const url = 'https://kaiju-no-8.fandom.com/wiki/Chapter_1';
  const response = await fetch(url);
  const html = await response.text();
  const $ = cheerio.load(html);
  
  // Check page title
  const pageTitle = $('h1.page-header__title, h1').first().text().trim();
  console.log(`Page Title: "${pageTitle}"\n`);
  
  // Check infobox
  const infobox = $('.portable-infobox');
  console.log(`Has Infobox: ${infobox.length > 0}`);
  
  if (infobox.length > 0) {
    console.log('\nInfobox Contents:');
    
    // Get all data rows
    const dataRows = infobox.find('.pi-item');
    dataRows.each((_, row) => {
      const $row = $(row);
      const label = $row.find('.pi-data-label').text().trim();
      const value = $row.find('.pi-data-value').text().trim();
      
      if (label && value) {
        console.log(`  ${label}: "${value}"`);
      }
    });
    
    // Check for image
    const image = infobox.find('.pi-image img').first();
    if (image.length > 0) {
      console.log(`\nCover Image: ${image.attr('src')?.substring(0, 50)}...`);
    }
  }
  
  // Check for any title patterns in the content
  console.log('\n\nSearching for title patterns in content:');
  
  // Look for chapter title in various places
  const possibleTitleElements = [
    '.pi-title',
    '.pi-header',
    'h2:not(:contains("Contents")):not(:contains("Navigation"))',
    'h3:not(:contains("Contents")):not(:contains("Navigation"))'
  ];
  
  possibleTitleElements.forEach(selector => {
    const elements = $(selector);
    if (elements.length > 0) {
      console.log(`\n${selector}:`);
      elements.slice(0, 3).each((_, el) => {
        console.log(`  "${$(el).text().trim()}"`);
      });
    }
  });
  
  // Check if the Story Arcs page has better info
  console.log('\n\n📄 Checking Story Arcs page for comparison:\n');
  
  const arcsUrl = 'https://kaiju-no-8.fandom.com/wiki/Story_Arcs';
  const arcsResponse = await fetch(arcsUrl);
  const arcsHtml = await arcsResponse.text();
  const $arcs = cheerio.load(arcsHtml);
  
  // Look for chapter 1 specifically
  const chapter1Links = $arcs('a').filter((_, el) => {
    const text = $arcs(el).text();
    const href = $arcs(el).attr('href') || '';
    return text.includes('Chapter 1') && href.includes('/Chapter_1');
  });
  
  console.log(`Found ${chapter1Links.length} references to Chapter 1`);
  
  if (chapter1Links.length > 0) {
    chapter1Links.each((i, link) => {
      const $link = $arcs(link);
      const parent = $link.parent();
      const grandparent = parent.parent();
      
      console.log(`\nReference ${i + 1}:`);
      console.log(`  Link text: "${$link.text().trim()}"`);
      console.log(`  Parent element: ${parent.prop('tagName')}`);
      console.log(`  Parent text: "${parent.text().trim().substring(0, 100)}..."`);
      
      // Check if there's additional context
      const listItem = $link.closest('li');
      if (listItem.length > 0) {
        const fullText = listItem.text().trim();
        console.log(`  Full list item: "${fullText.substring(0, 150)}..."`);
      }
    });
  }
}

checkSingleChapter().catch(console.error);